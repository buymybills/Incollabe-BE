import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
} from '../admin/models/profile-review.model';
import { Influencer } from '../auth/model/influencer.model';
import {
  APP_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../shared/constants/app.constants';

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
  ) {}

  async getInfluencerProfile(influencerId: number, isPublic: boolean = false) {
    const influencer = await this.influencerRepository.findById(influencerId);

    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Calculate profile completion
    const profileCompletion = this.calculateProfileCompletion(influencer);

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

    // Update influencer data
    const updatedData = {
      ...processedData,
      ...fileUrls,
    };

    await this.influencerRepository.updateInfluencer(influencerId, updatedData);

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

    // Send appropriate email and WhatsApp notification based on completion status
    if (isComplete && !wasComplete) {
      // Profile just became complete - automatically submit for verification
      await this.createProfileReview(influencerId);

      // Send verification pending notifications
      await Promise.all([
        this.emailService.sendInfluencerProfileVerificationPendingEmail(
          influencer.phone, // Using phone as identifier for influencers
          influencer.name,
        ),
        // Send WhatsApp notification if WhatsApp number is available and verified
        influencer.whatsappNumber && influencer.isWhatsappVerified
          ? this.whatsAppService.sendProfileVerificationPending(
              influencer.whatsappNumber,
              influencer.name,
            )
          : Promise.resolve(),
      ]);
    } else if (!isComplete) {
      // Profile is incomplete - send missing fields notifications
      await Promise.all([
        this.emailService.sendInfluencerProfileIncompleteEmail(
          influencer.phone,
          influencer.name,
          profileCompletion.missingFields,
          profileCompletion.nextSteps,
        ),
        // Send WhatsApp notification if WhatsApp number is available and verified
        influencer.whatsappNumber && influencer.isWhatsappVerified
          ? this.whatsAppService.sendProfileIncomplete(
              influencer.whatsappNumber,
              influencer.name,
              profileCompletion.missingFields.length.toString(),
            )
          : Promise.resolve(),
      ]);
    }

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

    return {
      isCompleted: missingFields.length === 0,
      completionPercentage,
      missingFields,
      nextSteps,
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

    if (steps.length === 0) {
      steps.push('Set up collaboration costs for different platforms');
    }

    return steps;
  }

  async sendWhatsAppVerificationOTP(request: WhatsAppOtpRequest) {
    const { influencerId, whatsappNumber } = request;
    const influencer = await this.influencerRepository.findById(influencerId);
    if (!influencer) {
      throw new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
    }

    // Generate and store OTP using OTP service
    const otp = await this.otpService.generateAndStoreOtp({
      identifier: whatsappNumber,
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

    // Verify OTP using OTP service
    await this.otpService.verifyOtp({
      identifier: '+91' + whatsappNumber,
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

    // For now, we'll send to a default admin email
    // In production, this should fetch all active admin emails
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@incollab.com';

    await this.emailService.sendAdminProfilePendingNotification(
      adminEmail,
      'Admin',
      'influencer',
      influencer.name,
      influencer.username || influencer.phone,
      influencerId,
    );
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
}
