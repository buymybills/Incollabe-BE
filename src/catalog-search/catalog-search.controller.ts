import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    description: 'Matching products sorted by relevance',
    schema: {
      example: {
        query: 'oversized tee white',
        total: 2,
        results: [
          {
            brand: 'Snitch',
            title: 'Oversized White Graphic Tee',
            category: 'T-Shirts',
            image: 'https://cdn.snitch.co.in/products/tee-white.jpg',
            url: 'https://www.snitch.co.in/products/oversized-white-tee',
            priceInr: 799,
            score: 3,
          },
          {
            brand: 'Wrogn',
            title: 'Classic White Oversized Tee',
            category: 'T-Shirts',
            image: 'https://cdn.wrogn.com/products/white-tee.jpg',
            url: 'https://www.wrogn.com/products/white-oversized-tee',
            priceInr: 999,
            score: 2,
          },
        ],
      },
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'All supported brand names and their gender coverage',
    schema: {
      example: [
        { name: 'Snitch', gender: 'men', type: 'fashion' },
        { name: 'Blissclub', gender: 'women', type: 'activewear' },
        { name: 'Mokobara', gender: 'unisex', type: 'accessories' },
      ],
    },
  })
  listBrands() {
    return this.catalogSearchService.listBrands();
  }
}
