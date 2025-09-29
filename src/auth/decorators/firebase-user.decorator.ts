import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';

export const FirebaseUser = createParamDecorator(
  (
    data: keyof DecodedIdToken | undefined,
    ctx: ExecutionContext,
  ): DecodedIdToken => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as DecodedIdToken;

    return data ? user?.[data] : user;
  },
);
