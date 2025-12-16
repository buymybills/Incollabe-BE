import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetupUpiAutopayDto {
  // No fields needed - influencer ID comes from auth token
}

export class PauseSubscriptionDto {
  @ApiProperty({
    description: 'Number of days to pause subscription (between 1 and 365)',
    example: 10,
    minimum: 1,
    maximum: 365,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  pauseDurationDays: number;

  @ApiPropertyOptional({
    description: 'Reason for pausing subscription',
    example: 'Going on vacation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResumeSubscriptionDto {
  // No fields needed - will resume immediately
}

export class CancelAutopayDto {
  @ApiPropertyOptional({
    description: 'Reason for cancelling autopay',
    example: 'Want to use manual payment instead',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
