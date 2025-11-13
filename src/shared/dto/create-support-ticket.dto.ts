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

export class CreateSupportTicketDto {
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
  })
  @IsEnum(ReportType)
  @IsNotEmpty()
  reportType: ReportType;

  @ApiPropertyOptional({
    description: 'Type of user being reported (if reporting another user)',
    enum: UserType,
    example: UserType.BRAND,
  })
  @IsEnum(UserType)
  @IsOptional()
  reportedUserType?: UserType;

  @ApiPropertyOptional({
    description: 'ID of the user being reported (if reporting another user)',
    example: 123,
  })
  @IsInt()
  @IsOptional()
  reportedUserId?: number;
}
