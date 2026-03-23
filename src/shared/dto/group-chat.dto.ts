import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemberType } from '../models/group-member.model';

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name', example: 'Marketing Team' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Group avatar URL (optional)', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({
    description: 'Broadcast-only mode: When true, only admins can send messages (announcement channel). When false, any member can send messages (regular group chat). Default: false',
    required: false,
    default: false,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isBroadcastOnly?: boolean;

  @ApiProperty({
    description: 'Allow users to join this group themselves. When true, influencers can discover and join the group. When false, only admins can add members. Default: true',
    required: false,
    default: true,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isJoinable?: boolean;

  @ApiProperty({
    description: 'Initial members to add to the group (optional, max 999 members plus creator = 1000 total)',
    required: false,
    type: 'array',
    items: {
      type: 'object',
      properties: {
        memberId: { type: 'number' },
        memberType: { type: 'string', enum: ['influencer', 'brand'] },
      },
    },
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(999) // Max 999 + creator = 1000 total
  initialMemberIds?: Array<{ memberId: number; memberType: MemberType }>;
}

export class AddMembersDto {
  @ApiProperty({
    description: 'Array of member IDs to add (max 50 at once)',
    example: [101, 102, 103],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  memberIds: number[];

  @ApiProperty({
    description: 'Array of member types (must match memberIds length)',
    example: ['influencer', 'brand', 'influencer'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsEnum(['influencer', 'brand'], { each: true })
  memberTypes: string[];
}

export class RemoveMemberDto {
  @ApiProperty({ description: 'Member ID to remove', example: 101 })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  memberId: number;

  @ApiProperty({
    description: 'Member type',
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['influencer', 'brand'])
  memberType: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'Member ID to promote/demote', example: 101 })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  memberId: number;

  @ApiProperty({
    description: 'Member type',
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['influencer', 'brand'])
  memberType: string;

  @ApiProperty({
    description: 'New role for the member',
    enum: ['admin', 'member'],
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['admin', 'member'])
  role: 'admin' | 'member';
}

export class UpdateGroupDto {
  @ApiProperty({ description: 'New group name (optional)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'New group avatar URL (optional)', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class GetGroupsDto {
  @ApiProperty({
    description: 'Filter groups: "my" shows only groups you joined, "all" shows all joinable community groups',
    required: false,
    default: 'my',
    enum: ['my', 'all'],
    example: 'my',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['my', 'all'])
  filter?: 'my' | 'all';

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number;
}

export class GetGroupDetailsDto {
  @ApiProperty({
    description: 'Search influencer members by name or username (brand admins are not filtered by search)',
    required: false,
    example: 'john',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
