import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { LayoutStateService } from '../layout-state.service';
import { AuthService } from '../../core/services/auth.service';
import { FeatureAccessService } from '../../core/services/feature-access.service';
import { getNavGroups } from '../nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  protected readonly layoutState = inject(LayoutStateService);
  private readonly auth = inject(AuthService);
  private readonly featureAccess = inject(FeatureAccessService);

  protected readonly navGroups = computed(() => {
    const groups = getNavGroups(this.auth.currentUser()?.role);
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => this.featureAccess.isEnabled(item.featureKey))
      }))
      .filter((group) => group.items.length > 0);
  });
}
