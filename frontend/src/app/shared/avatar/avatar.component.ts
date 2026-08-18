import { Component, computed, inject, input } from '@angular/core';
import { SecureImageComponent } from '../secure-image/secure-image.component';
import { MediaUrlService } from '../../core/services/media-url.service';

const GRADIENTS = [
  'from-violet-400 to-violet-600',
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600'
];

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-[70px] h-[70px] text-xl'
};

@Component({
  selector: 'app-avatar',
  imports: [SecureImageComponent],
  templateUrl: './avatar.component.html'
})
export class AvatarComponent {
  private readonly mediaUrl = inject(MediaUrlService);

  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  protected readonly sizeClass = computed(() => SIZE_CLASSES[this.size()]);
  protected readonly resolvedImageUrl = computed(() => this.mediaUrl.resolve(this.imageUrl()));

  protected readonly initials = computed(() =>
    this.name()
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  );

  protected readonly gradient = computed(() => {
    const code = this.name().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return GRADIENTS[code % GRADIENTS.length];
  });
}
