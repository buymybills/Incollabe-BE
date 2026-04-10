import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TabAccessLevel } from '../models/admin.model';

export class CreateRoleDto {
  @ApiProperty({
    example: 'moderator',
    description: 'Unique role identifier (lowercase, underscores only)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Role name must be lowercase letters, numbers, or underscores',
  })
  name!: string;

  @ApiProperty({ example: 'Moderator', description: 'Display label for the role' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ example: 'Can review content and manage posts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['none', 'view', 'edit'] },
    description: 'Default tab permissions for this role',
    example: {
      dashboard: 'view',
      influencers: 'view',
      posts: 'edit',
      profile_reviews: 'edit',
      campaigns: 'view',
      brands: 'view',
      hype_store: 'view',
      wallet: 'none',
      push_notifications: 'none',
      fiam_campaigns: 'none',
      analytics: 'view',
      settings: 'none',
      admin_management: 'none',
    },
  })
  @IsObject()
  tabPermissions!: Record<string, TabAccessLevel>;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Moderator', description: 'Display label for the role' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['none', 'view', 'edit'] },
    description: 'Updated default tab permissions',
    example: { dashboard: 'edit', posts: 'edit' },
  })
  @IsOptional()
  @IsObject()
  tabPermissions?: Record<string, TabAccessLevel>;
}

export class GetRolesQueryDto {
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
}
