import { Component, DestroyRef, SimpleChanges, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-secure-image',
  templateUrl: './secure-image.component.html'
})
export class SecureImageComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly src = input.required<string>();
  readonly alt = input('');
  readonly cssClass = input('');

  readonly objectUrl = signal<string | null>(null);
  readonly failed = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.revoke());
  }

  ngOnInit(): void {
    this.loadImage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && !changes['src'].firstChange) {
      this.loadImage();
    }
  }

  private loadImage(): void {
    this.failed.set(false);
    this.objectUrl.set(null);
    this.http.get(this.src(), { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.revoke();
        this.objectUrl.set(URL.createObjectURL(blob));
      },
      error: () => this.failed.set(true)
    });
  }

  private revoke(): void {
    const current = this.objectUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
  }
}
