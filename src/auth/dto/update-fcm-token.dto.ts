import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty({
    description: 'User ID of the influencer',
    example: 123,
  })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'Firebase Cloud Messaging token for push notifications',
    example: 'dX8kLm9nP4Q:APA91bF...',
  })
  @IsNotEmpty()
  @IsString()
  fcmToken: string;

  @ApiPropertyOptional({
    description: 'Unique device identifier from the mobile app',
    example: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Human-readable device name',
    example: 'iPhone 13 Pro',
  })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({
    description: 'Device operating system',
    enum: ['ios', 'android'],
    example: 'ios',
  })
  @IsOptional()
  @IsEnum(['ios', 'android'])
  deviceOs?: 'ios' | 'android';

  @ApiPropertyOptional({
    description: 'App version',
    example: '1.2.3',
  })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({
    description: 'Numeric version code (build number)',
    example: 123,
  })
  @IsOptional()
  @IsNumber()
  versionCode?: number;
}
