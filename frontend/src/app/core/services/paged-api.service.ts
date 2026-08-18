import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class PagedApiService {
  private readonly http = inject(HttpClient);

  list<T>(
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
      .get<ApiResponse<PageResponse<T>>>(`${environment.apiBaseUrl}${path}`, { params })
      .pipe(map((response) => response.data));
  }
}
