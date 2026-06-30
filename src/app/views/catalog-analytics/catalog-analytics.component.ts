import { Component, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import {
  CardBodyComponent, CardComponent, CardHeaderComponent,
  ColComponent, GutterDirective, RowComponent, SpinnerComponent,
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { CatalogAnalyticsService, CatalogAnalyticsData } from './catalog-analytics.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-catalog-analytics',
  standalone: true,
  imports: [
    DecimalPipe, KeyValuePipe, FormsModule,
    RowComponent, ColComponent, GutterDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, ChartjsComponent,
    PageHeaderComponent,
  ],
  templateUrl: './catalog-analytics.component.html',
})
export class CatalogAnalyticsComponent implements OnInit {
  loading = signal(true);
  data    = signal<CatalogAnalyticsData | null>(null);
  days    = signal(30);

  readonly periodOptions = [
    { value: 7,  label: 'Últimos 7 días' },
    { value: 30, label: 'Últimos 30 días' },
    { value: 90, label: 'Últimos 90 días' },
  ];

  // ── Gráfica: sesiones por día ─────────────────────────────────────────────

  dailyChartData = computed<ChartData | null>(() => {
    const d = this.data();
    if (!d) return null;
    return {
      labels: d.daily.labels,
      datasets: [{
        label: 'Sesiones',
        data: d.daily.data,
        borderColor: 'rgba(50, 131, 255, 1)',
        backgroundColor: 'rgba(50, 131, 255, 0.15)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.3,
      }],
    };
  });

  dailyChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 10, maxRotation: 0 } },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  dailyMinWidth = computed(() => {
    const count = this.data()?.daily.labels.length ?? 0;
    return count > 20 ? `${count * 38}px` : '100%';
  });

  // ── Gráfica: dispositivos (doughnut) ─────────────────────────────────────

  deviceChartData = computed<ChartData | null>(() => {
    const d = this.data();
    if (!d) return null;
    const labels: string[] = [];
    const values: number[] = [];
    const colorMap: Record<string, string> = {
      mobile:  'rgba(50, 131, 255, 0.8)',
      desktop: 'rgba(111, 66, 193, 0.8)',
      tablet:  'rgba(255, 193, 7, 0.8)',
    };
    const labelMap: Record<string, string> = {
      mobile: 'Celular', desktop: 'Computadora', tablet: 'Tablet',
    };
    for (const [k, v] of Object.entries(d.by_device)) {
      labels.push(labelMap[k] ?? k);
      values.push(v as number);
    }
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => {
          const key = Object.keys(d.by_device)[i];
          return colorMap[key] ?? 'rgba(128,128,128,0.8)';
        }),
        borderWidth: 2,
      }],
    };
  });

  deviceChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  // ── Gráfica: hora del día ─────────────────────────────────────────────────

  hourChartData = computed<ChartData | null>(() => {
    const d = this.data();
    if (!d) return null;
    return {
      labels: d.by_hour.labels,
      datasets: [{
        label: 'Sesiones',
        data: d.by_hour.data,
        backgroundColor: d.by_hour.data.map(v => {
          const max = Math.max(...d.by_hour.data);
          return v === max ? 'rgba(50, 131, 255, 0.9)' : 'rgba(50, 131, 255, 0.4)';
        }),
        borderRadius: 4,
        borderWidth: 0,
      }],
    };
  });

  hourChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  // ── Stats helpers ─────────────────────────────────────────────────────────

  pctMobile = computed(() => {
    const d = this.data();
    if (!d || !d.total_sessions) return 0;
    return Math.round(((d.by_device['mobile'] ?? 0) / d.total_sessions) * 100);
  });

  peakHour = computed(() => {
    const d = this.data();
    if (!d) return '—';
    const idx = d.by_hour.data.indexOf(Math.max(...d.by_hour.data));
    return d.by_hour.labels[idx] ?? '—';
  });

  constructor(private svc: CatalogAnalyticsService) {}

  ngOnInit(): void { this.load(); }

  onDaysChange(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.get(this.days()).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
