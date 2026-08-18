import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, input, output } from '@angular/core';
import { defineElement } from '@lordicon/element';

type ConfirmIconTone = 'danger' | 'warning' | 'info';

let lordIconRegistered = false;

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ConfirmModalComponent {
  readonly open = input(false);
  readonly title = input('Confirm action');
  readonly description = input<string | null>(null);
  readonly message = input('Are you sure you want to continue?');
  readonly iconTone = input<ConfirmIconTone>('danger');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly confirming = input(false);

  readonly resolvedDescription = computed(() => this.description() ?? this.message());
  readonly iconSrc = computed(() => {
    if (this.iconTone() === 'danger') {
      return 'https://cdn.lordicon.com/xyfswyxf.json';
    }

    if (this.iconTone() === 'warning') {
      return 'https://cdn.lordicon.com/gsqxdxog.json';
    }

    return 'https://cdn.lordicon.com/qjwkduhc.json';
  });

  readonly confirmAction = output<void>();
  readonly cancelAction = output<void>();

  constructor() {
    if (!lordIconRegistered) {
      defineElement();
      lordIconRegistered = true;
    }
  }
}
