import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post, UserType } from './models/post.model';
import { Like, LikerType } from './models/like.model';
import { Follow, FollowerType, FollowingType } from './models/follow.model';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreatePostMultipartDto } from './dto/create-post-multipart.dto';
import { UpdatePostMultipartDto } from './dto/update-post-multipart.dto';
import { FollowDto, FollowUserType } from './dto/follow.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { NotificationService } from '../shared/notification.service';
import { S3Service } from '../shared/s3.service';
import { Op, Sequelize } from 'sequelize';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(Like)
    private readonly likeModel: typeof Like,
    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    private readonly notificationService: NotificationService,
    private readonly s3Service: S3Service,
  ) {}

  async createPost(
    createPostDto: CreatePostDto | CreatePostMultipartDto,
    userType: UserType,
    userId: number,
    files?: Express.Multer.File[],
  ): Promise<Post> {
    // Validate that at least content or media is provided
    const hasContent =
      createPostDto.content && createPostDto.content.trim().length > 0;
    const hasMedia = files && files.length > 0;

    if (!hasContent && !hasMedia) {
      throw new BadRequestException(
        'Post must have either content or media (or both)',
      );
    }

    // Upload files to S3 if provided
    const mediaUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const folder = file.mimetype.startsWith('video/')
          ? 'posts/videos'
          : 'posts/images';
        const prefix = `${userType}-${userId}`;
        const url = await this.s3Service.uploadFileToS3(file, folder, prefix);
        mediaUrls.push(url);
      }
    }

    const postData: any = {
      content: createPostDto.content,
      mediaUrls: mediaUrls,
      userType,
    };

    if (userType === UserType.INFLUENCER) {
      postData.influencerId = userId;
    } else {
      postData.brandId = userId;
    }

    return this.postModel.create(postData);
  }

  async updatePost(
    postId: number,
    updatePostDto: UpdatePostDto | UpdatePostMultipartDto,
    userType: UserType,
    userId: number,
    files?: Express.Multer.File[],
  ): Promise<Post> {
    const post = await this.postModel.findByPk(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isOwner =
      (userType === UserType.INFLUENCER && post.influencerId === userId) ||
      (userType === UserType.BRAND && post.brandId === userId);

    if (!isOwner) {
      throw new ForbiddenException('You can only update your own posts');
    }

    // Handle media updates
    let mediaUrls = post.mediaUrls || [];

    // If existingMediaUrls is provided in multipart DTO, keep only those URLs (even if empty array)
    if (
      'existingMediaUrls' in updatePostDto &&
      updatePostDto.existingMediaUrls !== undefined
    ) {
      mediaUrls = updatePostDto.existingMediaUrls;
    }

    // Upload new files to S3 if provided
    if (files && files.length > 0) {
      for (const file of files) {
        const folder = file.mimetype.startsWith('video/')
          ? 'posts/videos'
          : 'posts/images';
        const prefix = `${userType}-${userId}`;
        const url = await this.s3Service.uploadFileToS3(file, folder, prefix);
        mediaUrls.push(url);
      }
    }

    // Validate that updated post will have either content or media
    const updatedContent =
      updatePostDto.content !== undefined
        ? updatePostDto.content
        : post.content;
    const hasContent = updatedContent && updatedContent.trim().length > 0;
    const hasMedia = mediaUrls && mediaUrls.length > 0;

    if (!hasContent && !hasMedia) {
      throw new BadRequestException(
        'Post must have either content or media (or both)',
      );
    }

    const updateData: any = {
      ...updatePostDto,
      mediaUrls,
    };

    // Remove the existingMediaUrls field as it's not part of the model
    delete updateData.existingMediaUrls;

    await post.update(updateData);
    return post;
  }

  async deletePost(
    postId: number,
    userType: UserType,
    userId: number,
  ): Promise<void> {
    const post = await this.postModel.findByPk(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isOwner =
      (userType === UserType.INFLUENCER && post.influencerId === userId) ||
      (userType === UserType.BRAND && post.brandId === userId);

    if (!isOwner) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await post.update({ isActive: false });
  }

  async likePost(
    postId: number,
    userType: UserType,
    userId: number,
  ): Promise<{ liked: boolean }> {
    const post = await this.postModel.findByPk(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const likerType =
      userType === UserType.INFLUENCER ? LikerType.INFLUENCER : LikerType.BRAND;
    const likerField =
      userType === UserType.INFLUENCER ? 'likerInfluencerId' : 'likerBrandId';

    const existingLike = await this.likeModel.findOne({
      where: {
        postId,
        likerType,
        [likerField]: userId,
      },
    });

    if (existingLike) {
      await existingLike.destroy();
      await post.decrement('likesCount');
      return { liked: false };
    } else {
      const likeData: any = {
        postId,
        likerType,
      };
      likeData[likerField] = userId;

      await this.likeModel.create(likeData);
      await post.increment('likesCount');

      // Send notification to post author when someone likes their post
      // Get post author details
      let postAuthor;
      if (post.userType === UserType.INFLUENCER) {
        postAuthor = await this.influencerModel.findByPk(post.influencerId);
      } else {
        postAuthor = await this.brandModel.findByPk(post.brandId);
      }

      // Get liker details
      let liker;
      if (userType === UserType.INFLUENCER) {
        liker = await this.influencerModel.findByPk(userId);
      } else {
        liker = await this.brandModel.findByPk(userId);
      }

      // Only send notification if we have both users and post author has FCM token
      if (postAuthor && liker && postAuthor.fcmToken) {
        // Don't send notification if user likes their own post
        const isOwnPost =
          (post.userType === UserType.INFLUENCER &&
            post.influencerId === userId &&
            userType === UserType.INFLUENCER) ||
          (post.userType === UserType.BRAND &&
            post.brandId === userId &&
            userType === UserType.BRAND);

        if (!isOwnPost) {
          const likerName =
            userType === UserType.INFLUENCER
              ? (liker as Influencer).name
              : (liker as Brand).brandName;

          const postTitle = post.content
            ? post.content.substring(0, 50) +
              (post.content.length > 50 ? '...' : '')
            : 'your post';

          await this.notificationService.sendPostLikeNotification(
            postAuthor.fcmToken,
            likerName,
            postTitle,
            postId.toString(),
            liker.username,
            (liker as Influencer | Brand).profileImage,
          );
        }
      }

      return { liked: true };
    }
  }

  async followUser(
    followDto: FollowDto,
    currentUserType: UserType,
    currentUserId: number,
  ): Promise<{ followed: boolean }> {
    const currentUserTypeString =
      currentUserType === UserType.INFLUENCER ? 'influencer' : 'brand';
    if (
      followDto.userType === currentUserTypeString &&
      followDto.userId === currentUserId
    ) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const followerType =
      currentUserType === UserType.INFLUENCER
        ? FollowerType.INFLUENCER
        : FollowerType.BRAND;
    const followingType =
      followDto.userType === FollowUserType.INFLUENCER
        ? FollowingType.INFLUENCER
        : FollowingType.BRAND;

    const followerField =
      currentUserType === UserType.INFLUENCER
        ? 'followerInfluencerId'
        : 'followerBrandId';
    const followingField =
      followDto.userType === FollowUserType.INFLUENCER
        ? 'followingInfluencerId'
        : 'followingBrandId';

    const existingFollow = await this.followModel.findOne({
      where: {
        followerType,
        [followerField]: currentUserId,
        followingType,
        [followingField]: followDto.userId,
      },
    });

    if (existingFollow) {
      await existingFollow.destroy();
      return { followed: false };
    } else {
      const followData: any = {
        followerType,
        followingType,
      };
      followData[followerField] = currentUserId;
      followData[followingField] = followDto.userId;

      await this.followModel.create(followData);

      // Send notification to the user being followed
      await this.sendFollowerNotification(
        followDto.userType,
        followDto.userId,
        currentUserType,
        currentUserId,
      );

      return { followed: true };
    }
  }

  async getPosts(
    getPostsDto: GetPostsDto,
    currentUserType?: UserType,
    currentUserId?: number,
  ): Promise<{
    posts: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, userType, userId } = getPostsDto;
    const offset = (page - 1) * limit;

    const whereCondition: any = { isActive: true };
    let includeCondition: any[] = [];
    let orderCondition: any[] = [];

    if (userType && userId) {
      // Viewing specific user's profile posts - show only that user's posts
      if (userType === 'influencer') {
        whereCondition.influencerId = userId;
        whereCondition.userType = UserType.INFLUENCER;
      } else if (userType === 'brand') {
        whereCondition.brandId = userId;
        whereCondition.userType = UserType.BRAND;
      }
      orderCondition = [
        ['createdAt', 'DESC'],
        ['likesCount', 'DESC'],
      ];
    } else if (currentUserId && currentUserType) {
      // Hybrid feed generation: P1-P6 priority + recency within each priority
      const followingUsers = await this.getFollowingUsers(
        currentUserType,
        currentUserId,
      );

      // Get user's niches for relevance matching
      const userNiches = await this.getUserNiches(
        currentUserType,
        currentUserId,
      );

      // Get users in matching niches
      const nicheMatchingUserIds =
        await this.getNicheMatchingUserIds(userNiches);

      // DO NOT FILTER - Show all posts but prioritize using P1-P6 system
      // The priority ordering will handle showing relevant content first

      // Build priority case with P1-P6 levels
      const priorityCase = this.buildPriorityCase(
        currentUserId,
        currentUserType,
        followingUsers.influencerIds,
        followingUsers.brandIds,
        nicheMatchingUserIds.influencerIds,
        nicheMatchingUserIds.brandIds,
      );

      // Hybrid ordering: Priority level (P1-P6) THEN recency within each priority
      orderCondition = [
        Sequelize.literal(priorityCase), // Priority level
        ['createdAt', 'DESC'], // Newest first within each priority
        ['likesCount', 'DESC'], // Engagement as tiebreaker
      ];
    } else {
      // Public feed - no user context
      orderCondition = [
        ['createdAt', 'DESC'],
        ['likesCount', 'DESC'],
      ];
    }

    includeCondition = [
      {
        model: Influencer,
        attributes: [
          'id',
          'name',
          'username',
          'profileImage',
          'profileHeadline',
        ],
        required: false,
      },
      {
        model: Brand,
        attributes: [
          'id',
          'brandName',
          'username',
          'profileImage',
          'profileHeadline',
        ],
        required: false,
      },
    ];

    const { count, rows: posts } = await this.postModel.findAndCountAll({
      where: whereCondition,
      include: includeCondition,
      order: orderCondition,
      limit,
      offset,
      distinct: true,
    });

    // Add isLikedByCurrentUser field to each post
    let postsWithLikeStatus = posts;
    if (currentUserId && currentUserType) {
      const likerType =
        currentUserType === UserType.INFLUENCER
          ? LikerType.INFLUENCER
          : LikerType.BRAND;
      const likerField =
        currentUserType === UserType.INFLUENCER
          ? 'likerInfluencerId'
          : 'likerBrandId';

      // Get all likes by current user for these posts
      const postIds = posts.map((post) => post.id);
      const userLikes = await this.likeModel.findAll({
        where: {
          postId: { [Op.in]: postIds },
          likerType,
          [likerField]: currentUserId,
        },
        attributes: ['postId'],
        raw: true,
      });

      const likedPostIds = new Set(userLikes.map((like) => like.postId));

      postsWithLikeStatus = posts.map((post) => {
        const postJson = post.toJSON();
        return {
          ...postJson,
          isLikedByCurrentUser: likedPostIds.has(post.id),
        };
      });
    }

    const totalPages = Math.ceil(count / limit);

    return {
      posts: postsWithLikeStatus,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  private async getUserNiches(
    userType: UserType,
    userId: number,
  ): Promise<number[]> {
    if (userType === UserType.INFLUENCER) {
      const influencerNiches = await InfluencerNiche.findAll({
        where: { influencerId: userId },
        attributes: ['nicheId'],
      });
      return influencerNiches.map((item) => item.nicheId);
    } else {
      const brandNiches = await BrandNiche.findAll({
        where: { brandId: userId },
        attributes: ['nicheId'],
      });
      return brandNiches.map((item) => item.nicheId);
    }
  }

  private async getFollowingUsers(
    userType: UserType,
    userId: number,
  ): Promise<{
    influencerIds: number[];
    brandIds: number[];
  }> {
    const followerType =
      userType === UserType.INFLUENCER
        ? FollowerType.INFLUENCER
        : FollowerType.BRAND;
    const followerField =
      userType === UserType.INFLUENCER
        ? 'followerInfluencerId'
        : 'followerBrandId';

    const follows = await this.followModel.findAll({
      where: {
        followerType,
        [followerField]: userId,
      },
      attributes: [
        'followingType',
        'followingInfluencerId',
        'followingBrandId',
      ],
    });

    const influencerIds: number[] = [];
    const brandIds: number[] = [];

    follows.forEach((follow) => {
      if (
        follow.followingType === FollowingType.INFLUENCER &&
        follow.followingInfluencerId
      ) {
        influencerIds.push(follow.followingInfluencerId);
      } else if (
        follow.followingType === FollowingType.BRAND &&
        follow.followingBrandId
      ) {
        brandIds.push(follow.followingBrandId);
      }
    });

    return { influencerIds, brandIds };
  }

  private async getNicheMatchingUserIds(
    userNiches: number[],
  ): Promise<{ influencerIds: number[]; brandIds: number[] }> {
    const influencerIds: number[] = [];
    const brandIds: number[] = [];

    if (userNiches.length > 0) {
      const influencersWithSimilarNiches = await InfluencerNiche.findAll({
        where: { nicheId: { [Op.in]: userNiches } },
        attributes: ['influencerId'],
      });

      const brandsWithSimilarNiches = await BrandNiche.findAll({
        where: { nicheId: { [Op.in]: userNiches } },
        attributes: ['brandId'],
      });

      influencersWithSimilarNiches.forEach((item) => {
        if (!influencerIds.includes(item.influencerId)) {
          influencerIds.push(item.influencerId);
        }
      });

      brandsWithSimilarNiches.forEach((item) => {
        if (!brandIds.includes(item.brandId)) {
          brandIds.push(item.brandId);
        }
      });
    }

    return { influencerIds, brandIds };
  }

  private buildPriorityCase(
    currentUserId: number,
    currentUserType: UserType,
    followingInfluencerIds: number[],
    followingBrandIds: number[],
    nicheMatchingInfluencerIds: number[],
    nicheMatchingBrandIds: number[],
  ): string {
    // Build CASE statement for priority ordering with time-based degradation
    // P1 (Priority 1): Recent own posts (posted within last 10 minutes) - appears on top temporarily
    // P2 (Priority 2): Same niche AND followed profiles (less than 30 days old)
    // P3 (Priority 3): Same niche but NOT followed (less than 30 days old)
    // P4 (Priority 4): Other posts from followed profiles (less than 30 days old)
    // P5 (Priority 5): All other posts + Old P2/P3/P4 posts (mixed by recency)
    // P6 (Priority 6): Old own posts (older than 10 minutes)

    const nicheInfluencers = nicheMatchingInfluencerIds.join(',') || '0';
    const nicheBrands = nicheMatchingBrandIds.join(',') || '0';
    const followingInfluencers = followingInfluencerIds.join(',') || '0';
    const followingBrands = followingBrandIds.join(',') || '0';

    const isInfluencer = currentUserType === UserType.INFLUENCER;

    // Own post check
    const ownUserTypeCheck = isInfluencer
      ? `"Post"."userType" = 'influencer' AND "Post"."influencerId" = ${currentUserId}`
      : `"Post"."userType" = 'brand' AND "Post"."brandId" = ${currentUserId}`;

    // Recent own posts (within last 10 minutes)
    const recentOwnPostCheck = `
      ${ownUserTypeCheck} AND
      "Post"."createdAt" > NOW() - INTERVAL '10 minutes'
    `;

    // Old own posts (older than 10 minutes)
    const oldOwnPostCheck = `
      ${ownUserTypeCheck} AND
      "Post"."createdAt" <= NOW() - INTERVAL '10 minutes'
    `;

    // Check if user is followed
    const isFollowedCheck = `
      ("Post"."userType" = 'influencer' AND "Post"."influencerId" IN (${followingInfluencers})) OR
      ("Post"."userType" = 'brand' AND "Post"."brandId" IN (${followingBrands}))
    `;

    // Check if post matches niche
    const nicheMatchCheck = `
      ("Post"."userType" = 'influencer' AND "Post"."influencerId" IN (${nicheInfluencers})) OR
      ("Post"."userType" = 'brand' AND "Post"."brandId" IN (${nicheBrands}))
    `;

    // Check if post is recent (less than 30 days old)
    const isRecentCheck = `"Post"."createdAt" > NOW() - INTERVAL '30 days'`;

    // P2: Same niche AND followed (intersection) - recent posts
    const nicheAndFollowedRecentCheck = `
      (${nicheMatchCheck}) AND (${isFollowedCheck}) AND (${isRecentCheck})
    `;

    // P2 old: Same niche AND followed but older than 30 days
    const nicheAndFollowedOldCheck = `
      (${nicheMatchCheck}) AND (${isFollowedCheck}) AND NOT (${isRecentCheck})
    `;

    // P3: Same niche but NOT followed - recent posts
    const nicheButNotFollowedRecentCheck = `
      (${nicheMatchCheck}) AND NOT (${isFollowedCheck}) AND NOT (${ownUserTypeCheck}) AND (${isRecentCheck})
    `;

    // P3 old: Same niche but NOT followed and older than 30 days
    const nicheButNotFollowedOldCheck = `
      (${nicheMatchCheck}) AND NOT (${isFollowedCheck}) AND NOT (${ownUserTypeCheck}) AND NOT (${isRecentCheck})
    `;

    // P4: Followed but not matching niche - recent posts
    const followedButNotNicheRecentCheck = `
      (${isFollowedCheck}) AND NOT (${nicheMatchCheck}) AND NOT (${ownUserTypeCheck}) AND (${isRecentCheck})
    `;

    // P4 old: Followed but not matching niche and older than 30 days
    const followedButNotNicheOldCheck = `
      (${isFollowedCheck}) AND NOT (${nicheMatchCheck}) AND NOT (${ownUserTypeCheck}) AND NOT (${isRecentCheck})
    `;

    return `
      CASE
        WHEN ${recentOwnPostCheck} THEN 1
        WHEN ${nicheAndFollowedRecentCheck} THEN 2
        WHEN ${nicheButNotFollowedRecentCheck} THEN 3
        WHEN ${followedButNotNicheRecentCheck} THEN 4
        WHEN ${nicheAndFollowedOldCheck} THEN 5
        WHEN ${nicheButNotFollowedOldCheck} THEN 5
        WHEN ${followedButNotNicheOldCheck} THEN 5
        WHEN ${oldOwnPostCheck} THEN 6
        ELSE 5
      END
    `;
  }

  async getPostById(
    postId: number,
    currentUserType?: UserType,
    currentUserId?: number,
  ): Promise<any> {
    const post = await this.postModel.findOne({
      where: { id: postId, isActive: true },
      include: [
        {
          model: Influencer,
          attributes: [
            'id',
            'name',
            'username',
            'profileImage',
            'profileHeadline',
          ],
        },
        {
          model: Brand,
          attributes: [
            'id',
            'brandName',
            'username',
            'profileImage',
            'profileHeadline',
          ],
        },
      ],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Add isLikedByCurrentUser field
    let postWithLikeStatus = post.toJSON();
    if (currentUserId && currentUserType) {
      const likerType =
        currentUserType === UserType.INFLUENCER
          ? LikerType.INFLUENCER
          : LikerType.BRAND;
      const likerField =
        currentUserType === UserType.INFLUENCER
          ? 'likerInfluencerId'
          : 'likerBrandId';

      const existingLike = await this.likeModel.findOne({
        where: {
          postId,
          likerType,
          [likerField]: currentUserId,
        },
      });

      postWithLikeStatus = {
        ...postWithLikeStatus,
        isLikedByCurrentUser: !!existingLike,
      };
    }

    return postWithLikeStatus;
  }

  private async sendFollowerNotification(
    followedUserType: FollowUserType,
    followedUserId: number,
    followerUserType: UserType,
    followerUserId: number,
  ) {
    // Get the user being followed
    let followedUser: Influencer | Brand | null = null;
    let followerUser: Influencer | Brand | null = null;

    if (followedUserType === FollowUserType.INFLUENCER) {
      followedUser = await this.influencerModel.findByPk(followedUserId, {
        attributes: ['fcmToken', 'name', 'username'],
      });
    } else {
      followedUser = await this.brandModel.findByPk(followedUserId, {
        attributes: ['fcmToken', 'brandName', 'username'],
      });
    }

    // Get the follower user
    if (followerUserType === UserType.INFLUENCER) {
      followerUser = await this.influencerModel.findByPk(followerUserId, {
        attributes: ['name', 'username', 'profileImage'],
      });
    } else {
      followerUser = await this.brandModel.findByPk(followerUserId, {
        attributes: ['brandName', 'username', 'profileImage'],
      });
    }

    if (followedUser?.fcmToken && followerUser) {
      const followerName =
        followerUserType === UserType.INFLUENCER
          ? (followerUser as Influencer).name
          : (followerUser as Brand).brandName;

      try {
        await this.notificationService.sendNewFollowerNotification(
          followedUser.fcmToken,
          followerName,
          followerUser.username,
          (followerUser as any).profileImage,
        );
      } catch (error) {
        console.error('Error sending follower notification:', error);
        // Don't throw - notification failure shouldn't break the follow action
      }
    }
  }
}
