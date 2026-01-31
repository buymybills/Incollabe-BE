import { Request } from 'express';
import { ParticipantType } from '../shared/models/conversation.model';

export interface User {
  id: number;
  email: string;
  userType: ParticipantType;
  profileCompleted: boolean;
}

export interface RequestWithUser extends Request {
  user: User;
}
