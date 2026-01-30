import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AppReviewService } from '../services/app-review.service';
import { DeviceTokenService } from '../device-token.service';
import {
  CheckReviewPromptResponseDto,
  RecordPromptShownDto,
  MarkAsReviewedDto,
  MarkAsReviewedResponseDto,
} from '../dto/app-review.dto';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('App Review')
@Controller('app-review')
export class AppReviewController {
  constructor(
    private readonly appReviewService: AppReviewService,
    private readonly deviceTokenService: DeviceTokenService,
  ) {}

  /**
   * Check if the review prompt should be shown to the user
   * GET /app-review/check
   *
   * This endpoint determines whether to show the app review prompt based on:
   * - For influencers: Number of campaigns they've been selected in (accepted invitations)
   * - For brands: Number of campaigns they've posted
   * - Whether they've already reviewed
   * - Time since last prompt (5 weeks between prompts)
   */
  @Public()
  @Get('check')
  @ApiOperation({
    summary: 'Check if review prompt should be shown',
    description:
      'Determines if the user should be shown the app review prompt based on campaign count (5 campaigns) and time since last prompt (5 weeks). For influencers, counts accepted campaign invitations. For brands, counts posted campaigns.\n\nUser type is automatically detected from device_tokens table using the provided device_id.',
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)',
    type: Number,
  })
  @ApiQuery({
    name: 'device_id',
    required: true,
    description: 'Device ID - used to automatically determine user type from device_tokens table',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Check completed successfully',
    type: CheckReviewPromptResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters',
  })
  async checkReviewPrompt(
    @Query('user_id') userId: string,
    @Query('device_id') deviceId: string,
  ): Promise<CheckReviewPromptResponseDto> {
    if (!userId) {
      throw new BadRequestException('user_id is required');
    }

    if (!deviceId) {
      throw new BadRequestException('device_id is required');
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      throw new BadRequestException('user_id must be a valid number');
    }

    // Determine user type from device_id
    const detectedUserType = await this.deviceTokenService.getUserTypeFromDevice(userIdNum, deviceId);
    if (!detectedUserType) {
      throw new BadRequestException('Device not found for this user. Please update your FCM token first.');
    }

    const resolvedUserType = detectedUserType as 'influencer' | 'brand';

    if (!['influencer', 'brand'].includes(resolvedUserType)) {
      throw new BadRequestException(
        'Invalid user type detected from device',
      );
    }

    const result = await this.appReviewService.shouldShowReviewPrompt(
      userIdNum,
      resolvedUserType as 'influencer' | 'brand',
    );

    // Get review status to include in response
    const status = await this.appReviewService.getReviewStatus(
      userIdNum,
      resolvedUserType as 'influencer' | 'brand',
    );

    return {
      shouldShow: result.shouldShow,
      reason: result.reason,
      campaignCount: result.campaignCount,
      isReviewed: status?.isReviewed || false,
      lastPromptedAt: status?.lastPromptedAt,
      promptCount: status?.promptCount,
    };
  }

  /**
   * Record that the prompt was shown to the user
   * POST /app-review/record-prompt
   *
   * Call this endpoint when you actually display the review prompt to the user.
   * This updates the last_prompted_at timestamp and increments the prompt count.
   */
  @Public()
  @Post('record-prompt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record that the review prompt was shown',
    description:
      'Records that the review prompt was actually displayed to the user. Updates the last prompted timestamp and increments the prompt count.\n\nUser type is automatically detected from device_tokens table using the provided device_id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompt recorded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters',
  })
  async recordPromptShown(@Body() dto: RecordPromptShownDto) {
    if (!dto.user_id) {
      throw new BadRequestException('user_id is required');
    }

    // Determine user type from device_id if not provided
    let resolvedUserType = dto.user_type;

    if (!resolvedUserType && dto.device_id) {
      const detectedUserType = await this.deviceTokenService.getUserTypeFromDevice(dto.user_id, dto.device_id);
      if (detectedUserType) {
        resolvedUserType = detectedUserType as 'influencer' | 'brand';
      } else {
        throw new BadRequestException('Device not found for this user. Please provide user_type or update your FCM token first.');
      }
    }

    if (!resolvedUserType) {
      throw new BadRequestException('Either user_type or device_id must be provided');
    }

    if (!['influencer', 'brand'].includes(resolvedUserType)) {
      throw new BadRequestException(
        'user_type must be either "influencer" or "brand"',
      );
    }

    const request = await this.appReviewService.recordPromptShown(
      dto.user_id,
      resolvedUserType,
    );

    return {
      message: 'Review prompt recorded successfully',
      promptCount: request.promptCount,
      lastPromptedAt: request.lastPromptedAt,
    };
  }

  /**
   * Mark the user as having completed the review
   * POST /app-review/mark-reviewed
   *
   * Call this endpoint when the user completes the app review.
   * Once marked as reviewed, the prompt will never be shown again.
   */
  @Public()
  @Post('mark-reviewed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark user as having completed the review',
    description:
      'Marks the user as having completed the app review. Once marked, the review prompt will never be shown to this user again.\n\nUser type is automatically detected from device_tokens table using the provided device_id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Review marked as completed',
    type: MarkAsReviewedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters',
  })
  async markAsReviewed(
    @Body() dto: MarkAsReviewedDto,
  ): Promise<MarkAsReviewedResponseDto> {
    if (!dto.user_id) {
      throw new BadRequestException('user_id is required');
    }

    // Determine user type from device_id if not provided
    let resolvedUserType = dto.user_type;

    if (!resolvedUserType && dto.device_id) {
      const detectedUserType = await this.deviceTokenService.getUserTypeFromDevice(dto.user_id, dto.device_id);
      if (detectedUserType) {
        resolvedUserType = detectedUserType as 'influencer' | 'brand';
      } else {
        throw new BadRequestException('Device not found for this user. Please provide user_type or update your FCM token first.');
      }
    }

    if (!resolvedUserType) {
      throw new BadRequestException('Either user_type or device_id must be provided');
    }

    if (!['influencer', 'brand'].includes(resolvedUserType)) {
      throw new BadRequestException(
        'user_type must be either "influencer" or "brand"',
      );
    }

    const request = await this.appReviewService.markAsReviewed(
      dto.user_id,
      resolvedUserType,
    );

    return {
      message: 'Review status updated successfully',
      isReviewed: request.isReviewed,
      reviewedAt: request.reviewedAt,
    };
  }

  /**
   * Get review status for a user
   * GET /app-review/status
   *
   * Retrieves the current review request status for a user
   */
  @Public()
  @Get('status')
  @ApiOperation({
    summary: 'Get review status for a user',
    description:
      'Retrieves the current app review request status including whether they have reviewed, prompt count, and last prompted date.\n\nUser type is automatically detected from device_tokens table using the provided device_id.',
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)',
    type: Number,
  })
  @ApiQuery({
    name: 'device_id',
    required: true,
    description: 'Device ID - used to automatically determine user type from device_tokens table',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No review record found for this user',
  })
  async getReviewStatus(
    @Query('user_id') userId: string,
    @Query('device_id') deviceId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('user_id is required');
    }

    if (!deviceId) {
      throw new BadRequestException('device_id is required');
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      throw new BadRequestException('user_id must be a valid number');
    }

    // Determine user type from device_id
    const detectedUserType = await this.deviceTokenService.getUserTypeFromDevice(userIdNum, deviceId);
    if (!detectedUserType) {
      throw new BadRequestException('Device not found for this user. Please update your FCM token first.');
    }

    const resolvedUserType = detectedUserType as 'influencer' | 'brand';

    if (!['influencer', 'brand'].includes(resolvedUserType)) {
      throw new BadRequestException(
        'Invalid user type detected from device',
      );
    }

    const status = await this.appReviewService.getReviewStatus(
      userIdNum,
      resolvedUserType as 'influencer' | 'brand',
    );

    if (!status) {
      return {
        message: 'No review record found for this user',
        hasRecord: false,
      };
    }

    return {
      message: 'Review status retrieved successfully',
      hasRecord: true,
      isReviewed: status.isReviewed,
      reviewedAt: status.reviewedAt,
      firstPromptedAt: status.firstPromptedAt,
      lastPromptedAt: status.lastPromptedAt,
      promptCount: status.promptCount,
    };
  }
}
