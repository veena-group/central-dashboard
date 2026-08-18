import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MediaUrlService {
  resolve(pathOrUrl: string | null | undefined): string | null {
    if (!pathOrUrl) {
      return null;
    }

    const trimmed = pathOrUrl.trim();
    if (!trimmed) {
      return null;
    }

    if (this.isAbsoluteOrSpecial(trimmed) || trimmed.startsWith('/api/')) {
      return trimmed;
    }

    const relativePath = trimmed.replace(/^\/+/, '');
    return `${environment.apiBaseUrl}/files/view?path=${encodeURIComponent(relativePath)}`;
  }

  private isAbsoluteOrSpecial(value: string): boolean {
    return (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('data:') ||
      value.startsWith('blob:')
    );
  }
}
