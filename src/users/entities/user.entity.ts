export enum UserRole {
  SuperAdmin = 'super_admin',
  Admin = 'admin',
  Student = 'student',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  isSubscribed: boolean;
  subscriptionEndsAt: Date | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
