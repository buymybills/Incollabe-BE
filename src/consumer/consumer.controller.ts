import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { ConsumerService } from './consumer.service';
import { SaveConsumerProfileDto } from './dto/save-consumer-profile.dto';
import { BecomeInfluencerDto } from './dto/become-influencer.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ApiFileFields } from '../auth/decorators/api-file.decorator';

@ApiTags('Consumer')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get consumer profile' })
  @ApiResponse({
    status: 200,
    schema: {
      example: { id: 3, phone: '9876543210', name: 'Rahul Sharma', profileImage: null, dateOfBirth: '1998-05-15' },
    },
  })
  async getProfile(@Req() req: any) {
    return this.consumerService.getProfile(req.user.id);
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('profileImage', {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(new Error('Only image files are allowed'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Save consumer profile',
    description: 'Save name, date of birth and optional profile image for the consumer.',
  })
  @ApiFileFields(['profileImage'], {
    name: {
      type: 'string',
      description: 'Full name',
      example: 'Rahul Sharma',
      required: false,
    },
    dateOfBirth: {
      type: 'string',
      description: 'Date of birth (YYYY-MM-DD)',
      example: '1998-05-15',
      required: false,
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Profile saved successfully',
        id: 3,
        name: 'Rahul Sharma',
        profileImage: 'https://s3.amazonaws.com/...',
        dateOfBirth: '1998-05-15',
      },
    },
  })
  async saveProfile(
    @Req() req: any,
    @Body() dto: SaveConsumerProfileDto,
    @UploadedFile() profileImage?: Express.Multer.File,
  ) {
    return this.consumerService.saveProfile(req.user.id, dto, profileImage);
  }

  @Post('become-influencer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade consumer to HYPE influencer',
    description: 'Validates the invite code and creates an influencer account using the saved consumer profile. Returns an influencer access token.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Welcome to HYPE! Complete your profile to get started.',
        accessToken: 'eyJ...',
        influencerId: 20293,
        isHypeInfluencer: true,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Profile name not saved yet' })
  @ApiResponse({ status: 403, description: 'Invalid or inactive invite code' })
  @ApiResponse({ status: 409, description: 'Influencer account already exists for this phone' })
  async becomeInfluencer(@Req() req: any, @Body() dto: BecomeInfluencerDto) {
    return this.consumerService.becomeInfluencer(req.user.id, dto);
  }
}
