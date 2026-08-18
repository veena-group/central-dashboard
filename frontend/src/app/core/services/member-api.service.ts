import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../models/api-response.model';
import { CategoryOption, CategoryType } from './admin-content-api.service';

@Injectable({ providedIn: 'root' })
export class MemberApiService {
  private readonly http = inject(HttpClient);

  list<T>(path: string): Observable<T[]> {
    return this.http
      .get<ApiResponse<T[]>>(`${environment.apiBaseUrl}/member${path}`)
      .pipe(map((response) => response.data));
  }

  listPaged<T>(
    path: string,
    page: number,
    size: number,
    filters?: Record<string, string | number | boolean | undefined | null>
  ): Observable<PageResponse<T>> {
    const params: Record<string, string | number | boolean> = { page, size };
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          params[key] = value;
        }
      }
    }
    return this.http
      .get<ApiResponse<PageResponse<T>>>(`${environment.apiBaseUrl}/member${path}`, { params })
      .pipe(map((response) => response.data));
  }

  get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${environment.apiBaseUrl}/member${path}`)
      .pipe(map((response) => response.data));
  }

  listCategories(type: CategoryType): Observable<CategoryOption[]> {
    return this.http
      .get<ApiResponse<CategoryOption[]>>(`${environment.apiBaseUrl}/member/categories`, { params: { type } })
      .pipe(map((response) => response.data));
  }

  fetchStoredFile(filePath: string): Observable<Blob> {
    return this.http.get(`${environment.apiBaseUrl}/files/view`, {
      params: { path: filePath },
      responseType: 'blob'
    });
  }
}
