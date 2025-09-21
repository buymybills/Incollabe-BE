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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FollowDto } from './dto/follow.dto';
import { GetPostsDto } from './dto/get-posts.dto';
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
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.createPost(createPostDto, userType, user.id);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific post by ID' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPostById(@Param('id', ParseIntPipe) id: number) {
    return this.postService.getPostById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentUser() user: User,
  ) {
    const userType =
      user.userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND;
    return this.postService.updatePost(id, updatePostDto, userType, user.id);
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
  @ApiResponse({
    status: 200,
    description: 'User posts retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPosts(
    @Param('userType') userType: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() getPostsDto: GetPostsDto,
  ) {
    const queryDto = { ...getPostsDto, userType, userId };
    return this.postService.getPosts(queryDto);
  }
}
