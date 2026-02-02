import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType, TicketStatus, UserType } from '../models/support-ticket.model';

export class TicketReporterDto {
  @ApiProperty({ example: 'influencer' })
  userType: UserType;

  @ApiProperty({ example: 38 })
  id: number;

  @ApiProperty({ example: 'Aditya Verma' })
  name: string;

  @ApiProperty({ example: 'gaming_aditya' })
  username: string;

  @ApiPropertyOptional({ example: '+919870541151' })
  phone?: string;

  @ApiPropertyOptional({ example: 'aditya@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  profileImage?: string;
}

export class AssignedAdminDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  email?: string;
}

export class SupportTicketDetailDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Cannot upload post image' })
  subject: string;

  @ApiProperty({ example: 'I am trying to upload an image but getting error 500' })
  description: string;

  @ApiProperty({
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    type: [String]
  })
  imageUrls: string[];

  @ApiProperty({ enum: ReportType, example: ReportType.TECHNICAL_ISSUE })
  reportType: ReportType;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.UNRESOLVED })
  status: TicketStatus;

  @ApiPropertyOptional({ type: TicketReporterDto })
  reporter?: TicketReporterDto;

  @ApiPropertyOptional({ enum: UserType })
  reportedUserType?: UserType;

  @ApiPropertyOptional({ example: 123 })
  reportedUserId?: number;

  @ApiPropertyOptional({ example: 'Issue has been resolved by updating server configuration' })
  resolution?: string;

  @ApiPropertyOptional({ example: '2026-02-02T10:30:00.000Z' })
  resolvedAt?: string;

  @ApiProperty({ example: '2026-02-02T04:16:37.352Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-02T04:16:37.352Z' })
  updatedAt: string;

  @ApiPropertyOptional({ type: AssignedAdminDto })
  assignedAdmin?: AssignedAdminDto;
}

export class TicketAuthorDto {
  @ApiProperty({ example: 'influencer', enum: ['influencer', 'brand', 'admin'] })
  type: string;

  @ApiProperty({ example: 38 })
  id: number;

  @ApiProperty({ example: 'Aditya Verma' })
  name: string;

  @ApiPropertyOptional({ example: 'gaming_aditya' })
  username?: string;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  profileImage?: string;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  email?: string;
}

export class TicketReplyDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'This is my reply to the ticket' })
  message: string;

  @ApiProperty({
    example: ['https://example.com/image1.jpg'],
    type: [String]
  })
  imageUrls: string[];

  @ApiProperty({ type: TicketAuthorDto })
  author: TicketAuthorDto;

  @ApiProperty({ example: '2026-02-02T05:24:16.078Z' })
  createdAt: string;
}

export class CreateTicketResponseDto {
  @ApiProperty({ example: 'Support ticket created successfully' })
  message: string;

  @ApiProperty({ example: 1 })
  ticketId: number;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.UNRESOLVED })
  status: TicketStatus;

  @ApiProperty({ example: '2026-02-02T04:16:37.352Z' })
  createdAt: string;
}

export class CreateReplyResponseDto {
  @ApiProperty({ example: 'Reply added successfully' })
  message: string;

  @ApiProperty({ example: 1 })
  replyId: number;

  @ApiProperty({ example: '2026-02-02T05:24:16.078Z' })
  createdAt: string;
}

export class PaginationDto {
  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

export class GetTicketsResponseDto {
  @ApiProperty({ type: [SupportTicketDetailDto] })
  tickets: SupportTicketDetailDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}

export class GetRepliesResponseDto {
  @ApiProperty({ type: [TicketReplyDto] })
  replies: TicketReplyDto[];
}
