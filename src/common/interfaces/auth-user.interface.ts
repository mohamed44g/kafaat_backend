import { UserRole } from '../../users/entities/user.entity.js';

export interface AuthUser {
  sub: string;
  role: UserRole;
  email: string;
  sessionId: string;
}
