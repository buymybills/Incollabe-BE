import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FirebaseService } from '../shared/firebase.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Firebase')
@Controller('firebase')
export class FirebaseController {
  constructor(private readonly firebaseService: FirebaseService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check Firebase connection health' })
  @ApiResponse({ status: 200, description: 'Firebase is connected' })
  async healthCheck() {
    return await this.firebaseService.healthCheck();
  }
}
