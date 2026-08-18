import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutStateService {
  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);

  toggleSidebar(): void {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      this.sidebarCollapsed.update((value) => !value);
    } else {
      this.mobileSidebarOpen.update((value) => !value);
    }
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }
}
