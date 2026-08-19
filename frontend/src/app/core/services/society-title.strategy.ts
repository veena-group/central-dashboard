import { Injectable, Injector, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { AuthService } from './auth.service';

const DEFAULT_BRAND = 'Veena Group';

@Injectable({ providedIn: 'root' })
export class SocietyTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  // AuthService injects Router, and Router depends on TitleStrategy internally - injecting
  // AuthService directly here would create Router -> TitleStrategy -> AuthService -> Router.
  // Injector defers resolution until updateTitle() actually runs (after Router already
  // exists), which breaks the cycle.
  private readonly injector = inject(Injector);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    const auth = this.injector.get(AuthService);
    const brand = auth.currentUser()?.societyName ?? DEFAULT_BRAND;
    this.title.setTitle(pageTitle ? `${brand} | ${pageTitle}` : `${brand} | Society Dashboard`);
  }
}
