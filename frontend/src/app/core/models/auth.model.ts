export type Role = 'SUPER_ADMIN' | 'SOCIETY_ADMIN' | 'MEMBER';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: number;
  name: string;
  email: string;
  photoUrl: string | null;
  societyName: string | null;
  societyLogoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  role: Role;
  societyId: number | null;
  societyDomain: string | null;
}

export interface CurrentUser {
  userId: number;
  name: string;
  email: string;
  photoUrl: string | null;
  societyName: string | null;
  societyLogoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  role: Role;
  societyId: number | null;
  societyDomain: string | null;
}
