import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProfileView, ViewedUserType, ViewerType } from '../models/profile-view.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export interface TrackProfileViewDto {
  viewedUserId: number;
  viewedUserType: 'influencer' | 'brand';
  viewerId: number;
  viewerType: 'influencer' | 'brand';
}

@Injectable()
export class ProfileViewService {
  constructor(
    @InjectModel(ProfileView)
    private readonly profileViewModel: typeof ProfileView,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
  ) {}

  /**
   * Track a profile view
   * UNIQUE counting: Each viewer is counted only ONCE per profile (lifetime)
   * Subsequent views update the timestamp but don't increment the count
   */
  async trackView(data: TrackProfileViewDto): Promise<{
    success: boolean;
    message: string;
    isNewView: boolean;
    viewsCount?: number;
  }> {
    try {
      // Verify viewed user exists
      if (data.viewedUserType === 'influencer') {
        const influencer = await this.influencerModel.findByPk(data.viewedUserId);
        if (!influencer) {
          throw new NotFoundException('Influencer not found');
        }
      } else {
        const brand = await this.brandModel.findByPk(data.viewedUserId);
        if (!brand) {
          throw new NotFoundException('Brand not found');
        }
      }

      // Prevent users from viewing their own profile (no tracking)
      if (
        data.viewedUserId === data.viewerId &&
        data.viewedUserType === data.viewerType
      ) {
        return {
          success: true,
          message: 'Own profile view not tracked',
          isNewView: false,
        };
      }

      const viewData: any = {
        viewedUserType: data.viewedUserType === 'influencer'
          ? ViewedUserType.INFLUENCER
          : ViewedUserType.BRAND,
        viewerType: data.viewerType === 'influencer'
          ? ViewerType.INFLUENCER
          : ViewerType.BRAND,
        viewedAt: new Date(),
      };

      // Set viewed user ID
      if (data.viewedUserType === 'influencer') {
        viewData.viewedInfluencerId = data.viewedUserId;
        viewData.viewedBrandId = null;
      } else {
        viewData.viewedBrandId = data.viewedUserId;
        viewData.viewedInfluencerId = null;
      }

      // Set viewer ID
      if (data.viewerType === 'influencer') {
        viewData.viewerInfluencerId = data.viewerId;
        viewData.viewerBrandId = null;
      } else {
        viewData.viewerBrandId = data.viewerId;
        viewData.viewerInfluencerId = null;
      }

      // Use findOrCreate to ensure unique tracking per viewer
      // This will only create a new record if this viewer has NEVER viewed this profile before
      const [view, created] = await this.profileViewModel.findOrCreate({
        where: {
          viewedUserType: viewData.viewedUserType,
          ...(data.viewedUserType === 'influencer'
            ? { viewedInfluencerId: data.viewedUserId }
            : { viewedBrandId: data.viewedUserId }),
          viewerType: viewData.viewerType,
          ...(data.viewerType === 'influencer'
            ? { viewerInfluencerId: data.viewerId }
            : { viewerBrandId: data.viewerId }),
        },
        defaults: viewData,
      });

      let viewsCount: number | undefined;

      if (created) {
        // NEW UNIQUE VIEWER - Increment the count
        if (data.viewedUserType === 'influencer') {
          await this.influencerModel.increment('profileViewsCount', {
            by: 1,
            where: { id: data.viewedUserId },
          });

          const influencer = await this.influencerModel.findByPk(data.viewedUserId, {
            attributes: ['profileViewsCount'],
          });
          viewsCount = influencer?.profileViewsCount;
        } else {
          await this.brandModel.increment('profileViewsCount', {
            by: 1,
            where: { id: data.viewedUserId },
          });

          const brand = await this.brandModel.findByPk(data.viewedUserId, {
            attributes: ['profileViewsCount'],
          });
          viewsCount = brand?.profileViewsCount;
        }

        return {
          success: true,
          message: 'New unique profile view tracked',
          isNewView: true,
          viewsCount,
        };
      } else {
        // REPEAT VIEW - Just update the timestamp, don't increment count
        await view.update({
          viewedAt: new Date(),
        });

        return {
          success: true,
          message: 'Repeat view - timestamp updated, count unchanged',
          isNewView: false,
        };
      }
    } catch (error) {
      console.error('Error tracking profile view:', error);
      throw error;
    }
  }

  /**
   * Get profile view count for a user
   */
  async getProfileViewCount(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<number> {
    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId, {
        attributes: ['profileViewsCount'],
      });
      return influencer?.profileViewsCount || 0;
    } else {
      const brand = await this.brandModel.findByPk(userId, {
        attributes: ['profileViewsCount'],
      });
      return brand?.profileViewsCount || 0;
    }
  }

  /**
   * Get list of users who viewed a profile
   */
  async getProfileViewers(
    userId: number,
    userType: 'influencer' | 'brand',
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    viewers: Array<{
      id: number;
      type: string;
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
    const offset = (page - 1) * limit;

    const whereClause: any = {
      viewedUserType: userType === 'influencer'
        ? ViewedUserType.INFLUENCER
        : ViewedUserType.BRAND,
    };

    if (userType === 'influencer') {
      whereClause.viewedInfluencerId = userId;
    } else {
      whereClause.viewedBrandId = userId;
    }

    const { count, rows } = await this.profileViewModel.findAndCountAll({
      where: whereClause,
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
    });

    const viewers = rows.map((view) => {
      if (view.viewerType === ViewerType.INFLUENCER && view.viewerInfluencer) {
        return {
          id: view.viewerInfluencer.id,
          type: 'influencer',
          name: view.viewerInfluencer.name,
          username: view.viewerInfluencer.username,
          profileImage: view.viewerInfluencer.profileImage,
          viewedAt: view.viewedAt,
        };
      } else if (view.viewerType === ViewerType.BRAND && view.viewerBrand) {
        return {
          id: view.viewerBrand.id,
          type: 'brand',
          name: view.viewerBrand.brandName,
          username: view.viewerBrand.username,
          profileImage: view.viewerBrand.profileImage,
          viewedAt: view.viewedAt,
        };
      }
      return null;
    }).filter(Boolean) as Array<{
      id: number;
      type: string;
      name: string;
      username: string;
      profileImage: string | null;
      viewedAt: Date;
    }>;

    return {
      viewers,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }
}
