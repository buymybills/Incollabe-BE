import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsDate, IsOptional, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePromotionDto {
  @ApiProperty({
    example: 'Weekend Flash Sale',
    description: 'Name of the promotion'
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Limited time 25% discount on MAX subscription',
    required: false,
    description: 'Promotional description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 19900,
    description: 'Original price in paise (₹199 = 19900 paise)',
    default: 19900
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  originalPrice?: number;

  @ApiProperty({
    example: 14900,
    description: 'Discounted price in paise (₹149 = 14900 paise)'
  })
  @IsInt()
  @Min(1)
  discountedPrice: number;

  @ApiProperty({
    example: '2026-03-24T10:00:00Z',
    description: 'Start date and time (UTC)'
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    example: '2026-03-25T10:00:00Z',
    description: 'End date and time (UTC)'
  })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty({
    example: 500,
    required: false,
    description: 'Maximum number of subscriptions allowed with this promotion (null = unlimited)'
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether to send announcement notification immediately',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  sendAnnouncement?: boolean;
}

export class UpdatePromotionDto {
  @ApiProperty({
    example: false,
    description: 'Set to false to deactivate the promotion'
  })
  @IsBoolean()
  isActive: boolean;
}
