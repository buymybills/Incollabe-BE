import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReelScannerService } from './reel-scanner.service';
import { ScanReelRequestDto } from './dto/scan-reel-request.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Reel Scanner')
@ApiBearerAuth()
@Controller('reel-scanner')
@UseGuards(AuthGuard)
export class ReelScannerController {
  constructor(private readonly reelScannerService: ReelScannerService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a URL for fashion products',
    description: 'Accepts a direct image URL or any web page (Instagram post, reel page). Extracts og:image for web pages automatically.',
  })
  @ApiResponse({ status: 200, description: 'Detected fashion items' })
  async scan(@Body() dto: ScanReelRequestDto) {
    return this.reelScannerService.scanUrl(dto.url);
  }
}
