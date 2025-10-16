import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Brand } from './model/brand.model';
import { BrandNiche } from './model/brand-niche.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { Region } from '../shared/models/region.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Follow, FollowingType } from '../post/models/follow.model';
import { Post, UserType } from '../post/models/post.model';
import { Campaign } from '../campaign/models/campaign.model';
import { S3Service } from '../shared/s3.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../shared/email.service';
import { MasterDataService } from '../shared/services/master-data.service';
import { ProfileReviewService } from '../admin/profile-review.service';
import {
  ProfileReview,
  ProfileType,
  ReviewStatus,
} from '../admin/models/profile-review.model';
import { SignupFiles } from '../types/file-upload.types';
import {
  CustomNiche,
  UserType as CustomNicheUserType,
} from '../auth/model/custom-niche.model';
import {
  BrandProfileResponseDto,
  DocumentInfo,
  ProfileCompletion,
} from './dto/brand-profile-response.dto';
import { CompanyTypeDto } from './dto/company-type.dto';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';

@Injectable()
export class BrandService {
  constructor(
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(BrandNiche)
    private readonly brandNicheModel: typeof BrandNiche,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(CompanyType)
    private readonly companyTypeModel: typeof CompanyType,
    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CustomNiche)
    private readonly customNicheModel: typeof CustomNiche,
    @InjectModel(ProfileReview)
    private readonly profileReviewModel: typeof ProfileReview,
    private readonly s3Service: S3Service,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly masterDataService: MasterDataService,
    private readonly profileReviewService: ProfileReviewService,
  ) {}

  async getBrandProfile(
    brandId: number,
    currentUserId?: number,
    currentUserType?: 'influencer' | 'brand',
  ): Promise<BrandProfileResponseDto> {
    const brand = await this.brandModel.findByPk(brandId, {
      include: [
        {
          model: Niche,
          through: { attributes: [] },
        },
        {
          model: CompanyType,
          attributes: ['id', 'name', 'description'],
        },
        {
          model: Country,
          as: 'headquarterCountry',
          attributes: ['id', 'name', 'code'],
        },
        {
          model: City,
          as: 'headquarterCity',
          attributes: ['id', 'name', 'state'],
        },
        {
          model: CustomNiche,
          attributes: ['id', 'name', 'description', 'isActive'],
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Check if current user follows this brand
    let isFollowing = false;
    if (currentUserId && currentUserType) {
      const followRecord = await this.followModel.findOne({
        where: {
          followingType: FollowingType.BRAND,
          followingBrandId: brandId,
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

    // Calculate profile completion, platform metrics, and get verification status
    const [profileCompletion, platformMetrics, verificationStatus] =
      await Promise.all([
        this.calculateProfileCompletion(brand),
        this.calculatePlatformMetrics(brandId),
        this.getVerificationStatus(brandId),
      ]);

    // Build comprehensive response
    return {
      id: brand.id,
      email: brand.email,
      brandName: brand.brandName || '',
      username: brand.username || '',
      brandBio: brand.brandBio || '',
      profileHeadline: brand.profileHeadline,
      isEmailVerified: brand.isEmailVerified,
      isActive: brand.isActive,

      companyInfo: {
        legalEntityName: brand.legalEntityName || '',
        companyType: brand.companyType
          ? {
              id: brand.companyType.id,
              name: brand.companyType.name,
              description: brand.companyType.description,
            }
          : null,
        foundedYear: brand.foundedYear,
        headquarterCountry: brand.headquarterCountry
          ? {
              id: brand.headquarterCountry.id,
              name: brand.headquarterCountry.name,
              code: brand.headquarterCountry.code,
            }
          : null,
        headquarterCity: brand.headquarterCity
          ? {
              id: brand.headquarterCity.id,
              name: brand.headquarterCity.name,
              state: brand.headquarterCity.state,
            }
          : null,
        activeRegions: brand.activeRegions || [],
        websiteUrl: brand.websiteUrl,
      },

      contactInfo: {
        pocName: brand.pocName || '',
        pocDesignation: brand.pocDesignation || '',
        pocEmailId: brand.pocEmailId || '',
        pocContactNumber: brand.pocContactNumber || '',
        brandEmailId: brand.brandEmailId,
      },

      profileMedia: {
        profileImage: brand.profileImage,
        profileBanner: brand.profileBanner,
      },

      socialLinks: {
        facebook: brand.facebookUrl,
        instagram: brand.instagramUrl,
        youtube: brand.youtubeUrl,
        linkedin: brand.linkedinUrl,
        twitter: brand.twitterUrl,
      },

      documents: {
        incorporationDocument: brand.incorporationDocument
          ? this.createDocumentInfo(
              brand.incorporationDocument,
              'incorporation',
            )
          : undefined,
        gstDocument: brand.gstDocument
          ? this.createDocumentInfo(brand.gstDocument, 'gst')
          : undefined,
        panDocument: brand.panDocument
          ? this.createDocumentInfo(brand.panDocument, 'pan')
          : undefined,
      },

      profileCompletion,

      niches: (brand.niches || []).map((niche) => ({
        id: niche.id,
        name: niche.name,
        description: niche.description,
        logoNormal: niche.logoNormal,
        logoDark: niche.logoDark,
      })),

      customNiches: (brand.customNiches || []).map((customNiche) => ({
        id: customNiche.id,
        name: customNiche.name,
        description: customNiche.description,
        isActive: customNiche.isActive,
      })),

      // Platform metrics
      metrics: platformMetrics,

      // Following status
      isFollowing,

      // Verification status
      verificationStatus,

      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
    };
  }

  async updateBrandProfile(
    brandId: number,
    updateData: UpdateBrandProfileDto,
    files?: SignupFiles,
  ) {
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Extract niches and custom niches, handle separately
    const { nicheIds, customNiches, ...brandUpdateData } = updateData;

    // Validate total niche count if both are provided
    if (nicheIds && customNiches) {
      const totalCount = nicheIds.length + customNiches.length;
      if (totalCount > 5) {
        throw new BadRequestException(
          'Maximum 5 niches allowed (regular + custom combined)',
        );
      }
    }

    // Handle regular niche update if provided
    if (nicheIds !== undefined) {
      await this.updateBrandNiches(brandId, nicheIds);
    }

    // Handle custom niche bulk replacement if provided
    if (customNiches !== undefined) {
      await this.updateBrandCustomNiches(brandId, customNiches);
    }

    // Handle file uploads if provided
    let fileUrls = {};
    if (files) {
      fileUrls = await this.uploadBrandFiles(files);
    }

    // Update brand data
    const updatedData = {
      ...brandUpdateData,
      ...fileUrls,
    };

    // Store the old completion status before update
    const wasComplete = brand.isProfileCompleted;

    await brand.update(updatedData);
    // Reload brand to get fresh data after update
    await brand.reload();

    // Check if profile has ever been submitted for review
    const hasBeenSubmitted = await this.profileReviewService.hasProfileReview(
      brand.id,
      ProfileType.BRAND,
    );

    // Check profile completion status with fresh data
    const isComplete = this.checkBrandProfileCompletion(brand);

    // Get profile completion details for email
    const profileCompletion = this.calculateProfileCompletion(brand);

    if (isComplete !== brand.isProfileCompleted) {
      await brand.update({ isProfileCompleted: isComplete });

      // If profile just became complete, create profile review and send notifications
      if (!wasComplete && isComplete) {
        // Create profile review for admin verification
        await this.profileReviewService.createProfileReview({
          profileId: brand.id,
          profileType: ProfileType.BRAND,
          submittedData: brand,
        });

        // Send verification email to brand
        await this.emailService.sendProfileVerificationPendingEmail(
          brand.email,
          brand.brandName || 'Brand Partner',
        );
      }
    }

    // Send appropriate email notification based on completion status
    // Only send notifications if profile has never been submitted
    if (!hasBeenSubmitted) {
      if (isComplete && !wasComplete) {
        // Profile just became complete - verification email already sent above at line 265
      } else if (!isComplete) {
        // Profile is incomplete - send missing fields email
        await this.emailService.sendBrandProfileIncompleteEmail(
          brand.email,
          brand.brandName || 'Brand Partner',
          profileCompletion.missingFields,
          profileCompletion.nextSteps,
        );
      }
    }
    // else: Profile has been submitted before - no notification

    // Return updated brand profile with verification status
    const profileData = await this.getBrandProfile(brandId);

    // Add appropriate message based on completion status
    if (!wasComplete && isComplete) {
      return {
        ...profileData,
        message:
          'Profile submitted for verification. You will receive an email confirmation once verification is complete within 48 hours.',
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

    return profileData;
  }

  async updateBrandNiches(brandId: number, nicheIds: number[]) {
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Validate niche IDs
    await this.validateNicheIds(nicheIds);

    // Remove existing niches
    await this.brandNicheModel.destroy({ where: { brandId } });

    // Add new niches
    const nicheAssociations = nicheIds.map((nicheId) => ({
      brandId,
      nicheId,
    }));

    await this.brandNicheModel.bulkCreate(nicheAssociations);

    return this.getBrandProfile(brandId);
  }

  private createDocumentInfo(
    documentUrl: string,
    documentType: string,
  ): DocumentInfo {
    // Extract filename from URL (assuming S3 URL structure)
    const urlParts = documentUrl.split('/');
    const filename = urlParts[urlParts.length - 1];

    return {
      url: documentUrl,
      filename: filename,
      uploadedAt: undefined, // Could be enhanced to track upload timestamps
      canView: documentUrl.startsWith('http'), // Basic check for viewable URLs
    };
  }

  private calculateProfileCompletion(brand: Brand): ProfileCompletion {
    const allFields = [
      'brandName',
      'username',
      'legalEntityName',
      'companyTypeId',
      'brandBio',
      'profileHeadline',
      'websiteUrl',
      'foundedYear',
      'headquarterCountryId',
      'headquarterCityId',
      'activeRegions',
      'pocName',
      'pocDesignation',
      'pocEmailId',
      'pocContactNumber',
      'profileImage',
      'profileBanner',
      'incorporationDocument',
      'gstDocument',
      'panDocument',
    ];

    const requiredFields = [
      'brandName',
      'username',
      'legalEntityName',
      'companyTypeId',
      'brandBio',
      'profileHeadline',
      'websiteUrl',
      'foundedYear',
      'headquarterCountryId',
      'headquarterCityId',
      'activeRegions',
      'pocName',
      'pocDesignation',
      'pocEmailId',
      'pocContactNumber',
      'profileImage',
      'profileBanner',
      'incorporationDocument',
      'gstDocument',
      'panDocument',
    ];

    const filledFields = allFields.filter((field) => {
      const value = brand[field as keyof Brand];
      return value && value.toString().trim().length > 0;
    });

    const missingFields = requiredFields.filter((field) => {
      const value = brand[field as keyof Brand];
      return !value || value.toString().trim().length === 0;
    });

    // Check for social media requirement separately
    const hasSocialMediaLink = Boolean(
      brand.facebookUrl ||
        brand.instagramUrl ||
        brand.youtubeUrl ||
        brand.linkedinUrl ||
        brand.twitterUrl,
    );

    // For completion calculation, treat social media as one requirement
    let adjustedFilledFields = filledFields.length;
    if (hasSocialMediaLink) {
      adjustedFilledFields += 1; // Count social media requirement as filled
    }

    const totalRequiredFields = allFields.length + 1; // +1 for social media requirement
    const completionPercentage = Math.round(
      (adjustedFilledFields / totalRequiredFields) * 100,
    );

    // Profile is complete if all regular fields are filled AND has at least one social media link
    const isCompleted = missingFields.length === 0 && hasSocialMediaLink;

    // Generate user-friendly next steps
    const nextSteps: string[] = [];
    const fieldGroups = {
      basic: ['brandName', 'username', 'brandBio'],
      company: [
        'legalEntityName',
        'companyTypeId',
        'websiteUrl',
        'foundedYear',
      ],
      location: ['headquarterCountryId', 'headquarterCityId', 'activeRegions'],
      contact: ['pocName', 'pocDesignation', 'pocEmailId', 'pocContactNumber'],
      media: ['profileImage', 'profileBanner', 'profileHeadline'],
      documents: ['incorporationDocument', 'gstDocument', 'panDocument'],
    };

    Object.entries(fieldGroups).forEach(([group, fields]) => {
      const missingInGroup = fields.filter((field) =>
        missingFields.includes(field),
      );
      if (missingInGroup.length > 0) {
        switch (group) {
          case 'basic':
            nextSteps.push('Complete basic profile information');
            break;
          case 'company':
            nextSteps.push('Add company details and website');
            break;
          case 'location':
            nextSteps.push('Specify business locations');
            break;
          case 'contact':
            nextSteps.push('Complete point of contact information');
            break;
          case 'media':
            nextSteps.push('Upload profile images and add headline');
            break;
          case 'documents':
            nextSteps.push('Upload required business documents');
            break;
        }
      }
    });

    // Add social media step if no social media links provided
    if (!hasSocialMediaLink) {
      nextSteps.push(
        'Add at least one social media link (Facebook, Instagram, YouTube, LinkedIn, or Twitter)',
      );
    }

    return {
      isCompleted,
      completionPercentage,
      missingFields: missingFields.map((field) =>
        this.getFriendlyFieldName(field),
      ),
      nextSteps,
    };
  }

  private getFriendlyFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      brandName: 'Brand Name',
      username: 'Username',
      legalEntityName: 'Legal Entity Name',
      companyTypeId: 'Company Type',
      brandBio: 'Brand Description',
      profileHeadline: 'Profile Headline',
      websiteUrl: 'Website URL',
      foundedYear: 'Founded Year',
      headquarterCountryId: 'Headquarter Country',
      headquarterCityId: 'Headquarter City',
      activeRegions: 'Active Regions',
      pocName: 'Point of Contact Name',
      pocDesignation: 'POC Designation',
      pocEmailId: 'POC Email',
      pocContactNumber: 'POC Phone',
      profileImage: 'Profile Image',
      profileBanner: 'Profile Banner',
      incorporationDocument: 'Incorporation Document',
      gstDocument: 'GST Document',
      panDocument: 'PAN Document',
    };
    return fieldMap[field] || field;
  }

  private checkBrandProfileCompletion(brand: Brand): boolean {
    const requiredFields = [
      'brandName',
      'username',
      'legalEntityName',
      'companyTypeId',
      'brandBio',
      'profileHeadline',
      'websiteUrl',
      'foundedYear',
      'pocName',
      'pocDesignation',
      'pocEmailId',
      'pocContactNumber',
    ];

    const requiredIdFields = ['headquarterCountryId', 'headquarterCityId'];

    const requiredDocuments = [
      'incorporationDocument',
      'gstDocument',
      'panDocument',
    ];

    const requiredImages = ['profileImage', 'profileBanner'];

    const allFieldsFilled = requiredFields.every((field) => {
      const value = brand[field as keyof Brand];
      return value && value.toString().trim().length > 0;
    });

    const allIdFieldsFilled = requiredIdFields.every((field) => {
      const value = brand[field as keyof Brand];
      return value !== null && value !== undefined && value > 0;
    });

    const hasActiveRegions =
      brand.activeRegions &&
      Array.isArray(brand.activeRegions) &&
      brand.activeRegions.length > 0;

    const allDocumentsUploaded = requiredDocuments.every((doc) => {
      const value = brand[doc as keyof Brand];
      return value && value.toString().trim().length > 0;
    });

    const allImagesUploaded = requiredImages.every((img) => {
      const value = brand[img as keyof Brand];
      return value && value.toString().trim().length > 0;
    });

    // At least one social media link required
    const hasSocialMediaLink = Boolean(
      brand.facebookUrl ||
        brand.instagramUrl ||
        brand.youtubeUrl ||
        brand.linkedinUrl ||
        brand.twitterUrl,
    );

    return (
      allFieldsFilled &&
      allIdFieldsFilled &&
      hasActiveRegions &&
      allDocumentsUploaded &&
      allImagesUploaded &&
      hasSocialMediaLink
    );
  }

  private async getVerificationStatus(brandId: number) {
    // Check if profile has been submitted for review
    const profileReview = await this.profileReviewModel.findOne({
      where: {
        profileId: brandId,
        profileType: ProfileType.BRAND,
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
            'Your profile has been approved and is now visible to influencers',
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

  private async uploadBrandFiles(files: SignupFiles) {
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
        ? await uploadFile(files.profileImage, 'profiles/brands', 'brand')
        : undefined,
      profileBanner: files?.profileBanner
        ? await uploadFile(files.profileBanner, 'profiles/brands', 'banner')
        : undefined,
      incorporationDocument: files?.incorporationDocument
        ? await uploadFile(
            files.incorporationDocument,
            'documents/brands',
            'incorporation',
          )
        : undefined,
      gstDocument: files?.gstDocument
        ? await uploadFile(files.gstDocument, 'documents/brands', 'gst')
        : undefined,
      panDocument: files?.panDocument
        ? await uploadFile(files.panDocument, 'documents/brands', 'pan')
        : undefined,
    };
  }

  private async validateNicheIds(nicheIds: number[]) {
    const validNiches = await this.nicheModel.findAll({
      where: { id: nicheIds },
      attributes: ['id'],
    });

    const validNicheIds = validNiches.map((niche) => niche.id);
    const invalidNicheIds = nicheIds.filter(
      (id) => !validNicheIds.includes(id),
    );

    if (invalidNicheIds.length > 0) {
      throw new BadRequestException(
        `Invalid niche IDs: ${invalidNicheIds.join(', ')}`,
      );
    }
  }

  // Dropdown data methods - now database-driven
  async getCountriesList() {
    return await this.masterDataService.getCountries();
  }

  async getCitiesList(countryId: number) {
    return await this.masterDataService.getCitiesByCountry(countryId);
  }

  async getFoundedYearsList() {
    return await this.masterDataService.getFoundedYears();
  }

  async getActiveRegionsList() {
    return await this.masterDataService.getRegions();
  }

  async getCompanyTypes(): Promise<CompanyTypeDto[]> {
    const companyTypes = await this.companyTypeModel.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
      attributes: ['id', 'name', 'description', 'isActive', 'sortOrder'],
    });

    return companyTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      description: ct.description,
      isActive: ct.isActive,
      sortOrder: ct.sortOrder,
    }));
  }

  private async updateBrandCustomNiches(
    brandId: number,
    customNicheNames: string[],
  ) {
    // Get existing custom niches to compare
    const existingCustomNiches = await this.customNicheModel.findAll({
      where: {
        userType: CustomNicheUserType.BRAND,
        userId: brandId,
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
    const regularNichesCount = await this.brandNicheModel.count({
      where: { brandId },
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

    // Delete all existing custom niches for this brand (bulk replacement)
    await this.customNicheModel.destroy({
      where: {
        userType: CustomNicheUserType.BRAND,
        userId: brandId,
      },
    });

    // Create new custom niches if any provided
    if (customNicheNames.length > 0) {
      const customNicheData = customNicheNames.map((name) => ({
        userType: CustomNicheUserType.BRAND,
        userId: brandId,
        influencerId: null,
        brandId: brandId,
        name: name,
        description: '',
        isActive: true,
      }));

      await this.customNicheModel.bulkCreate(customNicheData);
    }
  }

  private async calculatePlatformMetrics(brandId: number) {
    const [followersCount, followingCount, postsCount, campaignsCount] =
      await Promise.all([
        // Count followers (users who follow this brand)
        this.followModel.count({
          where: {
            followingType: FollowingType.BRAND,
            followingBrandId: brandId,
          },
        }),

        // Count following (users this brand follows)
        this.followModel.count({
          where: {
            followerType: FollowingType.BRAND,
            followerBrandId: brandId,
          },
        }),

        // Count posts created by this brand
        this.postModel.count({
          where: {
            userType: UserType.BRAND,
            brandId: brandId,
            isActive: true,
          },
        }),

        // Count campaigns created by this brand
        this.campaignModel.count({
          where: {
            brandId: brandId,
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
}
