import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AppComponent } from './app.component';
import { ImageScanComponent } from './image-scan/image-scan.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'video-scan', component: AppComponent },
  { path: 'image-scan', component: ImageScanComponent }
];
