import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../models/api-response.model';
import {
  DomainRenewalRequest,
  DomainRenewalResponse,
  FeatureConfigRequest,
  FeatureResponse,
  OnboardSocietyRequest,
  OnboardSocietyResponse,
  PaymentRequest,
  PaymentResponse,
  PlatformStatsResponse,
  SocietyAdminResponse,
  SocietyResponse,
  UpdateSocietyRequest
} from '../models/super-admin.model';

@Injectable({ providedIn: 'root' })
export class SuperAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/super-admin/societies`;

  onboardSociety(request: OnboardSocietyRequest): Observable<OnboardSocietyResponse> {
    return this.http
      .post<ApiResponse<OnboardSocietyResponse>>(this.base, request)
      .pipe(map((response) => response.data));
  }

  listSocieties(
    page: number,
    size: number,
    filters?: { search?: string; hostingState?: string; subscriptionState?: string }
  ): Observable<PageResponse<SocietyResponse>> {
    const params: Record<string, string | number> = { page, size };
    if (filters?.search) {
      params['search'] = filters.search;
    }
    if (filters?.hostingState) {
      params['hostingState'] = filters.hostingState;
    }
    if (filters?.subscriptionState) {
      params['subscriptionState'] = filters.subscriptionState;
    }
    return this.http
      .get<ApiResponse<PageResponse<SocietyResponse>>>(this.base, { params })
      .pipe(map((response) => response.data));
  }

  getSociety(societyId: number): Observable<SocietyResponse> {
    return this.http
      .get<ApiResponse<SocietyResponse>>(`${this.base}/${societyId}`)
      .pipe(map((response) => response.data));
  }

  updateSociety(societyId: number, request: UpdateSocietyRequest): Observable<SocietyResponse> {
    return this.http
      .put<ApiResponse<SocietyResponse>>(`${this.base}/${societyId}`, request)
      .pipe(map((response) => response.data));
  }

  uploadSocietyLogo(societyId: number, file: File): Observable<SocietyResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<SocietyResponse>>(`${this.base}/${societyId}/logo`, formData)
      .pipe(map((response) => response.data));
  }

  getFeatures(societyId: number): Observable<FeatureResponse[]> {
    return this.http
      .get<ApiResponse<FeatureResponse[]>>(`${this.base}/${societyId}/features`)
      .pipe(map((response) => response.data));
  }

  updateFeatures(societyId: number, request: FeatureConfigRequest[]): Observable<FeatureResponse[]> {
    return this.http
      .put<ApiResponse<FeatureResponse[]>>(`${this.base}/${societyId}/features`, request)
      .pipe(map((response) => response.data));
  }

  addPayment(societyId: number, request: PaymentRequest): Observable<PaymentResponse> {
    return this.http
      .post<ApiResponse<PaymentResponse>>(`${this.base}/${societyId}/payments`, request)
      .pipe(map((response) => response.data));
  }

  listPayments(societyId: number, page: number, size: number): Observable<PageResponse<PaymentResponse>> {
    return this.http
      .get<ApiResponse<PageResponse<PaymentResponse>>>(`${this.base}/${societyId}/payments`, { params: { page, size } })
      .pipe(map((response) => response.data));
  }

  getStats(): Observable<PlatformStatsResponse> {
    return this.http
      .get<ApiResponse<PlatformStatsResponse>>(`${this.base}/stats`)
      .pipe(map((response) => response.data));
  }

  listAdmins(societyId: number): Observable<SocietyAdminResponse[]> {
    return this.http
      .get<ApiResponse<SocietyAdminResponse[]>>(`${this.base}/${societyId}/admins`)
      .pipe(map((response) => response.data));
  }

  addDomainRenewal(societyId: number, request: DomainRenewalRequest): Observable<DomainRenewalResponse> {
    return this.http
      .post<ApiResponse<DomainRenewalResponse>>(`${this.base}/${societyId}/domain-renewals`, request)
      .pipe(map((response) => response.data));
  }

  listDomainRenewals(societyId: number): Observable<DomainRenewalResponse[]> {
    return this.http
      .get<ApiResponse<DomainRenewalResponse[]>>(`${this.base}/${societyId}/domain-renewals`)
      .pipe(map((response) => response.data));
  }
}
