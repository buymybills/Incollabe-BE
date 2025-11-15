import { UserType, ReportType, TicketStatus } from '../models/support-ticket.model';

export class SupportTicketCreationDto {
  userType: UserType;
  influencerId?: number;
  brandId?: number;
  subject: string;
  description: string;
  reportType: ReportType;
  status: TicketStatus;
  reportedUserType?: UserType;
  reportedUserId?: number;
}
