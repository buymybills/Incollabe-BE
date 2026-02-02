import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '../models/support-ticket.model';

export class ReportedInfluencerDto {
  @ApiProperty({ enum: [UserType.INFLUENCER] })
  userType: UserType.INFLUENCER;

  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  whatsappNumber?: string;

  @ApiProperty({ required: false })
  profileImage?: string;
}

export class ReportedBrandDto {
  @ApiProperty({ enum: [UserType.BRAND] })
  userType: UserType.BRAND;

  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  pocContactNumber?: string;

  @ApiProperty({ required: false })
  profileImage?: string;
}

export type ReportedUserDto = ReportedInfluencerDto | ReportedBrandDto | null;
