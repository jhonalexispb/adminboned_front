import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import {
  BadgeComponent, ButtonDirective,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  ColComponent, GutterDirective, ProgressComponent, RowComponent, SpinnerComponent,
  ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { DashboardService } from './dashboard.service';
import { DashboardData } from './dashboard.model';

@Component({
  templateUrl: 'dashboard.component.html',
  styleUrls: ['dashboard.component.scss'],
  imports: [
    DecimalPipe, RouterLink,
    RowComponent, ColComponent, GutterDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, ProgressComponent, SpinnerComponent, ButtonDirective,
    IconDirective,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    ChartjsComponent
  ]
})
export class DashboardComponent implements OnInit {
  loading = signal(true);
  data    = signal<DashboardData | null>(null);

  infoModal = signal<{ title: string; text: string } | null>(null);

  downloadingPdf = signal(false);

  chartData   = signal<ChartData | null>(null);
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

  constructor(private service: DashboardService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.service.get().subscribe({
      next: d => {
        this.data.set(d);
        this.buildChart(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private buildChart(d: DashboardData): void {
    this.chartData.set({
      labels: d.chart.labels.map(n => String(n)),
      datasets: [
        {
          label: 'Ventas S/',
          data: d.chart.ventas,
          backgroundColor: 'rgba(50, 131, 255, 0.7)',
          borderColor: 'rgba(50, 131, 255, 1)',
          borderWidth: 1,
          type: 'bar',
        },
        {
          label: `Meta S/ ${d.meta_diaria.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          data: d.chart.meta,
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

  showInfo(title: string, text: string): void {
    this.infoModal.set({ title, text });
  }

  closeInfo(): void {
    this.infoModal.set(null);
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.downloadPdf().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `dashboard-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false)
    });
  }

  metaMensualInfo(d: DashboardData): string {
    const metaDiaria = d.meta_diaria.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `Se calcula sola: tu meta diaria (S/ ${metaDiaria}) × los ${d.chart.labels.length} días de este mes. No la configuras aparte — ajusta la meta diaria y esta se actualiza.`;
  }

  promedioDiarioInfo(d: DashboardData): string {
    const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const margen = d.mes.margen_real !== null
      ? `tu margen real estimado este mes es de ${d.mes.margen_real.toFixed(1)}% (gastos S/ ${fmt(d.mes.gastos)})`
      : 'aún no hay suficientes ventas para estimar tu margen real este mes';
    return `Ventas netas del mes ÷ días transcurridos. Es un acumulado: los días flojos que ya pasaron pesan en este número y no se pueden cambiar — por eso lo importante es lo que sí está en tus manos: te quedan ${d.proyeccion.dias_restantes} días del mes; de aquí en adelante necesitas vender S/ ${fmt(d.proyeccion.necesario_diario_equilibrio)}/día para no perder, o S/ ${fmt(d.proyeccion.necesario_diario_meta)}/día para llegar a tu meta. Además, ${margen}.`;
  }

  get metaProgress(): number {
    const d = this.data();
    if (!d) return 0;
    return Math.min(100, Math.round((d.hoy.ventas / d.meta_diaria) * 100));
  }

  get metaMensualProgress(): number {
    const d = this.data();
    if (!d || !d.meta_mensual) return 0;
    return Math.min(100, Math.round((d.mes.ventas / d.meta_mensual) * 100));
  }

  get estadoColor(): string {
    switch (this.data()?.estado.nivel) {
      case 'bien':     return 'success';
      case 'atencion': return 'warning';
      case 'cuidado':  return 'danger';
      default:         return 'secondary';
    }
  }

  get estadoIcono(): string {
    switch (this.data()?.estado.nivel) {
      case 'bien':     return 'cilCheckCircle';
      case 'atencion': return 'cilWarning';
      case 'cuidado':  return 'cilXCircle';
      default:         return 'cilSpeedometer';
    }
  }

  get estadoTitulo(): string {
    switch (this.data()?.estado.nivel) {
      case 'bien':     return 'Vas bien';
      case 'atencion': return 'Atención';
      case 'cuidado':  return 'Cuidado';
      default:         return 'Aún sin datos suficientes';
    }
  }

  get ratioColor(): string {
    const r = this.data()?.mes.ratio_vs_anterior;
    if (r === null || r === undefined) return 'secondary';
    if (r <= 0.80) return 'success';
    if (r <= 1.00) return 'warning';
    return 'danger';
  }

  get ratioLabel(): string {
    const r = this.data()?.mes.ratio_vs_anterior;
    if (r === null || r === undefined) return 'Sin datos del mes anterior';
    if (r <= 0.80) return 'Bajo control';
    if (r <= 1.00) return 'Precaución';
    return 'Sobrecompra';
  }

  get gananciaColor(): string {
    const g = this.data()?.mes.ganancia ?? 0;
    return g >= 0 ? 'success' : 'danger';
  }
}
