import { ApiProperty } from '@nestjs/swagger';
import { CollaborationCostsDto } from './collaboration-costs.dto';

class CountryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;
}

class CityDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  state: string;
}

class LocationDto {
  @ApiProperty({ type: CountryDto, nullable: true })
  country: CountryDto | null;

  @ApiProperty({ type: CityDto, nullable: true })
  city: CityDto | null;
}

class SocialLinksDto {
  @ApiProperty({ required: false })
  instagram?: string;

  @ApiProperty({ required: false })
  youtube?: string;

  @ApiProperty({ required: false })
  facebook?: string;

  @ApiProperty({ required: false })
  linkedin?: string;

  @ApiProperty({ required: false })
  twitter?: string;
}

class NicheDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;
}

class CustomNicheDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  isActive: boolean;
}

class PlatformMetricsDto {
  @ApiProperty()
  followers: number;

  @ApiProperty()
  posts: number;
}

class ExperienceSocialLinkDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  platform: string;

  @ApiProperty()
  contentType: string;

  @ApiProperty()
  url: string;
}

class ExperienceDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  campaignName: string;

  @ApiProperty()
  brandName: string;

  @ApiProperty({ enum: ['ugc', 'paid', 'barter', 'engagement'] })
  campaignCategory: string;

  @ApiProperty({ type: [String] })
  deliverableFormat: string[];

  @ApiProperty()
  successfullyCompleted: boolean;

  @ApiProperty()
  roleDescription: string;

  @ApiProperty()
  keyResultAchieved: string;

  @ApiProperty({ type: [ExperienceSocialLinkDto] })
  socialLinks: ExperienceSocialLinkDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PublicProfileResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  bio: string;

  @ApiProperty()
  profileImage: string;

  @ApiProperty()
  profileBanner: string;

  @ApiProperty()
  profileHeadline: string;

  @ApiProperty({ type: LocationDto })
  location: LocationDto;

  @ApiProperty({ type: SocialLinksDto })
  socialLinks: SocialLinksDto;

  @ApiProperty({ type: [NicheDto] })
  niches: NicheDto[];

  @ApiProperty({ type: [CustomNicheDto], required: false })
  customNiches?: CustomNicheDto[];

  @ApiProperty({ type: PlatformMetricsDto, required: false })
  metrics?: PlatformMetricsDto;

  @ApiProperty({ required: false })
  isTopInfluencer?: boolean;

  @ApiProperty({
    description: 'Whether the current user follows this influencer',
    example: false,
    required: false,
  })
  isFollowing?: boolean;

  @ApiProperty({ type: CollaborationCostsDto })
  collaborationCosts: CollaborationCostsDto | object;

  @ApiProperty({ description: 'User type', example: 'influencer' })
  userType: 'influencer';

  @ApiProperty({ required: false })
  createdAt?: string;

  @ApiProperty({ required: false })
  updatedAt?: string;

  @ApiProperty({ type: [ExperienceDto] })
  experiences: ExperienceDto[];
}
