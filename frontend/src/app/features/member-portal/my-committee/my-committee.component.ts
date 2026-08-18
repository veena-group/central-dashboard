import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { MemberApiService } from '../../../core/services/member-api.service';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

interface CommitteeRow {
  id: number;
  name: string;
  designation: string;
  flat: string | null;
  phone: string | null;
  email: string | null;
  servingSince: string | null;
  photoUrl: string | null;
}

@Component({
  selector: 'app-my-committee',
  imports: [AvatarComponent, IconComponent, PaginationComponent, ReactiveFormsModule],
  templateUrl: './my-committee.component.html'
})
export class MyCommitteeComponent {
  private static readonly PAGE_SIZE = 5;

  private readonly api = inject(MemberApiService);

  readonly loading = signal(true);
  readonly rows = signal<CommitteeRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.load(0);
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.listPaged<CommitteeRow>('/committee', page, MyCommitteeComponent.PAGE_SIZE, {
      search: this.searchControl.value.trim() || undefined
    }).subscribe({
      next: (data) => {
        this.rows.set(data.content);
        this.page.set(data.page);
        this.totalPages.set(data.totalPages);
        this.first.set(data.first);
        this.last.set(data.last);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  hasActiveFilters(): boolean {
    return !!this.searchControl.value.trim();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.load(0);
  }
}
