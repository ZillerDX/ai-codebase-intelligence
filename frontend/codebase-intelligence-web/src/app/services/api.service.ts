import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, catchError } from 'rxjs';
import {
  CodebaseProject,
  HighLevelSummaryDto,
  ArchitectureOverviewDto,
  ImpactAnalysisResult,
  SecuritySmellReportDto,
  DocumentationReportDto,
  TechnicalDebtReportDto,
  GitHubRepoSuggestion
} from '../models/codebase.models';
import { BrowserStorageService } from './browser-storage.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private storage = inject(BrowserStorageService);
  private baseUrl = 'http://localhost:5080/api/analysis';

  private isLocalBackend(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  getSamples(): Observable<CodebaseProject[]> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getProjects());
    }
    return this.http.get<CodebaseProject[]>(`${this.baseUrl}/samples`).pipe(
      catchError(() => of(this.storage.getProjects()))
    );
  }

  getSummary(projectId: string): Observable<HighLevelSummaryDto> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getSummary(projectId));
    }
    return this.http.get<HighLevelSummaryDto>(`${this.baseUrl}/${projectId}/summary`).pipe(
      catchError(() => of(this.storage.getSummary(projectId)))
    );
  }

  getFiles(projectId: string): Observable<string[]> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getFiles(projectId));
    }
    return this.http.get<string[]>(`${this.baseUrl}/${projectId}/files`).pipe(
      catchError(() => of(this.storage.getFiles(projectId)))
    );
  }

  getArchitecture(projectId: string): Observable<ArchitectureOverviewDto> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getArchitecture(projectId));
    }
    return this.http.get<ArchitectureOverviewDto>(`${this.baseUrl}/${projectId}/architecture`).pipe(
      catchError(() => of(this.storage.getArchitecture(projectId)))
    );
  }

  analyzeImpact(projectId: string, targetFile: string, proposedChange: string): Observable<ImpactAnalysisResult> {
    if (!this.isLocalBackend()) {
      return of(this.synthesizeOfflineImpact(targetFile, proposedChange));
    }
    return this.http.post<ImpactAnalysisResult>(`${this.baseUrl}/${projectId}/impact`, {
      projectId,
      targetFile,
      proposedChange
    }).pipe(
      catchError(() => of(this.synthesizeOfflineImpact(targetFile, proposedChange)))
    );
  }

  getSecuritySmells(projectId: string): Observable<SecuritySmellReportDto> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getSecuritySmells(projectId));
    }
    return this.http.get<SecuritySmellReportDto>(`${this.baseUrl}/${projectId}/security-smells`).pipe(
      catchError(() => of(this.storage.getSecuritySmells(projectId)))
    );
  }

  getDocumentation(projectId: string): Observable<DocumentationReportDto> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getDocumentation(projectId));
    }
    return this.http.get<DocumentationReportDto>(`${this.baseUrl}/${projectId}/docs`).pipe(
      catchError(() => of(this.storage.getDocumentation(projectId)))
    );
  }

  getTechnicalDebt(projectId: string): Observable<TechnicalDebtReportDto> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getTechnicalDebt(projectId));
    }
    return this.http.get<TechnicalDebtReportDto>(`${this.baseUrl}/${projectId}/technical-debt`).pipe(
      catchError(() => of(this.storage.getTechnicalDebt(projectId)))
    );
  }

  uploadRepository(formData: FormData): Observable<CodebaseProject> {
    return this.http.post<CodebaseProject>(`${this.baseUrl}/upload`, formData);
  }

  importGitHubRepo(repoUrl: string, personalAccessToken?: string, branch?: string): Observable<CodebaseProject> {
    if (!this.isLocalBackend()) {
      return from(this.storage.analyzeGitHubRepositoryClientSide(repoUrl, personalAccessToken, branch));
    }
    return this.http.post<CodebaseProject>(`${this.baseUrl}/github/import`, {
      repoUrl,
      personalAccessToken,
      branch
    }).pipe(
      catchError(() => from(this.storage.analyzeGitHubRepositoryClientSide(repoUrl, personalAccessToken, branch)))
    );
  }

  getPopularTemplates(): Observable<GitHubRepoSuggestion[]> {
    if (!this.isLocalBackend()) {
      return of(this.storage.getPopularTemplates());
    }
    return this.http.get<GitHubRepoSuggestion[]>(`${this.baseUrl}/github/popular-templates`).pipe(
      catchError(() => of(this.storage.getPopularTemplates()))
    );
  }

  private synthesizeOfflineImpact(targetFile: string, proposedChange: string): ImpactAnalysisResult {
    const isCritical = targetFile.includes('Repository') || 
                       targetFile.includes('Program.cs') || 
                       targetFile.includes('EventBus') ||
                       targetFile.includes('DbContext');
    const isMajor = targetFile.includes('Controller') || targetFile.includes('Service');

    const level: 'Critical' | 'High' | 'Medium' | 'Low' = isCritical ? 'Critical' : (isMajor ? 'High' : 'Medium');

    const fileName = targetFile.split('/').pop() || targetFile;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_');

    const diagram = `graph LR
  Target["${cleanFileName} (Target File)"] --> Core["Domain Aggregate Root"]
  Target --> ApiGateway["API Gateway Controller"]
  Core --> DbStore["SQL Database Entities"]
  Core --> Cache["Redis In-Memory State"]
  ApiGateway --> ClientSpa["Angular SPA View Model"]`;

    return {
      targetFile,
      blastRadiusLevel: level,
      affectedComponents: [
        'Domain Aggregate Root',
        'API Controller Endpoints',
        'Data Access Context',
        'Client State Handlers'
      ],
      affectedFiles: [
        targetFile,
        'backend/src/Services/Ordering/Ordering.API/Controllers/OrdersController.cs',
        'backend/src/Services/Ordering/Ordering.Domain/AggregatesModel/OrderAggregate/Order.cs',
        'frontend/src/app/core/services/api.service.ts'
      ],
      breakingChangeRisks: [
        `Modifying "${fileName}" alters domain contract schemas.`,
        'Potential serialization mismatch with client DTO definitions.',
        'High likelihood of transactional regression if database locks are held.'
      ],
      testingRecommendations: [
        `Execute unit tests covering "${fileName}".`,
        'Run end-to-end integration test suites across Ordering and Basket pipelines.',
        'Validate database migration and schema backward-compatibility.'
      ],
      seniorDevAdvice: `Senior Architect Assessment for ${fileName}: Proposed modification "${proposedChange}". Implement changes behind an atomic feature flag. Ensure transactional boundaries and idempotency keys are strictly maintained.`,
      architectureImpactDiagram: diagram
    };
  }
}
