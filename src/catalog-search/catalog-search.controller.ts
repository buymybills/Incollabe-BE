import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ResolveProductUrlDto {
  @ApiProperty({ description: 'Direct product page URL from a partner brand', example: 'https://www.snitch.co.in/products/cargo-pants' })
  @IsUrl()
  url: string;
}
import { CatalogSearchService } from './catalog-search.service';
import { CatalogSearchRequestDto } from './dto/catalog-search.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Catalog Search')
@Public()
@Controller('catalog-search')
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

  @Post('resolve-product-url')
  @ApiOperation({
    summary: 'Validate a product URL and fetch its details',
    description:
      'Pass a product page URL. Returns product details if the URL belongs to a partner brand. ' +
      'Throws 400 if the domain is not in our partner brand list (e.g. myntra.com, amazon.in).',
  })
  @ApiBody({ type: ResolveProductUrlDto })
  @ApiResponse({
    status: 200,
    description: 'Product details fetched successfully',
    schema: {
      example: {
        brand: 'Snitch',
        productName: 'Cargo Pants',
        productThumbnailUrl: 'https://cdn.snitch.co.in/products/cargo.jpg',
        priceInr: 1299,
        category: 'Pants',
        originalUrl: 'https://www.snitch.co.in/products/cargo-pants',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '"myntra.com" is not a partner brand. Only products from our partner brands can be tagged.',
  })
  async resolveProductUrl(@Body() dto: ResolveProductUrlDto) {
    return this.catalogSearchService.resolveProductUrl(dto.url);
  }
}
