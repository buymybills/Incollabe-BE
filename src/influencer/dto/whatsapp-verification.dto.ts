import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length, IsNumber } from 'class-validator';

export class SendWhatsAppOTPDto {
  @ApiProperty({ description: 'WhatsApp number to verify' })
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Please provide a valid Indian WhatsApp number',
  })
  whatsappNumber: string;
}

export class VerifyWhatsAppOTPDto {
  @ApiProperty({ description: 'WhatsApp number' })
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Please provide a valid Indian WhatsApp number',
  })
  whatsappNumber: string;

  @ApiProperty({ description: 'OTP received on WhatsApp' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only numbers' })
  otp: string;
}

export class WhatsappVerificationDto {
  @ApiProperty({ description: 'Influencer ID' })
  @IsNumber()
  influencerId: number;

  @ApiProperty({ description: 'WhatsApp number' })
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Please provide a valid Indian WhatsApp number',
  })
  whatsappNumber: string;

  @ApiProperty({ description: 'OTP received on WhatsApp' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only numbers' })
  otp: string;
}
