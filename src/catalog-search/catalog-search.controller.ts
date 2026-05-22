import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogSearchService } from './catalog-search.service';
import { CatalogSearchRequestDto } from './dto/catalog-search.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Catalog Search')
@ApiBearerAuth()
@Controller('catalog-search')
@UseGuards(AuthGuard)
export class CatalogSearchController {
  constructor(private readonly catalogSearchService: CatalogSearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search products across 23 Indian D2C brand catalogs' })
  @ApiResponse({ status: 200, description: 'Matching products sorted by relevance' })
  async search(@Query() dto: CatalogSearchRequestDto) {
    const results = await this.catalogSearchService.search(dto.q, {
      gender: dto.gender,
      category: dto.category,
      limitPerBrand: dto.limitPerBrand ?? 5,
    });
    return { query: dto.q, total: results.length, results };
  }

  @Get('brands')
  @ApiOperation({ summary: 'List all available brands' })
  listBrands() {
    return this.catalogSearchService.listBrands();
  }
}
