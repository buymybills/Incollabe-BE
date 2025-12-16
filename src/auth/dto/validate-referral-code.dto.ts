import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateReferralCodeDto {
  @ApiProperty({
    description: 'Referral code to validate (8-character alphanumeric code)',
    example: 'ABC12XYZ',
    minLength: 8,
    maxLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Referral code is required' })
  @Length(8, 8, { message: 'Referral code must be exactly 8 characters' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Referral code must contain only uppercase letters and numbers',
  })
  referralCode: string;
}

export class ValidateReferralCodeResponseDto {
  @ApiProperty({
    description: 'Whether the referral code is valid',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Referral code is valid',
  })
  message: string;

  @ApiProperty({
    description: 'Details about the referral code (if valid)',
    required: false,
    example: {
      referrerName: 'Dhruv Bhatia',
      referrerUsername: 'dhruv_1109',
      usageCount: 2,
      monthlyLimit: 5,
    },
  })
  details?: {
    referrerName: string;
    referrerUsername: string;
    usageCount: number;
    monthlyLimit: number;
  };
}
