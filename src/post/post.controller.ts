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
}
