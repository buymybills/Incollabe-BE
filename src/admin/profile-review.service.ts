import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  ProfileReview,
  ReviewStatus,
  ProfileType,
} from './models/profile-review.model';
import { Admin } from './models/admin.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { EmailService } from '../shared/email.service';
import { WhatsAppService } from '../shared/whatsapp.service';
import { ProfileReviewDto } from './dto/profile-review.dto';

@Injectable()
export class ProfileReviewService {
  constructor(
    @InjectModel(ProfileReview)
    private readonly profileReviewModel: typeof ProfileReview,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async createProfileReview(createData: any) {
    const { profileId, profileType, submittedData } = createData;

    // Check if review already exists
    const existingReview = await this.profileReviewModel.findOne({
      where: { profileId, profileType, status: ReviewStatus.PENDING },
    });

    if (existingReview) {
      // Update existing review
      await existingReview.update({
        submittedData,
        submittedAt: new Date(),
      });
      return {
        message: 'Profile review request updated successfully',
        review: existingReview,
      };
    }

    const review = await this.profileReviewModel.create({
      profileId,
      profileType,
      submittedData,
      status: ReviewStatus.PENDING,
      submittedAt: new Date(),
    });

    // Send email notification to admins
    try {
      await this.notifyAdminsOfPendingProfile(profileId, profileType);
    } catch (error) {
      // Log error but don't fail the creation
      console.error('Failed to send email notification:', error);
    }

    return {
      message: 'Profile review request submitted successfully',
      review,
    };
  }

  async getPendingProfiles(adminId: number) {
    const profiles = await this.profileReviewModel.findAll({
      where: { status: ReviewStatus.PENDING },
      include: [
        {
          model: Admin,
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['submittedAt', 'ASC']],
    });

    // Fetch actual profile data
    const enrichedProfiles = await Promise.all(
      profiles.map(async (review) => {
        let profileData: any = null;

        if (review.profileType === ProfileType.BRAND) {
          profileData = await this.brandModel.findByPk(review.profileId, {
            attributes: [
              'id',
              'brandName',
              'email',
              'legalEntityName',
              'websiteUrl',
              'isProfileCompleted',
            ],
          });
        } else if (review.profileType === ProfileType.INFLUENCER) {
          profileData = await this.influencerModel.findByPk(review.profileId, {
            attributes: [
              'id',
              'name',
              'phone',
              'username',
              'profileImage',
              'isProfileCompleted',
            ],
          });
        }

        return {
          ...review.toJSON(),
          profile: profileData,
        };
      }),
    );

    return enrichedProfiles;
  }

  async getProfileDetails(profileId: number, profileType: ProfileType) {
    let profile: any = null;

    if (profileType === ProfileType.BRAND) {
      profile = await this.brandModel.findByPk(profileId);
    } else if (profileType === ProfileType.INFLUENCER) {
      profile = await this.influencerModel.findByPk(profileId, {
        include: ['niches', 'country', 'city'],
      });
    }

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const review = await this.profileReviewModel.findOne({
      where: { profileId, profileType },
      include: [
        {
          model: Admin,
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return {
      profile,
      review,
    };
  }

  async approveProfile(reviewId: number, adminId: number, comments?: string) {
    const review = await this.profileReviewModel.findByPk(reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (
      review.status !== ReviewStatus.PENDING &&
      review.status !== ReviewStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('Profile is not pending review');
    }

    await review.update({
      status: ReviewStatus.APPROVED,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminComments: comments,
    });

    // Update the actual profile
    if (review.profileType === ProfileType.BRAND) {
      await this.brandModel.update(
        { isVerified: true },
        { where: { id: review.profileId } },
      );

      const brand = await this.brandModel.findByPk(review.profileId);
      if (brand) {
        await this.emailService.sendBrandProfileApprovedEmail(
          brand.email,
          brand.brandName || 'Brand',
        );
      }
    } else if (review.profileType === ProfileType.INFLUENCER) {
      await this.influencerModel.update(
        { isVerified: true },
        { where: { id: review.profileId } },
      );

      const influencer = await this.influencerModel.findByPk(review.profileId);
      if (influencer) {
        // For influencers, we only send WhatsApp notifications, not emails
        // Debug logging for WhatsApp notification

        if (influencer.whatsappNumber && influencer.isWhatsappVerified) {
          console.log(
            'Sending WhatsApp notification to:',
            influencer.whatsappNumber,
          );
          await this.whatsAppService.sendProfileVerified(
            influencer.whatsappNumber,
            influencer.name,
          );
        } else {
          console.log('WhatsApp notification not sent. Reason:', {
            hasWhatsappNumber: !!influencer.whatsappNumber,
            isWhatsappVerified: influencer.isWhatsappVerified,
          });
        }
      }
    }

    return { message: 'Profile approved successfully', review };
  }

  async rejectProfile(
    reviewId: number,
    adminId: number,
    reason: string,
    comments?: string,
  ) {
    const review = await this.profileReviewModel.findByPk(reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (
      review.status !== ReviewStatus.PENDING &&
      review.status !== ReviewStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('Profile is not pending for review');
    }

    await review.update({
      status: ReviewStatus.REJECTED,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: reason,
      adminComments: comments,
    });

    // Notify user of rejection
    if (review.profileType === ProfileType.BRAND) {
      const brand = await this.brandModel.findByPk(review.profileId);
      if (brand) {
        await this.emailService.sendBrandProfileRejectedEmail(
          brand.email,
          brand.brandName || 'Brand',
          reason,
        );
      }
    } else if (review.profileType === ProfileType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(review.profileId);
      if (influencer) {
        // For influencers, we only send WhatsApp notifications, not emails
        if (influencer.whatsappNumber && influencer.isWhatsappVerified) {
          await this.whatsAppService.sendProfileRejected(
            influencer.whatsappNumber,
            influencer.name,
            reason,
          );
        }
      }
    }

    return { message: 'Profile rejected successfully', review };
  }

  private async notifyAdminsOfPendingProfile(
    profileId: number,
    profileType: ProfileType,
  ) {
    // Get all active profile reviewer admins
    const admins = await this.adminModel.findAll({
      where: {
        status: 'active',
        role: ['super_admin', 'profile_reviewer'],
      },
    });

    let profileName = '';
    let profileIdentifier = '';

    if (profileType === ProfileType.BRAND) {
      const brand = await this.brandModel.findByPk(profileId);
      profileName = brand?.brandName || 'Unknown Brand';
      profileIdentifier = brand?.email || '';
    } else if (profileType === ProfileType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(profileId);
      profileName = influencer?.name || 'Unknown Influencer';
      profileIdentifier = influencer?.username || influencer?.phone || '';
    }

    // Send notification emails to all admins
    const emailPromises = admins.map((admin) =>
      this.emailService.sendAdminProfilePendingNotification(
        admin.email,
        admin.name,
        profileType,
        profileName,
        profileIdentifier,
        profileId,
      ),
    );

    await Promise.all(emailPromises);
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      pendingReviewsCount,
      approvedTodayCount,
      rejectedTodayCount,
      totalBrandsCount,
      totalInfluencersCount,
    ] = await Promise.all([
      this.profileReviewModel.count({
        where: { status: 'pending' },
      }),
      this.profileReviewModel.count({
        where: {
          status: 'approved',
          reviewedAt: {
            [require('sequelize').Op.gte]: today,
            [require('sequelize').Op.lt]: tomorrow,
          },
        },
      }),
      this.profileReviewModel.count({
        where: {
          status: 'rejected',
          reviewedAt: {
            [require('sequelize').Op.gte]: today,
            [require('sequelize').Op.lt]: tomorrow,
          },
        },
      }),
      this.brandModel.count(),
      this.influencerModel.count(),
    ]);

    return {
      stats: {
        pendingReviews: pendingReviewsCount,
        approvedToday: approvedTodayCount,
        rejectedToday: rejectedTodayCount,
        totalBrands: totalBrandsCount,
        totalInfluencers: totalInfluencersCount,
      },
    };
  }

  async reviewProfile(reviewId: number, reviewDto: ProfileReviewDto) {
    if (!reviewId || !reviewDto) {
      throw new BadRequestException('Invalid input parameters');
    }

    const review = await this.profileReviewModel.findByPk(reviewId);
    if (!review) {
      throw new NotFoundException('Profile review not found');
    }

    if (
      review.status !== ReviewStatus.PENDING &&
      review.status !== ReviewStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        'Profile review has already been completed',
      );
    }

    await review.update({
      status: reviewDto.status,
      reviewedBy: reviewDto.reviewedBy,
      reviewedAt: new Date(),
      adminComments: reviewDto.adminComments,
      rejectionReason: reviewDto.rejectionReason,
    });

    return {
      message: 'Profile review completed successfully',
      review,
    };
  }

  async getPendingReviews(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const { count, rows: reviews } =
      await this.profileReviewModel.findAndCountAll({
        where: { status: ReviewStatus.PENDING },
        offset,
        limit,
        order: [['submittedAt', 'ASC']],
      });

    return {
      reviews,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getReviewsByProfileId(profileId: number, profileType: ProfileType) {
    return this.profileReviewModel.findAll({
      where: { profileId, profileType },
      order: [['submittedAt', 'DESC']],
    });
  }

  async getReviewStatistics() {
    const [pending, approved, rejected] = await Promise.all([
      this.profileReviewModel.findAll({
        where: { status: ReviewStatus.PENDING },
      }),
      this.profileReviewModel.findAll({
        where: { status: ReviewStatus.APPROVED },
      }),
      this.profileReviewModel.findAll({
        where: { status: ReviewStatus.REJECTED },
      }),
    ]);

    return {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
    };
  }

  async deleteReview(reviewId: number) {
    const review = await this.profileReviewModel.findByPk(reviewId);
    if (!review) {
      throw new NotFoundException('Profile review not found');
    }

    await review.destroy();
    return {
      message: 'Profile review deleted successfully',
    };
  }
}
