import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsObject,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdminStatus, TabAccessLevel } from '../models/admin.model';

export class CreateAdminDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'john.doe@collabkaroo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @ApiProperty({
    example: 'moderator',
    description:
      'Role name: "super_admin" (system role - only 1 allowed), "admin" (system role), or custom role (moderator, executive, intern, etc.)',
  })
  @IsString()
  role!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Tab-based permissions with access levels (none/view/edit)',
    example: {
      dashboard: 'view',
      influencers: 'edit',
      campaigns: 'view',
      hype_store: 'none',
    },
  })
  @IsOptional()
  @IsObject()
  tabPermissions?: Record<string, TabAccessLevel>;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  @IsOptional()
  @IsString()
  profileImage?: string;
}

export class AssignPermissionsDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['none', 'view', 'edit'] },
    description: 'Custom tab permissions. Pass null to reset to role defaults.',
    example: { dashboard: 'view', influencers: 'edit', campaigns: 'view' },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  tabPermissions!: Record<string, TabAccessLevel> | null;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'john.doe@collabkaroo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'moderator',
    description:
      'Role name: "super_admin" (system role - only 1 allowed), "admin" (system role), or custom role (moderator, executive, intern, etc.)',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Tab-based permissions with access levels. Pass null to use role defaults.',
    example: {
      dashboard: 'view',
      influencers: 'edit',
      campaigns: 'view',
    },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  tabPermissions?: Record<string, TabAccessLevel> | null;

  @ApiPropertyOptional({ enum: AdminStatus, example: AdminStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  @IsOptional()
  @IsString()
  profileImage?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'NewSecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}

export class GetAdminsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'moderator', description: 'Filter by role name' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ enum: AdminStatus })
  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;
}
