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
    description: 'Initial members to add to the group (optional, max 9 members plus creator)',
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
  @ArrayMaxSize(9) // Max 9 + creator = 10 total
  initialMemberIds?: Array<{ memberId: number; memberType: MemberType }>;
}

export class AddMembersDto {
  @ApiProperty({
    description: 'Array of member IDs to add',
    example: [101, 102, 103],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
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
