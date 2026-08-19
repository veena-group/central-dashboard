import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { AuthService } from './auth.service';

const DEFAULT_BRAND = 'Veena Group';

@Injectable({ providedIn: 'root' })
export class SocietyTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly auth = inject(AuthService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    const brand = this.auth.currentUser()?.societyName ?? DEFAULT_BRAND;
    this.title.setTitle(pageTitle ? `${brand} | ${pageTitle}` : `${brand} | Society Dashboard`);
  }
}
