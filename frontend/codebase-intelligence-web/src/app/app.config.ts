import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (/#/r/owner/repo) keep deep links and refresh working on any static host without redirect rules.
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
  ],
};
