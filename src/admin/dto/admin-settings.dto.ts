import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsBoolean, IsOptional } from 'class-validator';

// Change Password DTOs
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({
    description: 'New password (min 8 characters)',
    example: 'NewPassword123!',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password',
    example: 'NewPassword123!',
  })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

// Two Factor Authentication DTOs
export class Enable2FADto {
  @ApiProperty({
    description: 'Password confirmation to enable 2FA',
    example: 'MyPassword123!',
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class Disable2FADto {
  @ApiProperty({
    description: 'Password confirmation to disable 2FA',
    example: 'MyPassword123!',
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class TwoFactorStatusDto {
  @ApiProperty({ description: 'Whether 2FA is enabled' })
  isEnabled: boolean;

  @ApiProperty({ description: 'Email where OTP will be sent' })
  email: string;
}

export class TwoFactorResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Whether 2FA is now enabled' })
  isEnabled: boolean;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

// Browser Session DTOs
export class BrowserSessionDto {
  @ApiProperty({ description: 'Session ID (JTI from JWT)' })
  sessionId: string;

  @ApiProperty({ description: 'Device information' })
  device: string;

  @ApiProperty({ description: 'IP address' })
  ipAddress: string;

  @ApiProperty({ description: 'Location (if available)' })
  location?: string;

  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity: Date;

  @ApiProperty({ description: 'Is current session' })
  isCurrent: boolean;
}

export class BrowserSessionsResponseDto {
  @ApiProperty({
    description: 'List of active sessions',
    type: [BrowserSessionDto],
  })
  sessions: BrowserSessionDto[];

  @ApiProperty({ description: 'Total number of active sessions' })
  totalSessions: number;
}

export class LogoutSessionResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Session ID that was logged out' })
  sessionId: string;
}

// Delete Account DTOs
export class DeleteAccountDto {
  @ApiProperty({
    description: 'Password confirmation to delete account',
    example: 'MyPassword123!',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Confirmation text (must type "DELETE MY ACCOUNT")',
    example: 'DELETE MY ACCOUNT',
  })
  @IsString()
  confirmationText: string;

  @ApiProperty({
    description: 'Optional reason for deletion',
    required: false,
    example: 'No longer needed',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeleteAccountResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Admin ID that was deleted' })
  adminId: number;

  @ApiProperty({ description: 'Deletion timestamp' })
  deletedAt: Date;
}
