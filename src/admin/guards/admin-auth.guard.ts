import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AdminAuthService } from '../admin-auth.service';
import { AdminRole } from '../models/admin.model';

export interface RequestWithAdmin extends Request {
  admin: {
    id: number;
    email: string;
    role: AdminRole;
    type: string;
    jti?: string; // JWT ID for session management
  };
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      const payload = this.jwtService.verify(token);

      // Verify this is an admin token
      if (payload.type !== 'admin') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify admin still exists and is active
      const admin = await this.adminAuthService.getAdminProfile(payload.sub);

      request.admin = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        type: payload.type,
        jti: payload.jti, // Include JWT ID for session management
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
