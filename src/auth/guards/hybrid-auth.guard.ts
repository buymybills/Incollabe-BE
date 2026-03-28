import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { Brand } from '../../brand/model/brand.model';
import { Influencer } from '../model/influencer.model';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface JwtPayload {
  id: number;
  userType: string;
  profileCompleted: boolean;
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
    isExternal?: boolean; // Flag to identify external users
    externalAppId?: string; // Which external app is making the request
  };
}

/**
 * Hybrid Authentication Guard
 *
 * Supports two authentication methods:
 * 1. JWT Token (for brands and internal influencers) - validates against local database
 * 2. API Key + Headers (for external influencers) - bypasses database validation
 *
 * Usage:
 * - Brands: Always use JWT (they exist in local database)
 * - Internal Influencers: Use JWT (they exist in local database)
 * - External Influencers: Use API Key (they don't exist in local database)
 */
@Injectable()
export class HybridAuthGuard implements CanActivate {
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
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // Check for API Key first (for external influencers)
    const apiKey = request.headers['x-api-key'] as string;

    if (apiKey) {
      return this.validateApiKey(request, apiKey);
    }

    // Otherwise, use JWT (for brands and internal influencers)
    return this.validateJwt(request);
  }

  /**
   * Validate API Key authentication (for external influencers only)
   */
  private async validateApiKey(
    request: RequestWithUser,
    apiKey: string,
  ): Promise<boolean> {
    // Validate API key against configured keys
    const validApiKeys =
      this.configService.get<string>('EXTERNAL_API_KEYS')?.split(',') || [];

    if (!validApiKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Extract user info from headers
    const userId = request.headers['x-user-id'] as string;
    const userType = request.headers['x-user-type'] as string;
    const externalAppId = request.headers['x-app-id'] as string;
    const email = request.headers['x-user-email'] as string;
    const username = request.headers['x-user-username'] as string;

    if (!userId || !userType) {
      throw new UnauthorizedException(
        'Missing required headers: x-user-id, x-user-type',
      );
    }

    // Only allow external influencers via API key
    // Brands MUST use JWT (they exist in local database)
    if (userType !== 'influencer') {
      throw new UnauthorizedException(
        'API key authentication only allowed for influencers. Brands must use JWT.',
      );
    }

    // Attach external user info to request
    request.user = {
      id: parseInt(userId),
      userType: userType,
      profileCompleted: true, // External users are assumed to be verified
      email: email || undefined,
      username: username || undefined,
      isExternal: true, // Mark as external user
      externalAppId: externalAppId || 'unknown',
    };

    return true;
  }

  /**
   * Validate JWT authentication (for brands and internal influencers)
   */
  private async validateJwt(request: RequestWithUser): Promise<boolean> {
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required. Provide either Bearer token or API key (x-api-key header).',
      );
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Validate user exists in local database
      if (payload.userType === 'influencer') {
        const influencer = await this.influencerModel.findByPk(payload.id);
        if (!influencer) {
          throw new UnauthorizedException(
            'Influencer account not found or has been deleted',
          );
        }
        if (!influencer.isActive) {
          throw new UnauthorizedException('Account is inactive');
        }
      } else if (payload.userType === 'brand') {
        const brand = await this.brandModel.findByPk(payload.id);
        if (!brand) {
          throw new UnauthorizedException(
            'Brand account not found or has been deleted',
          );
        }
        if (!brand.isActive) {
          throw new UnauthorizedException('Account is inactive');
        }
      }

      // Attach user info to request
      request.user = {
        id: payload.id,
        profileCompleted: payload.profileCompleted,
        userType: payload.userType,
        email: payload.email,
        username: payload.username,
        isExternal: false, // Internal user
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired JWT token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
