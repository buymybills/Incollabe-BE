import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt } from 'class-validator';

export class RedeemRewardsDto {
  @ApiProperty({
    description: 'UPI ID record ID to use for redemption (optional, uses selected UPI if not provided)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  upiIdRecordId?: number;
}

export class RedeemRewardsResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Redemption request submitted successfully. You will receive the payment within 24-48 hours.',
  })
  message: string;

  @ApiProperty({
    description: 'Amount requested for redemption',
    example: 1100,
  })
  amountRequested: number;

  @ApiProperty({
    description: 'UPI ID where payment will be sent',
    example: '9876543210@paytm',
  })
  upiId: string;

  @ApiProperty({
    description: 'Number of transactions marked for processing',
    example: 5,
  })
  transactionsProcessed: number;
}
