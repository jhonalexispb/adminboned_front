import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrackedUser, TrackingPoint, DistrictCheck } from './tracking.model';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private base = `${environment.apiUrl}/tracking`;

  constructor(private http: HttpClient) {}

  trackedUsers(): Observable<TrackedUser[]> {
    return this.http.get<TrackedUser[]>(`${this.base}/users`);
  }

  route(userId: number, date: string): Observable<TrackingPoint[]> {
    const params = new HttpParams().set('user_id', userId).set('date', date);
    return this.http.get<TrackingPoint[]>(`${this.base}/route`, { params });
  }

  districtCheck(userId: number, date: string): Observable<DistrictCheck> {
    const params = new HttpParams().set('user_id', userId).set('date', date);
    return this.http.get<DistrictCheck>(`${this.base}/district-check`, { params });
  }
}
