import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateMaxCampaignOrderDto {
  @ApiProperty({
    description: 'Campaign ID to upgrade to Max Campaign',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  campaignId: number;
}

export class VerifyMaxCampaignPaymentDto {
  @ApiProperty({
    description: 'Razorpay payment ID',
    example: 'pay_MNpJx1234567890',
  })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({
    description: 'Razorpay order ID',
    example: 'order_MNpJx1234567890',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Razorpay payment signature',
    example: '9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
