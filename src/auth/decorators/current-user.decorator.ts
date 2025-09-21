import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser, User } from '../../types/request.types';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
