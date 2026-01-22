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
import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { CreditTransaction, CreditTransactionType, PaymentStatus } from './models/credit-transaction.model';
import { Niche } from '../auth/model/niche.model';
import { City } from '../shared/models/city.model';
import { Country } from '../shared/models/country.model';
import { Campaign } from '../campaign/models/campaign.model';
import { EmailService } from '../shared/email.service';
import { WhatsAppService } from '../shared/whatsapp.service';
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { UserType as DeviceUserType } from '../shared/models/device-token.model';
import { AuditLogService } from './services/audit-log.service';
import { AuditActionType } from './models/audit-log.model';
import { ProfileReviewDto } from './dto/profile-review.dto';
import { Op } from 'sequelize';

interface CampaignCountResult {
  brandId: number;
  count: string;
}

type ProfileData = Record<string, unknown>;

@Injectable()
export class ProfileReviewService {
  constructor(
    @InjectModel(ProfileReview)
    private readonly profileReviewModel: typeof ProfileReview,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(InfluencerReferralUsage)
    private readonly influencerReferralUsageModel: typeof InfluencerReferralUsage,
    @InjectModel(CreditTransaction)
    private readonly creditTransactionModel: typeof CreditTransaction,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly auditLogService: AuditLogService,
  ) { }

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
    await this.notifyAdminsOfPendingProfile(profileId, profileType);

    return {
      message: 'Profile review request submitted successfully',
      review,
    };
  }

  async getPendingProfiles(
    profileType?: ProfileType,
    page: number = 1,
    limit: number = 20,
  ) {
    const whereConditions: any = { status: ReviewStatus.PENDING };

    // Add profile type filter if provided
    if (profileType) {
      whereConditions.profileType = profileType;
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    const { count, rows: profiles } =
      await this.profileReviewModel.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Admin,
            attributes: ['id', 'name', 'email'],
          },
        ],
        order: [['submittedAt', 'ASC']],
        limit,
        offset,
      });

    // Batch fetch profile data to avoid N+1 queries
    const brandIds = profiles
      .filter((r) => r.profileType === ProfileType.BRAND)
      .map((r) => r.profileId);
    const influencerIds = profiles
      .filter((r) => r.profileType === ProfileType.INFLUENCER)
      .map((r) => r.profileId);

    // Fetch all brands in one query
    const brandsMap = new Map<number, Brand>();
    if (brandIds.length > 0) {
      const brands = await this.brandModel.findAll({
        where: { id: brandIds },
        attributes: [
          'id',
          'brandName',
          'email',
          'legalEntityName',
          'websiteUrl',
          'profileImage',
          'isProfileCompleted',
          'username',
        ],
        include: [
          {
            model: this.nicheModel,
            as: 'niches',
            attributes: ['id', 'name', 'description', 'logoNormal', 'logoDark'],
            through: { attributes: [] },
          },
          {
            model: this.cityModel,
            as: 'headquarterCity',
            attributes: ['id', 'name', 'state'],
          },
        ],
      });
      brands.forEach((b) => brandsMap.set(b.id, b));
    }

    // Fetch campaign counts for all brands in one query
    const campaignCountsMap = new Map<number, number>();
    if (brandIds.length > 0) {
      const campaignCounts = (await this.campaignModel.findAll({
        attributes: [
          'brandId',
          [this.campaignModel.sequelize!.fn('COUNT', '*'), 'count'],
        ],
        where: { brandId: brandIds },
        group: ['brandId'],
        raw: true,
      })) as unknown as CampaignCountResult[];

      campaignCounts.forEach((row) => {
        campaignCountsMap.set(row.brandId, parseInt(row.count));
      });
    }

    // Fetch all influencers in one query
    const influencersMap = new Map<number, Influencer>();
    if (influencerIds.length > 0) {
      const influencers = await this.influencerModel.findAll({
        where: { id: influencerIds },
        attributes: [
          'id',
          'name',
          'phone',
          'username',
          'profileImage',
          'isProfileCompleted',
          'gender',
          'dateOfBirth',
        ],
        include: [
          {
            model: this.nicheModel,
            as: 'niches',
            attributes: ['id', 'name', 'description', 'logoNormal', 'logoDark'],
            through: { attributes: [] },
          },
          {
            model: this.cityModel,
            as: 'city',
            attributes: ['id', 'name', 'state'],
          },
          {
            model: this.countryModel,
            as: 'country',
            attributes: ['id', 'name', 'code'],
          },
        ],
      });
      influencers.forEach((i) => influencersMap.set(i.id, i));
    }

    // Map profiles to enriched data
    const enrichedProfiles = profiles.map((review) => {
      let profileData: ProfileData | null = null;

      if (review.profileType === ProfileType.BRAND) {
        const brand = brandsMap.get(review.profileId);
        if (brand) {
          profileData = {
            ...brand.toJSON(),
            campaignCount: campaignCountsMap.get(review.profileId) || 0,
          };
        }
      } else if (review.profileType === ProfileType.INFLUENCER) {
        const influencer = influencersMap.get(review.profileId);
        if (influencer) {
          const influencerData = influencer.toJSON();

          // Calculate age from dateOfBirth if it exists
          if (influencerData.dateOfBirth) {
            const today = new Date();
            const birthDate = new Date(influencerData.dateOfBirth as string | Date);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (
              monthDiff < 0 ||
              (monthDiff === 0 && today.getDate() < birthDate.getDate())
            ) {
              age--;
            }
            influencerData.age = age;
          }

          profileData = influencerData;
        }
      }

      return {
        ...review.toJSON(),
        profile: profileData,
      };
    });

    return {
      data: enrichedProfiles,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
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
      profile: {
        ...profile.toJSON(),
        userType:
          profileType === ProfileType.BRAND
            ? ('brand' as const)
            : ('influencer' as const),
      },
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
      const brand = await this.brandModel.findByPk(review.profileId);
      if (brand) {
        await brand.update({ isVerified: true });
        await brand.reload(); // Reload to trigger decryption hooks
        await this.emailService.sendBrandProfileApprovedEmail(
          brand.email,
          brand.brandName || 'Brand',
        );
      }
    } else if (review.profileType === ProfileType.INFLUENCER) {
      await this.influencerModel.update(
        {
          isVerified: true,
          verifiedAt: new Date() 
        },
        { where: { id: review.profileId } },
      );

      const influencer = await this.influencerModel.findByPk(review.profileId);
      if (influencer) {
        // Send push notification for profile verified
        const fcmTokens = await this.deviceTokenService.getAllUserTokens(influencer.id, DeviceUserType.INFLUENCER);
        if (fcmTokens && fcmTokens.length > 0) {
          this.notificationService.sendCustomNotification(
            fcmTokens,
            'Profile Verified!',
            `Congratulations ${influencer.name}! Your profile has been verified and you can now apply for campaigns.`,
            { type: 'profile_verified' },
          ).catch(err => console.error('Failed to send profile verified notification:', err));
        }

        // Award referral credit if this influencer was referred by someone
        // Wrap in try-catch to prevent profile approval failure if referral fails
        try {
          const referralUsage = await this.influencerReferralUsageModel.findOne({
            where: {
              referredUserId: influencer.id,
              creditAwarded: false,
            },
          });

          if (referralUsage) {
            // Update the referral usage record
            await referralUsage.update({
              creditAwarded: true,
              creditAwardedAt: new Date(),
            });

            // Get the referrer influencer
            const referrer = await this.influencerModel.findByPk(
              referralUsage.influencerId,
            );

            if (referrer) {
              // Update referrer's credits
              const currentCredits = referrer.referralCredits || 0;
              const newCredits = currentCredits + 25;

              await this.influencerModel.update(
                { referralCredits: newCredits },
                { where: { id: referrer.id } },
              );

              // Log credit transaction for admin records
              await this.creditTransactionModel.create({
                influencerId: referrer.id,
                transactionType: CreditTransactionType.REFERRAL_BONUS,
                amount: 25,
                paymentStatus: PaymentStatus.PENDING,
                description: `Referral bonus for referring user ID ${influencer.id}`,
                referredUserId: influencer.id,
                upiId: referrer.upiId || null,
              });

              console.log(
                `✅ REFERRAL CREDIT AWARDED ✅`,
              );
              console.log(
                `├─ Referrer ID: ${referrer.id} (${referrer.name})`,
              );
              console.log(
                `├─ Referee ID: ${influencer.id} (${influencer.name})`,
              );
              console.log(
                `├─ Amount Earned: Rs 25`,
              );
              console.log(
                `├─ Total Credits Now: Rs ${newCredits}`,
              );
              console.log(
                `└─ Timestamp: ${new Date().toISOString()}`,
              );

              // Send notification to referrer
              let notificationMsg = `Congratulations! You have earned Rs 25 credit through the referral programme. Your total referral credits are now Rs ${newCredits}.`;

              if (!referrer.upiId) {
                notificationMsg +=
                  ' Please update your UPI ID in your profile to receive the amount. The credited amount will be transferred within 24 to 48 working hours.';
              } else {
                notificationMsg +=
                  ' The credited amount will be transferred to your UPI ID within 24 to 48 working hours.';
              }

              // Send WhatsApp notification asynchronously (fire-and-forget)
              // Error handling is done internally by WhatsApp service
              if (referrer.whatsappNumber && referrer.isWhatsappVerified) {
                this.whatsAppService.sendReferralCreditNotification(
                  referrer.whatsappNumber,
                  notificationMsg,
                );
              }
            }
          }
        } catch (error) {
          console.error(
            'Failed to award referral credit for influencer:',
            influencer.id,
            error,
          );
          // Don't throw - allow profile approval to continue even if referral fails
        }
      }
    }

    // Log audit trail
    const admin = await this.adminModel.findByPk(adminId);
    if (admin) {
      const profileName =
        review.profileType === ProfileType.BRAND
          ? (await this.brandModel.findByPk(review.profileId))?.brandName ||
          'Brand'
          : (await this.influencerModel.findByPk(review.profileId))?.name ||
          'Influencer';

      await this.auditLogService.logProfileReviewAction(
        {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
        AuditActionType.PROFILE_APPROVED,
        review.profileId,
        review.profileType,
        `Approved ${review.profileType} profile: "${profileName}"`,
      );
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

    // Set profile completion to false so user must resubmit
    if (review.profileType === ProfileType.BRAND) {
      const brand = await this.brandModel.findByPk(review.profileId);
      if (brand) {
        await brand.update({ isProfileCompleted: false });
        await brand.reload(); // Reload to trigger decryption hooks
        await this.emailService.sendBrandProfileRejectedEmail(
          brand.email,
          brand.brandName || 'Brand',
          reason,
        );
      }
    } else if (review.profileType === ProfileType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(review.profileId);
      if (influencer) {
        await this.influencerModel.update(
          { isProfileCompleted: false },
          { where: { id: review.profileId } },
        );
        // Send push notification for profile rejected
        const fcmTokens = await this.deviceTokenService.getAllUserTokens(influencer.id, DeviceUserType.INFLUENCER);
        if (fcmTokens && fcmTokens.length > 0) {
          this.notificationService.sendCustomNotification(
            fcmTokens,
            'Profile Rejected',
            `Hi ${influencer.name}, your profile verification was rejected. Reason: ${reason}. Please update your profile and resubmit.`,
            { type: 'profile_rejected', reason },
          ).catch(err => console.error('Failed to send profile rejected notification:', err));
        }
      }
    }

    // Log audit trail
    const admin = await this.adminModel.findByPk(adminId);
    if (admin) {
      const profileName =
        review.profileType === ProfileType.BRAND
          ? (await this.brandModel.findByPk(review.profileId))?.brandName ||
          'Brand'
          : (await this.influencerModel.findByPk(review.profileId))?.name ||
          'Influencer';

      await this.auditLogService.logProfileReviewAction(
        {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
        AuditActionType.PROFILE_REJECTED,
        review.profileId,
        review.profileType,
        `Rejected ${review.profileType} profile: "${profileName}" - Reason: ${reason}`,
      );
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

  async hasProfileReview(
    profileId: number,
    profileType: ProfileType,
  ): Promise<boolean> {
    const review = await this.profileReviewModel.findOne({
      where: {
        profileId,
        profileType,
        status: { [Op.ne]: ReviewStatus.REJECTED },
      },
    });
    return !!review;
  }

  // Credit Transaction Management Methods
  async getCreditTransactions(filters: {
    paymentStatus?: string;
    transactionType?: string;
    influencerId?: number;
    page: number;
    limit: number;
  }) {
    const { paymentStatus, transactionType, influencerId, page, limit } =
      filters;
    const offset = (page - 1) * limit;

    const whereConditions: any = {};

    if (paymentStatus) {
      whereConditions.paymentStatus = paymentStatus;
    }

    if (transactionType) {
      whereConditions.transactionType = transactionType;
    }

    if (influencerId) {
      whereConditions.influencerId = influencerId;
    }

    const { count, rows: transactions } =
      await this.creditTransactionModel.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Influencer,
            attributes: [
              'id',
              'name',
              'username',
              'profileImage',
              'phone',
              'upiId',
            ],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

    return {
      transactions,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async updateCreditTransactionStatus(
    transactionId: number,
    updateData: {
      paymentStatus: string;
      paymentReferenceId?: string;
      adminNotes?: string;
    },
    adminId: number,
  ) {
    const transaction = await this.creditTransactionModel.findByPk(
      transactionId,
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updateFields: any = {
      paymentStatus: updateData.paymentStatus,
      processedBy: adminId,
    };

    if (updateData.paymentReferenceId) {
      updateFields.paymentReferenceId = updateData.paymentReferenceId;
    }

    if (updateData.adminNotes) {
      updateFields.adminNotes = updateData.adminNotes;
    }

    // Set paidAt timestamp if marking as paid
    if (updateData.paymentStatus === PaymentStatus.PAID) {
      updateFields.paidAt = new Date();
    }

    await transaction.update(updateFields);

    return {
      message: 'Transaction status updated successfully',
      transaction,
    };
  }
}
