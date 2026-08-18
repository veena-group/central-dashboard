export type FeatureKey = 'MEMBERS' | 'NOTICES' | 'DOCUMENTS' | 'FORMS' | 'COMMITTEE' | 'MEETINGS' | 'GALLERY' | 'EVENTS';
export type HostingState = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NONE';
export type SubscriptionState = 'PAID_UP' | 'DUE_SOON' | 'OVERDUE' | 'NONE';

export const FEATURE_KEYS: FeatureKey[] = ['MEMBERS', 'NOTICES', 'DOCUMENTS', 'FORMS', 'COMMITTEE', 'MEETINGS', 'GALLERY', 'EVENTS'];

export interface FeatureConfigRequest {
  featureKey: FeatureKey;
  enabled: boolean;
  limit: number | null;
}

export interface FeatureResponse {
  id: number;
  featureKey: FeatureKey;
  enabled: boolean;
  limit: number | null;
}

export interface OnboardSocietyRequest {
  societyName: string;
  domain: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  domainStartDate: string;
  domainExpiryDate: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string | null;
  adminPassword: string;
  features: FeatureConfigRequest[];
}

export interface OnboardSocietyResponse {
  societyId: number;
  societyName: string;
  domain: string;
  adminUserId: number;
  adminEmail: string;
}

export interface SocietyResponse {
  id: number;
  name: string;
  domain: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  currentHostingExpiry: string | null;
  hostingState: HostingState;
  currentNextDueDate: string | null;
  subscriptionState: SubscriptionState;
  createdAt: string;
}

export interface UpdateSocietyRequest {
  name: string;
  domain: string;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface PaymentRequest {
  plan: string;
  amount: number;
  paymentDate: string | null;
  nextDueDate: string | null;
}

export interface PaymentResponse {
  id: number;
  plan: string;
  amount: number;
  paymentDate: string | null;
  nextDueDate: string | null;
}

export interface DomainRenewalRequest {
  startDate: string;
  expiryDate: string;
  notes: string | null;
}

export interface DomainRenewalResponse {
  id: number;
  startDate: string;
  expiryDate: string;
  notes: string | null;
  createdAt: string;
}

export interface PlatformStatsResponse {
  totalSocieties: number;
  hostingActive: number;
  hostingExpiringSoon: number;
  hostingExpired: number;
  subscriptionsPaidUp: number;
  subscriptionsDueSoon: number;
  subscriptionsOverdue: number;
}

export interface SocietyAdminResponse {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}
