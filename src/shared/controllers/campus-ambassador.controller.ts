import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CampusAmbassadorService } from '../services/campus-ambassador.service';
import {
  RegisterCampusAmbassadorDto,
  CampusAmbassadorResponseDto,
} from '../dto/campus-ambassador.dto';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('Campus Ambassador')
@Controller('campus-ambassador')
export class CampusAmbassadorController {
  constructor(private campusAmbassadorService: CampusAmbassadorService) {}

  /**
   * Register a new campus ambassador
   * POST /campus-ambassador/register
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new campus ambassador',
    description: 'Submits campus ambassador details and generates a unique ambassador ID. Phone number should be 10 digits (without +91), the system will add +91 prefix automatically.',
  })
  @ApiResponse({
    status: 201,
    description: 'Campus ambassador registered successfully',
    type: CampusAmbassadorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async register(@Body() dto: RegisterCampusAmbassadorDto) {
    const ambassador = await this.campusAmbassadorService.registerAmbassador(dto);

    return {
      success: true,
      message: 'Campus ambassador registered successfully!',
      data: {
        id: ambassador.id,
        ambassadorId: ambassador.ambassadorId,
        name: ambassador.name,
        phoneNumber: ambassador.phoneNumber,
        email: ambassador.email,
        collegeName: ambassador.collegeName,
        collegeCity: ambassador.collegeCity,
        collegeState: ambassador.collegeState,
        totalReferrals: ambassador.totalReferrals,
        successfulSignups: ambassador.successfulSignups,
        createdAt: ambassador.createdAt,
      },
    };
  }

  /**
   * Get ambassador by ambassador ID
   * GET /campus-ambassador/:ambassadorId
   */
  @Public()
  @Get(':ambassadorId')
  @ApiOperation({
    summary: 'Get campus ambassador by ID',
    description: 'Retrieves detailed information about a campus ambassador',
  })
  @ApiParam({
    name: 'ambassadorId',
    description: 'Campus ambassador ID (e.g., CA-0001)',
    example: 'CA-0001',
  })
  @ApiResponse({
    status: 200,
    description: 'Campus ambassador details',
    type: CampusAmbassadorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Campus ambassador not found',
  })
  async getById(@Param('ambassadorId') ambassadorId: string) {
    const ambassador = await this.campusAmbassadorService.getAmbassadorById(ambassadorId);

    return {
      success: true,
      data: ambassador,
    };
  }

}
