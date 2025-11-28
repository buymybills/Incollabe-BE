import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

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
}
