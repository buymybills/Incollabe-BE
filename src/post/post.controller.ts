import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreatePostMultipartDto } from './dto/create-post-multipart.dto';
import { UpdatePostMultipartDto } from './dto/update-post-multipart.dto';
import { FollowDto } from './dto/follow.dto';
import { GetPostsDto, GetPostsQueryDto } from './dto/get-posts.dto';
import { GetFollowersDto, GetFollowingDto } from './dto/get-followers.dto';
import { ActivateBoostDto, VerifyBoostPaymentDto, BoostModeResponseDto } from './dto/boost-post.dto';
import { GetAnalyticsDto, ProfileViewsResponseDto, PostViewsResponseDto, InteractionsResponseDto, FollowersResponseDto } from './dto/analytics.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserType } from './models/post.model';
import type { User } from '../types/request.types';

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('media', 10, {
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'video/mp4',
          'video/quicktime', // .mov files
          'video/x-msvideo', // .avi files
          'video/avi',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new Error('Only image and video files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new post',
    description:
      'Create a new post with text content and optional media files (up to 10 files, max 50MB each). Only verified influencers can create posts.',
  })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only verified influencers can create posts',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 50MB per file)',
  })
  async createPost(
    @Body() createPostDto: CreatePostMultipartDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
  ) {
    // Validate file sizes (50MB limit per file)
    const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes
    if (files && files.length > 0) {
      const oversizedFiles = files.filter((file) => file.size > maxFileSize);
      if (oversizedFiles.length > 0) {
        const filesInfo = oversizedFiles
          .map(
            (f) => `${f.originalname} (${(f.size / 1024 / 1024).toFixed(2)}MB)`,
          )
          .join(', ');
        throw new BadRequestException(
          `The following files exceed the 50MB size limit: ${filesInfo}. Please reduce file size and try again.`,
        );
      }
    }

    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.createPost(createPostDto, userType, user.id, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get posts feed' })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPosts(@Query() getPostsDto: GetPostsDto, @CurrentUser() user: User) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.getPosts(getPostsDto, userType, user.id);
  }

  @Get('followers')
  @ApiOperation({
    summary: 'Get my followers list',
    description:
      'Get a paginated list of users who follow you. ' +
      'Returns follower ID, type (influencer/brand), name, username, and profile image.\n\n' +
      '**Response includes:**\n' +
      '- Follower ID\n' +
      '- Type (influencer or brand)\n' +
      '- Name\n' +
      '- Username\n' +
      '- Profile image\n' +
      '- When they followed you\n\n' +
      '**Features:**\n' +
      '- Search by name or username\n' +
      '- Pagination support\n' +
      '- Case-insensitive search\n\n' +
      '**Use Cases:**\n' +
      '- Display followers tab in user profile\n' +
      '- Show who is following you\n' +
      '- Search followers by name/username\n' +
      '- Navigate to follower profiles\n' +
      '- Check follower count',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search followers by name or username (case-insensitive)',
    example: 'john',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Followers list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        followers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
                example: 15,
                description: 'Follower user ID',
              },
              type: {
                type: 'string',
                enum: ['influencer', 'brand'],
                example: 'influencer',
                description: 'User type',
              },
              name: {
                type: 'string',
                example: 'John Doe',
                description: 'Display name',
              },
              username: {
                type: 'string',
                example: 'johndoe',
                description: 'Username',
              },
              profileImage: {
                type: 'string',
                nullable: true,
                example: 'https://example.com/profile.jpg',
                description: 'Profile image URL (null if not set)',
              },
              followedAt: {
                type: 'string',
                format: 'date-time',
                example: '2026-03-15T10:00:00.000Z',
                description: 'When they followed you',
              },
            },
          },
        },
        total: {
          type: 'number',
          example: 150,
          description: 'Total number of followers',
        },
        page: {
          type: 'number',
          example: 1,
          description: 'Current page number',
        },
        limit: {
          type: 'number',
          example: 20,
          description: 'Items per page',
        },
        totalPages: {
          type: 'number',
          example: 8,
          description: 'Total number of pages',
        },
      },
      example: {
        followers: [
          {
            id: 15,
            type: 'influencer',
            name: 'John Doe',
            username: 'johndoe',
            profileImage: 'https://example.com/profile.jpg',
            followedAt: '2026-03-15T10:00:00.000Z',
          },
          {
            id: 32,
            type: 'brand',
            name: 'FashionBrand',
            username: 'fashionbrand',
            profileImage: 'https://example.com/brand.jpg',
            followedAt: '2026-03-14T15:30:00.000Z',
          },
          {
            id: 89,
            type: 'influencer',
            name: 'Sarah Johnson',
            username: 'sarahj',
            profileImage: null,
            followedAt: '2026-03-13T08:20:00.000Z',
          },
        ],
        total: 150,
        page: 1,
        limit: 20,
        totalPages: 8,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async getFollowers(
    @Query() dto: GetFollowersDto,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.getFollowers(
      userType,
      user.id,
      dto.page,
      dto.limit,
      dto.search,
    );
  }

  @Get('following')
  @ApiOperation({
    summary: 'Get my following list',
    description:
      'Get a paginated list of users that you follow. ' +
      'Returns user ID, type (influencer/brand), name, username, and profile image.\n\n' +
      '**Response includes:**\n' +
      '- User ID\n' +
      '- Type (influencer or brand)\n' +
      '- Name\n' +
      '- Username\n' +
      '- Profile image\n' +
      '- When you followed them\n\n' +
      '**Features:**\n' +
      '- Search by name or username\n' +
      '- Pagination support\n' +
      '- Case-insensitive search\n\n' +
      '**Use Cases:**\n' +
      '- Display following tab in user profile\n' +
      '- Show who you are following\n' +
      '- Search following by name/username\n' +
      '- Navigate to following user profiles\n' +
      '- Check following count',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search following by name or username (case-insensitive)',
    example: 'jane',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Following list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        following: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
                example: 42,
                description: 'User ID that you are following',
              },
              type: {
                type: 'string',
                enum: ['influencer', 'brand'],
                example: 'influencer',
                description: 'User type',
              },
              name: {
                type: 'string',
                example: 'Jane Smith',
                description: 'Display name',
              },
              username: {
                type: 'string',
                example: 'janesmith',
                description: 'Username',
              },
              profileImage: {
                type: 'string',
                nullable: true,
                example: 'https://example.com/jane.jpg',
                description: 'Profile image URL (null if not set)',
              },
              followedAt: {
                type: 'string',
                format: 'date-time',
                example: '2026-03-10T12:00:00.000Z',
                description: 'When you followed them',
              },
            },
          },
        },
        total: {
          type: 'number',
          example: 87,
          description: 'Total number of users you are following',
        },
        page: {
          type: 'number',
          example: 1,
          description: 'Current page number',
        },
        limit: {
          type: 'number',
          example: 20,
          description: 'Items per page',
        },
        totalPages: {
          type: 'number',
          example: 5,
          description: 'Total number of pages',
        },
      },
      example: {
        following: [
          {
            id: 42,
            type: 'influencer',
            name: 'Jane Smith',
            username: 'janesmith',
            profileImage: 'https://example.com/jane.jpg',
            followedAt: '2026-03-10T12:00:00.000Z',
          },
          {
            id: 18,
            type: 'brand',
            name: 'TechCompany',
            username: 'techco',
            profileImage: 'https://example.com/tech.jpg',
            followedAt: '2026-03-05T09:15:00.000Z',
          },
          {
            id: 73,
            type: 'influencer',
            name: 'Mike Wilson',
            username: 'mikew',
            profileImage: null,
            followedAt: '2026-03-01T14:30:00.000Z',
          },
        ],
        total: 87,
        page: 1,
        limit: 20,
        totalPages: 5,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async getFollowing(
    @Query() dto: GetFollowingDto,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.getFollowing(
      userType,
      user.id,
      dto.page,
      dto.limit,
      dto.search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific post by ID' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPostById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.getPostById(id, userType, user.id);
  }

  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('media', 10, {
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'video/mp4',
          'video/quicktime', // .mov files
          'video/x-msvideo', // .avi files
          'video/avi',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new Error('Only image and video files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a post',
    description:
      'Update post content and/or media. Use existingMediaUrls to keep specific media, new media files will be added.',
  })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 50MB per file)',
  })
  async updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostMultipartDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
  ) {
    // Validate file sizes (50MB limit per file)
    const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes
    if (files && files.length > 0) {
      const oversizedFiles = files.filter((file) => file.size > maxFileSize);
      if (oversizedFiles.length > 0) {
        const filesInfo = oversizedFiles
          .map(
            (f) => `${f.originalname} (${(f.size / 1024 / 1024).toFixed(2)}MB)`,
          )
          .join(', ');
        throw new BadRequestException(
          `The following files exceed the 50MB size limit: ${filesInfo}. Please reduce file size and try again.`,
        );
      }
    }

    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.updatePost(
      id,
      updatePostDto,
      userType,
      user.id,
      files,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deletePost(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    await this.postService.deletePost(id, userType, user.id);
    return { message: 'Post deleted successfully' };
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like or unlike a post' })
  @ApiResponse({ status: 200, description: 'Post like status updated' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async likePost(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.likePost(id, userType, user.id);
  }

  @Post('follow')
  @ApiOperation({ summary: 'Follow or unfollow a user' })
  @ApiResponse({ status: 200, description: 'Follow status updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async followUser(@Body() followDto: FollowDto, @CurrentUser() user: User) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.followUser(followDto, userType, user.id);
  }

  @Get('user/:userType/:userId')
  @ApiOperation({ summary: 'Get posts by specific user' })
  @ApiParam({
    name: 'userType',
    enum: ['influencer', 'brand'],
    description: 'user type',
  })
  @ApiParam({ name: 'userId', description: 'user id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'User posts retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPosts(
    @Param('userType') userType: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() getPostsDto: GetPostsQueryDto,
    @CurrentUser() user: User,
  ) {
    const queryDto = { ...getPostsDto, userType, userId }; // merge path params into query object
    const currentUserType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.getPosts(queryDto, currentUserType, user.id);
  }

  // ==================== Post Engagement Tracking ====================

  @Post(':id/increment-view')
  @ApiOperation({
    summary: 'Track post view',
    description: 'Tracks who viewed a post and increments the view count. Call this when a user views a post.',
  })
  @ApiParam({ name: 'id', description: 'Post ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'View tracked successfully',
    schema: {
      example: {
        success: true,
        viewsCount: 125,
        alreadyViewed: false,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async incrementViewCount(
    @Param('id', ParseIntPipe) postId: number,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return await this.postService.viewPost(postId, userType, user.id);
  }

  @Post(':id/share')
  @ApiOperation({
    summary: 'Track post share',
    description: 'Tracks who shared a post and increments the share count. Call this when a user shares a post.',
  })
  @ApiParam({ name: 'id', description: 'Post ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Share tracked successfully',
    schema: {
      example: {
        success: true,
        sharesCount: 45,
        alreadyShared: false,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sharePost(
    @Param('id', ParseIntPipe) postId: number,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return await this.postService.sharePost(postId, userType, user.id);
  }

  @Get(':id/sharers')
  @ApiOperation({
    summary: 'Get list of users who shared a post',
    description: 'Returns a paginated list of users (influencers and brands) who shared the post.',
  })
  @ApiParam({ name: 'id', description: 'Post ID', type: 'number' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', type: 'number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'List of sharers retrieved successfully',
    schema: {
      example: {
        sharers: [
          {
            id: 123,
            type: 'influencer',
            name: 'John Doe',
            username: 'johndoe',
            profileImage: 'https://...',
            sharedAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 45,
        page: 1,
        limit: 20,
        totalPages: 3,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPostSharers(
    @Param('id', ParseIntPipe) postId: number,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return await this.postService.getPostSharers(postId, page, limit);
  }

  @Get(':id/viewers')
  @ApiOperation({
    summary: 'Get list of users who viewed a post',
    description: 'Returns a paginated list of users (influencers and brands) who viewed the post.',
  })
  @ApiParam({ name: 'id', description: 'Post ID', type: 'number' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', type: 'number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'List of viewers retrieved successfully',
    schema: {
      example: {
        viewers: [
          {
            id: 456,
            type: 'brand',
            name: 'Acme Corp',
            username: 'acmecorp',
            profileImage: 'https://...',
            viewedAt: '2024-01-15T09:15:00Z',
          },
        ],
        total: 125,
        page: 1,
        limit: 20,
        totalPages: 7,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPostViewers(
    @Param('id', ParseIntPipe) postId: number,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return await this.postService.getPostViewers(postId, page, limit);
  }

  @Post('boost/create-order')
  @ApiOperation({
    summary: 'Create Razorpay order for post boost',
    description: 'Creates a payment order for boosting a post. Boost mode costs ₹29 and lasts for 24 hours. Boosted posts appear at the top of feeds with maximum visibility.'
  })
  @ApiResponse({
    status: 200,
    description: 'Payment order created successfully',
    type: BoostModeResponseDto,
  })
  @ApiResponse({ status: 403, description: 'You can only boost your own posts' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 400, description: 'Post is already boosted' })
  async createBoostOrder(
    @Body() activateBoostDto: ActivateBoostDto,
    @CurrentUser() user: User,
  ): Promise<BoostModeResponseDto> {
    return await this.postService.createBoostOrder(
      activateBoostDto.postId,
      user.id,
      user.userType as unknown as UserType,
    );
  }

  @Post('boost/verify-payment')
  @ApiOperation({
    summary: 'Verify payment and activate boost mode',
    description: 'Verifies the Razorpay payment and activates boost mode for the post for 24 hours. The post will appear at the top of all feeds without any filters.'
  })
  @ApiResponse({
    status: 200,
    description: 'Boost mode activated successfully',
    type: BoostModeResponseDto,
  })
  @ApiResponse({ status: 403, description: 'You can only boost your own posts' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 400, description: 'Invalid payment signature' })
  async verifyBoostPayment(
    @Body() verifyBoostDto: VerifyBoostPaymentDto,
    @CurrentUser() user: User,
  ): Promise<BoostModeResponseDto> {
    return await this.postService.verifyAndActivateBoost(
      verifyBoostDto.postId,
      user.id,
      user.userType as unknown as UserType,
      verifyBoostDto.razorpayOrderId,
      verifyBoostDto.razorpayPaymentId,
      verifyBoostDto.razorpaySignature,
    );
  }

  @Get('analytics/profile-views')
  @ApiOperation({
    summary: 'Get profile views analytics',
    description: 'Returns analytics for profile views aggregated from all post views. Shows who viewed your profile through your posts, with breakdowns by follower type, user type, and viewing categories.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile views analytics retrieved successfully',
    type: ProfileViewsResponseDto,
  })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['7_days', '15_days', '30_days', 'all_time'], description: 'Timeframe for analytics (default: 30_days)' })
  @ApiQuery({ name: 'followerType', required: false, enum: ['all', 'followers', 'non_followers'], description: 'Filter by follower type (default: all)' })
  @ApiQuery({ name: 'userType', required: false, enum: ['all', 'brands', 'influencers'], description: 'Filter by user type (default: all)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Custom start date (YYYY-MM-DD), overrides timeframe' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Custom end date (YYYY-MM-DD), overrides timeframe' })
  async getProfileViewsAnalytics(
    @Query() analyticsDto: GetAnalyticsDto,
    @CurrentUser() user: User,
  ): Promise<ProfileViewsResponseDto> {
    return await this.postService.getProfileViewsAnalytics(
      user.id,
      user.userType as unknown as UserType,
      analyticsDto,
    );
  }

  @Get('analytics/post-views')
  @ApiOperation({
    summary: 'Get post views analytics',
    description: 'Returns analytics for individual post views. Shows detailed breakdown of who viewed your posts, with follower/non-follower split, user type breakdown, top performing posts, and viewing category insights.',
  })
  @ApiResponse({
    status: 200,
    description: 'Post views analytics retrieved successfully',
    type: PostViewsResponseDto,
  })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['7_days', '15_days', '30_days', 'all_time'], description: 'Timeframe for analytics (default: 30_days)' })
  @ApiQuery({ name: 'followerType', required: false, enum: ['all', 'followers', 'non_followers'], description: 'Filter by follower type (default: all)' })
  @ApiQuery({ name: 'userType', required: false, enum: ['all', 'brands', 'influencers'], description: 'Filter by user type (default: all)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Custom start date (YYYY-MM-DD), overrides timeframe' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Custom end date (YYYY-MM-DD), overrides timeframe' })
  async getPostViewsAnalytics(
    @Query() analyticsDto: GetAnalyticsDto,
    @CurrentUser() user: User,
  ): Promise<PostViewsResponseDto> {
    return await this.postService.getPostViewsAnalytics(
      user.id,
      user.userType as unknown as UserType,
      analyticsDto,
    );
  }

  @Get('analytics/interactions')
  @ApiOperation({
    summary: 'Get interactions analytics',
    description: 'Returns analytics for post interactions (likes and shares). Shows total interactions with follower/non-follower breakdown, individual metrics for likes and shares with growth indicators, and top performing posts by likes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Interactions analytics retrieved successfully',
    type: InteractionsResponseDto,
  })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['7_days', '15_days', '30_days', 'all_time'], description: 'Timeframe for analytics (default: 30_days)' })
  @ApiQuery({ name: 'followerType', required: false, enum: ['all', 'followers', 'non_followers'], description: 'Filter by follower type (default: all)' })
  @ApiQuery({ name: 'userType', required: false, enum: ['all', 'brands', 'influencers'], description: 'Filter by user type (default: all)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Custom start date (YYYY-MM-DD), overrides timeframe' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Custom end date (YYYY-MM-DD), overrides timeframe' })
  async getInteractionsAnalytics(
    @Query() analyticsDto: GetAnalyticsDto,
    @CurrentUser() user: User,
  ): Promise<InteractionsResponseDto> {
    return await this.postService.getInteractionsAnalytics(
      user.id,
      user.userType as unknown as UserType,
      analyticsDto,
    );
  }

  @Get('analytics/followers')
  @ApiOperation({
    summary: 'Get followers analytics',
    description: 'Returns analytics for follower growth and composition. Shows net followers count with growth vs previous period, breakdown by creators and brands, followers gained/lost statistics, followers trend over time, top performing posts by followers gained, and niche distribution of followers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Followers analytics retrieved successfully',
    type: FollowersResponseDto,
  })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['7_days', '15_days', '30_days', 'all_time'], description: 'Timeframe for analytics (default: 30_days)' })
  @ApiQuery({ name: 'breakdownBy', required: false, enum: ['follower_wise', 'usertype_wise'], description: 'Breakdown type: follower_wise (simple: followers vs non-followers) or usertype_wise (nested: brands/influencers with followers breakdown) (default: follower_wise)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Custom start date (YYYY-MM-DD), overrides timeframe' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Custom end date (YYYY-MM-DD), overrides timeframe' })
  async getFollowersAnalytics(
    @Query() analyticsDto: GetAnalyticsDto,
    @CurrentUser() user: User,
  ): Promise<FollowersResponseDto> {
    return await this.postService.getFollowersAnalytics(
      user.id,
      user.userType as unknown as UserType,
      analyticsDto,
    );
  }
}
