import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexPlotOptions } from 'ng-apexcharts';
import { SuperAdminApiService } from '../../../core/services/super-admin-api.service';
import { StatCardComponent } from '../../../shared/stat-card/stat-card.component';

@Component({
  selector: 'app-super-admin-dashboard',
  imports: [NgApexchartsModule, StatCardComponent, RouterLink],
  templateUrl: './super-admin-dashboard.component.html'
})
export class SuperAdminDashboardComponent {
  private readonly api = inject(SuperAdminApiService);

  readonly loading = signal(true);
  readonly totalSocieties = signal(0);
  readonly subscriptionsPaidUp = signal(0);
  readonly hostingExpiringSoon = signal(0);
  readonly hostingExpired = signal(0);

  readonly chartSeries: ApexAxisChartSeries = [{ name: 'Societies', data: [] }];
  readonly chartOptions: ApexChart = { type: 'bar', height: 280, width: '100%', toolbar: { show: false }, fontFamily: 'Inter, sans-serif', redrawOnParentResize: false };
  readonly plotOptions: ApexPlotOptions = { bar: { borderRadius: 8, columnWidth: '46%', distributed: true } };
  readonly chartColors = ['#16A34A', '#F59E0B', '#DC2626'];
  readonly chartLabels = signal<string[]>(['Paid Up', 'Due Soon', 'Overdue']);
  readonly xaxis = computed<ApexXAxis>(() => ({ categories: this.chartLabels() }));

  constructor() {
    this.api.getStats().subscribe({
      next: (stats) => {
        this.totalSocieties.set(stats.totalSocieties);
        this.subscriptionsPaidUp.set(stats.subscriptionsPaidUp);
        this.hostingExpiringSoon.set(stats.hostingExpiringSoon);
        this.hostingExpired.set(stats.hostingExpired);
        this.chartSeries[0].data = [
          stats.subscriptionsPaidUp,
          stats.subscriptionsDueSoon,
          stats.subscriptionsOverdue
        ];
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
