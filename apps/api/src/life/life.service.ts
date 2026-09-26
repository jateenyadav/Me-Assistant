import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { lifeSchemas, type LifeKind, type LifePayload } from "@lifeos/shared";
import { LifeRecord, LifeRecordDocument, toPublicLifeEntry } from "./life.schema";
import { Transaction, TransactionDocument } from "../transactions/schemas/transaction.schema";

@Injectable()
export class LifeService {
  constructor(
    @InjectModel(LifeRecord.name) private readonly records: Model<LifeRecordDocument>,
    @InjectModel(Transaction.name) private readonly transactions: Model<TransactionDocument>,
  ) {}

  parseKind(value: string): LifeKind {
    if (!Object.hasOwn(lifeSchemas, value)) throw new BadRequestException("Unknown life record type");
    return value as LifeKind;
  }

  parsePayload(kind: LifeKind, value: unknown): LifePayload {
    const result = lifeSchemas[kind].safeParse(value);
    if (!result.success) throw new BadRequestException({
      message: "Invalid record", errors: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return result.data;
  }

  async list(userId: string, kind: LifeKind) {
    const records = await this.records.find({ userId: new Types.ObjectId(userId), kind })
      .sort({ occurredAt: -1, _id: -1 }).limit(100).exec();
    return records.map(toPublicLifeEntry);
  }

  async foodSummary(userId: string) {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    type Amount = { toString(): string };
    const rows = await this.records.aggregate<{
      count: number; calories: Amount; proteinGrams: Amount;
      carbohydratesGrams: Amount; fatGrams: Amount;
    }>([
      { $match: { userId: new Types.ObjectId(userId), kind: "food", occurredAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, count: { $sum: 1 },
        calories: { $sum: { $toDecimal: "$payload.calories" } },
        proteinGrams: { $sum: { $toDecimal: "$payload.proteinGrams" } },
        carbohydratesGrams: { $sum: { $toDecimal: "$payload.carbohydratesGrams" } },
        fatGrams: { $sum: { $toDecimal: "$payload.fatGrams" } },
      } },
    ]).exec();
    const row = rows[0];
    const measure = (value: Amount | undefined) => {
      const number = Number(value?.toString() ?? "0");
      if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number * 100))) {
        throw new InternalServerErrorException("Food summary exceeds supported range");
      }
      return Math.round(number * 100) / 100;
    };
    return { from: from.toISOString(), to: to.toISOString(), count: row?.count ?? 0,
      calories: measure(row?.calories), proteinGrams: measure(row?.proteinGrams),
      carbohydratesGrams: measure(row?.carbohydratesGrams), fatGrams: measure(row?.fatGrams) };
  }

  async workoutStats(userId: string) {
    const rows = await this.records.aggregate<{
      _id: string; sets: number; heaviestKg: number; volumeKg: { toString(): string };
    }>([
      { $match: { userId: new Types.ObjectId(userId), kind: "workout", occurredAt: { $lte: new Date() } } },
      { $unwind: "$payload.exercises" },
      { $unwind: "$payload.exercises.sets" },
      { $group: { _id: "$payload.exercises.name", sets: { $sum: 1 },
        heaviestKg: { $max: { $ifNull: ["$payload.exercises.sets.weightKg", 0] } },
        volumeKg: { $sum: { $multiply: [
          { $toDecimal: { $ifNull: ["$payload.exercises.sets.reps", 0] } },
          { $toDecimal: { $ifNull: ["$payload.exercises.sets.weightKg", 0] } },
        ] } },
      } },
      { $sort: { volumeKg: -1 } },
      { $limit: 30 },
    ]).exec();
    return rows.map((row) => {
      const volumeKg = Number(row.volumeKg.toString());
      if (!Number.isFinite(volumeKg) || !Number.isSafeInteger(Math.round(volumeKg * 100))) {
        throw new InternalServerErrorException("Workout volume exceeds supported range");
      }
      return { exercise: row._id, sets: row.sets, heaviestKg: row.heaviestKg,
        volumeKg: Math.round(volumeKg * 100) / 100 };
    });
  }

  async goalProgress(userId: string) {
    const owner = new Types.ObjectId(userId);
    const goals = await this.records.find({ userId: owner, kind: "goal" }).sort({ occurredAt: -1 }).limit(100).exec();
    return Promise.all(goals.map(async (goal) => {
      const payload = goal.payload as { domain: string; target: number; unit: string };
      const since = goal.createdAt;
      let current: number | null = null;
      if (payload.domain === "workout" && payload.unit === "sessions") {
        current = await this.records.countDocuments({ userId: owner, kind: "workout", occurredAt: { $gte: since } }).exec();
      } else if (payload.domain === "medication" && payload.unit === "doses") {
        current = await this.records.countDocuments({ userId: owner, kind: "medication-intake", occurredAt: { $gte: since }, "payload.outcome": "taken" }).exec();
      } else if (payload.domain === "diet" && payload.unit === "kcal") {
        const totals = await this.records.aggregate<{ amount: { toString(): string } }>([
          { $match: { userId: owner, kind: "food", occurredAt: { $gte: since } } },
          { $group: { _id: null, amount: { $sum: { $toDecimal: "$payload.calories" } } } },
        ]).exec();
        current = totals.length ? Number(totals[0].amount.toString()) : 0;
      } else if (payload.domain === "finance" && payload.unit === "INR") {
        const totals = await this.transactions.aggregate<{ _id: "expense" | "income"; amount: { toString(): string } }>([
          { $match: { userId: owner, category: { $exists: true }, occurredAt: { $gte: since, $lte: new Date() } } },
          { $group: { _id: "$type", amount: { $sum: { $toDecimal: "$amountMinor" } } } },
        ]).exec();
        let balanceMinor = 0;
        for (const total of totals) {
          const raw = total.amount.toString();
          const minor = /^\d+$/.test(raw) ? Number(raw) : NaN;
          if (!Number.isSafeInteger(minor) || (total._id !== "expense" && total._id !== "income")) {
            throw new InternalServerErrorException("Finance goal total exceeds supported range");
          }
          balanceMinor += total._id === "income" ? minor : -minor;
        }
        if (!Number.isSafeInteger(balanceMinor)) throw new InternalServerErrorException("Finance goal total exceeds supported range");
        current = balanceMinor / 100;
      }
      if (current !== null && !Number.isFinite(current)) current = null;
      return { goalId: goal._id.toString(), domain: payload.domain, target: payload.target,
        unit: payload.unit, current, status: current === null ? "unsupported" as const : "measured" as const };
    }));
  }

  async create(userId: string, kind: LifeKind, body: unknown) {
    const payload = this.parsePayload(kind, body);
    await this.checkMedicationOwner(userId, kind, payload);
    const record = await this.records.create({
      userId: new Types.ObjectId(userId), kind, payload,
      occurredAt: this.occurrence(kind, payload),
    });
    return toPublicLifeEntry(record);
  }

  async replace(userId: string, kind: LifeKind, id: string, body: unknown) {
    const recordId = this.recordId(id);
    const payload = this.parsePayload(kind, body);
    await this.checkMedicationOwner(userId, kind, payload);
    const record = await this.records.findOneAndUpdate(
      { _id: recordId, userId: new Types.ObjectId(userId), kind },
      { $set: { payload, occurredAt: this.occurrence(kind, payload) } },
      { returnDocument: "after", runValidators: true },
    ).exec();
    if (!record) throw new NotFoundException("Record not found");
    return toPublicLifeEntry(record);
  }

  async remove(userId: string, kind: LifeKind, id: string) {
    const recordId = this.recordId(id);
    if (kind === "medication" && await this.records.exists({
      userId: new Types.ObjectId(userId), kind: "medication-intake", "payload.medicationId": id,
    })) throw new ConflictException("Medication has intake history; keep the schedule for your records");
    const result = await this.records.deleteOne({ _id: recordId, userId: new Types.ObjectId(userId), kind }).exec();
    if (!result.deletedCount) throw new NotFoundException("Record not found");
  }

  private recordId(id: string): Types.ObjectId {
    if (!/^[a-f0-9]{24}$/.test(id)) throw new BadRequestException("Invalid record ID");
    return new Types.ObjectId(id);
  }

  private occurrence(kind: LifeKind, payload: LifePayload): Date {
    if (kind === "food" || kind === "workout" || kind === "medication-intake") {
      return new Date((payload as { loggedAt: string }).loggedAt);
    }
    if (kind === "reminder") return new Date((payload as { dueAt: string }).dueAt);
    return new Date();
  }

  private async checkMedicationOwner(userId: string, kind: LifeKind, payload: LifePayload) {
    if (kind !== "medication-intake") return;
    const medicationId = (payload as { medicationId: string }).medicationId;
    const exists = await this.records.exists({
      _id: new Types.ObjectId(medicationId), userId: new Types.ObjectId(userId), kind: "medication",
    });
    if (!exists) throw new NotFoundException("Medication not found");
  }
}
