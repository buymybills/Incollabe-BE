import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsNumber, Min } from 'class-validator';

export class AffiliateEarningsQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  limit?: number;
}

export class WithdrawAffiliateEarningsDto {
  @ApiProperty({ description: 'Amount to withdraw' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'ID from influencer_withdrawal_accounts' })
  @IsInt()
  withdrawalAccountId: number;
}
