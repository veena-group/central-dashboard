import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoginResponse } from '../../../core/models/auth.model';
import { ROLE_HOME_PATH } from '../../../core/models/role-home';

/**
 * Landing point for the tenant-site login handoff: a tenant's own login page calls
 * /api/auth/login directly (cross-origin), then redirects here with the resulting
 * LoginResponse base64-encoded in the URL fragment (`#session=...`), e.g.
 *   https://dashboard.lloyds.com/auth/callback#session=<base64>
 * Fragments are never sent to the server/logs, unlike query params.
 */
@Component({
  selector: 'app-auth-callback',
  template: `
    @if (errorMessage()) {
      <p>{{ errorMessage() }}</p>
    } @else {
      <p>Signing you in&hellip;</p>
    }
  `
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const encoded = params.get('session');

    if (!encoded) {
      this.fail('Missing session data.');
      return;
    }

    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const response = JSON.parse(json) as LoginResponse;
      this.auth.restoreExternalSession(response);
      this.router.navigateByUrl(ROLE_HOME_PATH[response.role], { replaceUrl: true });
    } catch {
      this.fail('Could not complete sign-in. Please try again.');
    }
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.router.navigateByUrl('/login', { replaceUrl: true }), 2000);
  }
}
