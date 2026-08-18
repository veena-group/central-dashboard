import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexPlotOptions } from 'ng-apexcharts';
import { MemberApiService } from '../../../core/services/member-api.service';
import { StatCardComponent } from '../../../shared/stat-card/stat-card.component';
import { IconComponent } from '../../../shared/icon/icon.component';

interface NoticeRow {
  id: number;
  title: string;
  categoryName: string | null;
  publishOn: string;
}

interface MeetingRow {
  id: number;
  title: string;
  meetingDate: string;
  status: string;
}

@Component({
  selector: 'app-member-home',
  imports: [StatCardComponent, IconComponent, NgApexchartsModule, RouterLink],
  templateUrl: './member-home.component.html'
})
export class MemberHomeComponent {
  private readonly api = inject(MemberApiService);

  readonly loading = signal(true);
  readonly noticeCount = signal(0);
  readonly documentCount = signal(0);
  readonly formCount = signal(0);
  readonly meetingCount = signal(0);
  readonly allNotices = signal<NoticeRow[]>([]);
  readonly noticeCategoryFilter = signal('');
  readonly upcomingMeetings = signal<MeetingRow[]>([]);

  readonly noticeCategoryOptions = computed(() =>
    Array.from(new Set(this.allNotices().map((n) => n.categoryName).filter((c): c is string => !!c))));

  readonly recentNotices = computed(() => {
    const filter = this.noticeCategoryFilter();
    const all = this.allNotices();
    return (filter ? all.filter((n) => n.categoryName === filter) : all).slice(0, 5);
  });

  readonly chartSeries: ApexAxisChartSeries = [{ name: 'Total', data: [] }];
  readonly chartOptions: ApexChart = { type: 'bar', height: 280, width: '100%', toolbar: { show: false }, fontFamily: 'Inter, sans-serif', redrawOnParentResize: false };
  readonly plotOptions: ApexPlotOptions = { bar: { borderRadius: 8, columnWidth: '46%', distributed: true } };
  readonly chartColors = ['#2563EB', '#16A34A', '#0F766E', '#D97706'];
  readonly chartLabels: string[] = ['Notices', 'Documents', 'Forms', 'Meetings'];
  readonly xaxis: ApexXAxis = { categories: this.chartLabels };

  constructor() {
    forkJoin({
      notices: this.api.list<NoticeRow>('/notices'),
      documents: this.api.list<unknown>('/documents'),
      forms: this.api.list<unknown>('/forms'),
      meetings: this.api.list<MeetingRow>('/meetings')
    }).subscribe({
      next: ({ notices, documents, forms, meetings }) => {
        this.noticeCount.set(notices.length);
        this.documentCount.set(documents.length);
        this.formCount.set(forms.length);
        this.meetingCount.set(meetings.length);
        this.allNotices.set(notices);
        this.upcomingMeetings.set(meetings.filter((m) => m.status === 'UPCOMING').slice(0, 5));
        this.chartSeries[0].data = [
          this.noticeCount(),
          this.documentCount(),
          this.formCount(),
          this.meetingCount()
        ];
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setNoticeCategoryFilter(value: string): void {
    this.noticeCategoryFilter.set(value);
  }
}
