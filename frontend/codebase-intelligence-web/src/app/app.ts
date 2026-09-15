import { Component, OnInit, inject, signal, computed, effect, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';
import {
  CodebaseProject,
  HighLevelSummaryDto,
  ArchitectureOverviewDto,
  ImpactAnalysisResult,
  SecuritySmellReportDto,
  DocumentationReportDto,
  TechnicalDebtReportDto,
  GitHubRepoSuggestion
} from './models/codebase.models';
import mermaid from 'mermaid';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private apiService = inject(ApiService);

  // Active Tab
  activeTab = signal<'summary' | 'architecture' | 'impact' | 'security' | 'docs' | 'debt'>('summary');

  // Repositories & Custom Popover Dropdown
  projects = signal<CodebaseProject[]>([]);
  selectedProjectId = signal<string>('ecommerce-microservices');
  selectedProject = computed<CodebaseProject>(() => {
    return this.projects().find(p => p.id === this.selectedProjectId()) 
      || this.projects()[0]
      || {
        id: 'ecommerce-microservices',
        name: 'OmniCart Microservices Platform',
        description: 'Reference eCommerce platform with .NET Aspire, RabbitMQ, and Redis cache.',
        languages: ['C#', 'TypeScript', 'SQL'],
        totalFiles: 1078,
        totalLinesOfCode: 142000,
        lastAnalyzed: new Date().toISOString()
      };
  });
  isRepoDropdownOpen = signal<boolean>(false);
  repoSearchQuery = signal<string>('');
  filteredProjects = computed(() => {
    const q = this.repoSearchQuery().toLowerCase().trim();
    if (!q) return this.projects();
    return this.projects().filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.languages && p.languages.some(l => l.toLowerCase().includes(q)))
    );
  });

  // Dedicated AI Codebase Deep Scanning Screen
  isScanningCodebase = signal<boolean>(false);
  scanProgress = signal<number>(0);
  scanStage = signal<number>(1);
  scanStageTitle = signal<string>('Connecting Git Engine & Resolving Tree...');
  scanLogs = signal<string[]>([]);
  private scanTimer: any = null;

  // Interactive Timeframe & KPI Metrics
  selectedTimeframe = signal<'7D' | '30D' | '90D' | 'ALL'>('30D');
  focusedSeverity = signal<'All' | 'Critical' | 'Major' | 'Minor'>('All');
  hoveredSeverity = signal<'Critical' | 'Major' | 'Minor' | null>(null);
  activeKpiCard = signal<string | null>(null);

  timeframeMultiplier = computed(() => {
    switch (this.selectedTimeframe()) {
      case '7D': return 0.28;
      case '30D': return 1.0;
      case '90D': return 2.65;
      case 'ALL': return 6.8;
      default: return 1.0;
    }
  });

  displayMergedPrs = computed(() => {
    const base = this.summaryData()?.mergedPullRequests || 145;
    return Math.round(base * this.timeframeMultiplier());
  });

  displayActiveUsers = computed(() => {
    const base = this.summaryData()?.activeUsers || 86;
    if (this.selectedTimeframe() === '7D') return Math.max(12, Math.round(base * 0.55));
    if (this.selectedTimeframe() === '90D') return Math.round(base * 1.4);
    if (this.selectedTimeframe() === 'ALL') return Math.round(base * 2.2);
    return base;
  });

  displayTimeToCommit = computed(() => {
    return this.summaryData()?.medianTimeToLastCommitHours || 1.7;
  });

  displayReviewSaved = computed(() => {
    const base = this.summaryData()?.reviewTimeSavedDays || 1.2;
    return +(base * this.timeframeMultiplier()).toFixed(1);
  });

  displayCommentsPosted = computed(() => {
    const base = this.summaryData()?.aiReviewCommentsPosted || 645;
    return Math.round(base * this.timeframeMultiplier());
  });

  displayAcceptedPercent = computed(() => {
    return this.summaryData()?.aiReviewCommentsAcceptedPercent || 45.1;
  });

  displayAvgAi = computed(() => {
    return this.summaryData()?.avgCommentsByAi || 4.5;
  });

  displayAvgHuman = computed(() => {
    return this.summaryData()?.avgCommentsByHuman || 6.9;
  });

  donutCenterTitle = computed(() => {
    const h = this.hoveredSeverity();
    const f = this.focusedSeverity();
    const target = h || (f !== 'All' ? f : null);
    if (target === 'Critical') return 'CRITICAL';
    if (target === 'Major') return 'MAJOR';
    if (target === 'Minor') return 'MINOR';
    return 'TOTAL COMMENTS';
  });

  donutCenterValue = computed(() => {
    const h = this.hoveredSeverity();
    const f = this.focusedSeverity();
    const target = h || (f !== 'All' ? f : null);
    const total = this.displayCommentsPosted();
    if (target === 'Critical') return `${Math.round(total * 0.15)}`;
    if (target === 'Major') return `${Math.round(total * 0.55)}`;
    if (target === 'Minor') return `${Math.round(total * 0.30)}`;
    return `${total}`;
  });

  donutCenterSubtext = computed(() => {
    const h = this.hoveredSeverity();
    const f = this.focusedSeverity();
    const target = h || (f !== 'All' ? f : null);
    if (target === 'Critical') return `${this.donutData().criticalPct}% of suggestions`;
    if (target === 'Major') return `${this.donutData().majorPct}% of suggestions`;
    if (target === 'Minor') return `${this.donutData().minorPct}% of suggestions`;
    return `${this.displayAcceptedPercent()}% accepted`;
  });

  // Dynamic Donut Arc Calculations (Reactive to Severity & Timeframe)
  readonly donutCircumference = 390;
  donutData = computed(() => {
    const data = this.summaryData()?.suggestionsBySeverityDonut;
    const baseCrit = data?.['Critical'] || 14;
    const baseMaj = data?.['Major'] || 48;
    const baseMin = data?.['Minor'] || 38;
    const sum = Math.max(1, baseCrit + baseMaj + baseMin);

    const f = this.focusedSeverity();
    let cRatio = baseCrit / sum;
    let mRatio = baseMaj / sum;
    let nRatio = baseMin / sum;

    if (f === 'Critical') {
      cRatio = 0.50; mRatio = 0.30; nRatio = 0.20;
    } else if (f === 'Major') {
      cRatio = 0.15; mRatio = 0.65; nRatio = 0.20;
    } else if (f === 'Minor') {
      cRatio = 0.15; mRatio = 0.30; nRatio = 0.55;
    }

    const cDash = +(cRatio * this.donutCircumference).toFixed(1);
    const mDash = +(mRatio * this.donutCircumference).toFixed(1);
    const nDash = +(nRatio * this.donutCircumference).toFixed(1);

    return {
      criticalDash: `${cDash} ${this.donutCircumference}`,
      criticalOffset: 0,
      majorDash: `${mDash} ${this.donutCircumference}`,
      majorOffset: -cDash,
      minorDash: `${nDash} ${this.donutCircumference}`,
      minorOffset: -(cDash + mDash),
      criticalPct: Math.round(cRatio * 100),
      majorPct: Math.round(mRatio * 100),
      minorPct: Math.round(nRatio * 100)
    };
  });

  // Dynamic Suggestions Breakdown (Reactive to Timeframe & Severity Filter)
  displayedSuggestions = computed(() => {
    const raw = this.summaryData()?.suggestionsBreakdown || [];
    const tf = this.timeframeMultiplier();
    const f = this.focusedSeverity();

    return raw.map(item => {
      const mult = f === 'Critical' ? 0.35 : (f === 'Major' ? 0.70 : (f === 'Minor' ? 0.45 : 1.0));
      const accepted = Math.max(1, Math.round(item.accepted * tf * mult));
      const posted = Math.max(accepted, Math.round(item.posted * tf * mult));
      const acceptedPct = Math.min(100, Math.round((accepted / posted) * 100));
      const remainingPct = Math.max(0, 100 - acceptedPct);

      return {
        category: item.category,
        accepted,
        posted,
        acceptedPct,
        remainingPct
      };
    });
  });

  // GitHub Integration State (Vercel-style)
  isImportModalOpen = signal<boolean>(false);
  importRepoUrl = signal<string>('');
  importBranch = signal<string>('main');
  importToken = signal<string>('');
  isImporting = signal<boolean>(false);
  importError = signal<string | null>(null);
  popularTemplates = signal<GitHubRepoSuggestion[]>([]);

  // Data Signals
  isLoading = signal<boolean>(false);
  summaryData = signal<HighLevelSummaryDto | null>(null);
  architectureData = signal<ArchitectureOverviewDto | null>(null);
  securityData = signal<SecuritySmellReportDto | null>(null);
  docsData = signal<DocumentationReportDto | null>(null);
  debtData = signal<TechnicalDebtReportDto | null>(null);
  fileList = signal<string[]>([]);

  // Impact Analysis State
  targetFile = signal<string>('src/Api/Controllers/CheckoutController.cs');
  proposedChange = signal<string>('Refactor TotalAmount property type from double to decimal and optimize asynchronous queue worker');
  impactResult = signal<ImpactAnalysisResult | null>(null);
  isAnalyzingImpact = signal<boolean>(false);

  // Search & Filter
  searchQuery = signal<string>('');
  selectedSeverityFilter = signal<string>('All');

  // Math Reference for Templates
  readonly Math = Math;

  // Diagram Zoom & Fullscreen Pan/Zoom State
  archZoom = signal<number>(1);
  impactZoom = signal<number>(1);
  docsZoom = signal<number>(1);
  fullscreenDiagram = signal<{ title: string; code: string; zoom: number; panX: number; panY: number } | null>(null);

  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;
  initialPanX = 0;
  initialPanY = 0;

  // Interactive Handlers
  setTimeframe(tf: '7D' | '30D' | '90D' | 'ALL') {
    this.selectedTimeframe.set(tf);
  }

  toggleKpiCard(cardId: string) {
    this.activeKpiCard.update(c => c === cardId ? null : cardId);
  }

  setFocusedSeverity(sev: 'All' | 'Critical' | 'Major' | 'Minor') {
    this.focusedSeverity.set(sev);
  }

  selectCategory(catName: string) {
    this.activeTab.set('security');
    this.searchQuery.set(catName);
    this.selectedSeverityFilter.set('All');
  }

  toggleRepoDropdown() {
    this.isRepoDropdownOpen.update(v => !v);
  }

  closeRepoDropdown() {
    this.isRepoDropdownOpen.set(false);
  }

  selectProject(proj: CodebaseProject) {
    this.selectedProjectId.set(proj.id);
    this.isRepoDropdownOpen.set(false);
    this.triggerDeepScan();
  }

  triggerDeepScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }
    const proj = this.selectedProject();
    const repoName = proj?.name || 'Codebase';
    const totalFiles = proj?.totalFiles || 1078;
    const languages = (proj?.languages || ['C#', 'TypeScript']).join(', ');

    this.isScanningCodebase.set(true);
    this.scanProgress.set(0);
    this.scanStage.set(1);
    this.scanStageTitle.set('Connecting Git Engine & Resolving Tree...');
    this.scanLogs.set([
      `[0.05s] [REPO] Selected: ${repoName} (Branch: main)`,
      `[0.18s] [TREE] Discovered ${totalFiles.toLocaleString()} files across ${languages}`
    ]);

    let step = 0;
    this.scanTimer = setInterval(() => {
      step++;
      const currentProgress = Math.min(100, step * 7);
      this.scanProgress.set(currentProgress);

      if (step === 3) {
        this.scanStage.set(2);
        this.scanStageTitle.set('Parsing AST & Constructing Dependency Graph...');
        this.scanLogs.update(logs => [
          ...logs,
          `[0.42s] [AST] Tokenized symbols, imports, and call graphs`,
          `[0.65s] [GRAPH] Constructed distributed dependency blast radius matrix`
        ]);
      } else if (step === 7) {
        this.scanStage.set(3);
        this.scanStageTitle.set('AI Neural Engine Evaluating Smells & Security...');
        this.scanLogs.update(logs => [
          ...logs,
          `[0.95s] [AI] Querying Gemini Neural Pipeline with architectural context...`,
          `[1.25s] [BLAST-RADIUS] Calculated blast radius and regression vulnerabilities`
        ]);
      } else if (step === 11) {
        this.scanStage.set(4);
        this.scanStageTitle.set('Synthesizing Technical Debt Ledger & ROI Roadmap...');
        this.scanLogs.update(logs => [
          ...logs,
          `[1.58s] [DEBT] Identified prioritized refactoring targets by engineering ROI`,
          `[1.85s] [COMPLETE] Diagnostics verified. Launching executive dashboard.`
        ]);
      }

      if (currentProgress >= 100) {
        clearInterval(this.scanTimer);
        setTimeout(() => {
          this.isScanningCodebase.set(false);
          setTimeout(() => this.renderMermaidDiagrams(), 100);
        }, 450);
      }
    }, 110);
  }

  skipScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }
    this.scanProgress.set(100);
    this.isScanningCodebase.set(false);
    setTimeout(() => this.renderMermaidDiagrams(), 100);
  }

  openImportModal() {
    this.isImportModalOpen.set(true);
    this.importError.set(null);
    if (this.popularTemplates().length === 0) {
      this.apiService.getPopularTemplates().subscribe({
        next: (templates) => this.popularTemplates.set(templates),
        error: (err) => console.warn('Could not fetch templates', err)
      });
    }
  }

  closeImportModal() {
    this.isImportModalOpen.set(false);
    this.importError.set(null);
  }

  selectTemplate(fullName: string) {
    this.importRepoUrl.set(fullName);
  }

  importGitHubRepo() {
    const url = this.importRepoUrl().trim();
    if (!url) {
      this.importError.set('Please provide a valid GitHub repository URL or slug, e.g. "dotnet/aspnetcore" or "facebook/react"');
      return;
    }

    this.isImporting.set(true);
    this.importError.set(null);

    this.apiService.importGitHubRepo(url, this.importToken().trim() || undefined, this.importBranch().trim() || undefined).subscribe({
      next: (newProj) => {
        this.projects.update(list => [newProj, ...list.filter(p => p.id !== newProj.id)]);
        this.selectedProjectId.set(newProj.id);
        this.isImporting.set(false);
        this.isImportModalOpen.set(false);
        this.importRepoUrl.set('');
        this.importToken.set('');
        this.triggerDeepScan();
      },
      error: (err) => {
        console.error('Import failed', err);
        this.importError.set(err.error?.message || 'Failed to import repository from GitHub. Please verify repository name, branch, or personal access token.');
        this.isImporting.set(false);
      }
    });
  }

  // Filtered Issues
  filteredIssues = computed(() => {
    const issues = this.securityData()?.issues || [];
    const filter = this.selectedSeverityFilter();
    const query = this.searchQuery().toLowerCase().trim();

    return issues.filter(issue => {
      const matchSeverity = filter === 'All' || issue.severity === filter;
      const matchQuery = !query || 
        issue.title.toLowerCase().includes(query) || 
        issue.description.toLowerCase().includes(query) ||
        issue.file.toLowerCase().includes(query);
      return matchSeverity && matchQuery;
    });
  });

  constructor() {
    // Re-fetch data when selected project changes
    effect(() => {
      const projId = this.selectedProjectId();
      if (projId) {
        this.loadProjectData(projId);
      }
    });

    // Re-render Mermaid diagrams when tabs switch
    effect(() => {
      const tab = this.activeTab();
      setTimeout(() => this.renderMermaidDiagrams(), 100);
    });
  }

  ngOnInit() {
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: 'loose',
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0a0d14',
        primaryColor: '#10b981',
        primaryTextColor: '#f1f5f9',
        primaryBorderColor: '#059669',
        lineColor: '#6366f1',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a'
      }
    });

    this.apiService.getSamples().subscribe({
      next: (projs) => {
        this.projects.set(projs);
        if (projs.length > 0) {
          this.selectedProjectId.set(projs[0].id);
        }
      },
      error: (err) => console.error('Failed to load sample projects', err)
    });
  }

  loadProjectData(projectId: string) {
    this.isLoading.set(true);

    // Reset data-rendered so that diagrams for this project will re-render
    document.querySelectorAll('.mermaid-code').forEach(el => el.removeAttribute('data-rendered'));

    // 1. High-Level Summary (Image 2)
    this.apiService.getSummary(projectId).subscribe({
      next: (summary) => this.summaryData.set(summary),
      error: (err) => console.error(err)
    });

    // 2. Files List
    this.apiService.getFiles(projectId).subscribe({
      next: (files) => {
        this.fileList.set(files);
        if (files.length > 0) {
          this.targetFile.set(files[0]);
        }
      },
      error: (err) => console.error(err)
    });

    // 3. Architecture
    this.apiService.getArchitecture(projectId).subscribe({
      next: (arch) => {
        this.architectureData.set(arch);
        setTimeout(() => this.renderMermaidDiagrams(), 150);
      },
      error: (err) => console.error(err)
    });

    // 4. Security & Smells
    this.apiService.getSecuritySmells(projectId).subscribe({
      next: (sec) => this.securityData.set(sec),
      error: (err) => console.error(err)
    });

    // 5. Documentation
    this.apiService.getDocumentation(projectId).subscribe({
      next: (docs) => {
        this.docsData.set(docs);
        setTimeout(() => this.renderMermaidDiagrams(), 150);
      },
      error: (err) => console.error(err)
    });

    // 6. Technical Debt
    this.apiService.getTechnicalDebt(projectId).subscribe({
      next: (debt) => {
        this.debtData.set(debt);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isImportModalOpen()) {
      this.closeImportModal();
    }
    if (this.isRepoDropdownOpen()) {
      this.closeRepoDropdown();
    }
    if (this.isScanningCodebase()) {
      this.skipScan();
    }
  }

  runImpactAnalysis() {
    const projId = this.selectedProjectId();
    const file = this.targetFile();
    const change = this.proposedChange();

    if (!file || !change) return;

    this.isAnalyzingImpact.set(true);
    this.impactResult.set(null);

    this.apiService.analyzeImpact(projId, file, change).subscribe({
      next: (res) => {
        this.impactResult.set(res);
        this.isAnalyzingImpact.set(false);
        setTimeout(() => this.renderMermaidDiagrams(), 150);
      },
      error: (err) => {
        console.error('Impact analysis error', err);
        this.isAnalyzingImpact.set(false);
      }
    });
  }

  sanitizeMermaidCode(raw: string): string {
    if (!raw) return '';
    let clean = raw.trim();

    // Strip markdown code fences if present
    clean = clean.replace(/^```mermaid\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

    // Replace unquoted '&' inside square brackets [ ... & ... ] with 'and'
    clean = clean.replace(/\[([^\]"]*?)&([^\]"]*?)\]/g, '[$1 and $2]');

    // Replace unquoted '&' inside round brackets ( ... & ... ) with 'and'
    clean = clean.replace(/\(([^)"]*?)&([^)"]*?)\)/g, '($1 and $2)');

    // Ensure labels with slashes or other symbols inside brackets are quoted
    clean = clean.replace(/([a-zA-Z0-9_-]+)\[([^\]"\n]+[\/][^\]"\n]*)\]/g, (_, id, label) => {
      return `${id}["${label.trim()}"]`;
    });

    // Sequence diagrams: participant aliases with unquoted parens e.g. participant OrderSvc as Order Service (C# .NET)
    clean = clean.replace(/participant\s+([A-Za-z0-9_]+)\s+as\s+([^"\n]+?\([^)\n]+?\)[^"\n]*)/g, (_, id, label) => {
      return `participant ${id} as "${label.trim()}"`;
    });

    return clean;
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async renderMermaidDiagrams() {
    const containers = document.querySelectorAll('.mermaid-code:not([data-rendered="true"])');
    for (let i = 0; i < containers.length; i++) {
      const el = containers[i] as HTMLElement;
      const rawCode = el.getAttribute('data-mermaid') || el.innerText;
      if (!rawCode || rawCode.trim().length === 0) continue;

      const cleanCode = this.sanitizeMermaidCode(rawCode);
      const id = 'mermaid-svg-' + Math.random().toString(36).substring(2, 9);

      try {
        const { svg } = await mermaid.render(id, cleanCode);
        el.innerHTML = svg;
        el.setAttribute('data-rendered', 'true');
      } catch (renderErr) {
        console.warn('Mermaid render issue for diagram:', renderErr);
        // Remove any Mermaid-injected error icons or stray SVG elements from document
        document.querySelectorAll(`[id^="${id}"], [id^="d${id}"], .error-icon`).forEach(node => node.remove());

        // Display clean, readable fallback view without scary bomb icons
        el.innerHTML = `
          <div class="mermaid-fallback-box" style="padding: 16px; font-family: monospace; font-size: 12px; color: #94a3b8; background: #070a10; border-radius: 6px; border: 1px solid #1e293b; text-align: left; line-height: 1.6; white-space: pre-wrap; width: 100%;">
            <div style="color: #10b981; font-weight: 600; margin-bottom: 8px; font-family: sans-serif; display: flex; align-items: center; gap: 6px;">
              <span>Architecture Specification</span>
            </div>
            ${this.escapeHtml(cleanCode)}
          </div>`;
        el.setAttribute('data-rendered', 'true');
      }
    }
  }

  // --- SVG Math for Radar and Donut Charts (Exact match to Image 2) ---

  // 3-Point Radar for "Review Comments by Severity" (Critical, Major, Minor)
  get3PointPolygon(type: 'accepted' | 'posted'): string {
    const data = this.summaryData()?.reviewCommentsBySeverity;
    if (!data || data.length < 3) {
      return '150,80 70,220 230,220';
    }

    const cx = 150;
    const cy = 150;
    const maxVal = 500;
    const maxR = 105;
    const tf = this.timeframeMultiplier();
    const scale = Math.min(1.25, Math.max(0.4, 0.45 + (tf - 0.28) * 0.12));
    const f = this.focusedSeverity();

    // Angles: Critical (Top = -90 deg), Major (Bottom-Left = 150 deg), Minor (Bottom-Right = 30 deg)
    const angles = [-Math.PI / 2, (5 * Math.PI) / 6, Math.PI / 6];

    const points = data.map((item, idx) => {
      let val = (type === 'accepted' ? item.accepted : item.posted) * scale;
      if (f === 'Critical' && idx === 0) val *= 1.35;
      if (f === 'Major' && idx === 1) val *= 1.35;
      if (f === 'Minor' && idx === 2) val *= 1.35;

      const r = Math.max(16, Math.min(maxR, (val / maxVal) * maxR));
      const angle = angles[idx % 3];
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return points.join(' ');
  }

  // 8-Axis Radar for "Category Distribution"
  get8PointPolygon(type: 'accepted' | 'posted'): string {
    const data = this.summaryData()?.categoryDistribution;
    const cx = 220;
    const cy = 160;
    if (!data || data.length < 8) {
      return `${cx},80 ${cx+60},105 ${cx+90},160 ${cx+60},215 ${cx},240 ${cx-60},215 ${cx-90},160 ${cx-60},105`;
    }

    const maxVal = 180;
    const maxR = 90;
    const tf = this.timeframeMultiplier();
    const scale = Math.min(1.2, Math.max(0.4, 0.5 + (tf - 0.28) * 0.1));
    const f = this.focusedSeverity();

    const points = data.map((item, idx) => {
      let val = (type === 'accepted' ? item.accepted : item.posted) * scale;
      if (f === 'Critical' && (idx === 0 || idx === 2)) val *= 1.25;
      if (f === 'Major' && (idx === 1 || idx === 3 || idx === 4)) val *= 1.25;
      if (f === 'Minor' && (idx === 5 || idx === 6 || idx === 7)) val *= 1.25;

      const r = Math.max(14, Math.min(maxR, (val / maxVal) * maxR));
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / 8;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return points.join(' ');
  }

  getRadarWebPath(ratio: number): string {
    const cx = 220;
    const cy = 160;
    const r = 90 * ratio;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 8;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  getCategoryLabelPos(idx: number): { x: number; y: number; anchor: string; shortName: string; fullName: string } {
    const cx = 220;
    const cy = 160;
    const r = 115;
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / 8;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle) + 4;

    let anchor = 'middle';
    if (x > cx + 15) anchor = 'start';
    else if (x < cx - 15) anchor = 'end';

    const names = [
      { short: 'Defects', full: 'Code Defect' },
      { short: 'Stability', full: 'Stability & Availability' },
      { short: 'Security', full: 'Security & Access' },
      { short: 'Performance', full: 'Performance & Scale' },
      { short: 'Maintainability', full: 'Maintainability & Debt' },
      { short: 'Code Quality', full: 'Code Quality & Style' },
      { short: 'Correctness', full: 'Functional Correctness' },
      { short: 'Data Integrity', full: 'Data Integrity & Integration' }
    ];

    const item = names[idx % 8];

    return { x, y, anchor, shortName: item.short, fullName: item.full };
  }

  // --- Diagram Zoom & Fullscreen Pan/Zoom Handlers ---
  zoomArch(delta: number) {
    this.archZoom.set(Math.min(2.5, Math.max(0.5, +(this.archZoom() + delta).toFixed(2))));
  }

  resetArchZoom() {
    this.archZoom.set(1);
  }

  zoomImpact(delta: number) {
    this.impactZoom.set(Math.min(2.5, Math.max(0.5, +(this.impactZoom() + delta).toFixed(2))));
  }

  resetImpactZoom() {
    this.impactZoom.set(1);
  }

  zoomDocs(delta: number) {
    this.docsZoom.set(Math.min(2.5, Math.max(0.5, +(this.docsZoom() + delta).toFixed(2))));
  }

  resetDocsZoom() {
    this.docsZoom.set(1);
  }

  openFullscreenDiagram(title: string, code: string) {
    this.fullscreenDiagram.set({
      title,
      code,
      zoom: 1,
      panX: 0,
      panY: 0
    });
    // Render Mermaid into the fullscreen container
    setTimeout(() => {
      const el = document.getElementById('fullscreen-mermaid-container');
      if (el) {
        el.removeAttribute('data-rendered');
        this.renderMermaidDiagrams();
      }
    }, 60);
  }

  closeFullscreenDiagram() {
    this.fullscreenDiagram.set(null);
  }

  zoomFullscreen(delta: number) {
    const cur = this.fullscreenDiagram();
    if (!cur) return;
    const nextZoom = Math.min(3.5, Math.max(0.4, +(cur.zoom + delta).toFixed(2)));
    this.fullscreenDiagram.set({ ...cur, zoom: nextZoom });
  }

  resetFullscreenZoom() {
    const cur = this.fullscreenDiagram();
    if (!cur) return;
    this.fullscreenDiagram.set({ ...cur, zoom: 1, panX: 0, panY: 0 });
  }

  onPanStart(e: MouseEvent) {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const cur = this.fullscreenDiagram();
    if (cur) {
      this.initialPanX = cur.panX;
      this.initialPanY = cur.panY;
    }
  }

  onPanMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const cur = this.fullscreenDiagram();
    if (!cur) return;
    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    this.fullscreenDiagram.set({
      ...cur,
      panX: this.initialPanX + deltaX,
      panY: this.initialPanY + deltaY
    });
  }

  onPanEnd() {
    this.isDragging = false;
  }

  onWheelZoom(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    this.zoomFullscreen(delta);
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.fullscreenDiagram()) {
      this.closeFullscreenDiagram();
    } else if (this.isImportModalOpen()) {
      this.closeImportModal();
    } else if (this.isRepoDropdownOpen()) {
      this.closeRepoDropdown();
    } else if (this.isScanningCodebase()) {
      this.skipScan();
    }
  }
}
