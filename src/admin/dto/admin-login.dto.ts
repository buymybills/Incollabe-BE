import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@cloutsy.com',
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
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Admin user information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'John Doe' },
      email: { type: 'string', example: 'admin@cloutsy.com' },
      role: { type: 'string', example: 'super_admin' },
      profileImage: {
        type: 'string',
        example: 'https://s3.amazonaws.com/profile.jpg',
      },
      lastLoginAt: { type: 'string', example: '2024-01-15T10:30:00Z' },
    },
  })
  admin: {
    id: number;
    name: string;
    email: string;
    role: string;
    profileImage?: string;
    lastLoginAt?: Date;
  };
}
