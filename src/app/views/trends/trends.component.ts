import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import {
  CardBodyComponent, CardComponent, CardHeaderComponent,
  ColComponent, GutterDirective, RowComponent, SpinnerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { TrendsService } from './trends.service';
import { TrendsData } from './trends.model';

@Component({
  templateUrl: 'trends.component.html',
  imports: [
    DecimalPipe, FormsModule,
    RowComponent, ColComponent, GutterDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, IconDirective,
    ChartjsComponent
  ]
})
export class TrendsComponent implements OnInit {
  loading = signal(true);
  data    = signal<TrendsData | null>(null);
  year    = signal<number>(new Date().getFullYear());
  mes     = signal<number | null>(null);

  downloadingPdf = signal(false);

  chartData = signal<ChartData | null>(null);
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: ctx => ` S/ ${(ctx.raw as number).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) => `S/ ${Number(v).toLocaleString('es-PE')}`
        }
      }
    }
  };

  constructor(private service: TrendsService) {}

  ngOnInit(): void { this.load(); }

  load(year?: number): void {
    this.loading.set(true);
    this.service.get(year).subscribe({
      next: d => {
        this.data.set(d);
        this.year.set(d.year);
        this.buildChart(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onYearChange(year: number): void {
    this.load(Number(year));
  }

  onMesChange(mes: string): void {
    this.mes.set(mes ? Number(mes) : null);
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.downloadPdf(this.year()).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `tendencias-${this.year()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false)
    });
  }

  get mesesFiltrados() {
    const d = this.data();
    if (!d) return [];
    const mes = this.mes();
    return mes ? d.meses.filter(m => m.mes === mes) : d.meses;
  }

  private buildChart(d: TrendsData): void {
    this.chartData.set({
      labels: d.meses.map(m => m.nombre),
      datasets: [
        {
          label: 'Ventas netas S/',
          data: d.meses.map(m => m.ventas),
          backgroundColor: 'rgba(50, 131, 255, 0.7)',
          borderColor: 'rgba(50, 131, 255, 1)',
          borderWidth: 1,
          type: 'bar',
        },
        {
          label: 'Meta mensual S/',
          data: d.meses.map(m => m.meta_mensual),
          borderColor: 'rgba(255, 99, 132, 0.8)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          type: 'line',
        }
      ]
    });
  }

  get tienePocoHistorial(): boolean {
    const d = this.data();
    if (!d) return false;
    return d.meses.filter(m => m.ventas > 0).length < 3;
  }

  gananciaColor(ganancia: number): string {
    return ganancia >= 0 ? 'text-success' : 'text-danger';
  }
}
