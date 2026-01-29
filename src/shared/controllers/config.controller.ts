import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnvironmentUrlsDto } from '../dto/config.dto';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('Config')
@Controller('config')
export class ConfigController {
  /**
   * Get backend and frontend URLs based on current environment
   * GET /config/environment-urls
   *
   * Returns the appropriate URLs based on NODE_ENV:
   * - staging: Backend: https://incollab.buymybills.in/api/docs#/, Frontend: https://collabkaroo.co.in
   * - production: Backend: https://api.collabkaroo.co.in/api/docs, Frontend: https://collabkaroo.com
   */
  @Public()
  @Get('environment-urls')
  @ApiOperation({
    summary: 'Get environment URLs',
    description:
      'Returns backend and frontend URLs based on the current NODE_ENV (staging or production)',
  })
  @ApiResponse({
    status: 200,
    description: 'Environment URLs retrieved successfully',
    type: EnvironmentUrlsDto,
  })
  getEnvironmentUrls(): EnvironmentUrlsDto {
    const environment = process.env.NODE_ENV || 'staging';

    let backendUrl: string;
    let frontendUrl: string;

    if (environment === 'production') {
      backendUrl = 'https://api.collabkaroo.co.in/api/docs';
      frontendUrl = 'https://collabkaroo.com';
    } else {
      // Default to staging for any other environment
      backendUrl = 'https://incollab.buymybills.in/api/docs#/';
      frontendUrl = 'https://collabkaroo.co.in';
    }

    return {
      environment,
      backendUrl,
      frontendUrl,
    };
  }
}
