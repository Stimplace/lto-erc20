import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RouterModule, Routes } from '@angular/router';

import { MatCardModule } from '@angular/material/card';

import { HomeComponent } from '@app/pages/home';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
];

@NgModule({
  declarations: [HomeComponent],
  imports: [CommonModule, RouterModule.forChild(routes), MatCardModule],
  providers: [],
})
export class HomeModule {}
