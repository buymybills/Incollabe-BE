import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HypeStoreService } from './hype-store.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestWithUser } from '../shared/interfaces/request-with-user.interface';
import {
  CreateHypeStoreDto,
  UpdateHypeStoreDto,
  HypeStoreResponseDto,
} from './dto/hype-store.dto';

@ApiTags('Hype Store')
@Controller('hype-stores')
export class HypeStoreController {
  constructor(private readonly hypeStoreService: HypeStoreService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create Hype Store (Brands only)',
    description:
      'Create a new Hype Store for your brand.\n\n' +
      '**Requirements:**\n' +
      '- Must be a brand user\n' +
      '- Can only have one store per brand\n' +
      '- Store will be inactive until admin verifies\n\n' +
      '**Auto-generated:**\n' +
      '- Store slug (URL-friendly name)\n' +
      '- Initial statistics (0 orders, revenue, etc.)',
  })
  @ApiResponse({
    status: 201,
    description: 'Store created successfully',
    type: HypeStoreResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Brand already has a store',
  })
  @ApiResponse({
    status: 403,
    description: 'Only brands can create stores',
  })
  async createStore(
    @Req() req: RequestWithUser,
    @Body() dto: CreateHypeStoreDto,
  ) {
    // Only brands can create stores
    if (req.user.userType !== 'brand') {
      throw new Error('Only brands can create stores');
    }

    return this.hypeStoreService.createStore(req.user.id, dto);
  }

  @Get('my-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my store (Brands only)',
    description: 'Get the Hype Store for the authenticated brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Store retrieved successfully',
    type: HypeStoreResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Store not found',
  })
  async getMyStore(@Req() req: RequestWithUser) {
    // Only brands have stores
    if (req.user.userType !== 'brand') {
      throw new Error('Only brands have stores');
    }

    return this.hypeStoreService.getStoreByBrandId(req.user.id);
  }

  @Put('my-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update my store (Brands only)',
    description:
      'Update Hype Store details.\n\n' +
      '**Note:** If you update the store name, the slug will be automatically regenerated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Store updated successfully',
    type: HypeStoreResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Store not found',
  })
  async updateMyStore(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateHypeStoreDto,
  ) {
    if (req.user.userType !== 'brand') {
      throw new Error('Only brands can update stores');
    }

    return this.hypeStoreService.updateStore(req.user.id, dto);
  }

  @Delete('my-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete my store (Brands only)',
    description: 'Permanently delete your Hype Store',
  })
  @ApiResponse({
    status: 200,
    description: 'Store deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Store not found',
  })
  async deleteMyStore(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'brand') {
      throw new Error('Only brands can delete stores');
    }

    return this.hypeStoreService.deleteStore(req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all verified Hype Stores (Public)',
    description:
      'Get paginated list of all active and verified Hype Stores.\n\n' +
      '**This is a public endpoint** - no authentication required.\n\n' +
      'Shows only stores that are:\n' +
      '- Active (isActive = true)\n' +
      '- Verified by admin (isVerified = true)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Stores retrieved successfully',
  })
  async getAllStores(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.hypeStoreService.getAllStores(page, limit);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get store by slug (Public)',
    description:
      'Get store details by URL-friendly slug.\n\n' +
      'Example: `/hype-stores/slug/nike-official-store`\n\n' +
      '**Public endpoint** - no authentication required.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Store slug',
    example: 'nike-official-store',
  })
  @ApiResponse({
    status: 200,
    description: 'Store retrieved successfully',
    type: HypeStoreResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Store not found',
  })
  async getStoreBySlug(@Param('slug') slug: string) {
    return this.hypeStoreService.getStoreBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get store by ID (Public)',
    description: 'Get store details by store ID.\n\n**Public endpoint** - no authentication required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Store retrieved successfully',
    type: HypeStoreResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Store not found',
  })
  async getStoreById(@Param('id', ParseIntPipe) id: number) {
    return this.hypeStoreService.getStoreById(id);
  }
}
