import { Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

const VARIANT_CLASSES: Record<'primary' | 'info' | 'success' | 'warning', string> = {
  primary: 'bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm',
  info: 'bg-info/15 text-info ring-1 ring-info/25 shadow-sm',
  success: 'bg-success/15 text-success ring-1 ring-success/25 shadow-sm',
  warning: 'bg-warning/25 text-warning-foreground ring-1 ring-warning/40 shadow-sm'
};

@Component({
  selector: 'app-stat-card',
  imports: [IconComponent],
  templateUrl: './stat-card.component.html'
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<IconName>();
  readonly variant = input<'primary' | 'info' | 'success' | 'warning'>('primary');
  readonly loading = input<boolean>(false);

  protected iconChipClass(): string {
    return VARIANT_CLASSES[this.variant()];
  }
}
