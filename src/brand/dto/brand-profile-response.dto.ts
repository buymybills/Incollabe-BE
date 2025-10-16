import { ApiProperty } from '@nestjs/swagger';

export class DocumentInfo {
  @ApiProperty({ description: 'Document URL for viewing/downloading' })
  url: string;

  @ApiProperty({ description: 'Original filename when uploaded' })
  filename?: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt?: string;

  @ApiProperty({ description: 'Whether document is viewable online' })
  canView: boolean;
}

export class SocialLinks {
  @ApiProperty({ description: 'Facebook page URL', required: false })
  facebook?: string;

  @ApiProperty({ description: 'Instagram profile URL', required: false })
  instagram?: string;

  @ApiProperty({ description: 'YouTube channel URL', required: false })
  youtube?: string;

  @ApiProperty({ description: 'LinkedIn company page URL', required: false })
  linkedin?: string;

  @ApiProperty({ description: 'Twitter/X profile URL', required: false })
  twitter?: string;
}

export class CompanyInfo {
  @ApiProperty({ description: 'Legal entity name' })
  legalEntityName: string;

  @ApiProperty({
    description: 'Company type information',
    example: {
      id: 1,
      name: 'Private Limited Company (Pvt. Ltd.)',
      description: 'A company limited by shares',
    },
  })
  companyType?: CompanyTypeInfo | null;

  @ApiProperty({ description: 'Founded year' })
  foundedYear?: number;

  @ApiProperty({
    example: { id: 1, name: 'India', code: 'IN' },
    description: 'Headquarter country information',
  })
  headquarterCountry?: { id: number; name: string; code: string } | null;

  @ApiProperty({
    example: { id: 15, name: 'Mumbai', state: 'Maharashtra' },
    description: 'Headquarter city information',
  })
  headquarterCity?: { id: number; name: string; state: string } | null;

  @ApiProperty({
    example: ['Asia', 'Europe', 'North America'],
    description: 'Active regions for campaigns',
  })
  activeRegions?: string[];

  @ApiProperty({ description: 'Brand website URL' })
  websiteUrl?: string;
}

export class ContactInfo {
  @ApiProperty({ description: 'Point of contact name' })
  pocName: string;

  @ApiProperty({ description: 'Point of contact designation' })
  pocDesignation: string;

  @ApiProperty({ description: 'Point of contact email' })
  pocEmailId: string;

  @ApiProperty({ description: 'Point of contact phone number' })
  pocContactNumber: string;

  @ApiProperty({ description: 'Brand email ID for business communications' })
  brandEmailId?: string;
}

export class ProfileMedia {
  @ApiProperty({ description: 'Profile image URL', required: false })
  profileImage?: string;

  @ApiProperty({ description: 'Profile banner URL', required: false })
  profileBanner?: string;
}

export class DocumentUploads {
  @ApiProperty({
    description: 'Incorporation document info',
    type: DocumentInfo,
    required: false,
  })
  incorporationDocument?: DocumentInfo;

  @ApiProperty({
    description: 'GST document info',
    type: DocumentInfo,
    required: false,
  })
  gstDocument?: DocumentInfo;

  @ApiProperty({
    description: 'PAN document info',
    type: DocumentInfo,
    required: false,
  })
  panDocument?: DocumentInfo;
}

export class ProfileCompletion {
  @ApiProperty({ description: 'Whether profile is fully completed' })
  isCompleted: boolean;

  @ApiProperty({ description: 'Percentage of profile completion (0-100)' })
  completionPercentage: number;

  @ApiProperty({
    description: 'List of missing required fields',
    type: [String],
  })
  missingFields: string[];

  @ApiProperty({
    description: 'Next steps for profile completion',
    type: [String],
  })
  nextSteps: string[];
}

interface CompanyTypeInfo {
  id: number;
  name: string;
  description: string;
}

export class PlatformMetrics {
  @ApiProperty({ description: 'Number of followers on this platform' })
  followers: number;

  @ApiProperty({ description: 'Number of users this brand follows' })
  following: number;

  @ApiProperty({ description: 'Number of posts created on this platform' })
  posts: number;

  @ApiProperty({ description: 'Number of campaigns created by this brand' })
  campaigns: number;
}

export class BrandProfileResponseDto {
  @ApiProperty({ description: 'Brand ID' })
  id: number;

  @ApiProperty({ description: 'Brand email address' })
  email: string;

  @ApiProperty({ description: 'Brand name' })
  brandName: string;

  @ApiProperty({ description: 'Unique username' })
  username: string;

  @ApiProperty({ description: 'Brand bio/description' })
  brandBio: string;

  @ApiProperty({ description: 'Profile headline' })
  profileHeadline?: string;

  @ApiProperty({ description: 'Email verification status' })
  isEmailVerified: boolean;

  @ApiProperty({ description: 'Account active status' })
  isActive: boolean;

  @ApiProperty({ description: 'Company information', type: CompanyInfo })
  companyInfo: CompanyInfo;

  @ApiProperty({ description: 'Contact information', type: ContactInfo })
  contactInfo: ContactInfo;

  @ApiProperty({ description: 'Profile media (images)', type: ProfileMedia })
  profileMedia: ProfileMedia;

  @ApiProperty({ description: 'Social media links', type: SocialLinks })
  socialLinks: SocialLinks;

  @ApiProperty({ description: 'Document uploads', type: DocumentUploads })
  documents: DocumentUploads;

  @ApiProperty({
    description: 'Profile completion status',
    type: ProfileCompletion,
  })
  profileCompletion: ProfileCompletion;

  @ApiProperty({
    description: 'Brand niches/categories',
    type: [Object],
    example: [
      {
        id: 1,
        name: 'Fashion',
        description: 'Fashion, style, and clothing content',
        logoNormal: '<svg>...</svg>',
        logoDark: '<svg>...</svg>',
      },
    ],
  })
  niches: Array<{
    id: number;
    name: string;
    description?: string;
    logoNormal?: string;
    logoDark?: string;
  }>;

  @ApiProperty({
    description: 'Custom niches created by the brand',
    type: [Object],
    example: [
      {
        id: 1,
        name: 'Sustainable Fashion',
      },
    ],
  })
  customNiches: Array<{
    id: number;
    name: string;
  }>;

  @ApiProperty({
    description: 'Platform engagement metrics',
    type: PlatformMetrics,
  })
  metrics: PlatformMetrics;

  @ApiProperty({
    description: 'Whether the current user follows this brand',
    example: false,
    required: false,
  })
  isFollowing?: boolean;

  @ApiProperty({
    description: 'Verification status of the profile',
    required: false,
    example: {
      status: 'pending',
      message: 'Profile Under Verification',
      description: 'Usually takes 1-2 business days to complete verification',
    },
  })
  verificationStatus?: {
    status: string;
    message: string;
    description: string;
  } | null;

  @ApiProperty({ description: 'Profile creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Last profile update timestamp' })
  updatedAt: string;
}
