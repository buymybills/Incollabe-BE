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
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { UserType as DeviceUserType } from '../shared/models/device-token.model';
import { APP_VERSION } from '../shared/constants/app-version.constants';
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
import * as crypto from 'crypto';
import { Gender } from '../auth/types/gender.enum';
import { CustomNicheService } from '../shared/services/custom-niche.service';
import { UserType as CustomNicheUserType } from '../auth/model/custom-niche.model';
import { CreditTransaction } from 'src/admin/models/credit-transaction.model';
import { InfluencerReferralUsage } from 'src/auth/model/influencer-referral-usage.model';
import { InfluencerUpi } from './models/influencer-upi.model';
import { ProSubscription, SubscriptionStatus } from './models/pro-subscription.model';

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
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
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
    @Inject('CREDIT_TRANSACTION_MODEL')
    private readonly creditTransactionModel: typeof CreditTransaction,
    @Inject('INFLUENCER_REFERRAL_USAGE_MODEL')
    private readonly influencerReferralUsageModel: typeof InfluencerReferralUsage,
    @Inject('INFLUENCER_UPI_MODEL')
    private readonly influencerUpiModel: typeof InfluencerUpi,
    @Inject('PRO_SUBSCRIPTION_MODEL')
    private readonly proSubscriptionModel: typeof ProSubscription,
  ) {}

  /**
   * Maps deliverable type value to its human-readable label
   */
  private getDeliverableLabel(value: string): string {
    const deliverableLabels: Record<string, string> = {
      // Social media deliverables
      instagram_reel: 'Insta Reel / Post',
      instagram_story: 'Insta Story',
      youtube_short: 'YT Shorts',
      youtube_long_video: 'YT Video',
      facebook_story: 'FB Story',
      facebook_post: 'FB Post',
      twitter_post: 'X Post',
      linkedin_post: 'LinkedIn Post',
      // Engagement deliverables
      like_comment: 'Like/Comment',
      playstore_review: 'Playstore Review',
      appstore_review: 'App Store Review',
      google_review: 'Google Review',
      app_download: 'App Download',
    };

    return deliverableLabels[value] || value;
  }

  async getInfluencerProfile(
    influencerId: number,
    isPublic: boolean = false,
    currentUserId?: number,
    currentUserType?: 'influencer' | 'brand',
    deviceId?: string,
  ) {
    // Validate that only influencers can access their own profile
    if (influencerId === currentUserId && currentUserType === 'brand') {
      throw new BadRequestException('Only influencers can access this endpoint');
    }

    let influencer = await this.influencerRepository.findById(influencerId);

    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Check if profile is actually complete and update flag if needed
    const isActuallyComplete =
      this.checkInfluencerProfileCompletion(influencer);
    if (isActuallyComplete && !influencer.isProfileCompleted) {
      // Check latest review status
      const latestReview = await this.profileReviewModel.findOne({
        where: { profileId: influencerId, profileType: ProfileType.INFLUENCER },
        order: [['createdAt', 'DESC']],
      });
      if (!latestReview || latestReview.status !== ReviewStatus.REJECTED) {
        // Profile is complete but flag is outdated - update it
        await this.influencerRepository.updateInfluencer(influencerId, {
          isProfileCompleted: true,
        });
        // ...existing code...
        // Check if profile has ever been submitted for review
        const hasBeenSubmitted = await this.hasProfileReview(influencerId);
        // If profile just became complete and hasn't been submitted, create review
        if (!hasBeenSubmitted) {
          await this.createProfileReview(influencerId);
          // Send verification pending push notification asynchronously (fire-and-forget)
          const fcmTokens = await this.deviceTokenService.getAllUserTokens(influencerId, DeviceUserType.INFLUENCER);
          if (fcmTokens && fcmTokens.length > 0) {
            this.notificationService.sendCustomNotification(
              fcmTokens,
              'Profile Under Review',
              `Hi ${influencer.name}, your profile has been submitted for verification. You will be notified once the review is complete within 48 hours.`,
              { type: 'profile_verification_pending' },
            ).catch(err => console.error('Failed to send profile verification pending notification:', err));
          }
        }
        // Refetch influencer to get updated state from database
        const updatedInfluencer = await this.influencerRepository.findById(
          influencerId,
        );
        if (updatedInfluencer) {
          influencer = updatedInfluencer;
        }
      }
      // else: latest review is rejected, require explicit resubmission
    }

    // Check if current user follows this influencer
    let isFollowing = false;
    if (currentUserId && currentUserType) {
      const followRecord = await this.followModel.findOne({
        where: {
          followingType: FollowingType.INFLUENCER,
          followingInfluencerId: influencerId,
          ...(currentUserType === 'influencer'
            ? {
                followerType: FollowingType.INFLUENCER,
                followerInfluencerId: currentUserId,
              }
            : {
                followerType: FollowingType.BRAND,
                followerBrandId: currentUserId,
              }),
        },
      });
      isFollowing = !!followRecord;
    }

    // Check and reset weekly credits if needed
    influencer = await this.checkAndResetWeeklyCredits(influencer);

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
      userType: 'influencer' as const,
      phone: influencer.phone || null,
      whatsappNumber: influencer.whatsappNumber || null,
      dateOfBirth: influencer.dateOfBirth
        ? influencer.dateOfBirth instanceof Date
          ? influencer.dateOfBirth.toISOString()
          : influencer.dateOfBirth
        : null,
      gender: influencer.gender || null,
      othersGender: influencer.othersGender || null,

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
        logoNormal: niche.logoNormal,
        logoDark: niche.logoDark,
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

      // Following status
      isFollowing,

      // Verification status (available for both public and private)
      verificationStatus,

      // Collaboration costs (public)
      collaborationCosts: influencer.collaborationCosts || {},

      createdAt:
        influencer.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt:
        influencer.updatedAt?.toISOString() || new Date().toISOString(),
    };

    // Fetch device token for the user (only for non-public view)
    let deviceToken: {
      id: number;
      deviceId: string | null;
      deviceName: string | null;
      deviceOs: string | null;
      appVersion: string | null;
      versionCode: number | null;
    } | null = null;

    // App version information with constants and user's installed version
    let appVersionInfo: {
      installedVersion: {
        appVersion: string | null;
        versionCode: number | null;
      };
      minimumVersion: {
        appVersion: string;
        versionCode: number;
      };
      latestVersion: {
        appVersion: string;
        versionCode: number;
      };
      updateRequired: boolean;
      updateAvailable: boolean;
      forceUpdate: boolean;
      updateMessage: string;
    } | null = null;

    if (!isPublic) {
      const devices = await this.deviceTokenService.getUserDevices(influencerId, DeviceUserType.INFLUENCER);

      // If deviceId is provided, find that specific device; otherwise use most recent
      let selectedDevice: typeof devices[number] | undefined = undefined;
      if (deviceId) {
        selectedDevice = devices.find(device => device.deviceId === deviceId);
      } else if (devices.length > 0) {
        selectedDevice = devices[0]; // Most recently used device
      }

      // Map device token to response format (without fcmToken)
      if (selectedDevice) {
        deviceToken = {
          id: selectedDevice.id,
          deviceId: selectedDevice.deviceId,
          deviceName: selectedDevice.deviceName,
          deviceOs: selectedDevice.deviceOs,
          appVersion: selectedDevice.appVersion,
          versionCode: selectedDevice.versionCode,
        };
      }

      // Get the most recently used device for app version comparison
      const mostRecentDevice = selectedDevice || (devices.length > 0 ? devices[0] : null);

      // Build app version info with constants and user's installed version
      appVersionInfo = {
        // User's currently installed app version (from their device)
        installedVersion: {
          appVersion: mostRecentDevice?.appVersion || null,
          versionCode: mostRecentDevice?.versionCode || null,
        },
        // Minimum required version (from constants)
        minimumVersion: {
          appVersion: APP_VERSION.MINIMUM_VERSION,
          versionCode: APP_VERSION.MINIMUM_VERSION_CODE,
        },
        // Latest available version (from constants)
        latestVersion: {
          appVersion: APP_VERSION.LATEST_VERSION,
          versionCode: APP_VERSION.LATEST_VERSION_CODE,
        },
        // Update flags
        updateRequired: mostRecentDevice?.versionCode
          ? mostRecentDevice.versionCode < APP_VERSION.MINIMUM_VERSION_CODE
          : false,
        updateAvailable: mostRecentDevice?.versionCode
          ? mostRecentDevice.versionCode < APP_VERSION.LATEST_VERSION_CODE
          : false,
        forceUpdate: APP_VERSION.FORCE_UPDATE && (mostRecentDevice?.versionCode
          ? mostRecentDevice.versionCode < APP_VERSION.MINIMUM_VERSION_CODE
          : false),
        // Update messages
        updateMessage: APP_VERSION.FORCE_UPDATE && (mostRecentDevice?.versionCode
          ? mostRecentDevice.versionCode < APP_VERSION.MINIMUM_VERSION_CODE
          : false)
          ? APP_VERSION.FORCE_UPDATE_MESSAGE
          : APP_VERSION.UPDATE_MESSAGE,
      };
    }

    // Include private data only if not public view
    if (!isPublic) {
      // Convert Pro subscription dates to IST if they exist
      const proActivatedAtIST = influencer.proActivatedAt
        ? new Date(influencer.proActivatedAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
        : null;

      const proExpiresAtIST = influencer.proExpiresAt
        ? new Date(influencer.proExpiresAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
        : null;

      // Calculate monthly referral usage count
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthlyReferralUsageCount = await this.influencerReferralUsageModel.count({
        where: {
          influencerId: influencer.id,
          referralCode: influencer.referralCode || '',
          createdAt: {
            [Op.gte]: startOfMonth,
            [Op.lte]: endOfMonth,
          },
        },
      });

      // Calculate next reset date (1st of next month at 00:00:00)
      const nextResetDate = new Date(startOfMonth);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      // Calculate isPro dynamically based on actual subscription status
      const now = new Date();
      let isPro = false;

      // Query the actual subscription to check its status
      const subscription = await this.proSubscriptionModel.findOne({
        where: { influencerId },
        order: [['createdAt', 'DESC']],
      });

      if (subscription) {
        // User has Pro access if:
        // 1. Subscription is ACTIVE, OR
        // 2. Subscription is CANCELLED but current period hasn't ended yet, OR
        // 3. Subscription is PAUSED:
        //    - Before currentPeriodEnd: isPro = true (paid period, pause hasn't started)
        //    - After resumeDate: isPro = true (pause ended)
        //    - Between currentPeriodEnd and resumeDate: isPro = false (pause active)

        if (subscription.status === SubscriptionStatus.ACTIVE) {
          isPro = true;
        } else if (subscription.status === SubscriptionStatus.CANCELLED) {
          isPro = subscription.currentPeriodEnd > now;
        } else if (subscription.status === SubscriptionStatus.PAUSED) {
          // If pause period has ended, give Pro access
          if (subscription.resumeDate && subscription.resumeDate <= now) {
            isPro = true;
          }
          // If still in paid period (pause hasn't started yet), give Pro access
          else if (subscription.currentPeriodEnd > now) {
            isPro = true;
          }
          // Otherwise, we're in the pause period - no Pro access
          else {
            isPro = false;
          }
        }
      }

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
        proSubscription: {
          isPro,
          proActivatedAt: proActivatedAtIST,
          proExpiresAt: proExpiresAtIST,
        },
        weeklyCredits: {
          remaining: influencer.weeklyCredits || 0,
          resetDate: influencer.weeklyCreditsResetDate
            ? new Date(influencer.weeklyCreditsResetDate).toISOString()
            : this.getNextMondayResetDate().toISOString(),
        },
        referralCode: influencer.referralCode || null,
        referralCredits: influencer.referralCredits || 0,
        monthlyReferralUsageCount,
        monthlyReferralLimit: 5,
        monthlyReferralRemainingSlots: 5 - monthlyReferralUsageCount,
        monthlyReferralResetDate: nextResetDate.toISOString(),
        upiId: influencer.upiId || null,
        profileCompletion,
        deviceToken,
        appVersion: appVersionInfo,
      };
    }

    return baseProfile;
  }

  async updateInfluencerProfile(
    influencerId: number,
    updateData: UpdateInfluencerProfileDto,
    files?: any,
    userType?: 'influencer' | 'brand',
  ) {
    // Validate that only influencers can update influencer profiles
    if (userType && userType !== 'influencer') {
      throw new BadRequestException('Only influencers can update influencer profiles');
    }

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

    // Handle profile banner clearing
    // If clearProfileBanner is true, set profileBanner to null
    // File uploads take precedence over the clear flag
    if (
      processedData.clearProfileBanner === true &&
      !fileUrls['profileBanner']
    ) {
      fileUrls['profileBanner'] = null;
    }

    // Remove clearProfileBanner from update data as it's not a database field
    delete processedData.clearProfileBanner;
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

    // Handle social links - set to null only if explicitly provided as empty string
    // This ensures that when a user removes a social link from their profile,
    // it gets cleared, but when updating other fields, these values are preserved
    // NOTE: upiId is now managed via dedicated UPI management APIs (POST /upi-ids, etc.)
    const clearableFields = [
      'instagramUrl',
      'youtubeUrl',
      'facebookUrl',
      'linkedinUrl',
      'twitterUrl',
    ];
    clearableFields.forEach((field) => {
      if (processedData[field] === '') {
        processedData[field] = null;
      } else if (processedData[field] === undefined) {
        // Remove the field from processedData to preserve existing value
        delete processedData[field];
      }
    });

    // Store the old completion status BEFORE any updates
    const wasComplete = influencer.isProfileCompleted;

    // Check if profile has ever been submitted for review
    const hasBeenSubmitted = await this.hasProfileReview(influencerId);

    // Pre-calculate what the profile will look like after update to determine completion
    const tempInfluencer = { ...influencer, ...processedData, ...fileUrls };
    const willBeComplete =
      this.checkInfluencerProfileCompletion(tempInfluencer);

    // Check if this is a rejected profile trying to resubmit
    const currentVerificationStatus =
      await this.getVerificationStatus(influencerId);
    if (currentVerificationStatus?.status === 'rejected' && willBeComplete) {
      // Check if the WhatsApp number is already in use by another verified or pending account
      const whatsappNumber = influencer.whatsappNumber;
      if (whatsappNumber) {
        const formattedNumber = whatsappNumber.startsWith('+91')
          ? whatsappNumber
          : `+91${whatsappNumber}`;

        const whatsappHash = crypto
          .createHash('sha256')
          .update(formattedNumber)
          .digest('hex');

        const existingInfluencer =
          await this.influencerRepository.findByWhatsappHash(
            whatsappHash,
            influencerId,
          );

        if (existingInfluencer) {
          const existingVerificationStatus = await this.getVerificationStatus(
            existingInfluencer.id,
          );
          if (
            existingInfluencer.isWhatsappVerified &&
            (existingVerificationStatus?.status === 'approved' ||
              existingVerificationStatus?.status === 'pending')
          ) {
            throw new BadRequestException(
              'This WhatsApp number is already in use by another verified influencer account. Please use a different number.',
            );
          }
        }
      }
    }

    // Update influencer data - include isProfileCompleted flag if profile will be complete
    const updatedData = {
      ...processedData,
      ...fileUrls,
      // Set completion flag immediately if profile is complete
      ...(willBeComplete ? { isProfileCompleted: true } : {}),
    };

    await this.influencerRepository.updateInfluencer(influencerId, updatedData);

    // Fetch updated influencer to get current state
    const updatedInfluencer =
      await this.influencerRepository.findById(influencerId);
    if (!updatedInfluencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Calculate profile completion for response
    const profileCompletion =
      this.calculateProfileCompletion(updatedInfluencer);
    const isComplete = profileCompletion.isCompleted;

    // If profile just became complete and hasn't been submitted, create review
    if (!wasComplete && isComplete && !hasBeenSubmitted) {
      // Create profile review for admin verification
      await this.createProfileReview(influencerId);

      // Send verification pending push notification
      const fcmTokens = await this.deviceTokenService.getAllUserTokens(influencerId, DeviceUserType.INFLUENCER);
      if (fcmTokens && fcmTokens.length > 0) {
        this.notificationService.sendCustomNotification(
          fcmTokens,
          'Profile Under Review',
          `Hi ${updatedInfluencer.name}, your profile has been submitted for verification. You will be notified once the review is complete within 48 hours.`,
          { type: 'profile_verification_pending' },
        ).catch(err => console.error('Failed to send profile verification pending notification:', err));
      }
    }

    // If profile is already complete but has no review record, create one
    // This handles cases where profile was already marked complete but hasn't been submitted yet
    if (isComplete && !hasBeenSubmitted && wasComplete) {
      await this.createProfileReview(influencerId);

      // Send verification pending push notification
      const fcmTokens = await this.deviceTokenService.getAllUserTokens(influencerId, DeviceUserType.INFLUENCER);
      if (fcmTokens && fcmTokens.length > 0) {
        this.notificationService.sendCustomNotification(
          fcmTokens,
          'Profile Under Review',
          `Hi ${updatedInfluencer.name}, your profile has been submitted for verification. You will be notified once the review is complete within 48 hours.`,
          { type: 'profile_verification_pending' },
        ).catch(err => console.error('Failed to send profile verification pending notification:', err));
      }
    }

    // Send appropriate WhatsApp notification based on completion status
    // Only send notifications if profile has never been submitted
    if (!hasBeenSubmitted) {
      if (!isComplete) {
        // Profile is incomplete - send missing fields notifications (WhatsApp only for influencers)
        console.log('Profile incomplete notification check:', {
          influencerId: influencer.id,
          name: influencer.name,
          whatsappNumber: influencer.whatsappNumber,
          isWhatsappVerified: influencer.isWhatsappVerified,
          missingFieldsCount: profileCompletion.missingFields.length,
          missingFields: profileCompletion.missingFields,
        });

        // Send profile incomplete push notification
        const fcmTokens = await this.deviceTokenService.getAllUserTokens(influencer.id, DeviceUserType.INFLUENCER);
        if (fcmTokens && fcmTokens.length > 0) {
          const missingCount = profileCompletion.missingFields.length;
          this.notificationService.sendCustomNotification(
            fcmTokens,
            'Complete Your Profile',
            `Hi ${influencer.name}, you have ${missingCount} field${missingCount > 1 ? 's' : ''} remaining to complete your profile. Complete it to apply for campaigns!`,
            {
              type: 'profile_incomplete',
              missingFieldsCount: missingCount.toString(),
              missingFields: JSON.stringify(profileCompletion.missingFields)
            },
          ).catch(err => console.error('Failed to send profile incomplete notification:', err));
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
      // 'profileBanner', // Optional - not required for 100% completion
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
          isNew: false, // Pending status doesn't need "new" indicator
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

    // Format the phone number consistently
    const formattedNumber = whatsappNumber.startsWith('+91')
      ? whatsappNumber
      : `+91${whatsappNumber}`;

    // Generate WhatsApp hash to check for existing verification
    const whatsappHash = crypto
      .createHash('sha256')
      .update(formattedNumber)
      .digest('hex');

    // Check if number is already verified by another influencer
    const existingInfluencer =
      await this.influencerRepository.findByWhatsappHash(
        whatsappHash,
        influencerId,
        formattedNumber,
      );

    // If number is already verified by another influencer, block it
    if (existingInfluencer) {
      throw new BadRequestException(
        'This WhatsApp number is already verified by another user',
      );
    }

    // Generate and store OTP
    const otp = await this.otpService.generateAndStoreOtp({
      identifier: formattedNumber,
      type: 'phone',
    });

    // Send OTP via WhatsApp (wait for delivery confirmation)
    // If this fails, error will be caught by global exception handler
    await this.whatsAppService.sendOTP(whatsappNumber, otp);

    return {
      message: SUCCESS_MESSAGES.WHATSAPP.OTP_SENT,
      whatsappNumber: whatsappNumber,
      otp: otp,
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

    // Format the phone number consistently
    const formattedNumber = whatsappNumber.startsWith('+91')
      ? whatsappNumber
      : `+91${whatsappNumber}`;

    // Verify OTP using OTP service
    await this.otpService.verifyOtp({
      identifier: formattedNumber,
      type: 'phone',
      otp: otp,
    });

    // Update WhatsApp verification status using repository
    await this.influencerRepository.updateWhatsAppVerification(
      influencerId,
      formattedNumber,
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
      campaignType,
      page = 1,
      limit = 10,
    } = getOpenCampaignsDto;

    // Fetch influencer profile data for filtering
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Calculate influencer's age if dateOfBirth exists
    let influencerAge: number | null = null;
    if (influencer.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(influencer.dateOfBirth);
      influencerAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        influencerAge--;
      }
    }

    const offset = (page - 1) * limit;
    const whereCondition: any = {
      status: CampaignStatus.ACTIVE,
      isActive: true,
    };

    // Get campaign IDs where influencer has been invited
    const invitations = await this.campaignInvitationModel.findAll({
      where: { influencerId },
      attributes: ['campaignId'],
    });
    const invitedCampaignIds = invitations ? invitations.map(inv => inv.campaignId) : [];
    
    console.log('🎯 INVITATION DEBUG - getOpenCampaigns:', {
      influencerId,
      invitationsCount: invitations.length,
      invitedCampaignIds,
      hasInvitations: invitedCampaignIds.length > 0,
    });

    // CRITICAL FIX: Use a top-level [Op.or] to separate invited campaigns from regular campaigns
    // This allows invited campaigns to bypass all demographic filters
    const allAndConditions: any[] = [];

    // Add invited campaigns at the TOP LEVEL so they bypass all other filters
    const inviteOnlyOrConditions: any[] = [
      { id: { [Op.in]: invitedCampaignIds.length > 0 ? invitedCampaignIds : [-1] } },
    ];

    // 24-hour early access filter for non-Pro users (only for NON-INVITED campaigns)
    if (!influencer?.isPro) {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      console.log('⏰ Early Access Filter (Open Campaigns) - Non-Pro User:', {
        currentTime: new Date().toISOString(),
        twentyFourHoursAgo: twentyFourHoursAgo.toISOString(),
        influencerId,
        isPro: influencer.isPro,
      });

      // Non-invited campaigns must match early access logic
      inviteOnlyOrConditions.push({
        [Op.and]: [
          { [Op.not]: { id: { [Op.in]: invitedCampaignIds.length > 0 ? invitedCampaignIds : [-1] } } }, // NOT invited
          {
            [Op.or]: [
              { isMaxCampaign: true }, // Show MAX campaigns
              {
                // Show ORGANIC campaigns older than 24 hours
                [Op.and]: [
                  { isMaxCampaign: { [Op.ne]: true } },
                  { isInviteOnly: { [Op.ne]: true } },
                  { createdAt: { [Op.lte]: twentyFourHoursAgo } },
                ],
              },
            ],
          },
        ],
      } as any);

      console.log('✅ Early Access Filter Applied to Open Campaigns');
    } else {
      // Pro users see non-invite-only campaigns (not invited)
      inviteOnlyOrConditions.push({
        [Op.and]: [
          { [Op.not]: { id: { [Op.in]: invitedCampaignIds.length > 0 ? invitedCampaignIds : [-1] } } }, // NOT invited
          { isInviteOnly: false }, // Only non-invite-only
        ],
      } as any);
    }

    // Add the invite/non-invite logic as top level OR
    allAndConditions.push({
      [Op.or]: inviteOnlyOrConditions,
    });

    whereCondition[Op.and] = allAndConditions;

    // Search by campaign name or brand name
    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Niche filter - use provided nicheIds or fetch influencer's niches
    let nicheIdsToFilter: number[] = [];
    if (nicheIds && nicheIds.length > 0) {
      // Use explicitly provided nicheIds from query parameter
      nicheIdsToFilter = nicheIds;
    } else {
      // Fetch influencer's niches automatically
      const influencerNiches = await this.influencerNicheModel.findAll({
        where: { influencerId },
        attributes: ['nicheId'],
        raw: true,
      });
      nicheIdsToFilter = influencerNiches.map((n: any) => n.nicheId);
    }

    // Add niche filter to WHERE condition if nicheIds are available
    // Invited campaigns won't reach here because they're handled in the top-level OR
    if (nicheIdsToFilter.length > 0) {
      const nicheConditions = nicheIdsToFilter.map((nicheId) =>
        literal(`"Campaign"."nicheIds"::jsonb @> '[${nicheId}]'::jsonb`),
      );
      whereCondition[Op.and] = [
        ...(whereCondition[Op.and] || []),
        { [Op.or]: nicheConditions },
      ];
    }

    // Add age filter to WHERE condition
    // Invited campaigns won't reach here because they're handled in the top-level OR
    if (influencerAge !== null) {
      whereCondition[Op.and] = [
        ...(whereCondition[Op.and] || []),
        {
          [Op.or]: [
            { isOpenToAllAges: true },
            {
              [Op.and]: [
                { minAge: { [Op.lte]: influencerAge } },
                { maxAge: { [Op.gte]: influencerAge } },
              ],
            },
          ],
        },
      ];
    }

    // Add gender filter to WHERE condition
    // Invited campaigns won't reach here because they're handled in the top-level OR
    if (influencer.gender) {
      whereCondition[Op.and] = [
        ...(whereCondition[Op.and] || []),
        {
          [Op.or]: [
            { isOpenToAllGenders: true },
            literal(
              `"Campaign"."genderPreferences"::jsonb @> '["${influencer.gender}"]'::jsonb`,
            ),
          ],
        },
      ];
    }

    // Add campaign type filter to WHERE condition
    if (campaignType) {
      whereCondition[Op.and] = [
        ...(whereCondition[Op.and] || []),
        { type: campaignType },
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
        attributes: ['id'], // Keep id to allow nested city data
        include: [
          {
            model: City,
            attributes: ['id', 'name', 'tier'],
          },
        ],
      },
    ];

    // City filter (from user's filter OR campaign location requirements)
    if (cityIds && cityIds.length > 0) {
      includeOptions.push({
        model: CampaignCity,
        where: { cityId: { [Op.in]: cityIds } },
        required: true,
      });
    }
    // Location filter - campaigns that match influencer's city or are Pan-India
    // Invited campaigns won't reach here because they're handled in the top-level OR
    if (influencer.cityId) {
      whereCondition[Op.and] = [
        ...(whereCondition[Op.and] || []),
        {
          [Op.or]: [
            { isPanIndia: true },
            {
              '$cities.cityId$': influencer.cityId,
            },
          ],
        },
      ];
    }

    // Apply pagination at database level
    const { count, rows: campaigns } = await this.campaignModel.findAndCountAll(
      {
        attributes: [
          'id',
          'brandId',
          'name',
          'description',
          'category',
          'deliverableFormat',
          'status',
          'type',
          'isInviteOnly',
          'isPanIndia',
          'minAge',
          'maxAge',
          'isOpenToAllAges',
          'genderPreferences',
          'isOpenToAllGenders',
          'nicheIds',
          'customInfluencerRequirements',
          'performanceExpectations',
          'brandSupport',
          'campaignBudget',
          'barterProductWorth',
          'additionalMonetaryPayout',
          'numberOfInfluencers',
          'isActive',
          'isMaxCampaign',
          'createdAt',
          'updatedAt',
        ],
        where: whereCondition,
        include: includeOptions,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
        subQuery: false,
      },
    );

    console.log('📊 QUERY RESULTS - getOpenCampaigns:', {
      influencerId,
      invitedCampaignIds,
      campaignsReturned: campaigns.length,
      totalCount: count,
      campaignIds: campaigns.map(c => c.id),
      campaignNames: campaigns.map(c => c.name),
    });

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

    const enrichedCampaigns = campaigns.map((campaign) => {
      const campaignData = campaign.toJSON();

      // Transform cities to array of objects
      if (campaignData.cities && campaignData.cities.length > 0) {
        const citiesArray = campaignData.cities.map((cityRelation: any) => {
          // Handle nested city structure from CampaignCity relation
          const cityData = cityRelation.city || cityRelation;
          return {
            id: cityData.id,
            name: cityData.name,
            tier: cityData.tier,
          };
        });
        (campaignData as any).cities = citiesArray;
      } else {
        (campaignData as any).cities = [];
      }

      // Transform deliverables to human-readable labels and remove from response
      let deliverableFormat: string[] | null = null;
      if (campaignData.deliverables && campaignData.deliverables.length > 0) {
        deliverableFormat = campaignData.deliverables.map((d: any) => this.getDeliverableLabel(d.type));
      }

      // Destructure to exclude deliverables from response
      const { deliverables, ...campaignDataWithoutDeliverables } = campaignData;

      return {
        ...campaignDataWithoutDeliverables,
        deliverableFormat,
        hasApplied: applicationMap.has(campaign.id),
        applicationStatus: applicationMap.get(campaign.id) || null,
        totalApplications: countMap.get(campaign.id) || 0,
      };
    });

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
      include: [{ model: Brand, attributes: ['id', 'brandName'] }],
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

    // Check 24-hour Pro-only early access window (applies to ALL campaigns)
    const now = new Date();
    const campaignCreatedAt = new Date(campaign.createdAt);
    const hoursSinceCreation = (now.getTime() - campaignCreatedAt.getTime()) / (1000 * 60 * 60);

    // If within first 24 hours, only Pro influencers can apply
    if (hoursSinceCreation <= 24) {
      const influencer = await this.influencerRepository.findById(influencerId);
      if (!influencer?.isPro) {
        const campaignTypeMessage = campaign.isMaxCampaign
          ? 'This is a Max Campaign.'
          : 'This campaign is in early access period.';
        throw new ForbiddenException(
          `${campaignTypeMessage} Only Pro influencers can apply during the first 24 hours. Upgrade to Pro or wait until the campaign opens to all influencers.`,
        );
      }
    }
    // After 24 hours, anyone can apply (no restriction)

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

    // Deduct weekly credit before creating application
    await this.deductWeeklyCredit(influencerId);

    // Create application
    const application = await this.campaignApplicationModel.create({
      campaignId,
      influencerId,
      status: ApplicationStatus.APPLIED,
    } as any);

    // Send push notification to influencer about application confirmation asynchronously (fire-and-forget)
    const influencerFcmTokens = await this.deviceTokenService.getAllUserTokens(influencer.id, DeviceUserType.INFLUENCER);
    if (influencerFcmTokens && influencerFcmTokens.length > 0) {
      this.notificationService.sendCustomNotification(
        influencerFcmTokens,
        'Application Submitted!',
        `Hi ${influencer.name}, your application for "${campaign.name}" by ${campaign.brand?.brandName || 'Brand'} has been submitted successfully. You will be notified about the status.`,
        {
          type: 'campaign_application_submitted',
          campaignId: campaign.id.toString(),
          campaignName: campaign.name,
          brandName: campaign.brand?.brandName || 'Brand',
        },
      ).catch(err => console.error('Failed to send campaign application confirmation notification:', err));
    }

    // Send push notification to brand owner about new application asynchronously (fire-and-forget)
    const brand = campaign.brand;
    if (brand?.id) {
      this.deviceTokenService
        .getAllUserTokens(brand.id, DeviceUserType.BRAND)
        .then((deviceTokens: string[]) => {
          if (deviceTokens.length > 0) {
            return this.notificationService.sendNewApplicationNotification(
              deviceTokens,
              influencer.name,
              campaign.name,
              influencer.id.toString(),
            );
          }
        })
        .catch((error: any) => {
          console.error('Failed to send push notification to brand:', error);
        });
    }

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
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    applications: MyApplicationResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const whereClause: any = { influencerId };

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Get total count and applications with pagination
    const { count, rows: applications } =
      await this.campaignApplicationModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Campaign,
            attributes: [
              'id',
              'name',
              'description',
              'status',
              'type',
              'category',
              'deliverableFormat',
              'campaignBudget',
              'barterProductWorth',
              'additionalMonetaryPayout',
              'numberOfInfluencers',
              'isActive',
              'isMaxCampaign',
              'createdAt',
              'updatedAt',
            ],
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
        limit,
        offset,
      });

    const mappedApplications = applications.map((app) => {
      const appData = app.toJSON();

      // Transform deliverables to human-readable labels
      let deliverableFormat: string[] | null = null;
      if (appData.campaign.deliverables && appData.campaign.deliverables.length > 0) {
        deliverableFormat = appData.campaign.deliverables.map((d: any) => this.getDeliverableLabel(d.type));
      }

      // Destructure to exclude deliverables from campaign response
      const { deliverables, ...campaignWithoutDeliverables } = appData.campaign;

      return {
        id: appData.id,
        status: appData.status,
        coverLetter: appData.coverLetter,
        proposalMessage: appData.proposalMessage,
        createdAt: appData.createdAt,
        reviewedAt: appData.reviewedAt,
        reviewNotes: appData.reviewNotes,
        campaign: {
          ...campaignWithoutDeliverables,
          deliverableFormat,
        },
      };
    });

    const totalPages = Math.ceil(count / limit);

    return {
      applications: mappedApplications as MyApplicationResponseDto[],
      total: count,
      page,
      limit,
      totalPages,
    };
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
      },
      attributes: [
        'id',
        'name',
        'description',
        'status',
        'type',
        'category',
        'deliverableFormat',
        'isInviteOnly',
        'isPanIndia',
        'minAge',
        'maxAge',
        'isOpenToAllAges',
        'genderPreferences',
        'isOpenToAllGenders',
        'nicheIds',
        'customInfluencerRequirements',
        'performanceExpectations',
        'brandSupport',
        'campaignBudget',
        'barterProductWorth',
        'additionalMonetaryPayout',
        'numberOfInfluencers',
        'isActive',
        'isMaxCampaign',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName', 'profileImage', 'websiteUrl'],
        },
        {
          model: CampaignCity,
          attributes: ['id'], // Keep id to allow nested city data
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

    const campaignData = campaign.toJSON();

    // Transform cities to array of objects
    let transformedCities: any = [];
    if (campaignData.cities && campaignData.cities.length > 0) {
      transformedCities = campaignData.cities.map((cityRelation: any) => {
        // Handle nested city structure from CampaignCity relation
        const cityData = cityRelation.city || cityRelation;
        return {
          id: cityData.id,
          name: cityData.name,
          tier: cityData.tier,
        };
      });
    }

    // Transform deliverables to human-readable labels
    let deliverableFormat: string[] | null = null;
    if (campaignData.deliverables && campaignData.deliverables.length > 0) {
      deliverableFormat = campaignData.deliverables.map((d: any) => this.getDeliverableLabel(d.type));
    }

    // Destructure to exclude deliverables from response
    const { deliverables, ...campaignDataWithoutDeliverables } = campaignData;

    // Return transformed campaign data
    return {
      ...campaignDataWithoutDeliverables,
      cities: transformedCities,
      deliverableFormat,
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
        contentType: link.contentType || 'post', // Default to 'post' if not provided
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
          contentType: link.contentType || 'post', // Default to 'post' if not provided
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

  async deleteExperience(
    experienceId: number,
    influencerId: number,
  ): Promise<{ message: string }> {
    const experience = await this.experienceModel.findOne({
      where: { id: experienceId, influencerId },
    });

    if (!experience) {
      throw new NotFoundException('Experience not found');
    }

    // Delete associated social links first
    await this.experienceSocialLinkModel.destroy({
      where: { experienceId },
    });

    // Delete the experience
    await experience.destroy();

    return { message: 'Experience deleted successfully' };
  }

  async getExperiences(
    influencerId: number,
    experienceId?: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<
    | Experience
    | {
        experiences: Experience[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }
  > {
    const includeOptions = [
      {
        model: ExperienceSocialLink,
        attributes: ['id', 'platform', 'contentType', 'url'],
      },
    ];

    // If experience ID is provided, return single experience
    if (experienceId) {
      const experience = await this.experienceModel.findOne({
        where: { id: experienceId, influencerId },
        include: includeOptions,
      });

      if (!experience) {
        throw new NotFoundException('Experience not found');
      }

      return experience;
    }

    // Otherwise return paginated list
    const offset = (page - 1) * limit;

    const { count, rows: experiences } =
      await this.experienceModel.findAndCountAll({
        where: { influencerId },
        include: includeOptions,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

    const totalPages = Math.ceil(count / limit);

    return {
      experiences,
      total: count,
      page,
      limit,
      totalPages,
    };
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
    const [
      followersCount,
      followingCount,
      postsCount,
      campaignsCount,
      experiencesCount,
    ] = await Promise.all([
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

      // Count experiences added by this influencer
      this.experienceModel.count({
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
      experiences: experiencesCount,
    };
  }

  async getTopInfluencers(page: number = 1, limit: number = 10) {
    // Fetch all top influencers first (without limit/offset for proper sorting)
    const allTopInfluencers = await this.influencerRepository.findAll({
      where: {
        isTopInfluencer: true,
        isActive: true,
        isVerified: true,
      },
      // DO NOT use order here, we will sort in-memory
    });

    // Calculate metrics for each top influencer
    const influencersWithMetrics = await Promise.all(
      allTopInfluencers.map(async (influencer) => {
        const [platformMetrics, verificationStatus] = await Promise.all([
          this.calculatePlatformMetrics(influencer.id),
          this.getVerificationStatus(influencer.id),
        ]);

        // Use overallScore if present, else default to 0
        const overallScore =
          platformMetrics && 'overallScore' in platformMetrics
            ? ((platformMetrics as any).overallScore ?? 0)
            : 0;

        return {
          id: influencer.id,
          name: influencer.name,
          username: influencer.username,
          bio: influencer.bio,
          profileImage: influencer.profileImage,
          profileBanner: influencer.profileBanner,
          profileHeadline: influencer.profileHeadline,
          userType: 'influencer' as const,
          displayOrder: influencer.displayOrder,
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
            logoNormal: niche.logoNormal,
            logoDark: niche.logoDark,
          })),
          metrics: platformMetrics,
          overallScore,
          isTopInfluencer: true,
          isVerified: influencer.isVerified,
          verificationStatus,
          createdAt: influencer.createdAt?.toISOString(),
          updatedAt: influencer.updatedAt?.toISOString(),
        };
      }),
    );

    // Sort by displayOrder ASC, then updatedAt DESC, then overallScore DESC
    influencersWithMetrics.sort((a, b) => {
      const aOrder = a.displayOrder ?? null;
      const bOrder = b.displayOrder ?? null;
      if (aOrder !== null && bOrder !== null) {
        const orderDiff = aOrder - bOrder;
        if (orderDiff !== 0) return orderDiff;
        // Tiebreaker: updatedAt DESC
        if (a.updatedAt && b.updatedAt) {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          if (bTime !== aTime) return bTime - aTime;
        }
        // Final tiebreaker: overallScore DESC
        return (b.overallScore ?? 0) - (a.overallScore ?? 0);
      }
      if (aOrder !== null && bOrder === null) return -1;
      if (aOrder === null && bOrder !== null) return 1;
      // If neither has displayOrder, sort by overallScore DESC
      return (b.overallScore ?? 0) - (a.overallScore ?? 0);
    });

    // Paginate after sorting using page and limit
    const offset = (page - 1) * limit;
    const paginatedInfluencers = influencersWithMetrics.slice(
      offset,
      offset + limit,
    );

    return {
      topInfluencers: paginatedInfluencers,
      total: influencersWithMetrics.length,
      page,
      limit,
      totalPages: Math.ceil(influencersWithMetrics.length / limit),
    };
  }

  async getReferralRewards(influencerId: number, page: number = 1, limit: number = 10) {
    // Get influencer to fetch total referral credits
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Only get individual credit transactions, exclude consolidated redemption requests
    const allTransactions = await this.creditTransactionModel.findAll({
      where: {
        influencerId,
        description: {
          [Op.notLike]: 'Redemption request%',
        },
      },
      attributes: ['amount', 'paymentStatus'],
      raw: true,
    });

    // Calculate summary
    const lifetimeReward = allTransactions.reduce((sum: number, tx: any) => sum + tx.amount, 0);
    const paid = allTransactions
      .filter((tx: any) => tx.paymentStatus === 'paid')
      .reduce((sum: number, tx: any) => sum + tx.amount, 0);
    const processing = allTransactions
      .filter((tx: any) => tx.paymentStatus === 'processing')
      .reduce((sum: number, tx: any) => sum + tx.amount, 0);
    const redeemable = allTransactions
      .filter((tx: any) => tx.paymentStatus === 'pending')
      .reduce((sum: number, tx: any) => sum + tx.amount, 0);

    // Include processing amounts in redeemed (since redemption is already requested)
    const redeemed = paid + processing;

    // Get paginated referral history
    const offset = (page - 1) * limit;

    // Get referrals with their details
    const { count, rows: referralUsages } = await this.influencerReferralUsageModel.findAndCountAll({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      raw: true,
    });

    // Get referred influencers details
    const referredUserIds = referralUsages.map((r: any) => r.referredUserId);

    // Use Influencer model directly to fetch multiple users
    const referredInfluencers = referredUserIds.length > 0
      ? await Influencer.findAll({
          where: { id: { [Op.in]: referredUserIds } },
          attributes: ['id', 'name', 'username', 'profileImage', 'isVerified'],
          raw: true,
        })
      : [];

    // Get credit transactions for these referrals
    const creditTransactions = referredUserIds.length > 0
      ? await this.creditTransactionModel.findAll({
          where: {
            influencerId,
            referredUserId: { [Op.in]: referredUserIds },
          },
          raw: true,
        })
      : [];

    // Create a map of referredUserId to transaction
    const txMap = new Map();
    creditTransactions.forEach((tx: any) => {
      txMap.set(tx.referredUserId, tx);
    });

    // Build referral history
    const referralHistory = referralUsages.map((usage: any) => {
      const referredInfluencer = referredInfluencers.find((inf: any) => inf.id === usage.referredUserId);
      const transaction = txMap.get(usage.referredUserId);

      return {
        id: referredInfluencer?.id || usage.referredUserId,
        name: referredInfluencer?.name || 'Unknown',
        username: referredInfluencer?.username || 'unknown',
        profileImage: referredInfluencer?.profileImage || null,
        isVerified: referredInfluencer?.isVerified || false,
        joinedAt: usage.createdAt,
        rewardEarned: transaction?.amount || 0,
        rewardStatus: transaction?.paymentStatus || 'pending',
        creditTransactionId: transaction?.id || null,
      };
    });

    return {
      summary: {
        lifetimeReward,
        redeemed,
        redeemable,
      },
      referralHistory,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async trackReferralInviteClick(influencerId: number) {
    // Verify influencer exists
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Increment the click count atomically
    await Influencer.increment('referralInviteClickCount', {
      where: { id: influencerId },
    });

    // Fetch the updated count
    const updated = await this.influencerRepository.findById(influencerId);
    if (!updated) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    return {
      success: true,
      message: 'Invite click tracked successfully',
      totalClicks: updated.referralInviteClickCount || 0,
    };
  }

  async redeemRewards(influencerId: number, upiIdRecordId?: number) {
    // Get influencer
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Get selected UPI ID or use provided UPI ID record
    let selectedUpiRecord: any;

    if (upiIdRecordId) {
      // Use the provided UPI ID record
      selectedUpiRecord = await this.influencerUpiModel.findOne({
        where: { id: upiIdRecordId, influencerId },
      });

      if (!selectedUpiRecord) {
        throw new NotFoundException('Selected UPI ID not found.');
      }
    } else {
      // Get the selected UPI ID
      selectedUpiRecord = await this.influencerUpiModel.findOne({
        where: {
          influencerId,
          isSelectedForCurrentTransaction: true
        },
      });

      if (!selectedUpiRecord) {
        throw new BadRequestException('No UPI ID selected for redemption. Please select a UPI ID first.');
      }
    }

    const finalUpiId = selectedUpiRecord.upiId;
    console.log('🔍 DEBUG - UPI ID selected for redemption:', {
      selectedUpiRecordId: selectedUpiRecord.id,
      finalUpiId,
      influencerId,
    });

    // Get all pending (earned but not redeemed) transactions
    const pendingTransactions = await this.creditTransactionModel.findAll({
      where: {
        influencerId,
        paymentStatus: 'pending',
      },
      raw: true,
    });

    if (pendingTransactions.length === 0) {
      throw new BadRequestException('No pending rewards to redeem.');
    }

    // Calculate total redeemable amount
    const totalAmount = pendingTransactions.reduce((sum: number, tx: any) => sum + tx.amount, 0);

    if (totalAmount <= 0) {
      throw new BadRequestException('No redeemable amount available.');
    }

    // Mark all pending credit transactions as 'processing' since they're being redeemed
    const transactionIds = pendingTransactions.map((tx: any) => tx.id);
    await this.creditTransactionModel.update(
      {
        paymentStatus: 'processing', // Mark as being processed for redemption
      },
      {
        where: {
          id: { [Op.in]: transactionIds },
        },
      },
    );

    // Create ONE consolidated redemption request transaction
    console.log('🔍 DEBUG - Creating redemption transaction with:', {
      influencerId,
      amount: totalAmount,
      upiId: finalUpiId,
      transactionIds,
    });

    const redemptionTransaction = await this.creditTransactionModel.create({
      influencerId,
      transactionType: 'referral_bonus',
      amount: totalAmount,
      paymentStatus: 'processing', // Waiting for admin to process
      upiId: finalUpiId,
      description: `Redemption request for ${transactionIds.length} referral bonuses (IDs: ${transactionIds.join(', ')})`,
    });

    console.log('🔍 DEBUG - Created redemption transaction:', {
      id: redemptionTransaction.id,
      upiId: redemptionTransaction.upiId,
    });

    // Update the UPI ID's lastUsedAt timestamp
    await selectedUpiRecord.update({ lastUsedAt: new Date() });

    // Send WhatsApp notification
    if (influencer.whatsappNumber && influencer.isWhatsappVerified) {
      const message = `Your redemption request for Rs ${totalAmount} has been received. The amount will be transferred to your UPI ID (${finalUpiId}) within 24-48 working hours.`;
      await this.whatsAppService.sendReferralCreditNotification(
        influencer.whatsappNumber,
        message,
      );
    }

    console.log('✅ Redemption request processed:', {
      influencerId,
      influencerName: influencer.name,
      amount: totalAmount,
      upiId: finalUpiId,
      upiIdRecordId: selectedUpiRecord.id,
      transactionsCount: transactionIds.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Redemption request submitted successfully. You will receive the payment within 24-48 hours.',
      amountRequested: totalAmount,
      upiId: finalUpiId,
      transactionsProcessed: transactionIds.length,
    };
  }

  // ==================== UPI Management Methods ====================

  async getInfluencerUpiIds(influencerId: number) {
    const upiIds = await this.influencerUpiModel.findAll({
      where: { influencerId },
      order: [
        ['isSelectedForCurrentTransaction', 'DESC'], // Selected first
        ['lastUsedAt', 'DESC NULLS LAST'], // Then by last used
        ['createdAt', 'DESC'], // Then by creation date
      ],
      raw: true,
    });

    // Transform to only include isSelectedForCurrentTransaction when true
    const transformedUpiIds = upiIds.map((upi: any) => {
      const { isSelectedForCurrentTransaction, ...rest } = upi;

      // Only include the field if it's true
      if (isSelectedForCurrentTransaction) {
        return { ...rest, isSelectedForCurrentTransaction: true };
      }

      return rest;
    });

    return {
      upiIds: transformedUpiIds,
      total: transformedUpiIds.length,
    };
  }

  async addUpiId(influencerId: number, upiId: string, setAsSelected: boolean = false) {
    // Check if influencer exists
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Check if UPI ID already exists for this influencer
    const existing = await this.influencerUpiModel.findOne({
      where: { influencerId, upiId },
    });

    if (existing) {
      throw new BadRequestException('This UPI ID is already added to your account.');
    }

    // If setAsSelected is true, unselect all other UPI IDs
    if (setAsSelected) {
      await this.influencerUpiModel.update(
        { isSelectedForCurrentTransaction: false },
        { where: { influencerId } },
      );
    }

    // Create new UPI ID record
    const newUpiRecord = await this.influencerUpiModel.create({
      influencerId,
      upiId,
      isSelectedForCurrentTransaction: setAsSelected,
    } as any);

    console.log('✅ UPI ID added:', {
      influencerId,
      upiId,
      setAsSelected,
      timestamp: new Date().toISOString(),
    });

    return newUpiRecord;
  }

  async selectUpiIdForTransaction(influencerId: number, upiIdRecordId: number) {
    // Check if the UPI record exists and belongs to this influencer
    const upiRecord = await this.influencerUpiModel.findOne({
      where: { id: upiIdRecordId, influencerId },
    });

    if (!upiRecord) {
      throw new NotFoundException('UPI ID not found or does not belong to you.');
    }

    // Unselect all other UPI IDs for this influencer
    await this.influencerUpiModel.update(
      { isSelectedForCurrentTransaction: false },
      { where: { influencerId } },
    );

    // Select the specified UPI ID
    await upiRecord.update({ isSelectedForCurrentTransaction: true });

    console.log('✅ UPI ID selected for transaction:', {
      influencerId,
      upiIdRecordId,
      upiId: upiRecord.upiId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'UPI ID selected successfully',
      upiId: upiRecord.upiId,
    };
  }

  async selectUpiAndRedeemRewards(influencerId: number, upiIdRecordId: number) {
    // Reuse existing methods: Select UPI first, then redeem rewards
    // Step 1: Select the UPI ID for transaction
    await this.selectUpiIdForTransaction(influencerId, upiIdRecordId);

    // Step 2: Redeem rewards with the selected UPI
    // Pass upiIdRecordId to explicitly use this UPI
    const result = await this.redeemRewards(influencerId, upiIdRecordId);

    console.log('✅ UPI Selected & Redemption Processed:', {
      influencerId,
      upiIdRecordId,
      amountRequested: result.amountRequested,
      upiId: result.upiId,
      transactionsProcessed: result.transactionsProcessed,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  async deleteUpiId(influencerId: number, upiIdRecordId: number) {
    // Check if the UPI record exists and belongs to this influencer
    const upiRecord = await this.influencerUpiModel.findOne({
      where: { id: upiIdRecordId, influencerId },
    });

    if (!upiRecord) {
      throw new NotFoundException('UPI ID not found or does not belong to you.');
    }

    // Don't allow deletion if this is the only UPI ID and there are pending transactions
    const upiCount = await this.influencerUpiModel.count({
      where: { influencerId },
    });

    if (upiCount === 1) {
      const pendingTransactions = await this.creditTransactionModel.count({
        where: {
          influencerId,
          paymentStatus: 'pending',
        },
      });

      if (pendingTransactions > 0) {
        throw new BadRequestException(
          'Cannot delete the only UPI ID when there are pending redemptions. Please add another UPI ID first.',
        );
      }
    }

    await upiRecord.destroy();

    console.log('✅ UPI ID deleted:', {
      influencerId,
      upiIdRecordId,
      upiId: upiRecord.upiId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'UPI ID deleted successfully',
    };
  }

  // ==================== Weekly Credits System ====================

  /**
   * Calculate the next Monday at 00:00:00
   */
  private getNextMondayResetDate(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate days until next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);

    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);

    return nextMonday;
  }

  /**
   * Check if credits need to be reset and reset them if necessary
   * Returns the updated influencer with current credits
   */
  private async checkAndResetWeeklyCredits(
    influencer: Influencer,
  ): Promise<Influencer> {
    const now = new Date();

    // If no reset date is set, initialize it
    if (!influencer.weeklyCreditsResetDate) {
      const nextMonday = this.getNextMondayResetDate();
      await this.influencerRepository.updateInfluencer(influencer.id, {
        weeklyCredits: 5,
        weeklyCreditsResetDate: nextMonday,
      });

      // Refetch to get updated data
      const updatedInfluencer = await this.influencerRepository.findById(influencer.id);
      return updatedInfluencer || influencer;
    }

    // Check if reset date has passed
    const resetDate = new Date(influencer.weeklyCreditsResetDate);
    if (now >= resetDate) {
      // Reset credits and calculate next Monday
      const nextMonday = this.getNextMondayResetDate();
      await this.influencerRepository.updateInfluencer(influencer.id, {
        weeklyCredits: 5,
        weeklyCreditsResetDate: nextMonday,
      });

      console.log('✅ Weekly credits reset for influencer:', {
        influencerId: influencer.id,
        newCredits: 5,
        nextResetDate: nextMonday.toISOString(),
      });

      // Refetch to get updated data
      const updatedInfluencer = await this.influencerRepository.findById(influencer.id);
      return updatedInfluencer || influencer;
    }

    return influencer;
  }

  /**
   * Deduct one weekly credit from the influencer
   * Throws error if no credits available
   */
  private async deductWeeklyCredit(influencerId: number): Promise<void> {
    let influencer = await this.influencerRepository.findById(influencerId);

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Check and reset credits if needed
    influencer = await this.checkAndResetWeeklyCredits(influencer);

    // Check if credits are available
    if (!influencer.weeklyCredits || influencer.weeklyCredits <= 0) {
      const resetDate = influencer.weeklyCreditsResetDate
        ? new Date(influencer.weeklyCreditsResetDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'next Monday';

      throw new BadRequestException(
        `You have used all your weekly credits. Credits will reset on ${resetDate}.`,
      );
    }

    // Deduct one credit
    const newCreditCount = influencer.weeklyCredits - 1;
    await this.influencerRepository.updateInfluencer(influencerId, {
      weeklyCredits: newCreditCount,
    });

    console.log('✅ Weekly credit deducted:', {
      influencerId,
      remainingCredits: newCreditCount,
      resetDate: influencer.weeklyCreditsResetDate,
    });
  }

  /**
   * Get current weekly credits info for an influencer
   * Returns credits and reset date
   */
  async getWeeklyCreditsInfo(influencerId: number): Promise<{
    weeklyCredits: number;
    weeklyCreditsResetDate: Date;
  }> {
    let influencer = await this.influencerRepository.findById(influencerId);

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Check and reset credits if needed
    influencer = await this.checkAndResetWeeklyCredits(influencer);

    return {
      weeklyCredits: influencer.weeklyCredits || 0,
      weeklyCreditsResetDate: influencer.weeklyCreditsResetDate || this.getNextMondayResetDate(),
    };
  }
}
