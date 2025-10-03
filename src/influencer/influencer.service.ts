import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { S3Service } from '../shared/s3.service';
import { EmailService } from '../shared/email.service';
import { WhatsAppService } from '../shared/whatsapp.service';
import { OtpService } from '../shared/services/otp.service';
import { InfluencerRepository } from './repositories/influencer.repository';
import { UpdateInfluencerProfileDto } from './dto/update-influencer-profile.dto';
import {
  ProfileReview,
  ProfileType,
  ReviewStatus,
} from '../admin/models/profile-review.model';
import { Admin } from '../admin/models/admin.model';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { Experience } from './models/experience.model';
import { ExperienceSocialLink } from './models/experience-social-link.model';
import { Follow, FollowingType } from '../post/models/follow.model';
import { Post, UserType } from '../post/models/post.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import {
  APP_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../shared/constants/app.constants';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
} from '../campaign/models/campaign.model';
import {
  CampaignApplication,
  ApplicationStatus,
} from '../campaign/models/campaign-application.model';
import { CampaignInvitation } from '../campaign/models/campaign-invitation.model';
import { CampaignDeliverable } from '../campaign/models/campaign-deliverable.model';
import { CampaignCity } from '../campaign/models/campaign-city.model';
import { City } from '../shared/models/city.model';
import { Brand } from '../brand/model/brand.model';
import { GetOpenCampaignsDto } from '../campaign/dto/get-open-campaigns.dto';
import { MyApplicationResponseDto } from '../campaign/dto/my-application-response.dto';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { Op, literal } from 'sequelize';
import { Gender } from '../auth/types/gender.enum';
import { CustomNicheService } from '../shared/services/custom-niche.service';
import { UserType as CustomNicheUserType } from '../auth/model/custom-niche.model';

// Private types for InfluencerService
type WhatsAppOtpRequest = {
  influencerId: number;
  whatsappNumber: string;
};

type WhatsAppOtpVerification = {
  influencerId: number;
  whatsappNumber: string;
  otp: string;
};

type InfluencerProfileData = {
  id: number;
  name: string;
  username: string;
  phone: string;
  isWhatsappVerified: boolean;
  isProfileCompleted: boolean;
  verification: {
    isProfileCompleted: boolean;
    isWhatsappVerified: boolean;
  };
};

@Injectable()
export class InfluencerService {
  constructor(
    private readonly influencerRepository: InfluencerRepository,
    private readonly otpService: OtpService,
    private readonly s3Service: S3Service,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    @Inject('PROFILE_REVIEW_MODEL')
    private readonly profileReviewModel: typeof ProfileReview,
    @Inject('CAMPAIGN_MODEL')
    private readonly campaignModel: typeof Campaign,
    @Inject('CAMPAIGN_APPLICATION_MODEL')
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @Inject('CAMPAIGN_INVITATION_MODEL')
    private readonly campaignInvitationModel: typeof CampaignInvitation,
    @Inject('ADMIN_MODEL')
    private readonly adminModel: typeof Admin,
    @Inject('NICHE_MODEL')
    private readonly nicheModel: typeof Niche,
    @Inject('INFLUENCER_NICHE_MODEL')
    private readonly influencerNicheModel: typeof InfluencerNiche,
    @Inject('EXPERIENCE_MODEL')
    private readonly experienceModel: typeof Experience,
    @Inject('EXPERIENCE_SOCIAL_LINK_MODEL')
    private readonly experienceSocialLinkModel: typeof ExperienceSocialLink,
    @Inject('FOLLOW_MODEL')
    private readonly followModel: typeof Follow,
    @Inject('POST_MODEL')
    private readonly postModel: typeof Post,
    @Inject('CUSTOM_NICHE_MODEL')
    private readonly customNicheModel: typeof CustomNiche,
    private readonly customNicheService: CustomNicheService,
  ) {}

  async getInfluencerProfile(influencerId: number, isPublic: boolean = false) {
    const influencer = await this.influencerRepository.findById(influencerId);

    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Calculate profile completion, platform metrics, and get verification status
    const [profileCompletion, platformMetrics, verificationStatus] =
      await Promise.all([
        this.calculateProfileCompletion(influencer),
        this.calculatePlatformMetrics(influencerId),
        this.getVerificationStatus(influencerId),
      ]);

    const baseProfile = {
      id: influencer.id,
      name: influencer.name,
      username: influencer.username,
      bio: influencer.bio,
      profileImage: influencer.profileImage,
      profileBanner: influencer.profileBanner,
      profileHeadline: influencer.profileHeadline,

      location: {
        country: influencer.country
          ? {
              id: influencer.country.id,
              name: influencer.country.name,
              code: influencer.country.code,
            }
          : null,
        city: influencer.city
          ? {
              id: influencer.city.id,
              name: influencer.city.name,
              state: influencer.city.state,
            }
          : null,
      },

      socialLinks: {
        instagram: influencer.instagramUrl,
        youtube: influencer.youtubeUrl,
        facebook: influencer.facebookUrl,
        linkedin: influencer.linkedinUrl,
        twitter: influencer.twitterUrl,
      },

      niches: (influencer.niches || []).map((niche) => ({
        id: niche.id,
        name: niche.name,
        description: niche.description,
      })),

      customNiches: (influencer.customNiches || []).map((customNiche) => ({
        id: customNiche.id,
        name: customNiche.name,
        description: customNiche.description,
        isActive: customNiche.isActive,
      })),

      // Platform metrics
      metrics: platformMetrics,

      // Top influencer status
      isTopInfluencer: influencer.isTopInfluencer,

      createdAt:
        influencer.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt:
        influencer.updatedAt?.toISOString() || new Date().toISOString(),
    };

    // Include private data only if not public view
    if (!isPublic) {
      return {
        ...baseProfile,
        phone: influencer.phone,
        contact: {
          whatsappNumber: influencer.whatsappNumber,
          isWhatsappVerified: influencer.isWhatsappVerified,
        },
        collaborationCosts: influencer.collaborationCosts || {},
        verification: {
          isPhoneVerified: influencer.isPhoneVerified,
          isWhatsappVerified: influencer.isWhatsappVerified,
          isProfileCompleted: influencer.isProfileCompleted,
        },
        verificationStatus,
        profileCompletion,
      };
    }

    return baseProfile;
  }

  async updateInfluencerProfile(
    influencerId: number,
    updateData: UpdateInfluencerProfileDto,
    files?: any,
  ) {
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Handle file uploads if provided
    let fileUrls = {};
    if (files) {
      fileUrls = await this.uploadInfluencerFiles(files);
    }

    // Handle date conversion if provided
    const processedData: any = { ...updateData };
    if (processedData.dateOfBirth) {
      processedData.dateOfBirth = new Date(processedData.dateOfBirth);
    }

    // Parse nested collaboration costs from form data
    const collaborationCosts: any = {};
    const rawData = updateData as any;

    // Check for nested form fields with syntax: collaborationCosts[platform][type]
    for (const [key, value] of Object.entries(rawData)) {
      const match = key.match(/^collaborationCosts\[([^\]]+)\]\[([^\]]+)\]$/);
      if (match && value !== undefined && value !== '') {
        const [, platform, type] = match;
        if (!collaborationCosts[platform]) {
          collaborationCosts[platform] = {};
        }
        collaborationCosts[platform][type] = parseInt(value as string, 10);
      }
    }

    // If we found collaboration costs in form data, add them to processed data
    if (Object.keys(collaborationCosts).length > 0) {
      processedData.collaborationCosts = collaborationCosts;
    }

    // Handle gender mapping logic
    if (processedData.gender) {
      if (
        processedData.gender === Gender.MALE ||
        processedData.gender === Gender.FEMALE
      ) {
        // Standard gender options - keep as is and clear othersGender
        processedData.othersGender = null;
      } else {
        // Custom gender option - map to Others
        processedData.othersGender = processedData.gender;
        processedData.gender = Gender.OTHERS;
      }
    }

    // Handle niche updates if provided
    if (processedData.nicheIds) {
      const nicheIds = this.parseNicheIds(processedData.nicheIds);
      await this.updateInfluencerNiches(influencerId, nicheIds);
      // Remove nicheIds from processedData as it's handled separately
      delete processedData.nicheIds;
    }

    // Handle custom niche bulk replacement if provided
    if (processedData.customNiches !== undefined) {
      await this.updateInfluencerCustomNiches(
        influencerId,
        processedData.customNiches,
      );
      // Remove customNiches from processedData as it's handled separately
      delete processedData.customNiches;
    }

    // Update influencer data
    const updatedData = {
      ...processedData,
      ...fileUrls,
    };

    await this.influencerRepository.updateInfluencer(influencerId, updatedData);

    // Check if profile has ever been submitted for review
    const hasBeenSubmitted = await this.hasProfileReview(influencerId);

    // Check and update profile completion status
    const wasComplete = influencer.isProfileCompleted;
    const updatedInfluencer =
      await this.influencerRepository.findById(influencerId);
    if (!updatedInfluencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }
    const profileCompletion =
      this.calculateProfileCompletion(updatedInfluencer);
    const isComplete = profileCompletion.isCompleted;

    if (isComplete !== influencer.isProfileCompleted) {
      await this.influencerRepository.updateInfluencer(influencerId, {
        isProfileCompleted: isComplete,
      });
    }

    // Send appropriate WhatsApp notification based on completion status
    // Only send notifications if profile has never been submitted
    if (!hasBeenSubmitted) {
      if (isComplete && !wasComplete) {
        // Profile just became complete - automatically submit for verification
        await this.createProfileReview(influencerId);

        // Send verification pending notifications (WhatsApp only for influencers)
        if (influencer.whatsappNumber && influencer.isWhatsappVerified) {
          await this.whatsAppService.sendProfileVerificationPending(
            influencer.whatsappNumber,
            influencer.name,
          );
        }
      } else if (!isComplete) {
        // Profile is incomplete - send missing fields notifications (WhatsApp only for influencers)
        console.log('Profile incomplete notification check:', {
          influencerId: influencer.id,
          name: influencer.name,
          whatsappNumber: influencer.whatsappNumber,
          isWhatsappVerified: influencer.isWhatsappVerified,
          missingFieldsCount: profileCompletion.missingFields.length,
          missingFields: profileCompletion.missingFields,
        });

        if (influencer.whatsappNumber && influencer.isWhatsappVerified) {
          console.log(
            'Sending profile incomplete WhatsApp notification to:',
            influencer.whatsappNumber,
          );
          await this.whatsAppService.sendProfileIncomplete(
            influencer.whatsappNumber,
            influencer.name,
            profileCompletion.missingFields.length.toString(),
          );
        } else {
          console.log(
            'Profile incomplete WhatsApp notification not sent. Reason:',
            {
              hasWhatsappNumber: !!influencer.whatsappNumber,
              isWhatsappVerified: influencer.isWhatsappVerified,
            },
          );
        }
      }
    }
    // else: Profile has been submitted before - no notification

    // Return updated profile with appropriate message
    const profileData = await this.getInfluencerProfile(influencerId);

    if (!wasComplete && isComplete) {
      return {
        ...profileData,
        message:
          'Profile submitted for verification. You will receive a notification once verification is complete within 48 hours.',
        status: 'pending_verification',
      };
    } else if (!isComplete) {
      return {
        ...profileData,
        message:
          'Profile updated successfully. Please complete the missing fields to submit for verification.',
        status: 'incomplete',
        missingFieldsCount: profileCompletion.missingFields.length,
      };
    }

    return {
      ...profileData,
      message: SUCCESS_MESSAGES.PROFILE.UPDATED,
    };
  }

  private calculateProfileCompletion(influencer: Influencer) {
    const requiredFields = [
      'name',
      'username',
      'bio',
      'profileImage',
      'profileBanner',
      'profileHeadline',
      'countryId',
      'cityId',
      'whatsappNumber',
      // At least one social media link
      'instagramUrl', // OR youtubeUrl, etc.
    ];

    const optionalButRecommended = [
      'youtubeUrl',
      'facebookUrl',
      'linkedinUrl',
      'twitterUrl',
    ];

    const allFields = [...requiredFields, ...optionalButRecommended];

    const filledRequiredFields = requiredFields.filter((field) => {
      if (field === 'instagramUrl') {
        // Check if at least one social media link exists
        return (
          influencer.instagramUrl ||
          influencer.youtubeUrl ||
          influencer.facebookUrl ||
          influencer.linkedinUrl ||
          influencer.twitterUrl
        );
      }
      const value = influencer[field as keyof Influencer];
      return value && value.toString().trim().length > 0;
    });

    const filledOptionalFields = optionalButRecommended.filter((field) => {
      const value = influencer[field as keyof Influencer];
      return value && value.toString().trim().length > 0;
    });

    const totalFilledFields =
      filledRequiredFields.length + filledOptionalFields.length;
    const completionPercentage = Math.round(
      (totalFilledFields / allFields.length) * 100,
    );

    const missingFields = requiredFields
      .filter((field) => {
        if (field === 'instagramUrl') {
          return !(
            influencer.instagramUrl ||
            influencer.youtubeUrl ||
            influencer.facebookUrl ||
            influencer.linkedinUrl ||
            influencer.twitterUrl
          );
        }
        const value = influencer[field as keyof Influencer];
        return !value || value.toString().trim().length === 0;
      })
      .map((field) => this.getFriendlyFieldName(field));

    const nextSteps = this.generateNextSteps(missingFields);

    const isActuallyCompleted =
      this.checkInfluencerProfileCompletion(influencer);

    return {
      isCompleted: isActuallyCompleted,
      completionPercentage,
      missingFields,
      nextSteps: isActuallyCompleted
        ? ['Your profile is complete and ready for verification!']
        : nextSteps,
    };
  }

  private checkInfluencerProfileCompletion(influencer: Influencer): boolean {
    const requiredFields = [
      'name',
      'username',
      'bio',
      'profileImage',
      'profileBanner',
      'profileHeadline',
      'countryId',
      'cityId',
      'whatsappNumber',
    ];

    const allFieldsFilled = requiredFields.every((field) => {
      const value = influencer[field as keyof Influencer];
      return value && value.toString().trim().length > 0;
    });

    // At least one social media link required
    const hasSocialMediaLink = Boolean(
      influencer.instagramUrl ||
        influencer.youtubeUrl ||
        influencer.facebookUrl ||
        influencer.linkedinUrl ||
        influencer.twitterUrl,
    );

    // WhatsApp verification required
    const isWhatsappVerified = Boolean(influencer.isWhatsappVerified);

    // Basic collaboration costs should be set
    const hasCollaborationCosts = Boolean(
      influencer.collaborationCosts &&
        Object.keys(influencer.collaborationCosts).length > 0,
    );

    return (
      allFieldsFilled &&
      hasSocialMediaLink &&
      isWhatsappVerified &&
      hasCollaborationCosts
    );
  }

  private async getVerificationStatus(influencerId: number) {
    // Check if profile has been submitted for review
    const profileReview = await this.profileReviewModel.findOne({
      where: {
        profileId: influencerId,
        profileType: ProfileType.INFLUENCER,
      },
      order: [['createdAt', 'DESC']],
    });

    if (!profileReview) {
      return null;
    }

    const { status, statusViewed } = profileReview;

    switch (status) {
      case ReviewStatus.PENDING:
      case ReviewStatus.UNDER_REVIEW:
        return {
          status: 'pending',
          message: 'Profile Under Verification',
          description:
            'Usually takes 1-2 business days to complete verification',
        };

      case ReviewStatus.APPROVED:
        // Mark as viewed if not already viewed
        if (!statusViewed) {
          await profileReview.update({ statusViewed: true });
        }
        return {
          status: 'approved',
          message: 'Profile Verification Successful',
          description:
            'Your profile has been approved and is now visible to brands',
          isNew: !statusViewed, // Indicates if this is first time seeing the status
        };

      case ReviewStatus.REJECTED:
        // Mark as viewed if not already viewed
        if (!statusViewed) {
          await profileReview.update({ statusViewed: true });
        }
        return {
          status: 'rejected',
          message: 'Profile Verification Rejected',
          description:
            profileReview.rejectionReason ||
            'Please update your profile and resubmit for verification',
          isNew: !statusViewed, // Indicates if this is first time seeing the status
        };

      default:
        return null;
    }
  }

  private getFriendlyFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      name: 'Full Name',
      username: 'Username',
      bio: 'Bio/Description',
      profileImage: 'Profile Image',
      profileBanner: 'Profile Banner',
      profileHeadline: 'Profile Headline',
      countryId: 'Country',
      cityId: 'City',
      whatsappNumber: 'WhatsApp Number',
      instagramUrl: 'At least one social media link',
    };
    return fieldMap[field] || field;
  }

  private generateNextSteps(missingFields: string[]): string[] {
    const steps: string[] = [];

    if (
      missingFields.includes('Profile Image') ||
      missingFields.includes('Profile Banner')
    ) {
      steps.push('Upload profile images to showcase your personal brand');
    }

    if (
      missingFields.includes('Profile Headline') ||
      missingFields.includes('Bio/Description')
    ) {
      steps.push('Complete your profile description and headline');
    }

    if (missingFields.includes('Country') || missingFields.includes('City')) {
      steps.push('Add your location information');
    }

    if (missingFields.includes('At least one social media link')) {
      steps.push('Connect your social media accounts');
    }

    if (missingFields.includes('WhatsApp Number')) {
      steps.push(
        'Add and verify your WhatsApp number for better communication',
      );
    }

    return steps;
  }

  async sendWhatsAppVerificationOTP(request: WhatsAppOtpRequest) {
    const { influencerId, whatsappNumber } = request;
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Generate and store OTP using OTP service (ensure consistent +91 format)
    const formattedNumber = whatsappNumber.startsWith('+91')
      ? whatsappNumber
      : `+91${whatsappNumber}`;
    const otp = await this.otpService.generateAndStoreOtp({
      identifier: formattedNumber,
      type: 'phone',
    });

    // Send OTP via WhatsApp
    await this.whatsAppService.sendOTP(whatsappNumber, otp);

    return {
      message: SUCCESS_MESSAGES.WHATSAPP.OTP_SENT,
      whatsappNumber: whatsappNumber,
      otp: otp, // Include OTP in response for testing (remove in production)
    };
  }

  async verifyWhatsAppOTP(verification: WhatsAppOtpVerification) {
    const { influencerId, whatsappNumber, otp } = verification;
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Check if WhatsApp is already verified
    if (influencer.isWhatsappVerified) {
      throw new BadRequestException(ERROR_MESSAGES.WHATSAPP.ALREADY_VERIFIED);
    }

    // Verify OTP using OTP service (ensure consistent +91 format)
    const formattedNumber = whatsappNumber.startsWith('+91')
      ? whatsappNumber
      : `+91${whatsappNumber}`;
    await this.otpService.verifyOtp({
      identifier: formattedNumber,
      type: 'phone',
      otp: otp,
    });

    // Update WhatsApp verification status using repository
    await this.influencerRepository.updateWhatsAppVerification(
      influencerId,
      whatsappNumber,
    );

    return {
      message: SUCCESS_MESSAGES.WHATSAPP.VERIFIED,
      verified: true,
    };
  }

  private async hasProfileReview(influencerId: number): Promise<boolean> {
    const review = await this.profileReviewModel.findOne({
      where: {
        profileId: influencerId,
        profileType: ProfileType.INFLUENCER,
        status: { [Op.ne]: ReviewStatus.REJECTED },
      },
    });
    return !!review;
  }

  private async createProfileReview(influencerId: number) {
    // Check if review already exists
    const existingReview = await this.profileReviewModel.findOne({
      where: { profileId: influencerId, profileType: ProfileType.INFLUENCER },
    });

    if (existingReview) {
      // Update existing review to pending status and clear previous review data
      await existingReview.update({
        status: 'pending',
        submittedAt: new Date(),
        // Clear previous review data for fresh review
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        adminComments: null,
      });
    } else {
      // Create new review
      await this.profileReviewModel.create({
        profileId: influencerId,
        profileType: ProfileType.INFLUENCER,
        status: 'pending',
        submittedAt: new Date(),
      });
    }

    // Send notification to admins
    await this.notifyAdminsOfPendingProfile(influencerId);
  }

  private async notifyAdminsOfPendingProfile(influencerId: number) {
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) return;

    // Get all active profile reviewer admins
    const admins = await this.adminModel.findAll({
      where: {
        status: 'active',
        role: ['super_admin', 'profile_reviewer'],
      },
    });

    // Send notification emails to all admins
    const emailPromises = admins.map((admin) =>
      this.emailService.sendAdminProfilePendingNotification(
        admin.email,
        admin.name,
        'influencer',
        influencer.name,
        influencer.username || influencer.phone,
        influencerId,
      ),
    );

    await Promise.all(emailPromises);
  }

  private async uploadInfluencerFiles(files: any) {
    const uploadFile = async (
      file: Express.Multer.File[],
      folder: string,
      prefix: string,
    ) => {
      if (file?.[0]) {
        return await this.s3Service.uploadFileToS3(file[0], folder, prefix);
      }
      return undefined;
    };

    return {
      profileImage: files?.profileImage
        ? await uploadFile(
            files.profileImage,
            'profiles/influencers',
            'profile',
          )
        : undefined,
      profileBanner: files?.profileBanner
        ? await uploadFile(
            files.profileBanner,
            'profiles/influencers',
            'banner',
          )
        : undefined,
    };
  }

  async getOpenCampaigns(
    getOpenCampaignsDto: GetOpenCampaignsDto,
    influencerId: number,
  ): Promise<{
    campaigns: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      search,
      cityIds,
      nicheIds,
      minBudget,
      maxBudget,
      page = 1,
      limit = 10,
    } = getOpenCampaignsDto;

    const offset = (page - 1) * limit;
    const whereCondition: any = {
      status: CampaignStatus.ACTIVE,
      isActive: true,
    };

    // Search by campaign name or brand name
    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const includeOptions: any[] = [
      {
        model: Brand,
        attributes: ['id', 'brandName', 'profileImage'],
      },
      {
        model: CampaignDeliverable,
        attributes: ['platform', 'type', 'budget', 'quantity'],
      },
      {
        model: CampaignCity,
        include: [
          {
            model: City,
            attributes: ['id', 'name', 'tier'],
          },
        ],
      },
    ];

    // City filter
    if (cityIds && cityIds.length > 0) {
      includeOptions.push({
        model: CampaignCity,
        where: { cityId: { [Op.in]: cityIds } },
        required: true,
      });
    }

    const { count, rows: campaigns } = await this.campaignModel.findAndCountAll(
      {
        where: whereCondition,
        include: includeOptions,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      },
    );

    // Add application status for each campaign
    const campaignIds = campaigns.map((campaign) => campaign.id);
    const existingApplications = await this.campaignApplicationModel.findAll({
      where: {
        campaignId: { [Op.in]: campaignIds },
        influencerId,
      },
      attributes: ['campaignId', 'status'],
    });

    const applicationMap = new Map();
    existingApplications.forEach((app) => {
      applicationMap.set(app.campaignId, app.status);
    });

    // Get total applications count for each campaign
    const applicationCounts = await this.campaignApplicationModel.findAll({
      where: { campaignId: { [Op.in]: campaignIds } },
      attributes: ['campaignId', [literal('COUNT(id)'), 'count']],
      group: ['campaignId'],
      raw: true,
    });

    const countMap = new Map();
    applicationCounts.forEach((count: any) => {
      countMap.set(count.campaignId, parseInt(count.count));
    });

    const enrichedCampaigns = campaigns.map((campaign) => ({
      ...campaign.toJSON(),
      hasApplied: applicationMap.has(campaign.id),
      applicationStatus: applicationMap.get(campaign.id) || null,
      totalApplications: countMap.get(campaign.id) || 0,
    }));

    const totalPages = Math.ceil(count / limit);

    return {
      campaigns: enrichedCampaigns,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  async applyCampaign(
    campaignId: number,
    influencerId: number,
  ): Promise<{
    success: boolean;
    applicationId: number;
    message: string;
    campaign: any;
  }> {
    // Verify campaign exists and is active
    const campaign = await this.campaignModel.findOne({
      where: {
        id: campaignId,
        status: CampaignStatus.ACTIVE,
        isActive: true,
      },
      include: [{ model: Brand, attributes: ['brandName'] }],
    } as any);

    if (!campaign) {
      throw new NotFoundException(
        'Campaign not found or no longer accepting applications',
      );
    }

    // Check if campaign is invite-only
    if (campaign.isInviteOnly) {
      // Verify influencer has been invited
      const invitation = await this.campaignInvitationModel.findOne({
        where: { campaignId, influencerId },
      });

      if (!invitation) {
        throw new ForbiddenException(
          'This is an invite-only campaign. You must be invited to apply.',
        );
      }
    }

    // Check if influencer has already applied
    const existingApplication = await this.campaignApplicationModel.findOne({
      where: { campaignId, influencerId },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'You have already applied to this campaign',
      );
    }

    // Verify influencer profile is complete and verified
    const influencer = await this.influencerRepository.findById(influencerId);
    if (
      !influencer ||
      !influencer.isProfileCompleted ||
      !influencer.isWhatsappVerified
    ) {
      throw new BadRequestException(
        'Your profile must be completed and verified to apply for campaigns',
      );
    }

    // Create application
    const application = await this.campaignApplicationModel.create({
      campaignId,
      influencerId,
      status: ApplicationStatus.APPLIED,
    } as any);

    // Send WhatsApp notification to influencer
    await this.whatsAppService.sendCampaignApplicationConfirmation(
      influencer.whatsappNumber,
      influencer.name,
      campaign.name,
      campaign.brand?.brandName || 'Brand',
    );

    return {
      success: true,
      applicationId: application.id,
      message:
        'Application submitted successfully. You will be notified about the status update.',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        brand: {
          brandName: campaign.brand?.brandName,
        },
      },
    };
  }

  async getMyApplications(
    influencerId: number,
    status?: string,
  ): Promise<MyApplicationResponseDto[]> {
    const whereClause: any = { influencerId };

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }

    const applications = await this.campaignApplicationModel.findAll({
      where: whereClause,
      include: [
        {
          model: Campaign,
          attributes: ['id', 'name', 'description', 'status', 'type'],
          include: [
            {
              model: Brand,
              attributes: ['id', 'brandName', 'profileImage'],
            },
            {
              model: CampaignDeliverable,
              attributes: ['platform', 'type', 'budget', 'quantity'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return applications.map((app) => {
      const appData = app.toJSON();
      return {
        id: appData.id,
        status: appData.status,
        coverLetter: appData.coverLetter,
        proposalMessage: appData.proposalMessage,
        createdAt: appData.createdAt,
        reviewedAt: appData.reviewedAt,
        reviewNotes: appData.reviewNotes,
        campaign: appData.campaign,
      };
    });
  }

  async withdrawApplication(
    applicationId: number,
    influencerId: number,
  ): Promise<{ message: string }> {
    // Find the application
    const application = await this.campaignApplicationModel.findOne({
      where: {
        id: applicationId,
        influencerId,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if application can be withdrawn
    if (
      application.status === ApplicationStatus.SELECTED ||
      application.status === ApplicationStatus.REJECTED ||
      application.status === ApplicationStatus.WITHDRAWN
    ) {
      throw new BadRequestException(
        `Cannot withdraw application with status: ${application.status}`,
      );
    }

    // Update status to withdrawn
    await application.update({
      status: ApplicationStatus.WITHDRAWN,
      reviewedAt: new Date(),
    });

    return {
      message: 'Application withdrawn successfully',
    };
  }

  async getCampaignDetails(
    campaignId: number,
    influencerId: number,
  ): Promise<any> {
    const campaign = await this.campaignModel.findOne({
      where: {
        id: campaignId,
        status: CampaignStatus.ACTIVE,
        isActive: true,
      },
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName', 'profileImage', 'websiteUrl'],
        },
        {
          model: CampaignCity,
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'tier'],
            },
          ],
        },
        {
          model: CampaignDeliverable,
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check if influencer has applied
    const application = await this.campaignApplicationModel.findOne({
      where: { campaignId, influencerId },
      attributes: ['status', 'createdAt'],
    });

    // Get total applications count
    const totalApplications = await this.campaignApplicationModel.count({
      where: { campaignId },
    });

    return {
      ...campaign.toJSON(),
      hasApplied: !!application,
      applicationStatus: application?.status || null,
      appliedAt: application?.createdAt || null,
      totalApplications,
    };
  }

  async createExperience(
    influencerId: number,
    createExperienceDto: CreateExperienceDto,
  ): Promise<Experience> {
    const { socialLinks, ...experienceData } = createExperienceDto;

    const experience = await this.experienceModel.create({
      ...experienceData,
      influencerId,
    });

    // Create social links if provided
    if (socialLinks && socialLinks.length > 0) {
      const socialLinkData = socialLinks.map((link) => ({
        experienceId: experience.id,
        platform: link.platform,
        contentType: link.contentType,
        url: link.url,
      }));

      await this.experienceSocialLinkModel.bulkCreate(socialLinkData);
    }

    // Return experience with social links
    const experienceWithLinks = await this.experienceModel.findOne({
      where: { id: experience.id },
      include: [
        {
          model: ExperienceSocialLink,
          attributes: ['id', 'platform', 'contentType', 'url'],
        },
      ],
    });

    if (!experienceWithLinks) {
      throw new NotFoundException('Experience not found after creation');
    }

    return experienceWithLinks;
  }

  async updateExperience(
    experienceId: number,
    influencerId: number,
    updateExperienceDto: UpdateExperienceDto,
  ): Promise<Experience> {
    const experience = await this.experienceModel.findOne({
      where: { id: experienceId, influencerId },
    });

    if (!experience) {
      throw new NotFoundException('Experience not found');
    }

    const { socialLinks, ...updateData } = updateExperienceDto;

    await experience.update(updateData);

    // Update social links if provided
    if (socialLinks !== undefined) {
      // Delete existing social links
      await this.experienceSocialLinkModel.destroy({
        where: { experienceId },
      });

      // Create new social links
      if (socialLinks && socialLinks.length > 0) {
        const socialLinkData = socialLinks.map((link) => ({
          experienceId: experience.id,
          platform: link.platform,
          contentType: link.contentType,
          url: link.url,
        }));

        await this.experienceSocialLinkModel.bulkCreate(socialLinkData);
      }
    }

    // Return experience with social links
    const experienceWithLinks = await this.experienceModel.findOne({
      where: { id: experienceId },
      include: [
        {
          model: ExperienceSocialLink,
          attributes: ['id', 'platform', 'contentType', 'url'],
        },
      ],
    });

    if (!experienceWithLinks) {
      throw new NotFoundException('Experience not found after update');
    }

    return experienceWithLinks;
  }

  async getExperiences(influencerId: number): Promise<Experience[]> {
    return this.experienceModel.findAll({
      where: { influencerId },
      include: [
        {
          model: ExperienceSocialLink,
          attributes: ['id', 'platform', 'contentType', 'url'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  private parseNicheIds(nicheIds: string): number[] {
    let parsedIds: number[];

    // Check if it's a JSON array format
    if (nicheIds.startsWith('[') && nicheIds.endsWith(']')) {
      const parsed = JSON.parse(nicheIds);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException(
          'Invalid niche IDs format: must be array',
        );
      }
      parsedIds = parsed.map((id) => parseInt(id, 10));
    } else {
      // Handle comma-separated values
      parsedIds = nicheIds.split(',').map((id) => parseInt(id.trim(), 10));
    }

    // Check for any invalid numbers
    const invalidIds = parsedIds.filter((id) => isNaN(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid niche IDs: ${invalidIds.join(', ')}`,
      );
    }

    return parsedIds;
  }

  private async updateInfluencerNiches(
    influencerId: number,
    nicheIds: number[],
  ) {
    // Validate niche IDs
    const validNiches = await this.nicheModel.findAll({
      where: { id: nicheIds, isActive: true },
    });

    if (validNiches.length !== nicheIds.length) {
      throw new BadRequestException('One or more invalid niche IDs provided');
    }

    // Create or update niche associations (like brand profile completion)
    for (const nicheId of nicheIds) {
      await this.influencerNicheModel.findOrCreate({
        where: { influencerId, nicheId },
        defaults: { influencerId, nicheId },
      });
    }

    // Remove old associations not in the new list
    await this.influencerNicheModel.destroy({
      where: {
        influencerId,
        nicheId: {
          [Op.notIn]: nicheIds,
        },
      },
    });
  }

  private async updateInfluencerCustomNiches(
    influencerId: number,
    customNicheNames: string[],
  ) {
    // Get existing custom niches to compare
    const existingCustomNiches = await this.customNicheModel.findAll({
      where: {
        userType: CustomNicheUserType.INFLUENCER,
        userId: influencerId,
        isActive: true,
      },
      attributes: ['name'],
    });

    const existingNames = existingCustomNiches
      .map((niche) => niche.name)
      .sort();
    const newNames = [...customNicheNames].sort();

    // Compare arrays - if identical, skip update to avoid unnecessary DB operations
    if (JSON.stringify(existingNames) === JSON.stringify(newNames)) {
      return; // No changes needed
    }

    // Validate 5-niche limit (regular + custom combined)
    const regularNichesCount = await this.influencerNicheModel.count({
      where: { influencerId },
    });

    if (regularNichesCount + customNicheNames.length > 5) {
      throw new BadRequestException(
        `Maximum 5 niches allowed (regular + custom combined). You have ${regularNichesCount} regular niches and trying to add ${customNicheNames.length} custom niches.`,
      );
    }

    // Validate custom niche names are unique
    const uniqueNames = [...new Set(customNicheNames)];
    if (uniqueNames.length !== customNicheNames.length) {
      throw new BadRequestException('Custom niche names must be unique');
    }

    // Delete all existing custom niches for this influencer (bulk replacement)
    await this.customNicheModel.destroy({
      where: {
        userType: CustomNicheUserType.INFLUENCER,
        userId: influencerId,
      },
    });

    // Create new custom niches if any provided
    if (customNicheNames.length > 0) {
      const customNicheData = customNicheNames.map((name) => ({
        userType: CustomNicheUserType.INFLUENCER,
        userId: influencerId,
        influencerId: influencerId,
        brandId: null,
        name: name,
        description: '',
        isActive: true,
      }));

      await this.customNicheModel.bulkCreate(customNicheData);
    }
  }

  private async calculatePlatformMetrics(influencerId: number) {
    const [followersCount, followingCount, postsCount, campaignsCount] =
      await Promise.all([
        // Count followers (users who follow this influencer)
        this.followModel.count({
          where: {
            followingType: FollowingType.INFLUENCER,
            followingInfluencerId: influencerId,
          },
        }),

        // Count following (users this influencer follows)
        this.followModel.count({
          where: {
            followerType: FollowingType.INFLUENCER,
            followerInfluencerId: influencerId,
          },
        }),

        // Count posts created by this influencer
        this.postModel.count({
          where: {
            userType: UserType.INFLUENCER,
            influencerId: influencerId,
            isActive: true,
          },
        }),

        // Count campaigns this influencer has applied to
        this.campaignApplicationModel.count({
          where: {
            influencerId: influencerId,
          },
        }),
      ]);

    return {
      followers: followersCount,
      following: followingCount,
      posts: postsCount,
      campaigns: campaignsCount,
    };
  }

  async getTopInfluencers(limit: number = 10, offset: number = 0) {
    // Fetch all top influencers first (without limit/offset for proper sorting)
    const allTopInfluencers = await this.influencerRepository.findAll({
      where: {
        isTopInfluencer: true,
        isActive: true,
        isVerified: true,
      },
    });

    // Calculate metrics for each top influencer
    const influencersWithMetrics = await Promise.all(
      allTopInfluencers.map(async (influencer) => {
        const [platformMetrics] = await Promise.all([
          this.calculatePlatformMetrics(influencer.id),
        ]);

        return {
          id: influencer.id,
          name: influencer.name,
          username: influencer.username,
          bio: influencer.bio,
          profileImage: influencer.profileImage,
          profileBanner: influencer.profileBanner,
          profileHeadline: influencer.profileHeadline,

          location: {
            country: influencer.country
              ? {
                  id: influencer.country.id,
                  name: influencer.country.name,
                  code: influencer.country.code,
                }
              : null,
            city: influencer.city
              ? {
                  id: influencer.city.id,
                  name: influencer.city.name,
                  state: influencer.city.state,
                }
              : null,
          },

          socialLinks: {
            instagram: influencer.instagramUrl,
            youtube: influencer.youtubeUrl,
            facebook: influencer.facebookUrl,
            linkedin: influencer.linkedinUrl,
            twitter: influencer.twitterUrl,
          },

          niches: (influencer.niches || []).map((niche) => ({
            id: niche.id,
            name: niche.name,
            description: niche.description,
          })),

          metrics: platformMetrics,
          isTopInfluencer: true,
          isVerified: influencer.isVerified,

          createdAt: influencer.createdAt?.toISOString(),
          updatedAt: influencer.updatedAt?.toISOString(),
        };
      }),
    );

    // Sort by follower count (descending - most followers first)
    const sortedInfluencers = influencersWithMetrics.sort(
      (a, b) => b.metrics.followers - a.metrics.followers,
    );

    // Apply pagination after sorting
    const paginatedInfluencers = sortedInfluencers.slice(
      offset,
      offset + limit,
    );

    return {
      topInfluencers: paginatedInfluencers,
      total: sortedInfluencers.length,
      limit,
      offset,
    };
  }
}
