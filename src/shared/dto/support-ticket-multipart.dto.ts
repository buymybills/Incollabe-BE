import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ReportType, UserType } from '../models/support-ticket.model';

export class CreateSupportTicketMultipartDto {
  @ApiProperty({
    description: 'Subject/title of the support ticket',
    example: 'Cannot upload post image',
    minLength: 5,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'I am trying to upload an image but getting error 500',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Type of report/issue',
    enum: ReportType,
    example: ReportType.TECHNICAL_ISSUE,
    enumName: 'ReportType',
  })
  @IsEnum(ReportType)
  @IsNotEmpty()
  reportType: ReportType;

  @ApiPropertyOptional({
    description: 'Type of user being reported (if reporting another user)',
    enum: UserType,
    example: UserType.BRAND,
    enumName: 'UserType',
  })
  @IsEnum(UserType)
  @IsOptional()
  reportedUserType?: string;

  @ApiPropertyOptional({
    description: 'ID of the user being reported (if reporting another user)',
    example: '123',
  })
  @IsOptional()
  reportedUserId?: string;

  @ApiPropertyOptional({
    description: 'Supporting images (max 5 images, 10MB each)',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    maxItems: 5,
  })
  @IsOptional()
  images?: any;
}

export class CreateTicketReplyMultipartDto {
  @ApiProperty({
    description: 'Reply message',
    example: 'We have received your request and will investigate this issue.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message: string;

  @ApiPropertyOptional({
    description: 'Supporting images (max 5 images, 10MB each)',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    maxItems: 5,
  })
  @IsOptional()
  images?: any;
}
