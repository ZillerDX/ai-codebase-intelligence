import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'CodePulse - Understand any codebase in minutes',
    loadComponent: () => import('./pages/welcome').then((m) => m.Welcome),
  },
  {
    path: 'r/:owner/:repo',
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Overview - CodePulse',
        loadComponent: () => import('./pages/overview').then((m) => m.Overview),
      },
      {
        path: 'architecture',
        title: 'How it is built - CodePulse',
        loadComponent: () => import('./pages/architecture').then((m) => m.Architecture),
      },
      {
        path: 'docs',
        title: 'Documentation - CodePulse',
        loadComponent: () => import('./pages/docs').then((m) => m.Docs),
      },
      {
        path: 'security',
        title: 'Security issues - CodePulse',
        loadComponent: () => import('./pages/security').then((m) => m.Security),
      },
      {
        path: 'debt',
        title: 'Technical debt - CodePulse',
        loadComponent: () => import('./pages/debt').then((m) => m.Debt),
      },
      {
        path: 'what-if',
        title: 'What if I change a file? - CodePulse',
        loadComponent: () => import('./pages/what-if').then((m) => m.WhatIf),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
