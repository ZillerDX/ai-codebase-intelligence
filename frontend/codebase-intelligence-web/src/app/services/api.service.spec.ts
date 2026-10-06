import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { BrowserStorageService } from './browser-storage.service';
import { SecuritySmellReportDto } from '../models/codebase.models';

describe('ApiService result provenance', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('passes through the source reported by the backend', () => {
    let result: SecuritySmellReportDto | undefined;
    api.getSecuritySmells('p1').subscribe((r) => (result = r));

    http.expectOne('http://localhost:5080/api/analysis/p1/security-smells').flush({
      projectId: 'p1',
      source: 'fallback',
      totalIssues: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      issues: [],
    });

    expect(result?.source).toBe('fallback');
  });

  it('marks results as offline when the backend call fails', () => {
    let result: SecuritySmellReportDto | undefined;
    api.getSecuritySmells('p1').subscribe((r) => (result = r));

    http
      .expectOne('http://localhost:5080/api/analysis/p1/security-smells')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(result?.source).toBe('offline');
  });

  it('marks offline impact analysis when the backend call fails', () => {
    let source: string | undefined;
    api.analyzeImpact('p1', 'src/A.cs', 'change').subscribe((r) => (source = r.source));

    http
      .expectOne('http://localhost:5080/api/analysis/p1/impact')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(source).toBe('offline');
  });
});

describe('BrowserStorageService result provenance', () => {
  it('labels built-in defaults as sample data', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const storage = TestBed.inject(BrowserStorageService);
    localStorage.removeItem('codepulse_arch_x');

    expect(storage.getArchitecture('x').source).toBe('sample');
    expect(storage.getSecuritySmells('x').source).toBe('sample');
    expect(storage.getDocumentation('x').source).toBe('sample');
    expect(storage.getTechnicalDebt('x').source).toBe('sample');
  });
});
