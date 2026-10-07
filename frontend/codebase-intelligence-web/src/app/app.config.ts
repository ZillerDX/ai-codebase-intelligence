import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (/#/r/owner/repo) keep deep links and refresh working on GitHub Pages without a server fallback.
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
  ],
};
