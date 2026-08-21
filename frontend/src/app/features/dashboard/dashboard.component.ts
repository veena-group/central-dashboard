import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexPlotOptions } from 'ng-apexcharts';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../../core/models/api-response.model';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { FeatureAccessService, FeatureKey } from '../../core/services/feature-access.service';

function emptyPage<T>(): ApiResponse<PageResponse<T>> {
  return {
    success: true,
    message: '',
    timestamp: '',
    data: { content: [], page: 0, size: 0, totalElements: 0, totalPages: 0, first: true, last: true }
  };
}

function emptyList<T>(): ApiResponse<T[]> {
  return { success: true, message: '', timestamp: '', data: [] };
}

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

type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'ONGOING';

@Component({
  selector: 'app-dashboard',
  imports: [NgApexchartsModule, StatCardComponent, IconComponent, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly http = inject(HttpClient);
  private readonly featureAccess = inject(FeatureAccessService);

  readonly showMembers = computed(() => this.featureAccess.isEnabled('MEMBERS'));
  readonly showNotices = computed(() => this.featureAccess.isEnabled('NOTICES'));
  readonly showDocuments = computed(() => this.featureAccess.isEnabled('DOCUMENTS'));
  readonly showMeetings = computed(() => this.featureAccess.isEnabled('MEETINGS'));

  readonly loading = signal(true);
  readonly memberCount = signal(0);
  readonly noticeCount = signal(0);
  readonly documentCount = signal(0);
  readonly meetingCount = signal(0);
  readonly eventCount = signal(0);
  readonly allRecentNotices = signal<NoticeRow[]>([]);
  readonly noticeCategoryFilter = signal('');
  readonly upcomingMeetings = signal<MeetingRow[]>([]);

  readonly noticeCategoryOptions = computed(() =>
    Array.from(new Set(this.allRecentNotices().map((n) => n.categoryName).filter((c): c is string => !!c))));

  readonly recentNotices = computed(() => {
    const filter = this.noticeCategoryFilter();
    const all = this.allRecentNotices();
    return (filter ? all.filter((n) => n.categoryName === filter) : all).slice(0, 5);
  });

  readonly chartSeries: ApexAxisChartSeries = [{ name: 'Total', data: [] }];
  readonly chartOptions: ApexChart = { type: 'bar', height: 280, width: '100%', toolbar: { show: false }, fontFamily: 'Inter, sans-serif', redrawOnParentResize: false };
  readonly plotOptions: ApexPlotOptions = { bar: { borderRadius: 8, columnWidth: '46%', distributed: true } };
  readonly chartColors = ['#0F766E', '#2563EB', '#16A34A', '#D97706', '#DB2777'];
  readonly chartLabels: string[] = ['Members', 'Notices', 'Documents', 'Meetings', 'Events'];
  readonly xaxis: ApexXAxis = { categories: this.chartLabels };

  constructor() {
    const base = environment.apiBaseUrl;
    const isEnabled = (key: FeatureKey) => this.featureAccess.isEnabled(key);
    const pageIfEnabled = (key: FeatureKey, url: string) =>
      isEnabled(key) ? this.http.get<ApiResponse<PageResponse<unknown>>>(url) : of(emptyPage<unknown>());

    forkJoin({
      members: pageIfEnabled('MEMBERS', `${base}/admin/members?page=0&size=1`),
      notices: pageIfEnabled('NOTICES', `${base}/admin/notices?page=0&size=1`),
      recentNotices: isEnabled('NOTICES')
        ? this.http.get<ApiResponse<NoticeRow[]>>(`${base}/admin/notices/recent?limit=20`)
        : of(emptyList<NoticeRow>()),
      documents: pageIfEnabled('DOCUMENTS', `${base}/admin/documents?page=0&size=1`),
      meetings: pageIfEnabled('MEETINGS', `${base}/admin/meetings?page=0&size=1`),
      upcomingMeetings: isEnabled('MEETINGS')
        ? this.http.get<ApiResponse<MeetingRow[]>>(`${base}/admin/meetings/upcoming?limit=5`)
        : of(emptyList<MeetingRow>()),
      events: pageIfEnabled('EVENTS', `${base}/admin/events?page=0&size=1`)
    }).subscribe({
      next: ({ members, notices, recentNotices, documents, meetings, upcomingMeetings, events }) => {
        this.memberCount.set(members.data.totalElements);
        this.noticeCount.set(notices.data.totalElements);
        this.documentCount.set(documents.data.totalElements);
        this.meetingCount.set(meetings.data.totalElements);
        this.allRecentNotices.set(recentNotices.data);
        this.upcomingMeetings.set(upcomingMeetings.data);
        this.eventCount.set(events.data.totalElements);
        this.chartSeries[0].data = [
          this.memberCount(),
          this.noticeCount(),
          this.documentCount(),
          this.meetingCount(),
          this.eventCount()
        ];
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setNoticeCategoryFilter(value: string): void {
    this.noticeCategoryFilter.set(value);
  }

  meetingStatusClass(status: string): string {
    const normalized = status?.toUpperCase() as MeetingStatus;
    switch (normalized) {
      case 'COMPLETED':
        return 'badge badge-soft-success';
      case 'CANCELLED':
        return 'badge badge-soft-danger';
      case 'ONGOING':
        return 'badge badge-soft-info';
      case 'SCHEDULED':
      default:
        return 'badge badge-soft-warning';
    }
  }

  noticeCategoryClass(categoryName: string | null): string {
    if (!categoryName) {
      return 'badge badge-soft-secondary';
    }
    const key = categoryName.toLowerCase();
    if (key.includes('urgent') || key.includes('emergency')) {
      return 'badge badge-soft-danger';
    }
    if (key.includes('event') || key.includes('festival')) {
      return 'badge badge-soft-info';
    }
    if (key.includes('maintenance') || key.includes('service')) {
      return 'badge badge-soft-warning';
    }
    return 'badge badge-soft-primary';
  }
}
