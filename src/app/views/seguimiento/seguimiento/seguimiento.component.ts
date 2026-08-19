import { Component, OnInit, ViewChild, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { CardBodyComponent, CardComponent, CardHeaderComponent, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import { forkJoin } from 'rxjs';
import { TrackingService } from '../tracking.service';
import { TrackedUser, TrackingPoint, AssignedDistrict } from '../tracking.model';
import { TrackingMapComponent } from '../tracking-map/tracking-map.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-seguimiento',
  standalone: true,
  imports: [
    DatePipe, FormsModule, FaIconComponent, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent, SpinnerComponent,
    TrackingMapComponent, PageHeaderComponent,
  ],
  templateUrl: './seguimiento.component.html',
})
export class SeguimientoComponent implements OnInit {
  @ViewChild(TrackingMapComponent) map?: TrackingMapComponent;

  users   = signal<TrackedUser[]>([]);
  loading = signal(false);
  points  = signal<TrackingPoint[]>([]);
  assignedDistricts = signal<AssignedDistrict[]>([]);
  provinceNames = computed(() =>
    [...new Set(this.assignedDistricts().map(d => d.province_name).filter((n): n is string => !!n))]
  );

  selectedUserId: number | null = null;
  selectedDate = new Date().toISOString().slice(0, 10);

  constructor(private svc: TrackingService) {}

  ngOnInit(): void {
    this.svc.trackedUsers().subscribe({
      next: u => {
        this.users.set(u);
        if (u.length && !this.selectedUserId) {
          this.selectedUserId = u[0].id;
          this.search();
        }
      },
    });
  }

  search(): void {
    if (!this.selectedUserId) return;
    this.loading.set(true);
    forkJoin({
      route: this.svc.route(this.selectedUserId, this.selectedDate),
      district: this.svc.districtCheck(this.selectedUserId, this.selectedDate),
    }).subscribe({
      next: ({ route, district }) => {
        this.points.set(route);
        this.assignedDistricts.set(district.assigned_districts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
