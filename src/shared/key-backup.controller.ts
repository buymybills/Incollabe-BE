import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { KeyBackupService } from './services/key-backup.service';
import { CreateKeyBackupDto, UpdateKeyBackupDto } from './dto/key-backup.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UserType } from './models/key-backup.model';

interface RequestWithUser extends Request {
  user: {
    id: number;
    userType: 'influencer' | 'brand';
  };
}

@ApiTags('E2EE Key Backup')
@Controller('keys')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class KeyBackupController {
  constructor(private readonly keyBackupService: KeyBackupService) {}

  @Post('backup')
  @ApiOperation({
    summary: 'Create or update encrypted key backup',
    description:
      'Store password-encrypted private key on server for cross-device support. ' +
      'The private key is encrypted with a key derived from user password using PBKDF2.',
  })
  @ApiResponse({
    status: 200,
    description: 'Key backup created/updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Key backup created successfully',
        keyVersion: 1,
      },
    },
  })
  async createBackup(@Req() req: RequestWithUser, @Body() dto: CreateKeyBackupDto) {
    return await this.keyBackupService.createOrUpdateBackup(
      req.user.id,
      req.user.userType as UserType,
      dto,
    );
  }

  @Get('backup')
  @ApiOperation({
    summary: 'Get encrypted key backup',
    description: 'Retrieve encrypted private key backup for decryption on client',
  })
  @ApiResponse({
    status: 200,
    description: 'Key backup retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          encryptedPrivateKey: 'U2FsdGVkX1...',
          salt: 'a1b2c3d4e5f6...',
          publicKey: '-----BEGIN PUBLIC KEY-----\n...',
          keyVersion: 1,
          createdAt: '2025-12-04T00:00:00.000Z',
        },
      },
    },
  })
  async getBackup(@Req() req: RequestWithUser) {
    return await this.keyBackupService.getBackup(
      req.user.id,
      req.user.userType as UserType,
    );
  }

  @Get('backup/exists')
  @ApiOperation({
    summary: 'Check if key backup exists',
    description: 'Check if user has a key backup stored',
  })
  @ApiResponse({
    status: 200,
    description: 'Backup existence check result',
    schema: {
      example: {
        success: true,
        exists: true,
      },
    },
  })
  async checkBackupExists(@Req() req: RequestWithUser) {
    const exists = await this.keyBackupService.hasBackup(
      req.user.id,
      req.user.userType as UserType,
    );

    return {
      success: true,
      exists,
    };
  }

  @Put('backup')
  @ApiOperation({
    summary: 'Update key backup',
    description: 'Update encrypted private key (for key rotation)',
  })
  @ApiResponse({
    status: 200,
    description: 'Key backup updated successfully',
  })
  async updateBackup(@Req() req: RequestWithUser, @Body() dto: UpdateKeyBackupDto) {
    return await this.keyBackupService.updateBackup(
      req.user.id,
      req.user.userType as UserType,
      dto,
    );
  }

  @Delete('backup')
  @ApiOperation({
    summary: 'Delete key backup',
    description: 'Permanently delete encrypted key backup from server',
  })
  @ApiResponse({
    status: 200,
    description: 'Key backup deleted successfully',
  })
  async deleteBackup(@Req() req: RequestWithUser) {
    return await this.keyBackupService.deleteBackup(
      req.user.id,
      req.user.userType as UserType,
    );
  }
}
