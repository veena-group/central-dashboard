import { Component, input } from '@angular/core';

export type IconName =
  | 'dashboard' | 'members' | 'notices' | 'documents' | 'forms' | 'committee'
  | 'meetings' | 'gallery' | 'categories' | 'profile' | 'logout' | 'search'
  | 'bell' | 'mail' | 'chevron-right' | 'menu' | 'user' | 'building' | 'trend-up'
  | 'download' | 'eye' | 'eye-off' | 'edit' | 'trash' | 'plus' | 'credit-card' | 'phone'
  | 'events';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html'
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}
