import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsInt, IsOptional, Min, IsDate, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { NudgeMessageType } from '../../shared/models/nudge-message-template.model';

export class CreateNudgeMessageTemplateDto {
  @ApiProperty({
    example: 'Unlock your potential 💫',
    description: 'Notification title (max 255 characters)',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: 'MAX members earn 3x more on average. Get unlimited applications for ₹199/month',
    description: 'Notification body text',
  })
  @IsString()
  body: string;

  @ApiProperty({
    enum: NudgeMessageType,
    example: NudgeMessageType.ROTATION,
    description: 'Message type: rotation (generic), out_of_credits (urgent), active_user (behavior-based)',
  })
  @IsEnum(NudgeMessageType)
  messageType: NudgeMessageType;

  @ApiPropertyOptional({
    example: 5,
    description: 'Minimum campaign applications required (for active_user type)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minCampaignApplications?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Show only when user has 0 credits (for out_of_credits type)',
  })
  @IsOptional()
  @IsBoolean()
  requiresZeroCredits?: boolean;

  @ApiPropertyOptional({
    example: 100,
    description: 'Priority (higher = shown first). Default: 0',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Order in rotation sequence (0-based, for rotation type only)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  rotationOrder?: number;

  @ApiPropertyOptional({
    example: '2026-03-25T00:00:00Z',
    description: 'Start showing this message from this date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  validFrom?: Date;

  @ApiPropertyOptional({
    example: '2026-04-25T23:59:59Z',
    description: 'Stop showing this message after this date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  validUntil?: Date;

  @ApiPropertyOptional({
    example: 'Generic message for new users - focus on earnings',
    description: 'Internal notes for admins (not shown to users)',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class UpdateNudgeMessageTemplateDto {
  @ApiPropertyOptional({
    example: 'Unlock your potential 💫',
    description: 'Notification title',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    example: 'MAX members earn 3x more on average. Get unlimited applications for ₹199/month',
    description: 'Notification body text',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    enum: NudgeMessageType,
    example: NudgeMessageType.ROTATION,
  })
  @IsOptional()
  @IsEnum(NudgeMessageType)
  messageType?: NudgeMessageType;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minCampaignApplications?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresZeroCredits?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rotationOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  validFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  validUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
