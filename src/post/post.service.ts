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
import { FollowDto, FollowUserType } from './dto/follow.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { Op } from 'sequelize';

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
  ) {}

  async createPost(
    createPostDto: CreatePostDto,
    userType: UserType,
    userId: number,
  ): Promise<Post> {
    const postData: any = {
      content: createPostDto.content,
      mediaUrls: createPostDto.mediaUrls || [],
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
    updatePostDto: UpdatePostDto,
    userType: UserType,
    userId: number,
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

    await post.update(updatePostDto);
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
      return { followed: true };
    }
  }

  async getPosts(
    getPostsDto: GetPostsDto,
    currentUserType?: UserType,
    currentUserId?: number,
  ): Promise<{
    posts: Post[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, userType, userId } = getPostsDto;
    const offset = (page - 1) * limit;

    let whereCondition: any = { isActive: true };
    let includeCondition: any[] = [];

    if (userType && userId) {
      if (userType === 'influencer') {
        whereCondition.influencerId = userId;
        whereCondition.userType = UserType.INFLUENCER;
      } else if (userType === 'brand') {
        whereCondition.brandId = userId;
        whereCondition.userType = UserType.BRAND;
      }
    } else if (currentUserId && currentUserType) {
      const userNiches = await this.getUserNiches(
        currentUserType,
        currentUserId,
      );
      const followingUsers = await this.getFollowingUsers(
        currentUserType,
        currentUserId,
      );

      const relevantUserIds = await this.getRelevantUserIds(
        userNiches,
        followingUsers,
      );

      if (
        relevantUserIds.influencerIds.length > 0 ||
        relevantUserIds.brandIds.length > 0
      ) {
        whereCondition = {
          ...whereCondition,
          [Op.or]: [
            ...(relevantUserIds.influencerIds.length > 0
              ? [
                  {
                    userType: UserType.INFLUENCER,
                    influencerId: { [Op.in]: relevantUserIds.influencerIds },
                  },
                ]
              : []),
            ...(relevantUserIds.brandIds.length > 0
              ? [
                  {
                    userType: UserType.BRAND,
                    brandId: { [Op.in]: relevantUserIds.brandIds },
                  },
                ]
              : []),
            ...(currentUserType === UserType.INFLUENCER
              ? [
                  {
                    userType: UserType.INFLUENCER,
                    influencerId: currentUserId,
                  },
                ]
              : []),
            ...(currentUserType === UserType.BRAND
              ? [
                  {
                    userType: UserType.BRAND,
                    brandId: currentUserId,
                  },
                ]
              : []),
          ],
        };
      }
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
      order: [
        ['createdAt', 'DESC'],
        ['likesCount', 'DESC'],
      ],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    return {
      posts,
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

  private async getRelevantUserIds(
    userNiches: number[],
    followingUsers: { influencerIds: number[]; brandIds: number[] },
  ): Promise<{ influencerIds: number[]; brandIds: number[] }> {
    const relevantInfluencerIds = new Set(followingUsers.influencerIds);
    const relevantBrandIds = new Set(followingUsers.brandIds);

    if (userNiches.length > 0) {
      const influencersWithSimilarNiches = await InfluencerNiche.findAll({
        where: { nicheId: { [Op.in]: userNiches } },
        attributes: ['influencerId'],
      });

      const brandsWithSimilarNiches = await BrandNiche.findAll({
        where: { nicheId: { [Op.in]: userNiches } },
        attributes: ['brandId'],
      });

      influencersWithSimilarNiches.forEach((item) =>
        relevantInfluencerIds.add(item.influencerId),
      );
      brandsWithSimilarNiches.forEach((item) =>
        relevantBrandIds.add(item.brandId),
      );
    }

    return {
      influencerIds: Array.from(relevantInfluencerIds),
      brandIds: Array.from(relevantBrandIds),
    };
  }

  async getPostById(postId: number): Promise<Post> {
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

    return post;
  }
}
