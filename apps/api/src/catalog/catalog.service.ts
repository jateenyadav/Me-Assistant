import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CatalogExercise, CatalogFood } from "@lifeos/shared";

type Nutrient = { nutrientId?: number; nutrientName?: string; unitName?: string; value?: number };
type FdcFood = { fdcId?: number; description?: string; foodNutrients?: Nutrient[] };
type OffProduct = { code?: string; product_name?: string; nutriments?: Record<string, unknown> };

@Injectable()
export class CatalogService {
  private exerciseCache: { expiresAt: number; entries: CatalogExercise[] } | null = null;
  private exerciseInFlight: Promise<CatalogExercise[]> | null = null;

  constructor(private readonly config: ConfigService) {}

  async searchExercises(query: string): Promise<CatalogExercise[]> {
    const entries = await this.exercises();
    const term = query.toLowerCase();
    return entries.filter((entry) => entry.name.toLowerCase().includes(term)).slice(0, 30);
  }

  private async exercises(): Promise<CatalogExercise[]> {
    if (this.exerciseCache && this.exerciseCache.expiresAt > Date.now()) return this.exerciseCache.entries;
    if (this.exerciseInFlight) return this.exerciseInFlight;
    this.exerciseInFlight = this.loadExercises();
    try {
      const entries = await this.exerciseInFlight;
      this.exerciseCache = { entries, expiresAt: Date.now() + 60 * 60 * 1000 };
      return entries;
    } finally { this.exerciseInFlight = null; }
  }

  private async loadExercises(): Promise<CatalogExercise[]> {
    const entries: CatalogExercise[] = [];
    for (let offset = 0; offset < 1_500; offset += 100) {
      const url = new URL("https://wger.de/api/v2/exerciseinfo/");
      url.searchParams.set("limit", "100");
      url.searchParams.set("offset", String(offset));
      const response = await this.read(url);
      if (!this.object(response) || !Array.isArray(response.results) || typeof response.count !== "number" || response.count > 1_500) {
        throw new ServiceUnavailableException("Unexpected exercise catalog response");
      }
      for (const raw of response.results) {
        if (!this.object(raw) || typeof raw.id !== "number" || !Array.isArray(raw.translations)) continue;
        const translation = raw.translations.find((item: unknown) => this.object(item) && item.language === 2 && typeof item.name === "string");
        if (!this.object(translation) || typeof translation.name !== "string" || !translation.name.trim()) continue;
        const category = this.object(raw.category) && typeof raw.category.name === "string" ? raw.category.name : "Exercise";
        const equipment = Array.isArray(raw.equipment) ? raw.equipment.flatMap((item: unknown) =>
          this.object(item) && typeof item.name === "string" ? [item.name] : []) : [];
        entries.push({ id: raw.id, name: translation.name, category, equipment });
      }
      if (offset + response.results.length >= response.count) return entries;
      if (response.results.length === 0) throw new ServiceUnavailableException("Incomplete exercise catalog");
    }
    throw new ServiceUnavailableException("Exercise catalog exceeds supported page limit");
  }

  async searchFoods(query: string): Promise<CatalogFood[]> {
    const key = this.config.get<string>("USDA_API_KEY");
    if (!key) throw new ServiceUnavailableException("Food search needs a server-side USDA_API_KEY");
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", key);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", "20");
    const body = await this.read(url);
    if (!this.object(body) || !Array.isArray(body.foods)) throw new ServiceUnavailableException("Unexpected USDA response");
    return (body.foods as unknown[]).flatMap((food) => {
      if (!this.object(food) || typeof food.fdcId !== "number" || typeof food.description !== "string") return [];
      const source = food as FdcFood;
      const nutrient = (id: number, unit: string) => {
        const found = source.foodNutrients?.find((item) => item.nutrientId === id && item.unitName?.toUpperCase() === unit);
        return this.nonnegative(found?.value);
      };
      const energy = source.foodNutrients?.find((item) => item.nutrientName?.startsWith("Energy") && item.unitName?.toUpperCase() === "KCAL");
      return [{
        id: String(food.fdcId), name: food.description, source: "usda" as const,
        per100g: {
          calories: this.nonnegative(energy?.value), proteinGrams: nutrient(1003, "G"),
          carbohydratesGrams: nutrient(1005, "G"), fatGrams: nutrient(1004, "G"),
        },
      }];
    });
  }

  async barcode(barcode: string): Promise<CatalogFood | null> {
    const contact = this.config.get<string>("OPEN_FOOD_FACTS_CONTACT");
    if (!contact) throw new ServiceUnavailableException("Barcode lookup needs OPEN_FOOD_FACTS_CONTACT");
    const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${barcode}`);
    url.searchParams.set("fields", "code,product_name,nutriments");
    const body = await this.read(url, { "User-Agent": `LifeOS/0.1 (${contact})` });
    if (!this.object(body) || body.status === 0) return null;
    if (!this.object(body.product) || typeof body.product.product_name !== "string") return null;
    const product = body.product as OffProduct;
    const nutrients = product.nutriments ?? {};
    return {
      id: barcode, name: product.product_name!, source: "open_food_facts",
      per100g: {
        calories: this.nonnegative(nutrients["energy-kcal_100g"]),
        proteinGrams: this.nonnegative(nutrients.proteins_100g),
        carbohydratesGrams: this.nonnegative(nutrients.carbohydrates_100g),
        fatGrams: this.nonnegative(nutrients.fat_100g),
      },
    };
  }

  validateQuery(value: unknown): string {
    if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 80) {
      throw new BadRequestException("Search text must be 2–80 characters");
    }
    return value.trim();
  }

  validateBarcode(value: string): string {
    if (!/^\d{8,14}$/.test(value)) throw new BadRequestException("Invalid barcode");
    return value;
  }

  private async read(url: URL, headers: Record<string, string> = {}): Promise<unknown> {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`Provider status ${response.status}`);
      return await response.json();
    } catch {
      throw new ServiceUnavailableException("Catalog provider is temporarily unavailable");
    }
  }

  private object(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private nonnegative(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000 ? value : null;
  }
}
