import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ActivateBoostDto {
  @ApiProperty({
    description: 'Post ID to boost',
    example: 123,
  })
  @IsNotEmpty()
  @IsNumber()
  postId: number;
}

export class VerifyBoostPaymentDto {
  @ApiProperty({
    description: 'Post ID that was boosted',
    example: 123,
  })
  @IsNotEmpty()
  @IsNumber()
  postId: number;

  @ApiProperty({
    description: 'Razorpay order ID',
    example: 'order_123abc',
  })
  @IsNotEmpty()
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({
    description: 'Razorpay payment ID',
    example: 'pay_456def',
  })
  @IsNotEmpty()
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({
    description: 'Razorpay signature for verification',
    example: 'signature_789ghi',
  })
  @IsNotEmpty()
  @IsString()
  razorpaySignature: string;
}

export class BoostModeResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Boost mode activated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Razorpay order details for payment',
    required: false,
  })
  order?: {
    id: string;
    amount: number;
    currency: string;
    key: string;
  };

  @ApiProperty({
    description: 'Boost expiration timestamp',
    required: false,
  })
  boostExpiresAt?: Date;

  @ApiProperty({
    description: 'Post details after boost',
    required: false,
  })
  post?: any;
}
