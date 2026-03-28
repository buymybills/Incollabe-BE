import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsInt, IsOptional, Min, IsDate, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { NudgeMessageType } from '../../shared/models/nudge-message-template.model';

export class GetNudgeAnalyticsDto {
  @ApiPropertyOptional({
    enum: NudgeMessageType,
    description: 'Filter analytics by message type',
  })
  @IsOptional()
  @IsEnum(NudgeMessageType)
  messageType?: NudgeMessageType;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class GetNudgeMessageTemplatesDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: NudgeMessageType,
    description: 'Filter by message type',
  })
  @IsOptional()
  @IsEnum(NudgeMessageType)
  messageType?: NudgeMessageType;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search in title and body text',
    example: 'Pro subscription'
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter templates within valid date range (based on validFrom/validUntil)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isCurrentlyValid?: boolean;

  @ApiPropertyOptional({
    enum: ['id', 'priority', 'timesSent', 'conversionRate', 'createdAt'],
    default: 'id',
    description: 'Field to sort by'
  })
  @IsOptional()
  @IsString()
  orderBy?: string = 'id';

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    description: 'Sort direction'
  })
  @IsOptional()
  @IsString()
  orderDirection?: 'ASC' | 'DESC' = 'DESC';
}

export class CreateNudgeMessageTemplateDto {
  @ApiProperty({
    examples: {
      rotation: {
        value: 'Unlock your potential 💫',
        description: 'Example for rotation type',
      },
      out_of_credits: {
        value: 'You\'re out of credits! 🚨',
        description: 'Example for out_of_credits type',
      },
      active_user: {
        value: 'You\'re on fire! 🔥',
        description: 'Example for active_user type',
      },
      payment_pending: {
        value: 'Complete your payment 💳',
        description: 'Example for payment_pending type',
      },
    },
    description: 'Notification title (max 255 characters)',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    examples: {
      rotation: {
        value: 'MAX members earn 3x more on average. Get unlimited applications for ₹199/month',
        description: 'Generic promotional message',
      },
      out_of_credits: {
        value: 'Upgrade to MAX and get unlimited campaign applications. Join 10,000+ influencers earning more!',
        description: 'Urgent message when credits are exhausted',
      },
      active_user: {
        value: 'You\'ve applied to 10+ campaigns! MAX members like you get 5x better ROI. Upgrade now for ₹199/month',
        description: 'Targeted message for highly active users',
      },
      payment_pending: {
        value: 'Your subscription payment is pending. Complete it now to continue enjoying MAX benefits!',
        description: 'Message for users with pending payments',
      },
    },
    description: 'Notification body text',
  })
  @IsString()
  body: string;

  @ApiProperty({
    enum: NudgeMessageType,
    examples: {
      rotation: {
        value: 'rotation',
        description: 'Generic rotating messages shown to all users',
      },
      out_of_credits: {
        value: 'out_of_credits',
        description: 'Urgent messages shown when user has 0 credits',
      },
      active_user: {
        value: 'active_user',
        description: 'Behavior-based messages for users with many applications',
      },
      payment_pending: {
        value: 'payment_pending',
        description: 'Messages for users with pending/failed payments',
      },
    },
    description: 'Message type determines when and to whom this message is shown',
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

export class NudgeMessageTemplateResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Nudge message template created successfully' })
  message: string;

  @ApiProperty({
    example: {
      id: 1,
      title: 'Unlock your potential 💫',
      body: 'MAX members earn 3x more on average. Get unlimited applications for ₹199/month',
      messageType: 'rotation',
      minCampaignApplications: null,
      requiresZeroCredits: false,
      isActive: true,
      priority: 100,
      rotationOrder: 0,
      timesSent: 0,
      conversionCount: 0,
      validFrom: '2026-03-25T00:00:00.000Z',
      validUntil: '2026-04-25T23:59:59.000Z',
      createdBy: 1,
      internalNotes: 'Generic message for new users - focus on earnings',
      createdAt: '2026-03-26T10:30:00.000Z',
      updatedAt: '2026-03-26T10:30:00.000Z',
    },
    description: 'Created/Updated nudge message template',
  })
  template: {
    id: number;
    title: string;
    body: string;
    messageType: string;
    minCampaignApplications: number | null;
    requiresZeroCredits: boolean;
    isActive: boolean;
    priority: number;
    rotationOrder: number | null;
    timesSent: number;
    conversionCount: number;
    validFrom: string | null;
    validUntil: string | null;
    createdBy: number | null;
    internalNotes: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export class NudgeMessageTemplateListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: [
      {
        id: 3,
        title: 'Complete your payment 💳',
        body: 'Your subscription payment is pending. Complete it now to continue enjoying MAX benefits!',
        messageType: 'payment_pending',
        minCampaignApplications: null,
        requiresZeroCredits: false,
        isActive: true,
        priority: 180,
        rotationOrder: null,
        timesSent: 15,
        conversionCount: 8,
        validFrom: '2026-03-25T00:00:00.000Z',
        validUntil: null,
        createdBy: 1,
        internalNotes: 'Payment reminder for failed/pending subscriptions',
        createdAt: '2026-03-26T12:00:00.000Z',
        updatedAt: '2026-03-26T12:00:00.000Z',
        conversionRate: 53.33,
        isCurrentlyValid: true,
      },
      {
        id: 2,
        title: 'You\'re out of credits! 🚨',
        body: 'Upgrade to MAX and get unlimited campaign applications.',
        messageType: 'out_of_credits',
        minCampaignApplications: null,
        requiresZeroCredits: true,
        isActive: true,
        priority: 200,
        rotationOrder: null,
        timesSent: 120,
        conversionCount: 45,
        validFrom: '2026-03-20T00:00:00.000Z',
        validUntil: null,
        createdBy: 1,
        internalNotes: 'High urgency - shown when credits = 0',
        createdAt: '2026-03-25T10:30:00.000Z',
        updatedAt: '2026-03-25T10:30:00.000Z',
        conversionRate: 37.5,
        isCurrentlyValid: true,
      },
      {
        id: 1,
        title: 'Unlock your potential 💫',
        body: 'MAX members earn 3x more on average. Get unlimited applications for ₹199/month',
        messageType: 'rotation',
        minCampaignApplications: null,
        requiresZeroCredits: false,
        isActive: true,
        priority: 100,
        rotationOrder: 0,
        timesSent: 500,
        conversionCount: 85,
        validFrom: '2026-03-15T00:00:00.000Z',
        validUntil: '2026-04-25T23:59:59.000Z',
        createdBy: 1,
        internalNotes: 'Generic message for new users - focus on earnings',
        createdAt: '2026-03-20T10:30:00.000Z',
        updatedAt: '2026-03-20T10:30:00.000Z',
        conversionRate: 17.0,
        isCurrentlyValid: true,
      },
    ],
    description: 'List of nudge message templates (sorted by id DESC)',
  })
  templates: Array<{
    id: number;
    title: string;
    body: string;
    messageType: string;
    minCampaignApplications: number | null;
    requiresZeroCredits: boolean;
    isActive: boolean;
    priority: number;
    rotationOrder: number | null;
    timesSent: number;
    conversionCount: number;
    validFrom: string | null;
    validUntil: string | null;
    createdBy: number | null;
    internalNotes: string | null;
    createdAt: string;
    updatedAt: string;
    conversionRate: number;
    isCurrentlyValid: boolean;
  }>;

  @ApiProperty({ example: 3, description: 'Total number of templates matching the filters' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 1, description: 'Total number of pages' })
  totalPages: number;
}
