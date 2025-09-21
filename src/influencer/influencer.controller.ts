import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { InfluencerService } from './influencer.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateInfluencerProfileDto } from './dto/update-influencer-profile.dto';
import {
  SendWhatsAppOTPDto,
  VerifyWhatsAppOTPDto,
} from './dto/whatsapp-verification.dto';
import type { RequestWithUser } from '../types/request.types';

@ApiTags('Influencer Profile')
@Controller('influencer')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InfluencerController {
  constructor(private readonly influencerService: InfluencerService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get comprehensive influencer profile',
    description:
      'Returns complete influencer profile with verification status and completion details',
  })
  @ApiResponse({
    status: 200,
    description: 'Influencer profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Influencer not found' })
  async getInfluencerProfile(@Req() req: RequestWithUser) {
    const influencerId = req.user.id;
    return await this.influencerService.getInfluencerProfile(influencerId);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update influencer profile and submit for verification',
    description:
      'Update any influencer profile fields including basic info, bio, social links, and collaboration costs. When all required fields are completed, the profile is automatically submitted for verification. This endpoint handles updating existing values that may have been skipped during signup.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Comprehensive influencer profile update with optional file uploads',
    schema: {
      type: 'object',
      properties: {
        // Basic Info (can update existing values)
        name: {
          type: 'string',
          description: 'Full name - can update existing',
        },
        username: {
          type: 'string',
          description: 'Username - can update existing',
        },
        bio: {
          type: 'string',
          description:
            'Bio/description - can update existing or add if skipped during signup',
        },
        profileHeadline: {
          type: 'string',
          description:
            'Profile headline - can update existing or add if skipped',
        },
        dateOfBirth: {
          type: 'string',
          description: 'Date of birth - can update existing or add if skipped',
        },
        gender: {
          type: 'string',
          description: 'Gender - can update existing or add if skipped',
        },

        // Location
        countryId: { type: 'number', description: 'Country ID' },
        cityId: { type: 'number', description: 'City ID' },

        // Contact
        whatsappNumber: {
          type: 'string',
          description: 'WhatsApp number for verification',
        },

        // Social Media Links (can update existing or add new)
        instagramUrl: { type: 'string', description: 'Instagram profile URL' },
        youtubeUrl: { type: 'string', description: 'YouTube channel URL' },
        facebookUrl: { type: 'string', description: 'Facebook profile URL' },
        linkedinUrl: { type: 'string', description: 'LinkedIn profile URL' },
        twitterUrl: { type: 'string', description: 'Twitter/X profile URL' },

        // Collaboration Costs
        collaborationCosts: {
          type: 'object',
          description: 'Collaboration costs for different platforms',
          properties: {
            instagram: {
              type: 'object',
              properties: {
                reel: {
                  type: 'number',
                  description: 'Price for Instagram Reel',
                },
                story: {
                  type: 'number',
                  description: 'Price for Instagram Story',
                },
                post: {
                  type: 'number',
                  description: 'Price for Instagram Post',
                },
              },
            },
            youtube: {
              type: 'object',
              properties: {
                short: {
                  type: 'number',
                  description: 'Price for YouTube Short',
                },
                longVideo: {
                  type: 'number',
                  description: 'Price for YouTube Long Video',
                },
              },
            },
            facebook: {
              type: 'object',
              properties: {
                post: {
                  type: 'number',
                  description: 'Price for Facebook Post',
                },
                story: {
                  type: 'number',
                  description: 'Price for Facebook Story',
                },
              },
            },
            linkedin: {
              type: 'object',
              properties: {
                post: {
                  type: 'number',
                  description: 'Price for LinkedIn Post',
                },
              },
            },
            twitter: {
              type: 'object',
              properties: {
                post: {
                  type: 'number',
                  description: 'Price for Twitter/X Post',
                },
              },
            },
          },
        },

        // File Uploads
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file - can update existing',
        },
        profileBanner: {
          type: 'string',
          format: 'binary',
          description: 'Profile banner image file - can update existing',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Profile updated successfully. If profile becomes complete, it is automatically submitted for verification.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 123 },
        name: { type: 'string', example: 'John Doe' },
        message: {
          type: 'string',
          example:
            'Profile submitted for verification. You will receive a notification once verification is complete within 48 hours.',
        },
        status: {
          type: 'string',
          enum: ['incomplete', 'pending_verification'],
          example: 'pending_verification',
        },
        missingFieldsCount: {
          type: 'number',
          example: 0,
          description: 'Present when status is incomplete',
        },
        verification: {
          type: 'object',
          properties: {
            isProfileCompleted: { type: 'boolean', example: true },
            isWhatsappVerified: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'profileBanner', maxCount: 1 },
    ]),
  )
  async updateInfluencerProfile(
    @Req() req: RequestWithUser,
    @Body() updateData: UpdateInfluencerProfileDto,
    @UploadedFiles() files: any,
  ) {
    const influencerId = req.user.id;
    return await this.influencerService.updateInfluencerProfile(
      influencerId,
      updateData,
      files,
    );
  }

  @Post('request-whatsapp-otp')
  @ApiOperation({
    summary: 'Request WhatsApp verification OTP',
    description:
      'Send OTP to WhatsApp number for verification. This is part of the verification flow.',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp OTP sent successfully',
  })
  async sendWhatsAppVerificationOTP(
    @Req() req: RequestWithUser,
    @Body() sendOtpDto: SendWhatsAppOTPDto,
  ) {
    const influencerId = req.user.id;
    return await this.influencerService.sendWhatsAppVerificationOTP({
      influencerId,
      whatsappNumber: sendOtpDto.whatsappNumber,
    });
  }

  @Post('verify-whatsapp-otp')
  @ApiOperation({
    summary: 'Verify WhatsApp OTP',
    description:
      'Confirm WhatsApp verification with OTP. This completes the WhatsApp verification step.',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp verified successfully',
  })
  async verifyWhatsAppOTP(
    @Req() req: RequestWithUser,
    @Body() verifyOtpDto: VerifyWhatsAppOTPDto,
  ) {
    const influencerId = req.user.id;
    return await this.influencerService.verifyWhatsAppOTP({
      influencerId,
      whatsappNumber: verifyOtpDto.whatsappNumber,
      otp: verifyOtpDto.otp,
    });
  }

  @Get('profile/:id')
  @ApiOperation({
    summary: 'Get public influencer profile',
    description: 'Get public influencer profile by ID',
  })
  async getPublicInfluencerProfile(
    @Param('id', ParseIntPipe) influencerId: number,
  ) {
    const profile = await this.influencerService.getInfluencerProfile(
      influencerId,
      true,
    );

    // Return public fields only
    return {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      profileImage: profile.profileImage,
      profileBanner: profile.profileBanner,
      profileHeadline: profile.profileHeadline,
      location: profile.location,
      socialLinks: profile.socialLinks,
      niches: profile.niches,
    };
  }
}
