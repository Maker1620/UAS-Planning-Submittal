import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { CLIENT_PROFILES, DOCUMENT_CATALOG } from '../data/clientProfiles';
import {
  AuditSummary,
  ClientProfileId,
  ClientRequirements,
  ComplianceFinding,
  DocumentKey,
  FindingCategory,
  FindingSeverity,
  HazardMitigation,
  SubmittalPackage,
  WorkspaceTab,
} from '../types/submittal';

interface ComplianceAuditViewProps {
  pkg: SubmittalPackage;
  audit: AuditSummary;
  onUpdatePackage: (updater: (prev: SubmittalPackage) => SubmittalPackage) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
}

const SEVERITY_FILTERS: { id: 'all' | FindingSeverity; label: string }[] = [
  { id: 'all', label: 'All Findings' },
  { id: 'blocker', label: 'Blockers' },
  { id: 'missing_doc', label: 'Missing Docs' },
  { id: 'warning', label: 'Warnings' },
  { id: 'passed', label: 'Verified' },
];

const CATEGORY_FILTERS: ('All' | FindingCategory)[] = [
  'All',
  'Airspace & Regulatory',
  'Crew & Aircraft',
  'Site & Safety',
  'Client & Documentation',
];

export const ComplianceAuditView: React.FC<ComplianceAuditViewProps> = ({
  pkg,
  audit,
  onUpdatePackage,
  onNavigateTab,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | FindingCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomRules, setShowCustomRules] = useState(false);
  const [highlightedDoc, setHighlightedDoc] = useState<DocumentKey | null>(null);

  // New mitigation form state
  const [newHazard, setNewHazard] = useState('');
  const [newRisk, setNewRisk] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newControl, setNewControl] = useState('');
  const [newOwner, setNewOwner] = useState('PIC / VO');

  const docSectionRef = useRef<HTMLDivElement>(null);
  const activeProfile = CLIENT_PROFILES[pkg.clientProfileId];

  // Determine which documents are currently required by client profile or regulatory triggers
  const requiredDocSet = useMemo(() => {
    const req = pkg.clientRequirements;
    const set = new Set<DocumentKey>(['part107_cert', 'aircraft_reg', 'coi_insurance']);
    if (pkg.site.airspaceClass !== 'G' || pkg.operations.losMode === 'BVLOS') {
      set.add('laanc_waiver');
    }
    if (
      (pkg.operations.overPeople !== 'None (Sterile Area)' || pkg.operations.overMovingVehicles) &&
      pkg.operations.mtowLbs > 0.55
    ) {
      set.add('oop_doc');
    }
    if (req.requireJha) set.add('jha_jsa');
    if (req.requireErp) set.add('erp_plan');
    if (req.requireSiteAccessAuth) set.add('site_access');
    if (req.requireMaintenanceLog) set.add('maintenance_log');
    if (req.requireHseInduction) set.add('hse_induction');
    if (req.requireSimopsPermit) set.add('simops_permit');
    if (req.requireAdvanceNotice) set.add('advance_notice');
    return set;
  }, [pkg]);

  const filteredFindings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return audit.findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'All' && f.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.detail.toLowerCase().includes(q) ||
        f.citation.toLowerCase().includes(q) ||
        f.source.toLowerCase().includes(q)
      );
    });
  }, [audit.findings, severityFilter, categoryFilter, searchQuery]);

  const handleSelectClientProfile = (profileId: ClientProfileId) => {
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      clientProfileId: profileId,
      clientRequirements: { ...CLIENT_PROFILES[profileId].defaults },
    }));
  };

  const updateClientReq = <K extends keyof ClientRequirements>(
    key: K,
    value: ClientRequirements[K]
  ) => {
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      clientRequirements: {
        ...prev.clientRequirements,
        [key]: value,
      },
    }));
  };

  const updateDocument = (
    docKey: DocumentKey,
    patch: Partial<SubmittalPackage['documents'][DocumentKey]>
  ) => {
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      documents: {
        ...prev.documents,
        [docKey]: {
          ...prev.documents[docKey],
          ...patch,
        },
      },
    }));
  };

  const handleJumpToDoc = (docKey: DocumentKey) => {
    setHighlightedDoc(docKey);
    docSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      setHighlightedDoc((curr) => (curr === docKey ? null : curr));
    }, 3200);
  };

  const handleAddSuggestedMitigation = (finding: ComplianceFinding) => {
    if (!finding.suggestedMitigation) return;
    const item: HazardMitigation = {
      id: `mit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hazard: finding.suggestedMitigation.hazard,
      riskLevel: finding.suggestedMitigation.riskLevel,
      mitigationControl: finding.suggestedMitigation.mitigationControl,
      owner: 'PIC / VO',
    };
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      mitigations: [...prev.mitigations, item],
    }));
  };

  const handleAddCustomMitigation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHazard.trim() || !newControl.trim()) return;
    const item: HazardMitigation = {
      id: `mit-${Date.now()}`,
      hazard: newHazard.trim(),
      riskLevel: newRisk,
      mitigationControl: newControl.trim(),
      owner: newOwner.trim() || 'PIC',
    };
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      mitigations: [...prev.mitigations, item],
    }));
    setNewHazard('');
    setNewControl('');
  };

  const handleDeleteMitigation = (id: string) => {
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      mitigations: prev.mitigations.filter((m) => m.id !== id),
    }));
  };

  const renderSeverityLabel = (severity: FindingSeverity) => {
    switch (severity) {
      case 'blocker':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Blocker
          </span>
        );
      case 'missing_doc':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
            <FileWarning className="w-3.5 h-3.5 shrink-0" />
            Missing Doc
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Warning
          </span>
        );
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Verified
          </span>
        );
    }
  };

  const isDocExpired = (expDate: string) => {
    if (!expDate || !pkg.operations.plannedDate) return false;
    return new Date(expDate + 'T00:00:00') < new Date(pkg.operations.plannedDate + 'T00:00:00');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Compliance Audit &amp; Client Gap Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Cross-checks your site and operational parameters against FAA Part 107 regulations and the target client’s safety assessment standards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('submittal')}
          className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Preview Submittal Package
        </button>
      </div>

      {/* Section 1: Target Client Assessment Profile */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              01. Target Client / Host Company Assessment Profile
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the industry standard your client’s HSE or aviation team will audit against, or customize specific contract requirements.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCustomRules((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Customize Client Criteria</span>
            {showCustomRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Object.keys(CLIENT_PROFILES) as ClientProfileId[]).map((id) => {
              const prof = CLIENT_PROFILES[id];
              const selected = pkg.clientProfileId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectClientProfile(id)}
                  className={`text-left p-4 rounded-md border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-blue-50/50 border-blue-700'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{prof.name}</span>
                    {selected && (
                      <span className="text-xs font-medium text-blue-700 whitespace-nowrap">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{prof.sector}</div>
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs font-mono text-slate-600 leading-relaxed">
                    {prof.auditFocus}
                  </div>
                </button>
              );
            })}
          </div>

          {showCustomRules && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Custom Client Contract &amp; HSE Overrides ({activeProfile.name})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Adjust thresholds to match a specific RFP, vendor portal, or Master Services Agreement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectClientProfile(pkg.clientProfileId)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Industry Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Min Aviation Liability COI ($ Millions)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    step={1}
                    value={pkg.clientRequirements.minCoiMillions}
                    onChange={(e) => updateClientReq('minCoiMillions', Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Minimum Horizontal Standoff (ft)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={5}
                    value={pkg.clientRequirements.minStandoffFt}
                    onChange={(e) => updateClientReq('minStandoffFt', Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred Min PIC Flight Hours
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={5}
                    value={pkg.clientRequirements.minPicHours}
                    onChange={(e) => updateClientReq('minPicHours', Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {(
                  [
                    ['requireAdditionalInsured', 'Require Additional Insured on COI'],
                    ['requireDedicatedVo', 'Require Dedicated Visual Observer (2-Person Crew)'],
                    ['requireNdaaAirframe', 'Require NDAA Sec. 848 Compliant Airframe'],
                    ['requireJha', 'Require Site-Specific JHA / JSA'],
                    ['requireErp', 'Require Emergency Response Plan (ERP)'],
                    ['requireSiteAccessAuth', 'Require Written Site Access Authorization'],
                    ['requireHseInduction', 'Require Client HSE Site Orientation'],
                    ['requireSimopsPermit', 'Require SIMOPS / Permit-to-Work'],
                    ['requireMaintenanceLog', 'Require Pre-Flight Maintenance & Battery Log'],
                    ['requireAdvanceNotice', 'Require Advance Stakeholder Notification'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={pkg.clientRequirements[key]}
                      onChange={(e) => updateClientReq(key, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Automated Gap & Compliance Audit Table */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        {/* Flat KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-5 col-span-2 lg:col-span-1 bg-slate-50/60">
            <div className="text-xs text-slate-500">Submittal Readiness</div>
            <div
              className={`mt-1.5 text-sm font-semibold leading-snug ${
                audit.readinessStatus === 'Ready for Client Submittal'
                  ? 'text-emerald-700'
                  : audit.readinessStatus === 'Conditional — Review Warnings'
                    ? 'text-amber-700'
                    : 'text-red-700'
              }`}
            >
              {audit.readinessStatus}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-slate-500">Critical Blockers</div>
            <div className="mt-1 text-2xl font-mono font-semibold tabular-nums text-red-700">
              {audit.blockers}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-slate-500">Missing Documents</div>
            <div className="mt-1 text-2xl font-mono font-semibold tabular-nums text-red-700">
              {audit.missingDocs}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-slate-500">Safety Warnings</div>
            <div className="mt-1 text-2xl font-mono font-semibold tabular-nums text-amber-700">
              {audit.warnings}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-slate-500">Requirements Met</div>
            <div className="mt-1 text-2xl font-mono font-semibold tabular-nums text-emerald-700">
              {audit.passed}
              <span className="text-sm font-normal text-slate-400">/{audit.totalChecks}</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200">
              {SEVERITY_FILTERS.map((sf) => (
                <button
                  key={sf.id}
                  type="button"
                  onClick={() => setSeverityFilter(sf.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    severityFilter === sf.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'All' | FindingCategory)}
              aria-label="Filter findings by category"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              {CATEGORY_FILTERS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules, citations, gaps..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No findings match the current filter.</p>
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('all');
                setCategoryFilter('All');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredFindings.map((finding) => (
              <div
                key={finding.id}
                className="px-6 py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    {renderSeverityLabel(finding.severity)}
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-mono text-slate-600">{finding.citation}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-500">{finding.source}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-500">{finding.category}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900">{finding.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    {finding.detail}
                  </p>
                  {finding.severity !== 'passed' && (
                    <p className="text-xs text-slate-700 pt-0.5">
                      <span className="font-semibold text-slate-900">Action: </span>
                      {finding.remediation}
                    </p>
                  )}
                </div>

                {/* Action Affordance */}
                {finding.severity !== 'passed' && (
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    {finding.suggestedMitigation && (
                      <button
                        type="button"
                        onClick={() => handleAddSuggestedMitigation(finding)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Mitigation Control
                      </button>
                    )}

                    {finding.docKey && (
                      <button
                        type="button"
                        onClick={() => handleJumpToDoc(finding.docKey!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Log Document
                      </button>
                    )}

                    {finding.targetTab !== 'audit' && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab(finding.targetTab)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-blue-50/60 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>
                          {finding.targetTab === 'site'
                            ? 'Edit Site'
                            : finding.targetTab === 'map'
                              ? 'Open Site Map'
                              : 'Edit Operations'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Submittal Documentation Checklist */}
      <section
        ref={docSectionRef}
        className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200 scroll-mt-6"
      >
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              02. Submittal Documentation Checklist &amp; Expiration Verification
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track attached documents, reference numbers, and expirations relative to the planned flight date ({pkg.operations.plannedDate || 'unset'}).
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {DOCUMENT_CATALOG.filter((d) => requiredDocSet.has(d.key) && pkg.documents[d.key].attached).length}
            /{requiredDocSet.size} required docs attached
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                <th className="py-2.5 pl-6 pr-3 w-10">Inc.</th>
                <th className="py-2.5 px-3">Document</th>
                <th className="py-2.5 px-3 w-28">Requirement</th>
                <th className="py-2.5 px-3 w-44">Reference / Permit #</th>
                <th className="py-2.5 px-3 w-40">Expiration</th>
                <th className="py-2.5 pl-3 pr-6">Reviewer Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DOCUMENT_CATALOG.map((doc) => {
                const rec = pkg.documents[doc.key];
                const isReq = requiredDocSet.has(doc.key);
                const expired = rec.attached && isDocExpired(rec.expirationDate);
                const isHighlighted = highlightedDoc === doc.key;

                return (
                  <tr
                    key={doc.key}
                    className={`transition-colors ${
                      isHighlighted
                        ? 'bg-blue-50/80'
                        : isReq && !rec.attached
                          ? 'bg-red-50/30 hover:bg-red-50/50'
                          : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-3 pl-6 pr-3 align-top">
                      <input
                        type="checkbox"
                        checked={rec.attached}
                        onChange={(e) => updateDocument(doc.key, { attached: e.target.checked })}
                        aria-label={`Attach ${doc.title}`}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                      />
                    </td>

                    <td className="py-3 px-3 align-top">
                      <div className="font-semibold text-slate-900">{doc.title}</div>
                      <div className="text-slate-500 mt-0.5">{doc.description}</div>
                    </td>

                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      {isReq ? (
                        <span
                          className={`font-medium ${
                            rec.attached && !expired ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {expired ? 'Expired' : rec.attached ? 'Required · Met' : 'Required'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Optional</span>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top">
                      <input
                        type="text"
                        value={rec.referenceNumber}
                        onChange={(e) =>
                          updateDocument(doc.key, { referenceNumber: e.target.value })
                        }
                        placeholder={doc.placeholderRef}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </td>

                    <td className="py-3 px-3 align-top">
                      {doc.hasExpiration ? (
                        <div>
                          <input
                            type="date"
                            value={rec.expirationDate}
                            onChange={(e) =>
                              updateDocument(doc.key, { expirationDate: e.target.value })
                            }
                            className={`w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white border rounded focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                              expired
                                ? 'border-red-500 text-red-700'
                                : 'border-slate-300 text-slate-700'
                            }`}
                          />
                          {expired && (
                            <div className="text-[11px] font-medium text-red-700 mt-1">
                              Expires before flight
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">N/A</span>
                      )}
                    </td>

                    <td className="py-3 pl-3 pr-6 align-top">
                      <input
                        type="text"
                        value={rec.notes}
                        onChange={(e) => updateDocument(doc.key, { notes: e.target.value })}
                        placeholder="Add verification note..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: Site-Specific Hazard Mitigation Matrix */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              03. Site-Specific Hazard Mitigation Matrix (JHA Input)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Document engineering and procedural controls for every site hazard identified in Site &amp; Airspace.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {pkg.mitigations.length} controls logged
          </span>
        </div>

        {pkg.mitigations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                  <th className="py-2.5 pl-6 pr-3 w-56">Identified Hazard</th>
                  <th className="py-2.5 px-3 w-24">Risk</th>
                  <th className="py-2.5 px-3">Mitigation Control / Operational Procedure</th>
                  <th className="py-2.5 px-3 w-32">Owner</th>
                  <th className="py-2.5 pl-3 pr-6 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {pkg.mitigations.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="py-3 pl-6 pr-3 font-semibold text-slate-900 align-top">
                      {m.hazard}
                    </td>
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          m.riskLevel === 'High'
                            ? 'text-red-700'
                            : m.riskLevel === 'Medium'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {m.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 leading-relaxed align-top">
                      {m.mitigationControl}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 align-top whitespace-nowrap">
                      {m.owner}
                    </td>
                    <td className="py-3 pl-3 pr-6 align-top text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteMitigation(m.id)}
                        aria-label={`Remove mitigation for ${m.hazard}`}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            No hazard mitigations logged yet. Add one below or click “Add Mitigation Control” on any hazard gap above.
          </div>
        )}

        {/* Inline Add Mitigation Form */}
        <form onSubmit={handleAddCustomMitigation} className="p-6 bg-slate-50/50 space-y-4">
          <div className="text-xs font-semibold text-slate-800">Add Custom Hazard Control</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <input
                type="text"
                value={newHazard}
                onChange={(e) => setNewHazard(e.target.value)}
                placeholder="Hazard (e.g., Helicopter Pad)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div className="md:col-span-2">
              <select
                value={newRisk}
                onChange={(e) => setNewRisk(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="High">High Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="Low">Low Risk</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <input
                type="text"
                value={newControl}
                onChange={(e) => setNewControl(e.target.value)}
                placeholder="Specific engineering or procedural control..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="Owner (PIC / VO)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                className="w-full px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
};
