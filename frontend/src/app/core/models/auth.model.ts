export type Role = 'SUPER_ADMIN' | 'SOCIETY_ADMIN' | 'MEMBER';
export type LoginType = 'EMAIL' | 'MOBILE';

export interface LoginRequest {
  /** Email or mobile number, depending on the society's login type. */
  identifier: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: number;
  name: string;
  email: string | null;
  photoUrl: string | null;
  societyName: string | null;
  societyLogoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  role: Role;
  societyId: number | null;
  societyDomain: string | null;
  phone: string | null;
  loginType: LoginType;
}

export interface CurrentUser {
  userId: number;
  name: string;
  email: string | null;
  photoUrl: string | null;
  societyName: string | null;
  societyLogoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  role: Role;
  societyId: number | null;
  societyDomain: string | null;
  phone?: string | null;
  loginType?: LoginType;
}
