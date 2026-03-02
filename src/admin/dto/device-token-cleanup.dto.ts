import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrphanedTokenDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 9650 })
  userId: number;

  @ApiProperty({ example: 'influencer', enum: ['influencer', 'brand', 'admin'] })
  userType: string;

  @ApiProperty({ example: 'eX4mPl3T0k3n...' })
  fcmToken: string;

  @ApiProperty({ example: 'iPhone 13', required: false })
  deviceName?: string | null;

  @ApiProperty({ example: 'ios', required: false })
  deviceOs?: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  lastUsedAt: Date;

  @ApiProperty({ example: '2026-01-10T08:00:00.000Z' })
  createdAt: Date;
}

export class CleanupPreviewResponseDto {
  @ApiProperty({ example: 15 })
  totalOrphanedTokens: number;

  @ApiProperty({ example: 12 })
  deletedInfluencerTokens: number;

  @ApiProperty({ example: 3 })
  deletedBrandTokens: number;

  @ApiProperty({ example: 0 })
  deletedAdminTokens: number;

  @ApiProperty({ type: [OrphanedTokenDto] })
  orphanedTokens: OrphanedTokenDto[];

  @ApiProperty({ example: '2026-02-28T10:30:00.000Z' })
  timestamp: Date;
}

export class CleanupExecuteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Successfully removed 15 orphaned FCM tokens' })
  message: string;

  @ApiProperty({ example: 15 })
  totalRemoved: number;

  @ApiProperty({ example: 12 })
  influencerTokensRemoved: number;

  @ApiProperty({ example: 3 })
  brandTokensRemoved: number;

  @ApiProperty({ example: 0 })
  adminTokensRemoved: number;

  @ApiProperty({ type: [Number], example: [123, 456, 789] })
  removedTokenIds: number[];

  @ApiProperty({ example: '2026-02-28T10:30:00.000Z' })
  timestamp: Date;
}

export class TokenStatisticsDto {
  @ApiProperty({ example: 1250 })
  totalActiveTokens: number;

  @ApiProperty({ example: 890 })
  influencerTokens: number;

  @ApiProperty({ example: 350 })
  brandTokens: number;

  @ApiProperty({ example: 10 })
  adminTokens: number;

  @ApiProperty({ example: 15 })
  orphanedTokens: number;

  @ApiProperty({ example: 120 })
  inactiveTokensLast30Days: number;

  @ApiProperty({ example: 200 })
  inactiveTokensLast90Days: number;

  @ApiProperty({ example: '2026-02-28T10:30:00.000Z' })
  timestamp: Date;
}
