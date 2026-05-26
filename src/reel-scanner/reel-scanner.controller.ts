import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReelScannerService } from './reel-scanner.service';
import { ScanReelRequestDto } from './dto/scan-reel-request.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Reel Scanner')
@Public()
@Controller('reel-scanner')
export class ReelScannerController {
  constructor(private readonly reelScannerService: ReelScannerService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a URL for fashion products',
    description: 'Accepts a direct image URL or any web page (Instagram post, reel page). Extracts og:image for web pages automatically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detected fashion items',
    schema: {
      example: {
        sourceImageUrl: 'https://example.com/image.jpg',
        items: [
          {
            brand: 'Snitch',
            productName: 'Oversized Graphic Tee',
            type: 'T-Shirt',
            wearerGender: 'men',
            color: 'white',
            pattern: 'graphic print',
            fit: 'oversized',
            details: 'crew neck, drop shoulder',
            searchQuery: 'oversized white graphic tee men',
            confidence: 0.92,
          },
        ],
      },
    },
  })
  async scan(@Body() dto: ScanReelRequestDto) {
    return this.reelScannerService.scanUrl(dto.url);
  }
}
