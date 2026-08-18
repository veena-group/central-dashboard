import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { ClickOutsideDirective } from '../../shared/click-outside/click-outside.directive';
import { LayoutStateService } from '../layout-state.service';
import { AuthService } from '../../core/services/auth.service';
import { MediaUrlService } from '../../core/services/media-url.service';
import { SecureImageComponent } from '../../shared/secure-image/secure-image.component';

@Component({
  selector: 'app-topbar',
  imports: [IconComponent, AvatarComponent, ClickOutsideDirective, SecureImageComponent],
  templateUrl: './topbar.component.html'
})
export class TopbarComponent {
  protected readonly layoutState = inject(LayoutStateService);
  protected readonly auth = inject(AuthService);
  protected readonly mediaUrl = inject(MediaUrlService);
  private readonly router = inject(Router);

  protected readonly profileOpen = signal(false);

  toggleProfile(): void {
    this.profileOpen.update((v) => !v);
  }

  goToProfile(): void {
    this.profileOpen.set(false);
    this.router.navigateByUrl('/profile');
  }

  logout(): void {
    this.profileOpen.set(false);
    this.auth.logout();
  }
}
