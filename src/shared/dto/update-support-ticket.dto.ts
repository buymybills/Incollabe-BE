import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TicketStatus } from '../models/support-ticket.model';

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({
    description: 'Update ticket status',
    enum: TicketStatus,
    example: TicketStatus.RESOLVED,
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    description: 'Admin notes (internal)',
    example: 'Investigated the issue, found root cause',
  })
  @IsString()
  @IsOptional()
  adminNotes?: string;

  @ApiPropertyOptional({
    description: 'Resolution message (sent to user)',
    example: 'We have fixed the upload issue. Please try again.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  @IsOptional()
  resolution?: string;
}
