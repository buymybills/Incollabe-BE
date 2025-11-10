import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Post, UserType } from '../../post/models/post.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { City } from '../../shared/models/city.model';
import { Niche } from '../../auth/model/niche.model';

@Injectable()
export class AdminPostService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
  ) {}

  async getPosts(filters: any): Promise<any> {
    const {
      postFilter,
      searchQuery,
      userSearch,
      locationSearch,
      sortBy = 'createdAt',
      page = 1,
      limit = 20,
    } = filters;

    // Build base where conditions
    const whereConditions: any = {
      isActive: true,
    };

    // Apply post filter (user type: all, influencer, brand)
    switch (postFilter) {
      case 'influencerPosts':
        whereConditions.userType = UserType.INFLUENCER;
        break;
      case 'brandPosts':
        whereConditions.userType = UserType.BRAND;
        break;
      case 'allPosts':
      default:
        // No user type filter for all posts
        break;
    }

    // Apply content search
    if (searchQuery && searchQuery.trim()) {
      whereConditions.content = { [Op.iLike]: `%${searchQuery.trim()}%` };
    }

    // Build include for influencer
    const influencerInclude: any = {
      model: Influencer,
      attributes: ['id', 'name', 'username', 'profileImage', 'cityId'],
      required: false,
      include: [
        {
          model: City,
          as: 'city',
          attributes: ['id', 'name'],
        },
        {
          model: Niche,
          as: 'niches',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
    };

    // Build include for brand
    const brandInclude: any = {
      model: Brand,
      attributes: [
        'id',
        'brandName',
        'username',
        'profileImage',
        'headquarterCityId',
      ],
      required: false,
      include: [
        {
          model: City,
          as: 'headquarterCity',
          attributes: ['id', 'name'],
        },
        {
          model: Niche,
          as: 'niches',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
    };

    // Apply user search (influencer or brand name)
    if (userSearch && userSearch.trim()) {
      const userSearchTerm = `%${userSearch.trim()}%`;
      influencerInclude.where = {
        [Op.or]: [
          { name: { [Op.iLike]: userSearchTerm } },
          { username: { [Op.iLike]: userSearchTerm } },
        ],
      };
      brandInclude.where = {
        [Op.or]: [
          { brandName: { [Op.iLike]: userSearchTerm } },
          { username: { [Op.iLike]: userSearchTerm } },
        ],
      };
    }

    // Apply location search
    if (locationSearch && locationSearch.trim()) {
      influencerInclude.include[0].where = {
        name: { [Op.iLike]: `%${locationSearch.trim()}%` },
      };
      brandInclude.include[0].where = {
        name: { [Op.iLike]: `%${locationSearch.trim()}%` },
      };
    }

    // Determine sort order
    let order: any = [['createdAt', 'DESC']];
    switch (sortBy) {
      case 'createdAt':
        order = [['createdAt', 'DESC']];
        break;
      case 'likes':
        order = [['likesCount', 'DESC']];
        break;
      case 'engagement':
        // Sort by likes count (engagement)
        order = [['likesCount', 'DESC']];
        break;
      default:
        order = [['createdAt', 'DESC']];
        break;
    }

    // Fetch posts with pagination
    const { rows: posts, count: total } = await this.postModel.findAndCountAll({
      where: whereConditions,
      include: [influencerInclude, brandInclude],
      order,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    // Enrich posts with user and location data
    const enrichedPosts = posts.map((post) => {
      const postJson = post.toJSON();
      let userName: string | null = null;
      let userImage: string | null = null;
      let username: string | null = null;
      let city: string | null = null;
      let niches: string[] = [];

      if (post.userType === UserType.INFLUENCER && postJson.influencer) {
        userName = postJson.influencer.name;
        userImage = postJson.influencer.profileImage || null;
        username = postJson.influencer.username;
        city = postJson.influencer.city?.name || null;
        niches = postJson.influencer.niches?.map((n: any) => n.name) || [];
      } else if (post.userType === UserType.BRAND && postJson.brand) {
        userName = postJson.brand.brandName;
        userImage = postJson.brand.profileImage || null;
        username = postJson.brand.username;
        city = postJson.brand.headquarterCity?.name || null;
        niches = postJson.brand.niches?.map((n: any) => n.name) || [];
      }

      return {
        id: post.id,
        content: post.content,
        media: this.getMediaArray(post.mediaUrls),
        userType: post.userType,
        userId:
          post.userType === UserType.INFLUENCER
            ? post.influencerId
            : post.brandId,
        userName,
        username,
        userImage,
        location: city || null,
        categories: niches,
        likesCount: post.likesCount || 0,
        engagement: post.likesCount || 0,
        createdAt: post.createdAt,
        isActive: post.isActive,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      posts: enrichedPosts,
      total,
      page,
      limit,
      totalPages,
    };
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

  private getMediaType(url: string): 'video' | 'image' {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
    const lowerUrl = url.toLowerCase();

    for (const ext of videoExtensions) {
      if (lowerUrl.includes(ext)) {
        return 'video';
      }
    }

    return 'image';
  }
}
