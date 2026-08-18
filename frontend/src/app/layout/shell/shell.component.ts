import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { LayoutStateService } from '../layout-state.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  protected readonly layoutState = inject(LayoutStateService);

  protected readonly contentMarginLeft = computed(() =>
    this.layoutState.sidebarCollapsed() ? '72px' : '260px'
  );
}
