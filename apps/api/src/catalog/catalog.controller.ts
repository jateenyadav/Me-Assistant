import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("foods")
  async searchFoods(@Query("q") query: unknown) {
    return { foods: await this.catalog.searchFoods(this.catalog.validateQuery(query)) };
  }

  @Get("exercises")
  async searchExercises(@Query("q") query: unknown) {
    return { exercises: await this.catalog.searchExercises(this.catalog.validateQuery(query)) };
  }

  @Get("barcode/:barcode")
  async barcode(@Param("barcode") raw: string) {
    return { food: await this.catalog.barcode(this.catalog.validateBarcode(raw)) };
  }
}
