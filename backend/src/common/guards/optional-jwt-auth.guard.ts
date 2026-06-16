import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates if a valid token is present, but never rejects.
 * Used by endpoints that behave differently for guests vs. logged-in users
 * (e.g. cart merge, product views). `request.user` is undefined for guests.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(_err: any, user: any) {
    return user || undefined; // swallow errors, allow anonymous
  }
}
