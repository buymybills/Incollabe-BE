import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@collabkaroo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

export class AdminLoginResponseDto {
  @ApiProperty({
    description: 'JWT access token (only present when 2FA is disabled)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken?: string;

  @ApiProperty({
    description:
      'JWT refresh token for obtaining new access tokens (only present when 2FA is disabled)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Admin user information (only present when 2FA is disabled)',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'John Doe' },
      email: { type: 'string', example: 'admin@collabkaroo.com' },
      role: { type: 'string', example: 'super_admin' },
      status: { type: 'string', example: 'ACTIVE' },
    },
  })
  admin?: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  };

  @ApiProperty({
    description:
      'Message indicating OTP has been sent (only present when 2FA is enabled)',
    example: 'OTP sent to your email. Please verify to complete login.',
  })
  message?: string;

  @ApiProperty({
    description: 'Email where OTP was sent (only present when 2FA is enabled)',
    example: 'admin@collabkaroo.com',
  })
  email?: string;

  @ApiProperty({
    description: 'Indicates if OTP verification is required to complete login',
    example: true,
  })
  requiresOtp: boolean;
}
