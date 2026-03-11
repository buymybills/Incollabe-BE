import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class CreateBrandSharedCouponDto {
  @ApiProperty({
    description: 'Brand-shared coupon code (e.g., SNITCHCOLLABKAROO)',
    example: 'SNITCHCOLLABKAROO',
    minLength: 5,
    maxLength: 50,
  })
  @IsString()
  @Length(5, 50)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Coupon code must contain only uppercase letters and numbers',
  })
  couponCode: string;

  @ApiProperty({
    description: 'Optional description of this coupon campaign',
    example: 'Snitch collaboration coupon for all influencers',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
