import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { ChangePasswordRequest, MyProfileResponse, UpdateMyProfileRequest } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/me`;

  getMyProfile(): Observable<MyProfileResponse> {
    return this.http.get<ApiResponse<MyProfileResponse>>(this.base).pipe(map((response) => response.data));
  }

  updateMyProfile(request: UpdateMyProfileRequest): Observable<MyProfileResponse> {
    return this.http.put<ApiResponse<MyProfileResponse>>(this.base, request).pipe(map((response) => response.data));
  }

  uploadMyPhoto(file: File): Observable<MyProfileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<MyProfileResponse>>(`${this.base}/photo`, formData).pipe(map((response) => response.data));
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.base}/password`, request).pipe(map(() => undefined));
  }
}
