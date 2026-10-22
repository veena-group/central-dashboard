import { LoginType } from './auth.model';

export interface MyProfileResponse {
  id: number;
  name: string;
  flat: string | null;
  wing: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  societyId: number | null;
  photoUrl: string | null;
  createdAt: string;
  loginType: LoginType;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateMyProfileRequest {
  name: string;
  flat: string | null;
  wing: string | null;
  phone: string | null;
}
