import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  ValidateIf,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateWithdrawalAccountDto {
  @ApiProperty({ enum: ['upi', 'bank'] })
  @IsIn(['upi', 'bank'])
  accountType: 'upi' | 'bank';

  @ApiProperty({ required: false, description: 'Required when accountType is upi' })
  @ValidateIf((o) => o.accountType === 'upi')
  @IsNotEmpty()
  @IsString()
  upiId?: string;

  @ApiProperty({ required: false, description: 'Required when accountType is bank' })
  @ValidateIf((o) => o.accountType === 'bank')
  @IsNotEmpty()
  @IsString()
  accountHolderName?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.accountType === 'bank')
  @IsNotEmpty()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.accountType === 'bank')
  @IsNotEmpty()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.accountType === 'bank')
  @IsNotEmpty()
  @IsString()
  ifscCode?: string;
}

export class RedeemWithdrawalDto {
  @ApiProperty({ description: 'Amount to withdraw' })
  @IsNumber()
  @Min(1)
  amount: number;
}
