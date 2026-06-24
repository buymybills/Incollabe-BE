import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FeedService } from './feed.service';

@ApiTags('Feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('hype')
  @ApiOperation({ summary: 'Public HYPE reel feed (no auth required)' })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'subcategoryId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHypeFeed(
    @Query('categoryId') categoryId?: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getHypeFeed({
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      subcategoryId: subcategoryId ? parseInt(subcategoryId) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('hype/:postId')
  @ApiOperation({ summary: 'Single HYPE reel detail with attached products' })
  async getHypeReelDetail(@Param('postId', ParseIntPipe) postId: number) {
    const result = await this.feedService.getHypeReelDetail(postId);
    if (!result) throw new NotFoundException('HYPE reel not found');
    return result;
  }

  @Get('top-creators')
  @ApiOperation({ summary: 'Top creators by HYPE reels count' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopCreators(@Query('limit') limit?: string) {
    return this.feedService.getTopCreators(limit ? parseInt(limit) : 10);
  }
}
