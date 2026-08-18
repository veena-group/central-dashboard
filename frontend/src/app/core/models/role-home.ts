import { Role } from './auth.model';

export const ROLE_HOME_PATH: Record<Role, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  SOCIETY_ADMIN: '/admin/dashboard',
  MEMBER: '/member/dashboard'
};
