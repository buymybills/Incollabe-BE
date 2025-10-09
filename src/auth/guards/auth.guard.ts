import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectModel } from '@nestjs/sequelize';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Influencer } from '../model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

interface JwtPayload {
  id: number;
  profileCompleted: boolean;
  userType?: string;
  email?: string;
  username?: string;
  jti: string;
}

interface RequestWithUser extends Request {
  user: {
    id: number;
    profileCompleted: boolean;
    userType: string;
    email?: string;
    username?: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token required');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Check if the account exists and is active
      if (payload.userType === 'influencer') {
        const influencer = await this.influencerModel.findByPk(payload.id);
        if (!influencer) {
          throw new UnauthorizedException('Account not found or has been deleted');
        }
        if (!influencer.isActive) {
          throw new UnauthorizedException('Account is inactive');
        }
      } else if (payload.userType === 'brand') {
        const brand = await this.brandModel.findByPk(payload.id);
        if (!brand) {
          throw new UnauthorizedException('Account not found or has been deleted');
        }
        if (!brand.isActive) {
          throw new UnauthorizedException('Account is inactive');
        }
      }

      // Attach user info to request for use in controllers
      request.user = {
        id: payload.id,
        profileCompleted: payload.profileCompleted,
        userType: payload.userType || 'unknown',
        email: payload.email,
        username: payload.username,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
