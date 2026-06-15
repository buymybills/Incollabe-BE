import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CommentMatchType } from '../../shared/models/comment-automation.model';

export class CreateCommentAutomationDto {
  @ApiProperty({ description: 'Label for this automation', example: 'Summer Sale Reel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Instagram post or reel link',
    example: 'https://www.instagram.com/reel/Cabc123XYZ/',
  })
  @IsString()
  @IsNotEmpty()
  mediaUrl: string;

  @ApiProperty({
    description: 'Trigger keyword(s). Use commas to add more than one.',
    example: 'price, link, want',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  keyword: string;

  @ApiPropertyOptional({ enum: CommentMatchType, default: CommentMatchType.CONTAINS })
  @IsOptional()
  @IsEnum(CommentMatchType)
  matchType?: CommentMatchType;

  @ApiPropertyOptional({ description: 'Public reply posted under the comment' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentReply?: string;

  @ApiPropertyOptional({ description: 'Private DM sent to the commenter' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dmMessage?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommentAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  keyword?: string;

  @ApiPropertyOptional({ enum: CommentMatchType })
  @IsOptional()
  @IsEnum(CommentMatchType)
  matchType?: CommentMatchType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentReply?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dmMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GetCommentAutomationsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search title / keyword / link' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class UpdateCommentAutomationStatusDto {
  @ApiProperty({ description: 'Activate or deactivate the automation' })
  @IsBoolean()
  isActive: boolean;
}
