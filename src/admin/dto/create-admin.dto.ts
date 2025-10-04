import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { AdminRole, AdminStatus } from '../models/admin.model';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Admin full name',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Admin email address',
    example: 'john@collabkaroo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'securePassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    description: 'Admin role',
    enum: AdminRole,
    example: AdminRole.PROFILE_REVIEWER,
    enumName: 'AdminRole',
  })
  @IsEnum(AdminRole, { message: 'Role must be a valid admin role' })
  role: AdminRole;
}

export class CreateAdminResponseDto {
  @ApiProperty({
    description: 'Created admin ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Admin name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Admin email',
    example: 'john@collabkaroo.com',
  })
  email: string;

  @ApiProperty({
    description: 'Admin role',
    enum: AdminRole,
    example: AdminRole.PROFILE_REVIEWER,
  })
  role: AdminRole;

  @ApiProperty({
    description: 'Admin status',
    enum: AdminStatus,
    example: AdminStatus.ACTIVE,
  })
  status: AdminStatus;

  @ApiProperty({
    description: 'Admin creation date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}
