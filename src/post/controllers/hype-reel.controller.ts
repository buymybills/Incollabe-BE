import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { HypeReelService } from '../services/hype-reel.service';
import { CreateHypeReelDto } from '../dto/create-hype-reel.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('HYPE Reels')
@Controller()
export class HypeReelController {
  constructor(private readonly hypeReelService: HypeReelService) {}

  // ── Public ─────────────────────────────────────────────────────────────────

  @Get('posts/hype-reels')
  @ApiOperation({ summary: 'Public paginated HYPE reel feed' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHypeReels(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hypeReelService.getInfluencerHypeReels(0, page ? +page : 1, limit ? +limit : 20);
  }

  @Get('posts/hype-reels/:postId/products')
  @ApiOperation({ summary: "Products attached to a HYPE reel ('Shop Whole Look')" })
  getProducts(@Param('postId', ParseIntPipe) postId: number) {
    return this.hypeReelService.getHypeReelProducts(postId);
  }

  @Post('posts/:id/get-affiliate-links')
  @ApiOperation({ summary: 'Get affiliate links for a reel' })
  getAffiliateLinks(@Param('id', ParseIntPipe) id: number) {
    return this.hypeReelService.getAffiliateLinks(id);
  }

  // ── Influencer (authenticated) ──────────────────────────────────────────────

  @Post('posts/hype-reel')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Create a HYPE reel post with products',
    description:
      'Supports two upload modes:\n\n' +
      '1. **File upload** (`multipart/form-data`): Upload video/thumbnail directly via `media` field (max 50MB each)\n' +
      '2. **URL mode** (`application/json`): Provide pre-uploaded S3 URLs in `mediaUrls` array',
  })
  @UseInterceptors(
    FilesInterceptor('media', 2, {
      fileFilter: (req, file, callback) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
        if (!allowed.includes(file.mimetype)) {
          return callback(new Error('Only image and video files are allowed'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  createHypeReel(
    @Req() req: any,
    @Body() dto: CreateHypeReelDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.hypeReelService.createHypeReel(req.user.id, dto, files);
  }

  @Patch('posts/:id/collaborator/respond')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept or decline a collaborator invite' })
  respondToCollaboration(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'accepted' | 'declined' },
  ) {
    return this.hypeReelService.respondToCollaboratorInvite(id, req.user.id, body.status);
  }

  @Get('influencer/hype-reels')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Influencer's own HYPE reels list" })
  getMyHypeReels(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hypeReelService.getInfluencerHypeReels(
      req.user.id,
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }

  @Get('influencer/purchasable-products')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Products eligible to attach from HypeStore order history' })
  getPurchasableProducts(@Req() req: any) {
    return this.hypeReelService.getPurchasableProducts(req.user.id);
  }
}
