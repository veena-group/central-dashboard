import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { CurrentUser, LoginRequest, LoginResponse } from '../models/auth.model';
import { MyProfileResponse } from '../models/profile.model';
import { MediaUrlService } from './media-url.service';

const TOKEN_KEY = 'cd_token';
const REFRESH_TOKEN_KEY = 'cd_refresh_token';
const USER_KEY = 'cd_user';
const DEFAULT_FAVICON = 'favicon.ico';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly mediaUrl = inject(MediaUrlService);

  private readonly currentUserSignal = signal<CurrentUser | null>(this.readUserFromStorage());
  private faviconObjectUrl: string | null = null;

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor() {
    this.applyBranding(this.currentUserSignal());
  }

  login(request: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${environment.apiBaseUrl}/auth/login`, request).pipe(
      tap((response) => this.persistSession(response.data))
    );
  }

  /**
   * Accepts a LoginResponse obtained by a tenant site's own login page (which calls
   * /api/auth/login directly, cross-origin) and handed off via the /auth/callback route.
   * Persists it exactly like a normal in-app login.
   */
  restoreExternalSession(response: LoginResponse): void {
    this.persistSession(response);
  }

  logout(): void {
    // Fire-and-forget: revokes the token server-side (see AuthController.logout), but local
    // logout must still succeed immediately even if this call fails (offline, expired token, etc).
    this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}).subscribe({ error: () => {} });

    const societyDomain = this.currentUserSignal()?.societyDomain;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSignal.set(null);
    this.applyBranding(null);

    // Members/admins came in from their own tenant site (see AuthCallbackComponent) — send
    // them back there. Super admins have no tenant site, so fall back to the local login page.
    // `societyDomain` is expected to be a bare host (e.g. "lloyds.com"), matching what the
    // backend's domain-validation check compares against - but tolerate a full URL too (e.g.
    // "http://localhost:5173" for local dev) instead of double-prefixing it with "https://".
    if (societyDomain) {
      const target = societyDomain.includes('://') ? societyDomain : `https://${societyDomain}`;
      window.location.href = target;
    } else {
      this.router.navigateByUrl('/login');
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  syncCurrentUserFromProfile(profile: MyProfileResponse): void {
    const current = this.currentUserSignal();
    if (!current) {
      return;
    }
    const updated: CurrentUser = {
      ...current,
      name: profile.name,
      email: profile.email,
      photoUrl: profile.photoUrl
    };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    this.currentUserSignal.set(updated);
    this.applyBranding(updated);
  }

  private persistSession(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    const user: CurrentUser = {
      userId: response.userId,
      name: response.name,
      email: response.email,
      photoUrl: response.photoUrl,
      societyName: response.societyName,
      societyLogoUrl: response.societyLogoUrl,
      primaryColor: response.primaryColor,
      secondaryColor: response.secondaryColor,
      role: response.role,
      societyId: response.societyId,
      societyDomain: response.societyDomain
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUserSignal.set(user);
    this.applyBranding(user);
  }

  private readUserFromStorage(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as CurrentUser;
    } catch {
      return null;
    }
  }

  private applyBranding(user: CurrentUser | null): void {
    const root = document.documentElement;
    const primary = this.normalizeColor(user?.primaryColor) ?? '#0F766E';
    const secondary = this.normalizeColor(user?.secondaryColor) ?? '#F59E0B';
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-foreground', this.getContrastColor(primary));
    root.style.setProperty('--secondary', secondary);
    root.style.setProperty('--secondary-foreground', this.getContrastColor(secondary));
    this.applyFavicon(user);
  }

  /**
   * Society logos are served via the authenticated /api/files/view endpoint (MediaUrlService),
   * so a plain <link rel="icon" href="..."> can't load them directly - the browser won't attach
   * the auth token to that request. Fetch it the same way SecureImageComponent does (blob via
   * HttpClient) and point the favicon at the resulting object URL instead.
   */
  private applyFavicon(user: CurrentUser | null): void {
    const resolvedUrl = this.mediaUrl.resolve(user?.societyLogoUrl);
    if (!resolvedUrl) {
      this.setFaviconHref(DEFAULT_FAVICON);
      this.revokeFaviconObjectUrl();
      return;
    }
    this.http.get(resolvedUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const previous = this.faviconObjectUrl;
        this.faviconObjectUrl = URL.createObjectURL(blob);
        this.setFaviconHref(this.faviconObjectUrl);
        if (previous) {
          URL.revokeObjectURL(previous);
        }
      },
      error: () => this.setFaviconHref(DEFAULT_FAVICON)
    });
  }

  private setFaviconHref(href: string): void {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  private revokeFaviconObjectUrl(): void {
    if (this.faviconObjectUrl) {
      URL.revokeObjectURL(this.faviconObjectUrl);
      this.faviconObjectUrl = null;
    }
  }

  private normalizeColor(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
  }

  private getContrastColor(hex: string): string {
    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    return luminance > 0.6 ? '#111827' : '#FFFFFF';
  }
}
