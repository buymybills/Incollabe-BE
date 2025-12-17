import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionOrderDto {
  // No body needed, influencerId comes from JWT
}

export class VerifySubscriptionPaymentDto {
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

  @ApiProperty({
    description: 'Subscription ID',
    example: 1,
  })
  @IsNotEmpty()
  subscriptionId: number;
}

export class CancelProSubscriptionDto {
  @ApiProperty({
    description: 'Reason for cancellation (optional)',
    example: 'Too expensive',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
