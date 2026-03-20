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
import { Share, SharerType } from './models/share.model';
import { PostView, ViewerType } from './models/post-view.model';
import { PostBoostInvoice, InvoiceStatus, PaymentMethod } from './models/post-boost-invoice.model';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreatePostMultipartDto } from './dto/create-post-multipart.dto';
import { UpdatePostMultipartDto } from './dto/update-post-multipart.dto';
import { FollowDto, FollowUserType } from './dto/follow.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import {
  GetAnalyticsDto,
  TimeframeType,
  FollowerFilterType,
  UserTypeFilter,
  BreakdownType,
  ProfileViewsResponseDto,
  PostViewsResponseDto,
  InteractionsResponseDto,
  FollowersResponseDto,
  ViewBreakdown,
  UserTypeBreakdown,
  CategoryBreakdown,
  TimeSeriesDataPoint,
  TopPost,
  InteractionMetric,
  TopPostByLikes,
  FollowerTypeBreakdown,
  FollowersGainLost,
  FollowersTrendDataPoint,
  TopPostByFollowers,
} from './dto/analytics.dto';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { Niche } from '../auth/model/niche.model';
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { UserType as DeviceUserType } from '../shared/models/device-token.model';
import { InAppNotificationService } from '../shared/in-app-notification.service';
import { NotificationType } from '../shared/models/in-app-notification.model';
import { S3Service } from '../shared/s3.service';
import { RazorpayService } from '../shared/razorpay.service';
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
    @InjectModel(Share)
    private readonly shareModel: typeof Share,
    @InjectModel(PostView)
    private readonly postViewModel: typeof PostView,
    @InjectModel(PostBoostInvoice)
    private readonly postBoostInvoiceModel: typeof PostBoostInvoice,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly s3Service: S3Service,
    private readonly razorpayService: RazorpayService,
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

    // Check if influencer is verified before allowing post creation
    if (userType === UserType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(userId);
      if (!influencer) {
        throw new NotFoundException('Influencer not found');
      }
      if (!influencer.isVerified) {
        throw new ForbiddenException(
          'Only verified influencers can create posts. Please complete your profile and wait for admin verification.',
        );
      }
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
        liker = await this.influencerModel.findByPk(userId, {
          attributes: ['id', 'name', 'username', 'profileImage'],
        });
      } else {
        liker = await this.brandModel.findByPk(userId, {
          attributes: ['id', 'brandName', 'username', 'profileImage'],
        });
      }

      // Only send notification if we have both users and post author has device tokens
      if (postAuthor && liker && postAuthor.id) {
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

          // Send notifications asynchronously (fire-and-forget)
          const postAuthorUserType = post.userType === UserType.INFLUENCER
            ? DeviceUserType.INFLUENCER
            : DeviceUserType.BRAND;

          // Create in-app notification for post like
          const postAuthorDbUserType =
            post.userType === UserType.INFLUENCER ? 'influencer' : 'brand';
          const postAuthorUserId =
            post.userType === UserType.INFLUENCER
              ? post.influencerId
              : post.brandId;

          const likerProfileImage = (liker as Influencer | Brand).profileImage;

          this.inAppNotificationService
            .createNotification({
              userId: postAuthorUserId,
              userType: postAuthorDbUserType as 'influencer' | 'brand',
              title: 'New Like',
              body: `${likerName} liked your post`,
              type: NotificationType.POST_LIKE,
              actionUrl: `app://posts/${postId}`,
              actionType: 'view_post',
              relatedEntityType: 'post',
              relatedEntityId: postId,
              metadata: {
                postId,
                likerUserId: userId,
                likerUserType: userType === UserType.INFLUENCER ? 'influencer' : 'brand',
                likerName,
                likerProfileImage,
              },
            } as any)
            .catch((error: any) => {
              console.error('Error creating in-app notification for post like:', error);
            });

          // Send push notification
          this.deviceTokenService
            .getAllUserTokens(postAuthor.id, postAuthorUserType)
            .then((deviceTokens: string[]) => {
              if (deviceTokens.length > 0) {
                // Send to all devices in parallel
                const notificationPromises = deviceTokens.map((token) =>
                  this.notificationService.sendPostLikeNotification(
                    token,
                    likerName,
                    postTitle,
                    postId.toString(),
                    liker.username,
                    (liker as Influencer | Brand).profileImage,
                  ),
                );
                return Promise.allSettled(notificationPromises);
              }
            })
            .catch((error: any) => {
              console.error('Error sending post like notification:', error);
            });
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
        ['isBoosted', 'DESC'], // Boosted posts first
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

      // Hybrid ordering: Boosted posts first, then Priority level (P1-P6) THEN recency within each priority
      orderCondition = [
        ['isBoosted', 'DESC'], // Boosted posts first (always on top)
        Sequelize.literal(priorityCase), // Priority level
        ['createdAt', 'DESC'], // Newest first within each priority
        ['likesCount', 'DESC'], // Engagement as tiebreaker
      ];
    } else {
      // Public feed - no user context
      orderCondition = [
        ['isBoosted', 'DESC'], // Boosted posts first
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
        const { mediaUrls, ...postJson } = post.toJSON();
        return {
          ...postJson,
          isLikedByCurrentUser: likedPostIds.has(post.id),
          media: this.getMediaArray(mediaUrls),
        };
      });
    } else {
      postsWithLikeStatus = posts.map((post) => {
        const { mediaUrls, ...postJson } = post.toJSON();
        return {
          ...postJson,
          media: this.getMediaArray(mediaUrls),
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

  private getMediaType(url: string): 'video' | 'image' {
    // Check if URL is a video (contains /videos/ folder or video extensions)
    const isVideo =
      url.includes('/posts/videos/') || url.match(/\.(mp4|mov|avi|webm|mkv)$/i);

    return isVideo ? 'video' : 'image';
  }

  private getMediaArray(
    mediaUrls: string[],
  ): Array<{ mediaUrl: string; mediaType: 'video' | 'image' }> {
    if (!mediaUrls || mediaUrls.length === 0) {
      return [];
    }

    return mediaUrls.map((url) => ({
      mediaUrl: url,
      mediaType: this.getMediaType(url),
    }));
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

    // Add isLikedByCurrentUser field and media array
    const { mediaUrls, ...postData } = post.toJSON();
    let postWithLikeStatus = postData;

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
        ...postData,
        isLikedByCurrentUser: !!existingLike,
        media: this.getMediaArray(mediaUrls),
      };
    } else {
      postWithLikeStatus = {
        ...postData,
        media: this.getMediaArray(mediaUrls),
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
        attributes: ['id', 'name', 'username'],
      });
    } else {
      followedUser = await this.brandModel.findByPk(followedUserId, {
        attributes: ['id', 'brandName', 'username'],
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

    if (followedUser?.id && followerUser) {
      const followerName =
        followerUserType === UserType.INFLUENCER
          ? (followerUser as Influencer).name
          : (followerUser as Brand).brandName;

      // Send notifications asynchronously (fire-and-forget)
      const followedDeviceUserType = followedUserType === FollowUserType.INFLUENCER
        ? DeviceUserType.INFLUENCER
        : DeviceUserType.BRAND;

      // Create in-app notification for new follower
      const followedDbUserType =
        followedUserType === FollowUserType.INFLUENCER ? 'influencer' : 'brand';
      const followerDbUserType =
        followerUserType === UserType.INFLUENCER ? 'influencer' : 'brand';

      const followerProfileImage = (followerUser as any).profileImage;

      this.inAppNotificationService
        .createNotification({
          userId: followedUserId,
          userType: followedDbUserType as 'influencer' | 'brand',
          title: 'New Follower',
          body: `${followerName} started following you`,
          type: NotificationType.NEW_FOLLOWER,
          actionUrl: `app://profile/${followerDbUserType}/${followerUserId}`,
          actionType: 'view_profile',
          relatedEntityType: 'user',
          relatedEntityId: followerUserId,
          metadata: {
            followerUserId,
            followerUserType: followerDbUserType,
            followerName,
            followerUsername: followerUser.username,
            followerProfileImage,
          },
        } as any)
        .catch((error: any) => {
          console.error('Error creating in-app notification for new follower:', error);
        });

      // Send push notification
      this.deviceTokenService
        .getAllUserTokens(followedUser.id, followedDeviceUserType)
        .then((deviceTokens: string[]) => {
          if (deviceTokens.length > 0) {
            // Send to all devices in parallel
            const notificationPromises = deviceTokens.map((token) =>
              this.notificationService.sendNewFollowerNotification(
                token,
                followerName,
                followerUser.username,
                (followerUser as any).profileImage,
              ),
            );
            return Promise.allSettled(notificationPromises);
          }
        })
        .catch((error: any) => {
          console.error('Error sending follower notification:', error);
        });
    }
  }

  /**
   * Get followers list (users who follow the current user)
   */
  async getFollowers(
    currentUserType: UserType,
    currentUserId: number,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<{
    followers: Array<{
      id: number;
      type: 'influencer' | 'brand';
      name: string;
      username: string;
      profileImage: string | null;
      followedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const followingType =
      currentUserType === UserType.INFLUENCER
        ? FollowingType.INFLUENCER
        : FollowingType.BRAND;
    const followingField =
      currentUserType === UserType.INFLUENCER
        ? 'followingInfluencerId'
        : 'followingBrandId';

    const offset = (page - 1) * limit;

    // Build include options with paranoid: false to include soft-deleted users
    const influencerInclude: any = {
      model: Influencer,
      as: 'followerInfluencer',
      attributes: ['id', 'name', 'username', 'profileImage'],
      required: false,
      paranoid: false, // Include soft-deleted influencers
    };

    const brandInclude: any = {
      model: Brand,
      as: 'followerBrand',
      attributes: ['id', 'brandName', 'username', 'profileImage'],
      required: false,
      paranoid: false, // Include soft-deleted brands
    };

    // Add search filter if provided
    if (search) {
      const searchPattern = `%${search}%`;
      influencerInclude.where = {
        [Op.or]: [
          { name: { [Op.iLike]: searchPattern } },
          { username: { [Op.iLike]: searchPattern } },
        ],
      };
      brandInclude.where = {
        [Op.or]: [
          { brandName: { [Op.iLike]: searchPattern } },
          { username: { [Op.iLike]: searchPattern } },
        ],
      };
    }

    // Get total count with search filter
    const total = await this.followModel.count({
      where: {
        followingType,
        [followingField]: currentUserId,
      },
      include: [influencerInclude, brandInclude],
      distinct: true,
    });

    // Get followers with pagination and search
    const follows = await this.followModel.findAll({
      where: {
        followingType,
        [followingField]: currentUserId,
      },
      include: [influencerInclude, brandInclude],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const followers = follows.map((follow) => {
      const followData = follow.toJSON();

      if (followData.followerType === FollowerType.INFLUENCER && followData.followerInfluencer) {
        return {
          id: followData.followerInfluencer.id,
          type: 'influencer' as const,
          name: followData.followerInfluencer.name,
          username: followData.followerInfluencer.username,
          profileImage: followData.followerInfluencer.profileImage || null,
          followedAt: followData.createdAt,
        };
      } else if (followData.followerType === FollowerType.BRAND && followData.followerBrand) {
        return {
          id: followData.followerBrand.id,
          type: 'brand' as const,
          name: followData.followerBrand.brandName,
          username: followData.followerBrand.username,
          profileImage: followData.followerBrand.profileImage || null,
          followedAt: followData.createdAt,
        };
      }
      return null;
    }).filter((follower): follower is NonNullable<typeof follower> => follower !== null);

    const totalPages = Math.ceil(total / limit);

    return {
      followers,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get following list (users that the current user follows)
   */
  async getFollowing(
    currentUserType: UserType,
    currentUserId: number,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<{
    following: Array<{
      id: number;
      type: 'influencer' | 'brand';
      name: string;
      username: string;
      profileImage: string | null;
      followedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const followerType =
      currentUserType === UserType.INFLUENCER
        ? FollowerType.INFLUENCER
        : FollowerType.BRAND;
    const followerField =
      currentUserType === UserType.INFLUENCER
        ? 'followerInfluencerId'
        : 'followerBrandId';

    const offset = (page - 1) * limit;

    // Build include options
    const influencerInclude: any = {
      model: Influencer,
      as: 'followingInfluencer',
      attributes: ['id', 'name', 'username', 'profileImage'],
      required: false,
    };

    const brandInclude: any = {
      model: Brand,
      as: 'followingBrand',
      attributes: ['id', 'brandName', 'username', 'profileImage'],
      required: false,
    };

    // Add search filter if provided
    if (search) {
      const searchPattern = `%${search}%`;
      influencerInclude.where = {
        [Op.or]: [
          { name: { [Op.iLike]: searchPattern } },
          { username: { [Op.iLike]: searchPattern } },
        ],
      };
      brandInclude.where = {
        [Op.or]: [
          { brandName: { [Op.iLike]: searchPattern } },
          { username: { [Op.iLike]: searchPattern } },
        ],
      };
    }

    // Get total count with search filter
    const total = await this.followModel.count({
      where: {
        followerType,
        [followerField]: currentUserId,
      },
      include: [influencerInclude, brandInclude],
      distinct: true,
    });

    // Get following with pagination and search
    const follows = await this.followModel.findAll({
      where: {
        followerType,
        [followerField]: currentUserId,
      },
      include: [influencerInclude, brandInclude],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const following = follows.map((follow) => {
      const followData = follow.toJSON();

      if (followData.followingType === FollowingType.INFLUENCER && followData.followingInfluencer) {
        return {
          id: followData.followingInfluencer.id,
          type: 'influencer' as const,
          name: followData.followingInfluencer.name,
          username: followData.followingInfluencer.username,
          profileImage: followData.followingInfluencer.profileImage || null,
          followedAt: followData.createdAt,
        };
      } else if (followData.followingType === FollowingType.BRAND && followData.followingBrand) {
        return {
          id: followData.followingBrand.id,
          type: 'brand' as const,
          name: followData.followingBrand.brandName,
          username: followData.followingBrand.username,
          profileImage: followData.followingBrand.profileImage || null,
          followedAt: followData.createdAt,
        };
      }
      return null;
    }).filter((user): user is NonNullable<typeof user> => user !== null);

    const totalPages = Math.ceil(total / limit);

    return {
      following,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Track post view - creates a view record for analytics
   */
  async viewPost(
    postId: number,
    userType: UserType,
    userId: number,
  ): Promise<{ success: boolean; viewsCount: number; alreadyViewed: boolean }> {
    const post = await this.postModel.findByPk(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const viewerType =
      userType === UserType.INFLUENCER ? ViewerType.INFLUENCER : ViewerType.BRAND;
    const viewerField =
      userType === UserType.INFLUENCER ? 'viewerInfluencerId' : 'viewerBrandId';

    // Check if user already viewed this post
    const existingView = await this.postViewModel.findOne({
      where: {
        postId,
        viewerType,
        [viewerField]: userId,
      },
    });

    if (existingView) {
      // Already viewed, just return current count
      return {
        success: true,
        viewsCount: post.viewsCount,
        alreadyViewed: true,
      };
    }

    // Create new view record
    const viewData: any = {
      postId,
      viewerType,
    };
    viewData[viewerField] = userId;

    await this.postViewModel.create(viewData);
    // Note: viewsCount will be auto-incremented by the database trigger

    await post.reload();

    return {
      success: true,
      viewsCount: post.viewsCount,
      alreadyViewed: false,
    };
  }

  /**
   * Track post share - creates a share record for analytics
   */
  async sharePost(
    postId: number,
    userType: UserType,
    userId: number,
  ): Promise<{ success: boolean; sharesCount: number; alreadyShared: boolean }> {
    const post = await this.postModel.findByPk(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const sharerType =
      userType === UserType.INFLUENCER ? SharerType.INFLUENCER : SharerType.BRAND;
    const sharerField =
      userType === UserType.INFLUENCER ? 'sharerInfluencerId' : 'sharerBrandId';

    // Check if user already shared this post
    const existingShare = await this.shareModel.findOne({
      where: {
        postId,
        sharerType,
        [sharerField]: userId,
      },
    });

    if (existingShare) {
      // Already shared, just return current count
      return {
        success: true,
        sharesCount: post.sharesCount,
        alreadyShared: true,
      };
    }

    // Create new share record
    const shareData: any = {
      postId,
      sharerType,
    };
    shareData[sharerField] = userId;

    await this.shareModel.create(shareData);
    // Note: sharesCount will be auto-incremented by the database trigger

    await post.reload();

    return {
      success: true,
      sharesCount: post.sharesCount,
      alreadyShared: false,
    };
  }

  /**
   * Get list of users who shared a post
   */
  async getPostSharers(
    postId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    sharers: Array<{
      id: number;
      type: 'influencer' | 'brand';
      name: string;
      username: string;
      profileImage: string | null;
      sharedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const post = await this.postModel.findByPk(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const offset = (page - 1) * limit;

    const { count, rows: shares } = await this.shareModel.findAndCountAll({
      where: { postId },
      include: [
        {
          model: Influencer,
          as: 'sharerInfluencer',
          attributes: ['id', 'name', 'username', 'profileImage'],
          required: false,
        },
        {
          model: Brand,
          as: 'sharerBrand',
          attributes: ['id', 'brandName', 'username', 'profileImage'],
          required: false,
        },
      ],
      order: [['sharedAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const sharers = shares.map((share) => {
      const shareData = share.toJSON();

      if (shareData.sharerType === SharerType.INFLUENCER && shareData.sharerInfluencer) {
        return {
          id: shareData.sharerInfluencer.id,
          type: 'influencer' as const,
          name: shareData.sharerInfluencer.name,
          username: shareData.sharerInfluencer.username,
          profileImage: shareData.sharerInfluencer.profileImage || null,
          sharedAt: shareData.sharedAt,
        };
      } else if (shareData.sharerType === SharerType.BRAND && shareData.sharerBrand) {
        return {
          id: shareData.sharerBrand.id,
          type: 'brand' as const,
          name: shareData.sharerBrand.brandName,
          username: shareData.sharerBrand.username,
          profileImage: shareData.sharerBrand.profileImage || null,
          sharedAt: shareData.sharedAt,
        };
      }
      return null;
    }).filter((sharer): sharer is NonNullable<typeof sharer> => sharer !== null);

    const totalPages = Math.ceil(count / limit);

    return {
      sharers,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get list of users who viewed a post
   */
  async getPostViewers(
    postId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    viewers: Array<{
      id: number;
      type: 'influencer' | 'brand';
      name: string;
      username: string;
      profileImage: string | null;
      viewedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const post = await this.postModel.findByPk(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const offset = (page - 1) * limit;

    const { count, rows: views } = await this.postViewModel.findAndCountAll({
      where: { postId },
      include: [
        {
          model: Influencer,
          as: 'viewerInfluencer',
          attributes: ['id', 'name', 'username', 'profileImage'],
          required: false,
        },
        {
          model: Brand,
          as: 'viewerBrand',
          attributes: ['id', 'brandName', 'username', 'profileImage'],
          required: false,
        },
      ],
      order: [['viewedAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const viewers = views.map((view) => {
      const viewData = view.toJSON();

      if (viewData.viewerType === ViewerType.INFLUENCER && viewData.viewerInfluencer) {
        return {
          id: viewData.viewerInfluencer.id,
          type: 'influencer' as const,
          name: viewData.viewerInfluencer.name,
          username: viewData.viewerInfluencer.username,
          profileImage: viewData.viewerInfluencer.profileImage || null,
          viewedAt: viewData.viewedAt,
        };
      } else if (viewData.viewerType === ViewerType.BRAND && viewData.viewerBrand) {
        return {
          id: viewData.viewerBrand.id,
          type: 'brand' as const,
          name: viewData.viewerBrand.brandName,
          username: viewData.viewerBrand.username,
          profileImage: viewData.viewerBrand.profileImage || null,
          viewedAt: viewData.viewedAt,
        };
      }
      return null;
    }).filter((viewer): viewer is NonNullable<typeof viewer> => viewer !== null);

    const totalPages = Math.ceil(count / limit);

    return {
      viewers,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Create Razorpay order for boost mode payment
   * Boost mode costs ₹29 and lasts for 24 hours
   */
  async createBoostOrder(
    postId: number,
    userId: number,
    userType: UserType,
  ): Promise<{
    success: boolean;
    message: string;
    post?: any;
    invoice?: any;
    payment?: any;
  }> {
    // Check if post exists and belongs to the user
    const post = await this.postModel.findByPk(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Verify ownership
    if (userType === UserType.INFLUENCER && post.influencerId !== userId) {
      throw new ForbiddenException('You can only boost your own posts');
    }
    if (userType === UserType.BRAND && post.brandId !== userId) {
      throw new ForbiddenException('You can only boost your own posts');
    }

    // Check if post is already boosted
    if (post.isBoosted && post.boostExpiresAt && new Date() < post.boostExpiresAt) {
      throw new BadRequestException('This post is already boosted');
    }

    // Auto-delete old pending payment and invoice
    if (post.boostPaymentStatus === 'pending') {
      await this.postBoostInvoiceModel.destroy({
        where: {
          postId,
          paymentStatus: InvoiceStatus.PENDING,
        },
      });

      // Clear post payment fields
      await post.update({
        boostPaymentStatus: undefined,
        boostOrderId: undefined,
        boostPaymentId: undefined,
        boostAmount: undefined,
      } as any);
    }

    // Get user details with city information for tax calculation
    let cityName = '';
    if (userType === UserType.BRAND) {
      const brand = await this.brandModel.findByPk(userId, {
        include: [
          {
            model: this.postModel.sequelize?.models?.City,
            as: 'headquarterCity',
          },
        ],
      });
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
      cityName = brand.headquarterCity?.name?.toLowerCase() || '';
    } else {
      const influencer = await this.influencerModel.findByPk(userId, {
        include: [
          {
            model: this.postModel.sequelize?.models?.City,
            as: 'city',
          },
        ],
      });
      if (!influencer) {
        throw new NotFoundException('Influencer not found');
      }
      cityName = influencer.city?.name?.toLowerCase() || '';
    }

    // Calculate taxes
    // Total = 2900 paise (Rs 29)
    // Base = 24.58 (in paise: 2458)
    // Tax = 4.42 (in paise: 442)
    const totalAmount = 2900; // Rs 29 in paise
    const baseAmount = 2458; // Rs 24.58 in paise

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let taxAmount = 0;

    // Check if location is Delhi
    const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

    if (isDelhi) {
      // For Delhi: CGST and SGST (total tax = 442 paise = Rs 4.42)
      cgst = 221; // Rs 2.21
      sgst = 221; // Rs 2.21 (total: 442 paise)
      taxAmount = cgst + sgst; // 442
    } else {
      // For other locations: IGST
      igst = 442; // Rs 4.42
      taxAmount = igst;
    }

    // Create invoice with tax breakdown
    const invoice = await this.postBoostInvoiceModel.create({
      invoiceNumber: null,
      postId,
      userType: userType as any,
      brandId: userType === UserType.BRAND ? userId : null,
      influencerId: userType === UserType.INFLUENCER ? userId : null,
      amount: baseAmount,
      tax: taxAmount,
      cgst,
      sgst,
      igst,
      totalAmount,
      paymentStatus: InvoiceStatus.PENDING,
      paymentMethod: PaymentMethod.RAZORPAY,
    });

    // Create Razorpay order
    const razorpayOrder = await this.razorpayService.createOrder(
      invoice.totalAmount / 100, // Amount in Rs
      'INR',
      `POST_BOOST_${postId}_INV_${invoice.id}`,
      {
        postId,
        invoiceId: invoice.id,
        userId,
        userType,
        purpose: 'POST_BOOST',
      },
    );

    if (!razorpayOrder.success) {
      throw new BadRequestException('Failed to create payment order');
    }

    // Update invoice with Razorpay order ID
    await invoice.update({
      razorpayOrderId: razorpayOrder.orderId,
    });

    // Update post with order details
    await post.update({
      boostPaymentStatus: 'pending',
      boostOrderId: razorpayOrder.orderId,
      boostAmount: invoice.totalAmount / 100, // Store in rupees
    });

    return {
      success: true,
      message: 'Boost payment order created successfully',
      post: {
        id: post.id,
        currentStatus: {
          isBoosted: false,
          paymentStatus: 'pending',
        },
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
      },
      payment: {
        orderId: razorpayOrder.orderId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    };
  }

  /**
   * Verify boost payment and activate boost mode
   */
  async verifyAndActivateBoost(
    postId: number,
    userId: number,
    userType: UserType,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<{
    success: boolean;
    message: string;
    post?: Post;
    boostExpiresAt?: Date;
    invoice?: any;
  }> {
    // Verify the post exists and belongs to user
    const post = await this.postModel.findByPk(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Verify ownership
    if (userType === UserType.INFLUENCER && post.influencerId !== userId) {
      throw new ForbiddenException('You can only boost your own posts');
    }
    if (userType === UserType.BRAND && post.brandId !== userId) {
      throw new ForbiddenException('You can only boost your own posts');
    }

    // Verify Razorpay payment
    const isValid = this.razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Verify order ID matches
    if (post.boostOrderId !== razorpayOrderId) {
      throw new BadRequestException('Order ID mismatch');
    }

    // Get invoice
    const invoice = await this.postBoostInvoiceModel.findOne({
      where: {
        postId,
        razorpayOrderId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found for this boost order');
    }

    // Generate invoice number now that payment is confirmed
    const invoiceNumber = await this.generateBoostInvoiceNumber();

    // Update invoice
    await invoice.update({
      invoiceNumber,
      paymentStatus: InvoiceStatus.PAID,
      razorpayPaymentId,
      paidAt: new Date(),
    });

    // Activate boost mode for 24 hours
    const boostedAt = new Date();
    const boostExpiresAt = new Date(boostedAt.getTime() + 24 * 60 * 60 * 1000);

    await post.update({
      isBoosted: true,
      boostedAt,
      boostExpiresAt,
      boostPaymentId: razorpayPaymentId,
      boostPaymentStatus: 'paid',
      boostAmount: invoice.totalAmount / 100, // Store in rupees
    });

    // Reload post with user details
    await post.reload({
      include: [
        {
          model: Influencer,
          attributes: ['id', 'fullName', 'username', 'profileImage'],
        },
        {
          model: Brand,
          attributes: ['id', 'brandName', 'username', 'profileImage'],
        },
      ],
    });

    return {
      success: true,
      message: 'Boost mode activated successfully for 24 hours',
      post,
      boostExpiresAt,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount / 100,
      },
    };
  }

  /**
   * Generate unique invoice number for Post Boost
   * Format: INV-B2602-SEQ
   * Example: INV-B2602-1 (1st boost invoice in Feb 2026)
   */
  private async generateBoostInvoiceNumber(): Promise<string> {
    const year = String(new Date().getFullYear()).slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    const currentPrefix = `INV-B${yearMonth}-`;

    // Fetch all invoices with this prefix
    const invoices = await this.postBoostInvoiceModel.findAll({
      where: {
        invoiceNumber: {
          [Op.like]: `${currentPrefix}%`,
        },
      },
      attributes: ['invoiceNumber'],
    });

    let nextNumber = 1;

    // Find the highest sequence number
    for (const inv of invoices) {
      const parts = inv.invoiceNumber.split('-');
      const n = parseInt(parts[2], 10);
      if (!isNaN(n)) {
        nextNumber = Math.max(nextNumber, n + 1);
      }
    }

    return `${currentPrefix}${nextNumber}`;
  }

  /**
   * Check and expire boosted posts that have exceeded 24 hours
   * Called by cron job
   */
  async expireBoostedPosts(): Promise<void> {
    const now = new Date();

    // Find all posts that are boosted but expired
    const expiredPosts = await this.postModel.findAll({
      where: {
        isBoosted: true,
        boostExpiresAt: {
          [Op.lt]: now,
        },
      },
    });

    // Update all expired posts
    for (const post of expiredPosts) {
      await post.update({
        isBoosted: false,
      });
    }

    if (expiredPosts.length > 0) {
      console.log(`Expired ${expiredPosts.length} boosted posts`);
    }
  }

  /**
   * Get profile views analytics
   * Profile views = unique viewers across all posts by the user
   */
  async getProfileViewsAnalytics(
    userId: number,
    userType: UserType,
    analyticsDto: GetAnalyticsDto,
  ): Promise<ProfileViewsResponseDto> {
    const { startDate, endDate } = this.getDateRange(analyticsDto);

    // Map breakdownBy to internal filter flags
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      analyticsDto.userType = UserTypeFilter.ALL;
    } else {
      analyticsDto.followerType = FollowerFilterType.ALL;
    }

    // Get all posts by this user
    const userPosts = await this.postModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? { influencerId: userId }
          : { brandId: userId }),
        isActive: true,
      },
      attributes: ['id'],
    });

    const postIds = userPosts.map((p) => p.id);

    if (postIds.length === 0) {
      return this.getEmptyAnalyticsResponse(
        'profile_views',
        startDate,
        endDate,
        analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      );
    }

    // Get all views for these posts
    const viewsWhere: any = {
      postId: { [Op.in]: postIds },
      viewedAt: { [Op.between]: [startDate, endDate] },
    };

    // Apply user type filter
    if (
      analyticsDto.userType &&
      analyticsDto.userType !== UserTypeFilter.ALL
    ) {
      viewsWhere.viewerType =
        analyticsDto.userType === UserTypeFilter.BRANDS
          ? ViewerType.BRAND
          : ViewerType.INFLUENCER;
    }

    // Get unique viewers (profile views)
    const views = await this.postViewModel.findAll({
      where: viewsWhere,
      attributes: [
        'viewerType',
        'viewerInfluencerId',
        'viewerBrandId',
        'viewedAt',
      ],
      group: ['viewerType', 'viewerInfluencerId', 'viewerBrandId', 'viewedAt'],
    });

    // Calculate total views (unique viewers)
    const uniqueViewers = new Set();
    views.forEach((view) => {
      const viewerKey =
        view.viewerType === ViewerType.INFLUENCER
          ? `influencer-${view.viewerInfluencerId}`
          : `brand-${view.viewerBrandId}`;
      uniqueViewers.add(viewerKey);
    });
    const totalViews = uniqueViewers.size;

    // Calculate breakdown based on breakdownBy parameter
    let followerBreakdown;
    let userTypeBreakdown;

    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      // Only calculate user type breakdown
      userTypeBreakdown = await this.calculateUserTypeBreakdown(views, userId, userType);
    } else {
      // Only calculate follower breakdown (default)
      followerBreakdown = await this.calculateFollowerBreakdown(
        views,
        userId,
        userType,
        analyticsDto.followerType,
      );
    }

    // Calculate time series data
    const timeSeriesData = await this.calculateTimeSeriesData(
      postIds,
      startDate,
      endDate,
      userId,
      userType,
    );

    // Calculate category breakdown
    const { brandCategories, creatorCategories } =
      await this.calculateCategoryBreakdown(views);

    // Calculate growth percentage
    const previousPeriodData = await this.getPreviousPeriodViews(
      postIds,
      startDate,
      endDate,
    );
    const growthPercentage = this.calculateGrowthPercentage(
      totalViews,
      previousPeriodData,
    );

    // Build response based on breakdown type
    const response: ProfileViewsResponseDto = {
      type: 'profile_views',
      totalViews,
      growthPercentage,
      timeSeriesData,
      topBrandCategories: brandCategories,
      topCreatorCategories: creatorCategories,
      timeframe: analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    } as any;

    // Add breakdown fields based on breakdown type
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE && userTypeBreakdown) {
      response.brands = userTypeBreakdown.brands;
      response.influencers = userTypeBreakdown.influencers;
    } else if (followerBreakdown) {
      response.followers = {
        count: followerBreakdown.followers,
        percentage: this.calculatePercentage(
          followerBreakdown.followers,
          followerBreakdown.total,
        ),
      };
      response.nonFollowers = {
        count: followerBreakdown.nonFollowers,
        percentage: this.calculatePercentage(
          followerBreakdown.nonFollowers,
          followerBreakdown.total,
        ),
      };
    }

    return response;
  }

  /**
   * Get post views analytics
   * Shows views for individual posts
   */
  async getPostViewsAnalytics(
    userId: number,
    userType: UserType,
    analyticsDto: GetAnalyticsDto,
  ): Promise<PostViewsResponseDto> {
    const { startDate, endDate } = this.getDateRange(analyticsDto);

    // Map breakdownBy to internal filter flags
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      analyticsDto.userType = UserTypeFilter.ALL;
    } else {
      analyticsDto.followerType = FollowerFilterType.ALL;
    }

    // Get all posts by this user
    const userPosts = await this.postModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? { influencerId: userId }
          : { brandId: userId }),
        isActive: true,
      },
      attributes: ['id', 'content', 'mediaUrls', 'createdAt', 'viewsCount'],
      order: [['viewsCount', 'DESC']],
    });

    const postIds = userPosts.map((p) => p.id);

    if (postIds.length === 0) {
      return this.getEmptyPostAnalyticsResponse(
        startDate,
        endDate,
        analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      );
    }

    // Get all views for these posts
    const viewsWhere: any = {
      postId: { [Op.in]: postIds },
      viewedAt: { [Op.between]: [startDate, endDate] },
    };

    // Apply user type filter
    if (
      analyticsDto.userType &&
      analyticsDto.userType !== UserTypeFilter.ALL
    ) {
      viewsWhere.viewerType =
        analyticsDto.userType === UserTypeFilter.BRANDS
          ? ViewerType.BRAND
          : ViewerType.INFLUENCER;
    }

    const views = await this.postViewModel.findAll({
      where: viewsWhere,
      attributes: [
        'postId',
        'viewerType',
        'viewerInfluencerId',
        'viewerBrandId',
        'viewedAt',
      ],
    });

    // Calculate total views
    const totalViews = views.length;

    // Calculate breakdown based on breakdownBy parameter
    let followerBreakdown;
    let userTypeBreakdown;

    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      // Only calculate user type breakdown
      userTypeBreakdown = await this.calculateUserTypeBreakdown(views, userId, userType);
    } else {
      // Only calculate follower breakdown (default)
      followerBreakdown = await this.calculateFollowerBreakdown(
        views,
        userId,
        userType,
        analyticsDto.followerType,
      );
    }

    // Calculate time series data
    const timeSeriesData = await this.calculateTimeSeriesData(
      postIds,
      startDate,
      endDate,
      userId,
      userType,
    );

    // Calculate category breakdown
    const { brandCategories, creatorCategories } =
      await this.calculateCategoryBreakdown(views);

    // Get top performing posts
    const topPosts = await this.getTopPosts(postIds, startDate, endDate, 3);

    // Calculate growth percentage
    const previousPeriodData = await this.getPreviousPeriodViews(
      postIds,
      startDate,
      endDate,
    );
    const growthPercentage = this.calculateGrowthPercentage(
      totalViews,
      previousPeriodData,
    );

    // Build response based on breakdown type
    const response: PostViewsResponseDto = {
      type: 'post_views',
      totalViews,
      growthPercentage,
      timeSeriesData,
      topBrandCategories: brandCategories,
      topCreatorCategories: creatorCategories,
      topPosts,
      timeframe: analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    } as any;

    // Add breakdown fields based on breakdown type
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE && userTypeBreakdown) {
      response.brands = userTypeBreakdown.brands;
      response.influencers = userTypeBreakdown.influencers;
    } else if (followerBreakdown) {
      response.followers = {
        count: followerBreakdown.followers,
        percentage: this.calculatePercentage(
          followerBreakdown.followers,
          followerBreakdown.total,
        ),
      };
      response.nonFollowers = {
        count: followerBreakdown.nonFollowers,
        percentage: this.calculatePercentage(
          followerBreakdown.nonFollowers,
          followerBreakdown.total,
        ),
      };
    }

    return response;
  }

  /**
   * Helper method to determine date range based on timeframe
   */
  private getDateRange(analyticsDto: GetAnalyticsDto): {
    startDate: Date;
    endDate: Date;
  } {
    let startDate: Date;
    let endDate: Date = new Date();

    // Custom dates take precedence
    if (analyticsDto.startDate && analyticsDto.endDate) {
      startDate = new Date(analyticsDto.startDate);
      endDate = new Date(analyticsDto.endDate);
    } else {
      // Use timeframe
      const timeframe = analyticsDto.timeframe || TimeframeType.THIRTY_DAYS;
      const now = new Date();
      endDate = now;

      switch (timeframe) {
        case TimeframeType.SEVEN_DAYS:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case TimeframeType.FIFTEEN_DAYS:
          startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
          break;
        case TimeframeType.THIRTY_DAYS:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case TimeframeType.ALL_TIME:
          startDate = new Date('2020-01-01'); // Beginning of platform
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }

  /**
   * Calculate follower vs non-follower breakdown
   */
  private async calculateFollowerBreakdown(
    views: PostView[],
    userId: number,
    userType: UserType,
    followerFilter?: FollowerFilterType,
  ): Promise<{ total: number; followers: number; nonFollowers: number }> {
    if (views.length === 0) {
      return { total: 0, followers: 0, nonFollowers: 0 };
    }

    // Get all followers of this user
    const followersData = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
      },
      attributes: ['followerType', 'followerInfluencerId', 'followerBrandId'],
    });

    // Create a set of follower identifiers
    const followerSet = new Set(
      followersData.map((f) =>
        f.followerType === FollowerType.INFLUENCER
          ? `influencer-${f.followerInfluencerId}`
          : `brand-${f.followerBrandId}`,
      ),
    );

    // Count followers and non-followers
    let followers = 0;
    let nonFollowers = 0;

    // Get unique viewers
    const uniqueViewers = new Set();
    views.forEach((view) => {
      const viewerKey =
        view.viewerType === ViewerType.INFLUENCER
          ? `influencer-${view.viewerInfluencerId}`
          : `brand-${view.viewerBrandId}`;

      if (!uniqueViewers.has(viewerKey)) {
        uniqueViewers.add(viewerKey);

        if (followerSet.has(viewerKey)) {
          followers++;
        } else {
          nonFollowers++;
        }
      }
    });

    // Apply follower filter
    if (followerFilter === FollowerFilterType.FOLLOWERS) {
      return { total: followers, followers, nonFollowers: 0 };
    } else if (followerFilter === FollowerFilterType.NON_FOLLOWERS) {
      return { total: nonFollowers, followers: 0, nonFollowers };
    }

    return { total: followers + nonFollowers, followers, nonFollowers };
  }

  /**
   * Calculate user type breakdown (brands and influencers with their follower breakdown)
   */
  private async calculateUserTypeBreakdown(
    views: PostView[],
    userId: number,
    userType: UserType,
  ): Promise<{ brands: UserTypeBreakdown; influencers: UserTypeBreakdown }> {
    if (views.length === 0) {
      return {
        brands: {
          total: 0,
          percentage: 0,
          followers: 0,
          followersPercentage: 0,
          nonFollowers: 0,
          nonFollowersPercentage: 0,
        },
        influencers: {
          total: 0,
          percentage: 0,
          followers: 0,
          followersPercentage: 0,
          nonFollowers: 0,
          nonFollowersPercentage: 0,
        },
      };
    }

    // Get all followers of this user
    const followersData = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
      },
      attributes: ['followerType', 'followerInfluencerId', 'followerBrandId'],
    });

    // Create a set of follower identifiers
    const followerSet = new Set(
      followersData.map((f) =>
        f.followerType === FollowerType.INFLUENCER
          ? `influencer-${f.followerInfluencerId}`
          : `brand-${f.followerBrandId}`,
      ),
    );

    // Count by user type
    let brandFollowers = 0;
    let brandNonFollowers = 0;
    let influencerFollowers = 0;
    let influencerNonFollowers = 0;

    // Get unique viewers grouped by type
    const uniqueViewers = new Set();
    views.forEach((view) => {
      const viewerKey =
        view.viewerType === ViewerType.INFLUENCER
          ? `influencer-${view.viewerInfluencerId}`
          : `brand-${view.viewerBrandId}`;

      if (!uniqueViewers.has(viewerKey)) {
        uniqueViewers.add(viewerKey);

        const isFollower = followerSet.has(viewerKey);

        if (view.viewerType === ViewerType.BRAND) {
          if (isFollower) {
            brandFollowers++;
          } else {
            brandNonFollowers++;
          }
        } else {
          // ViewerType.INFLUENCER
          if (isFollower) {
            influencerFollowers++;
          } else {
            influencerNonFollowers++;
          }
        }
      }
    });

    const brandTotal = brandFollowers + brandNonFollowers;
    const influencerTotal = influencerFollowers + influencerNonFollowers;
    const grandTotal = brandTotal + influencerTotal;

    return {
      brands: {
        total: brandTotal,
        percentage: this.calculatePercentage(brandTotal, grandTotal),
        followers: brandFollowers,
        followersPercentage: this.calculatePercentage(
          brandFollowers,
          brandTotal,
        ),
        nonFollowers: brandNonFollowers,
        nonFollowersPercentage: this.calculatePercentage(
          brandNonFollowers,
          brandTotal,
        ),
      },
      influencers: {
        total: influencerTotal,
        percentage: this.calculatePercentage(influencerTotal, grandTotal),
        followers: influencerFollowers,
        followersPercentage: this.calculatePercentage(
          influencerFollowers,
          influencerTotal,
        ),
        nonFollowers: influencerNonFollowers,
        nonFollowersPercentage: this.calculatePercentage(
          influencerNonFollowers,
          influencerTotal,
        ),
      },
    };
  }

  /**
   * Calculate time series data for graph
   */
  private async calculateTimeSeriesData(
    postIds: number[],
    startDate: Date,
    endDate: Date,
    userId: number,
    userType: UserType,
  ): Promise<TimeSeriesDataPoint[]> {
    const views = await this.postViewModel.findAll({
      where: {
        postId: { [Op.in]: postIds },
        viewedAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['viewedAt', 'viewerType', 'viewerInfluencerId', 'viewerBrandId'],
      order: [['viewedAt', 'ASC']],
    });

    // Get followers
    const followersData = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
      },
      attributes: ['followerType', 'followerInfluencerId', 'followerBrandId'],
    });

    const followerSet = new Set(
      followersData.map((f) =>
        f.followerType === FollowerType.INFLUENCER
          ? `influencer-${f.followerInfluencerId}`
          : `brand-${f.followerBrandId}`,
      ),
    );

    // Group views by date
    const viewsByDate: Map<string, { followers: number; nonFollowers: number }> = new Map();

    views.forEach((view) => {
      const dateKey = this.formatDateForGraph(view.viewedAt);
      const viewerKey =
        view.viewerType === ViewerType.INFLUENCER
          ? `influencer-${view.viewerInfluencerId}`
          : `brand-${view.viewerBrandId}`;

      if (!viewsByDate.has(dateKey)) {
        viewsByDate.set(dateKey, { followers: 0, nonFollowers: 0 });
      }

      const dateData = viewsByDate.get(dateKey)!;
      if (followerSet.has(viewerKey)) {
        dateData.followers++;
      } else {
        dateData.nonFollowers++;
      }
    });

    // Convert to array and fill missing dates
    const result: TimeSeriesDataPoint[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = this.formatDateForGraph(currentDate);
      const data = viewsByDate.get(dateKey) || { followers: 0, nonFollowers: 0 };

      result.push({
        date: dateKey,
        followers: data.followers,
        nonFollowers: data.nonFollowers,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * Calculate category breakdown by viewer niches
   */
  private async calculateCategoryBreakdown(views: PostView[]): Promise<{
    brandCategories: CategoryBreakdown[];
    creatorCategories: CategoryBreakdown[];
  }> {
    // Get unique brand viewers
    const brandViewerIds = [
      ...new Set(
        views
          .filter((v) => v.viewerType === ViewerType.BRAND)
          .map((v) => v.viewerBrandId),
      ),
    ];

    // Get unique influencer viewers
    const influencerViewerIds = [
      ...new Set(
        views
          .filter((v) => v.viewerType === ViewerType.INFLUENCER)
          .map((v) => v.viewerInfluencerId),
      ),
    ];

    // Get brands with their niches
    const brands = await this.brandModel.findAll({
      where: { id: { [Op.in]: brandViewerIds } },
      include: [
        {
          model: Niche,
          as: 'niches',
          through: { attributes: [] },
          attributes: ['id', 'name'],
        },
      ],
    });

    // Get influencers with their niches
    const influencers = await this.influencerModel.findAll({
      where: { id: { [Op.in]: influencerViewerIds } },
      include: [
        {
          model: Niche,
          as: 'niches',
          through: { attributes: [] },
          attributes: ['id', 'name'],
        },
      ],
    });

    // Count brand categories
    const brandCategoryCount: Map<string, number> = new Map();
    brands.forEach((brand: any) => {
      brand.niches?.forEach((niche: any) => {
        const nicheName = niche.name || 'Other';
        brandCategoryCount.set(
          nicheName,
          (brandCategoryCount.get(nicheName) || 0) + 1,
        );
      });
    });

    // Count influencer categories
    const influencerCategoryCount: Map<string, number> = new Map();
    influencers.forEach((influencer: any) => {
      influencer.niches?.forEach((niche: any) => {
        const nicheName = niche.name || 'Other';
        influencerCategoryCount.set(
          nicheName,
          (influencerCategoryCount.get(nicheName) || 0) + 1,
        );
      });
    });

    // Convert to arrays and calculate percentages
    const brandCategories = this.convertCategoryMapToBreakdown(
      brandCategoryCount,
      brandViewerIds.length,
    );
    const creatorCategories = this.convertCategoryMapToBreakdown(
      influencerCategoryCount,
      influencerViewerIds.length,
    );

    return { brandCategories, creatorCategories };
  }

  /**
   * Convert category map to breakdown array
   */
  private convertCategoryMapToBreakdown(
    categoryMap: Map<string, number>,
    total: number,
  ): CategoryBreakdown[] {
    const breakdown: CategoryBreakdown[] = [];

    categoryMap.forEach((count, category) => {
      breakdown.push({
        category,
        count,
        percentage: this.calculatePercentage(count, total),
      });
    });

    // Sort by count descending and take top 5
    return breakdown.sort((a, b) => b.count - a.count).slice(0, 5);
  }

  /**
   * Get top performing posts by views
   */
  private async getTopPosts(
    postIds: number[],
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<TopPost[]> {
    const viewCounts = await this.postViewModel.findAll({
      where: {
        postId: { [Op.in]: postIds },
        viewedAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'postId',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'viewCount'],
      ],
      group: ['postId'],
      order: [[Sequelize.literal('"viewCount"'), 'DESC']],
      limit,
      raw: true,
    });

    const topPostIds = viewCounts.map((vc: any) => vc.postId);

    const posts = await this.postModel.findAll({
      where: { id: { [Op.in]: topPostIds } },
      attributes: ['id', 'content', 'mediaUrls', 'createdAt'],
    });

    return posts.map((post) => {
      const viewData: any = viewCounts.find((vc: any) => vc.postId === post.id);
      return {
        id: post.id,
        date: this.formatDateForGraph(post.createdAt),
        views: parseInt(viewData?.viewCount || '0'),
        mediaUrl: post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : '',
        content: post.content || '',
      };
    });
  }

  /**
   * Get previous period views for growth calculation
   */
  private async getPreviousPeriodViews(
    postIds: number[],
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const count = await this.postViewModel.count({
      where: {
        postId: { [Op.in]: postIds },
        viewedAt: { [Op.between]: [previousStartDate, previousEndDate] },
      },
    });

    return count;
  }

  /**
   * Calculate growth percentage
   */
  private calculateGrowthPercentage(
    current: number,
    previous: number,
  ): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * Calculate percentage
   */
  private calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  /**
   * Format date for graph display
   */
  private formatDateForGraph(date: Date): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  /**
   * Get empty analytics response
   */
  private getEmptyAnalyticsResponse(
    type: 'profile_views' | 'post_views',
    startDate: Date,
    endDate: Date,
    timeframe: TimeframeType,
  ): any {
    return {
      type,
      totalViews: 0,
      growthPercentage: 0,
      followers: { count: 0, percentage: 0 },
      nonFollowers: { count: 0, percentage: 0 },
      timeSeriesData: [],
      topBrandCategories: [],
      topCreatorCategories: [],
      timeframe,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  /**
   * Get empty post analytics response with topPosts
   */
  private getEmptyPostAnalyticsResponse(
    startDate: Date,
    endDate: Date,
    timeframe: TimeframeType,
  ): PostViewsResponseDto {
    return {
      type: 'post_views',
      totalViews: 0,
      growthPercentage: 0,
      followers: { count: 0, percentage: 0 },
      nonFollowers: { count: 0, percentage: 0 },
      timeSeriesData: [],
      topBrandCategories: [],
      topCreatorCategories: [],
      topPosts: [],
      timeframe,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  /**
   * Get interactions analytics (likes, shares, etc.)
   */
  async getInteractionsAnalytics(
    userId: number,
    userType: UserType,
    analyticsDto: GetAnalyticsDto,
  ): Promise<InteractionsResponseDto> {
    const { startDate, endDate } = this.getDateRange(analyticsDto);

    // Map breakdownBy to internal filter flags
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      analyticsDto.userType = UserTypeFilter.ALL;
    } else {
      analyticsDto.followerType = FollowerFilterType.ALL;
    }

    // Get all posts by this user
    const userPosts = await this.postModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? { influencerId: userId }
          : { brandId: userId }),
        isActive: true,
      },
      attributes: ['id', 'content', 'mediaUrls', 'createdAt', 'likesCount', 'sharesCount'],
    });

    const postIds = userPosts.map((p) => p.id);

    if (postIds.length === 0) {
      return this.getEmptyInteractionsResponse(
        startDate,
        endDate,
        analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      );
    }

    // Get all likes in the timeframe
    const likesWhere: any = {
      postId: { [Op.in]: postIds },
      createdAt: { [Op.between]: [startDate, endDate] },
    };

    // Apply user type filter
    if (analyticsDto.userType && analyticsDto.userType !== UserTypeFilter.ALL) {
      likesWhere.likerType =
        analyticsDto.userType === UserTypeFilter.BRANDS
          ? LikerType.BRAND
          : LikerType.INFLUENCER;
    }

    const likes = await this.likeModel.findAll({
      where: likesWhere,
      attributes: ['likerType', 'likerInfluencerId', 'likerBrandId', 'createdAt'],
    });

    // Get all shares in the timeframe
    const sharesWhere: any = {
      postId: { [Op.in]: postIds },
      createdAt: { [Op.between]: [startDate, endDate] },
    };

    // Apply user type filter
    if (analyticsDto.userType && analyticsDto.userType !== UserTypeFilter.ALL) {
      sharesWhere.sharerType =
        analyticsDto.userType === UserTypeFilter.BRANDS
          ? SharerType.BRAND
          : SharerType.INFLUENCER;
    }

    const shares = await this.shareModel.findAll({
      where: sharesWhere,
      attributes: ['sharerType', 'sharerInfluencerId', 'sharerBrandId', 'createdAt'],
    });

    // Calculate total interactions
    const totalInteractions = likes.length + shares.length;

    // Calculate follower breakdown for interactions
    const interactions = [
      ...likes.map((l) => ({
        userType: l.likerType === LikerType.INFLUENCER ? ViewerType.INFLUENCER : ViewerType.BRAND,
        userId: l.likerType === LikerType.INFLUENCER ? l.likerInfluencerId : l.likerBrandId,
      })),
      ...shares.map((s) => ({
        userType: s.sharerType === SharerType.INFLUENCER ? ViewerType.INFLUENCER : ViewerType.BRAND,
        userId: s.sharerType === SharerType.INFLUENCER ? s.sharerInfluencerId : s.sharerBrandId,
      })),
    ];

    // Calculate breakdown based on breakdownBy parameter
    let followerBreakdown;
    let userTypeBreakdown;

    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      // Only calculate user type breakdown
      userTypeBreakdown = await this.calculateInteractionsUserTypeBreakdown(
        interactions,
        userId,
        userType,
      );
    } else {
      // Only calculate follower breakdown (default)
      followerBreakdown = await this.calculateInteractionsFollowerBreakdown(
        interactions,
        userId,
        userType,
        analyticsDto.followerType,
      );
    }

    // Calculate growth for interactions
    const previousPeriodInteractions = await this.getPreviousPeriodInteractions(
      postIds,
      startDate,
      endDate,
    );

    const growth = totalInteractions - previousPeriodInteractions;
    const growthFormatted = this.formatNumber(Math.abs(growth));

    // Get previous period likes and shares
    const { likes: prevLikes, shares: prevShares } =
      await this.getPreviousPeriodLikesAndShares(postIds, startDate, endDate);

    // Create metrics
    const metrics: InteractionMetric[] = [
      {
        name: 'LIKES',
        count: likes.length,
        growth: likes.length - prevLikes,
        growthFormatted: this.formatNumber(Math.abs(likes.length - prevLikes)),
      },
      {
        name: 'SHARE',
        count: shares.length,
        growth: shares.length - prevShares,
        growthFormatted: this.formatNumber(Math.abs(shares.length - prevShares)),
      },
    ];

    // Get top posts by likes
    const topPostsByLikes = await this.getTopPostsByLikes(postIds, startDate, endDate, 3);

    // Build response based on breakdown type
    const response: InteractionsResponseDto = {
      type: 'interactions',
      totalInteractions,
      totalInteractionsFormatted: this.formatNumberIndian(totalInteractions),
      growth,
      growthFormatted: `${growth >= 0 ? '+' : '-'}${growthFormatted} vs last month`,
      metrics,
      topPostsByLikes,
      timeframe: analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      startDate: this.formatDateShort(startDate),
      endDate: this.formatDateShort(endDate),
    } as any;

    // Add breakdown fields based on breakdown type
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE && userTypeBreakdown) {
      response.brands = userTypeBreakdown.brands;
      response.influencers = userTypeBreakdown.influencers;
    } else if (followerBreakdown) {
      response.followers = {
        count: followerBreakdown.followers,
        percentage: this.calculatePercentage(
          followerBreakdown.followers,
          followerBreakdown.total,
        ),
      };
      response.nonFollowers = {
        count: followerBreakdown.nonFollowers,
        percentage: this.calculatePercentage(
          followerBreakdown.nonFollowers,
          followerBreakdown.total,
        ),
      };
    }

    return response;
  }

  /**
   * Get followers analytics
   * Shows follower count, growth, breakdown by type, and trend over time
   */
  async getFollowersAnalytics(
    userId: number,
    userType: UserType,
    analyticsDto: GetAnalyticsDto,
  ): Promise<FollowersResponseDto> {
    const { startDate, endDate } = this.getDateRange(analyticsDto);

    // Map breakdownBy to internal filter flags
    if (analyticsDto.breakdownBy === BreakdownType.USERTYPE_WISE) {
      analyticsDto.userType = UserTypeFilter.ALL;
    } else {
      analyticsDto.followerType = FollowerFilterType.ALL;
    }

    // Get all current followers
    const currentFollowers = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
      },
      attributes: [
        'id',
        'followerType',
        'followerInfluencerId',
        'followerBrandId',
        'createdAt',
      ],
    });

    const netFollowers = currentFollowers.length;

    // Get followers gained in the timeframe
    const followersGained = currentFollowers.filter(
      (f) => f.createdAt >= startDate && f.createdAt <= endDate,
    );

    // Get followers lost in the timeframe (followers who unfollowed)
    // For now, we'll simulate this with a query - in production you'd need an unfollows table
    const followersLost: any[] = [];

    // Calculate breakdown by follower type
    const creatorsCount = currentFollowers.filter(
      (f) => f.followerType === FollowerType.INFLUENCER,
    ).length;
    const brandsCount = currentFollowers.filter(
      (f) => f.followerType === FollowerType.BRAND,
    ).length;

    const breakdown: FollowerTypeBreakdown[] = [
      {
        count: creatorsCount,
        percentage: this.calculatePercentage(creatorsCount, netFollowers),
        label: 'Creators',
      },
      {
        count: brandsCount,
        percentage: this.calculatePercentage(brandsCount, netFollowers),
        label: 'Brands',
      },
    ];

    // Calculate followers gain breakdown
    const gainedCreatorsCount = followersGained.filter(
      (f) => f.followerType === FollowerType.INFLUENCER,
    ).length;
    const gainedBrandsCount = followersGained.filter(
      (f) => f.followerType === FollowerType.BRAND,
    ).length;
    const totalGained = followersGained.length;

    const followersGainData: FollowersGainLost = {
      total: totalGained,
      growthFormatted: `+${this.formatNumber(totalGained)} vs last month`,
      creators: gainedCreatorsCount,
      creatorsPercentage: this.calculatePercentage(
        gainedCreatorsCount,
        totalGained,
      ),
      brands: gainedBrandsCount,
      brandsPercentage: this.calculatePercentage(gainedBrandsCount, totalGained),
    };

    // Calculate followers lost breakdown
    const lostCreatorsCount = followersLost.filter(
      (f) => f.followerType === FollowerType.INFLUENCER,
    ).length;
    const lostBrandsCount = followersLost.filter(
      (f) => f.followerType === FollowerType.BRAND,
    ).length;
    const totalLost = followersLost.length;

    const followersLostData: FollowersGainLost = {
      total: totalLost,
      growthFormatted: `-${this.formatNumber(totalLost)} vs last month`,
      creators: lostCreatorsCount,
      creatorsPercentage: this.calculatePercentage(lostCreatorsCount, totalLost),
      brands: lostBrandsCount,
      brandsPercentage: this.calculatePercentage(lostBrandsCount, totalLost),
    };

    // Calculate followers trend over time
    const followersTrend = await this.calculateFollowersTrend(
      userId,
      userType,
      startDate,
      endDate,
    );

    // Get top posts by followers gained
    const topPostsByFollowers = await this.getTopPostsByFollowersGained(
      userId,
      userType,
      startDate,
      endDate,
      3,
    );

    // Calculate niche breakdown for brands
    const topBrandNiches = await this.calculateFollowerNicheBreakdown(
      userId,
      userType,
      FollowerType.BRAND,
    );

    // Calculate niche breakdown for creators
    const topCreatorNiches = await this.calculateFollowerNicheBreakdown(
      userId,
      userType,
      FollowerType.INFLUENCER,
    );

    // Calculate growth vs previous period
    const previousPeriodStart = new Date(startDate);
    const previousPeriodEnd = new Date(startDate);
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    previousPeriodStart.setDate(previousPeriodStart.getDate() - daysDiff);

    const previousFollowersGained = await this.followModel.count({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
        createdAt: {
          [Op.between]: [previousPeriodStart, previousPeriodEnd],
        },
      },
    });

    const growth = totalGained - previousFollowersGained;

    return {
      type: 'followers',
      netFollowers,
      netFollowersFormatted: this.formatNumberIndian(netFollowers),
      growth,
      growthFormatted: `${growth >= 0 ? '+' : '-'}${this.formatNumber(Math.abs(growth))} vs last month`,
      breakdown,
      followersGain: followersGainData,
      followersLost: followersLostData,
      followersTrend,
      topPostsByFollowers,
      topBrandNiches,
      topCreatorNiches,
      timeframe: analyticsDto.timeframe || TimeframeType.THIRTY_DAYS,
      startDate: this.formatDateShort(startDate),
      endDate: this.formatDateShort(endDate),
    };
  }

  /**
   * Calculate followers trend over time
   */
  private async calculateFollowersTrend(
    userId: number,
    userType: UserType,
    startDate: Date,
    endDate: Date,
  ): Promise<FollowersTrendDataPoint[]> {
    const trend: FollowersTrendDataPoint[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const count = await this.followModel.count({
        where: {
          ...(userType === UserType.INFLUENCER
            ? {
                followingType: FollowingType.INFLUENCER,
                followingInfluencerId: userId,
              }
            : {
                followingType: FollowingType.BRAND,
                followingBrandId: userId,
              }),
          createdAt: { [Op.lte]: currentDate },
        },
      });

      trend.push({
        date: this.formatDateForGraph(currentDate),
        count,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trend;
  }

  /**
   * Get top posts by followers gained
   */
  private async getTopPostsByFollowersGained(
    userId: number,
    userType: UserType,
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<TopPostByFollowers[]> {
    // Get all posts by this user
    const userPosts = await this.postModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? { influencerId: userId }
          : { brandId: userId }),
        isActive: true,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['id', 'content', 'mediaUrls', 'createdAt', 'viewsCount'],
    });

    // For each post, count how many followers were gained within 24 hours of posting
    const postsWithFollowers = await Promise.all(
      userPosts.map(async (post) => {
        const postDate = new Date(post.createdAt);
        const nextDay = new Date(postDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const followersGained = await this.followModel.count({
          where: {
            ...(userType === UserType.INFLUENCER
              ? {
                  followingType: FollowingType.INFLUENCER,
                  followingInfluencerId: userId,
                }
              : {
                  followingType: FollowingType.BRAND,
                  followingBrandId: userId,
                }),
            createdAt: { [Op.between]: [postDate, nextDay] },
          },
        });

        return {
          id: post.id,
          date: this.formatDateShort(post.createdAt),
          followersGained,
          views: post.viewsCount || 0,
          mediaUrl:
            post.mediaUrls && post.mediaUrls.length > 0
              ? post.mediaUrls[0]
              : '',
          content: post.content || '',
        };
      }),
    );

    // Sort by followers gained and take top N
    return postsWithFollowers
      .sort((a, b) => b.followersGained - a.followersGained)
      .slice(0, limit);
  }

  /**
   * Calculate follower niche breakdown
   */
  private async calculateFollowerNicheBreakdown(
    userId: number,
    userType: UserType,
    followerType: FollowerType,
  ): Promise<CategoryBreakdown[]> {
    // Get all followers of this type
    const followers = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
        followerType,
      },
      attributes: ['followerInfluencerId', 'followerBrandId'],
    });

    if (followers.length === 0) {
      return [];
    }

    // Get niches for these followers
    const nicheMap = new Map<string, number>();

    for (const follower of followers) {
      let niches: any[] = [];

      if (followerType === FollowerType.INFLUENCER && follower.followerInfluencerId) {
        const influencer = await this.influencerModel.findOne({
          where: { id: follower.followerInfluencerId },
          include: [
            {
              model: Niche,
              as: 'niches',
              through: { attributes: [] },
            },
          ],
        });

        niches = influencer?.niches?.map((n) => n.name) || [];
      } else if (followerType === FollowerType.BRAND && follower.followerBrandId) {
        const brand = await this.brandModel.findOne({
          where: { id: follower.followerBrandId },
          include: [
            {
              model: Niche,
              as: 'niches',
              through: { attributes: [] },
            },
          ],
        });

        niches = brand?.niches?.map((n) => n.name) || [];
      }

      niches.forEach((niche) => {
        nicheMap.set(niche, (nicheMap.get(niche) || 0) + 1);
      });
    }

    // Convert to array and sort
    const breakdown: CategoryBreakdown[] = Array.from(nicheMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: this.calculatePercentage(count, followers.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return breakdown;
  }

  /**
   * Calculate follower breakdown for interactions
   */
  private async calculateInteractionsFollowerBreakdown(
    interactions: Array<{ userType: ViewerType; userId: number }>,
    userId: number,
    userType: UserType,
    followerFilter?: FollowerFilterType,
  ): Promise<{ total: number; followers: number; nonFollowers: number }> {
    if (interactions.length === 0) {
      return { total: 0, followers: 0, nonFollowers: 0 };
    }

    // Get all followers of this user
    const followersData = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
      },
      attributes: ['followerType', 'followerInfluencerId', 'followerBrandId'],
    });

    // Create a set of follower identifiers
    const followerSet = new Set(
      followersData.map((f) =>
        f.followerType === FollowerType.INFLUENCER
          ? `influencer-${f.followerInfluencerId}`
          : `brand-${f.followerBrandId}`,
      ),
    );

    // Count followers and non-followers
    let followers = 0;
    let nonFollowers = 0;

    interactions.forEach((interaction) => {
      const interactorKey =
        interaction.userType === ViewerType.INFLUENCER
          ? `influencer-${interaction.userId}`
          : `brand-${interaction.userId}`;

      if (followerSet.has(interactorKey)) {
        followers++;
      } else {
        nonFollowers++;
      }
    });

    // Apply follower filter
    if (followerFilter === FollowerFilterType.FOLLOWERS) {
      return { total: followers, followers, nonFollowers: 0 };
    } else if (followerFilter === FollowerFilterType.NON_FOLLOWERS) {
      return { total: nonFollowers, followers: 0, nonFollowers };
    }

    return { total: followers + nonFollowers, followers, nonFollowers };
  }

  /**
   * Calculate user type breakdown for interactions
   */
  private async calculateInteractionsUserTypeBreakdown(
    interactions: Array<{ userType: ViewerType; userId: number }>,
    userId: number,
    userType: UserType,
  ): Promise<{ brands: UserTypeBreakdown; influencers: UserTypeBreakdown }> {
    if (interactions.length === 0) {
      return {
        brands: {
          total: 0,
          percentage: 0,
          followers: 0,
          followersPercentage: 0,
          nonFollowers: 0,
          nonFollowersPercentage: 0,
        },
        influencers: {
          total: 0,
          percentage: 0,
          followers: 0,
          followersPercentage: 0,
          nonFollowers: 0,
          nonFollowersPercentage: 0,
        },
      };
    }

    // Get all followers of this user
    const followersData = await this.followModel.findAll({
      where: {
        ...(userType === UserType.INFLUENCER
          ? {
              followingType: FollowingType.INFLUENCER,
              followingInfluencerId: userId,
            }
          : {
              followingType: FollowingType.BRAND,
              followingBrandId: userId,
            }),
      },
      attributes: ['followerType', 'followerInfluencerId', 'followerBrandId'],
    });

    // Create a set of follower identifiers
    const followerSet = new Set(
      followersData.map((f) =>
        f.followerType === FollowerType.INFLUENCER
          ? `influencer-${f.followerInfluencerId}`
          : `brand-${f.followerBrandId}`,
      ),
    );

    // Count by user type
    let brandFollowers = 0;
    let brandNonFollowers = 0;
    let influencerFollowers = 0;
    let influencerNonFollowers = 0;

    interactions.forEach((interaction) => {
      const interactorKey =
        interaction.userType === ViewerType.INFLUENCER
          ? `influencer-${interaction.userId}`
          : `brand-${interaction.userId}`;

      const isFollower = followerSet.has(interactorKey);

      if (interaction.userType === ViewerType.BRAND) {
        if (isFollower) {
          brandFollowers++;
        } else {
          brandNonFollowers++;
        }
      } else {
        // ViewerType.INFLUENCER
        if (isFollower) {
          influencerFollowers++;
        } else {
          influencerNonFollowers++;
        }
      }
    });

    const brandTotal = brandFollowers + brandNonFollowers;
    const influencerTotal = influencerFollowers + influencerNonFollowers;
    const grandTotal = brandTotal + influencerTotal;

    return {
      brands: {
        total: brandTotal,
        percentage: this.calculatePercentage(brandTotal, grandTotal),
        followers: brandFollowers,
        followersPercentage: this.calculatePercentage(
          brandFollowers,
          brandTotal,
        ),
        nonFollowers: brandNonFollowers,
        nonFollowersPercentage: this.calculatePercentage(
          brandNonFollowers,
          brandTotal,
        ),
      },
      influencers: {
        total: influencerTotal,
        percentage: this.calculatePercentage(influencerTotal, grandTotal),
        followers: influencerFollowers,
        followersPercentage: this.calculatePercentage(
          influencerFollowers,
          influencerTotal,
        ),
        nonFollowers: influencerNonFollowers,
        nonFollowersPercentage: this.calculatePercentage(
          influencerNonFollowers,
          influencerTotal,
        ),
      },
    };
  }

  /**
   * Get previous period interactions count
   */
  private async getPreviousPeriodInteractions(
    postIds: number[],
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const likesCount = await this.likeModel.count({
      where: {
        postId: { [Op.in]: postIds },
        createdAt: { [Op.between]: [previousStartDate, previousEndDate] },
      },
    });

    const sharesCount = await this.shareModel.count({
      where: {
        postId: { [Op.in]: postIds },
        createdAt: { [Op.between]: [previousStartDate, previousEndDate] },
      },
    });

    return likesCount + sharesCount;
  }

  /**
   * Get previous period likes and shares counts
   */
  private async getPreviousPeriodLikesAndShares(
    postIds: number[],
    startDate: Date,
    endDate: Date,
  ): Promise<{ likes: number; shares: number }> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const likes = await this.likeModel.count({
      where: {
        postId: { [Op.in]: postIds },
        createdAt: { [Op.between]: [previousStartDate, previousEndDate] },
      },
    });

    const shares = await this.shareModel.count({
      where: {
        postId: { [Op.in]: postIds },
        createdAt: { [Op.between]: [previousStartDate, previousEndDate] },
      },
    });

    return { likes, shares };
  }

  /**
   * Get top posts by likes
   */
  private async getTopPostsByLikes(
    postIds: number[],
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<TopPostByLikes[]> {
    const likeCounts = await this.likeModel.findAll({
      where: {
        postId: { [Op.in]: postIds },
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'postId',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'likeCount'],
      ],
      group: ['postId'],
      order: [[Sequelize.literal('"likeCount"'), 'DESC']],
      limit,
      raw: true,
    });

    const topPostIds = likeCounts.map((lc: any) => lc.postId);

    const posts = await this.postModel.findAll({
      where: { id: { [Op.in]: topPostIds } },
      attributes: ['id', 'content', 'mediaUrls', 'createdAt'],
    });

    return posts.map((post) => {
      const likeData: any = likeCounts.find((lc: any) => lc.postId === post.id);
      const likes = parseInt(likeData?.likeCount || '0');
      return {
        id: post.id,
        date: this.formatDateForGraph(post.createdAt),
        likes,
        likesFormatted: this.formatNumber(likes),
        mediaUrl:
          post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : '',
        content: post.content || '',
      };
    });
  }

  /**
   * Format number in K format (e.g., 32000 -> 32k)
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  }

  /**
   * Format number in Indian format (e.g., 100000 -> 10,00,00)
   */
  private formatNumberIndian(num: number): string {
    return num.toLocaleString('en-IN');
  }

  /**
   * Format date as "Aug 1 - Sep1"
   */
  private formatDateShort(date: Date): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  /**
   * Get empty interactions response
   */
  private getEmptyInteractionsResponse(
    startDate: Date,
    endDate: Date,
    timeframe: TimeframeType,
  ): InteractionsResponseDto {
    return {
      type: 'interactions',
      totalInteractions: 0,
      totalInteractionsFormatted: '0',
      growth: 0,
      growthFormatted: '+0 vs last month',
      followers: { count: 0, percentage: 0 },
      nonFollowers: { count: 0, percentage: 0 },
      metrics: [
        { name: 'LIKES', count: 0, growth: 0, growthFormatted: '0' },
        { name: 'SHARE', count: 0, growth: 0, growthFormatted: '0' },
      ],
      topPostsByLikes: [],
      timeframe,
      startDate: this.formatDateShort(startDate),
      endDate: this.formatDateShort(endDate),
    };
  }
}
