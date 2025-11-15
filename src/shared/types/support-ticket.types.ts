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

  @ApiProperty()
  phone: string;

  @ApiProperty()
  whatsappNumber: string;

  @ApiProperty()
  profileImage: string;
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

  @ApiProperty()
  email: string;

  @ApiProperty()
  pocContactNumber: string;

  @ApiProperty()
  profileImage: string;
}

export type ReportedUserDto = ReportedInfluencerDto | ReportedBrandDto | null;
