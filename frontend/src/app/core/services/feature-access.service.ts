import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { AuthService } from './auth.service';

export type FeatureKey = 'MEMBERS' | 'NOTICES' | 'DOCUMENTS' | 'FORMS' | 'COMMITTEE' | 'MEETINGS' | 'GALLERY' | 'EVENTS';

interface FeatureUsageResponse {
  featureKey: FeatureKey;
  enabled: boolean;
  limit: number;
  used: number;
}

@Injectable({ providedIn: 'root' })
export class FeatureAccessService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly enabledFeaturesSignal = signal<ReadonlySet<FeatureKey> | null>(null);

  readonly loaded = () => this.enabledFeaturesSignal() !== null;

  load(): Observable<void> {
    const base = this.auth.currentUser()?.role === 'MEMBER' ? 'member' : 'admin';
    return this.http.get<ApiResponse<FeatureUsageResponse[]>>(`${environment.apiBaseUrl}/${base}/features`).pipe(
      tap((response) => {
        const enabled = new Set(response.data.filter((f) => f.enabled).map((f) => f.featureKey));
        this.enabledFeaturesSignal.set(enabled);
      }),
      map(() => undefined),
      catchError(() => {
        // Fail open: if the features endpoint is unreachable, leave state unloaded so isEnabled()
        // defaults to true rather than hiding every feature because of a transient network error.
        // The backend still enforces the real check on each list/create call regardless.
        return of(undefined);
      })
    );
  }

  reset(): void {
    this.enabledFeaturesSignal.set(null);
  }

  isEnabled(key: FeatureKey | undefined): boolean {
    if (!key) {
      return true;
    }
    const enabled = this.enabledFeaturesSignal();
    if (enabled === null) {
      return true;
    }
    return enabled.has(key);
  }
}
