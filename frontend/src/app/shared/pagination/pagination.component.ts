import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html'
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly first = input.required<boolean>();
  readonly last = input.required<boolean>();

  readonly prev = output<void>();
  readonly next = output<void>();
}
