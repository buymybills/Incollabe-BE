import { Request } from 'express';

export interface User {
  id: number;
  email: string;
  userType: 'brand' | 'influencer';
  profileCompleted: boolean;
}

export interface RequestWithUser extends Request {
  user: User;
}
