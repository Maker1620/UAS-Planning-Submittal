import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Printer,
  Upload,
} from 'lucide-react';
import { CLIENT_PROFILES, DOCUMENT_CATALOG } from '../data/clientProfiles';
import { formatElementMetrics, MAP_CATEGORIES } from '../data/mapCategories';
import { AuditSummary, SubmittalPackage, WorkspaceTab } from '../types/submittal';
import { AirspaceProfileDiagram } from './AirspaceProfileDiagram';

interface SubmittalPackageViewProps {
  pkg: SubmittalPackage;
  audit: AuditSummary;
  driveConnected: boolean;
  uploadingPdf: boolean;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onUploadPdfToDrive: () => void;
}

export const SubmittalPackageView: React.FC<SubmittalPackageViewProps> = ({
  pkg,
  audit,
  driveConnected,
  uploadingPdf,
  onNavigateTab,
  onUploadPdfToDrive,
}) => {
  const [copied, setCopied] = useState(false);
  const profile = CLIENT_PROFILES[pkg.clientProfileId];

  const attachedDocs = DOCUMENT_CATALOG.filter((d) => pkg.documents[d.key].attached);
  const openGaps = audit.findings.filter(
    (f) => f.severity === 'blocker' || f.severity === 'missing_doc'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      submittalPackage: pkg,
      complianceAuditSummary: {
        readinessStatus: audit.readinessStatus,
        blockers: audit.blockers,
        missingDocuments: audit.missingDocs,
        warnings: audit.warnings,
        passedChecks: audit.passed,
        findings: audit.findings,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.referenceCode || 'uas-submittal'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBrief = async () => {
    const lines = [
      `UAS FLIGHT SUBMITTAL TRANSMITTAL — ${pkg.referenceCode}`,
      `Project: ${pkg.title}`,
      `Client: ${pkg.operations.clientOrganization || 'Not specified'} (${profile.name})`,
      `Operator: ${pkg.operations.operatorCompany || 'Not specified'}`,
      `Planned Window: ${pkg.operations.plannedDate} ${pkg.operations.startTime}–${pkg.operations.endTime}`,
      ``,
      `SITE & AIRSPACE`,
      `- Site: ${pkg.site.siteName} (${pkg.site.address})`,
      `- Coordinates: ${pkg.site.latitude}, ${pkg.site.longitude}`,
      `- Airspace: Class ${pkg.site.airspaceClass} (LAANC Grid: ${pkg.site.laancGridCeilingFt} ft) | Planned Max AGL: ${pkg.operations.maxPlannedAglFt} ft`,
      `- Tallest Obstacle: ${pkg.site.tallestObstacleFt} ft | Horizontal Standoff: ${pkg.site.horizontalStandoffFt} ft`,
      ``,
      `CREW & AIRCRAFT`,
      `- PIC: ${pkg.operations.picName} (Part 107 #${pkg.operations.picCertNumber}, ${pkg.operations.picFlightHours} hrs)`,
      `- Visual Observer(s): ${pkg.operations.voCount} (${pkg.operations.voNames || 'None'})`,
      `- Aircraft: ${pkg.operations.aircraftModel} (${pkg.operations.aircraftRegNumber}, ${pkg.operations.mtowLbs} lbs, ${pkg.operations.remoteId})`,
      `- Liability COI: $${pkg.operations.coiCoverageMillions}M (${pkg.operations.additionalInsuredNamed ? 'Additional Insured confirmed' : 'Additional Insured pending'})`,
      ``,
      `COMPLIANCE AUDIT STATUS: ${audit.readinessStatus}`,
      `- Blockers: ${audit.blockers} | Missing Docs: ${audit.missingDocs} | Warnings: ${audit.warnings} | Passed: ${audit.passed}/${audit.totalChecks}`,
      ...(openGaps.length > 0
        ? ['', 'OPEN ITEMS BEFORE FLIGHT:', ...openGaps.map((g) => `- [${g.citation}] ${g.title}`)]
        : ['', 'All regulatory and client submittal checks satisfied.']),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Screen-only Action Toolbar */}
      <div className="no-print flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Client Flight Submittal Package
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Formatted operational and site-specific assessment dossier ready for client HSE or aviation safety submission.
          </p>
          {pkg.driveSync?.folderName && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 font-mono">
              <span>Google Drive: {pkg.driveSync.folderName}</span>
              {pkg.driveSync.lastSyncedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Synced{' '}
                    {new Date(pkg.driveSync.lastSyncedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </>
              )}
              {pkg.driveSync.webViewLink && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={pkg.driveSync.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    Open in Drive
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyBrief}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Brief' : 'Copy Transmittal Brief'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          {driveConnected && (
            <button
              type="button"
              onClick={onUploadPdfToDrive}
              disabled={uploadingPdf}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingPdf ? 'Uploading PDF…' : 'Upload PDF to Drive'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Warning Notice if Blockers Remain */}
      {openGaps.length > 0 && (
        <div className="no-print bg-red-50/70 border border-red-200 rounded-md px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
            <div className="text-xs text-red-900">
              <span className="font-semibold">
                {openGaps.length} unresolved compliance {openGaps.length === 1 ? 'gap' : 'gaps'} detected.
              </span>{' '}
              This package is marked <span className="font-semibold">{audit.readinessStatus}</span> and may be rejected by {pkg.operations.clientOrganization || 'the client'} until blockers and missing documents are resolved.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('audit')}
            className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white hover:bg-red-50 border border-red-300 rounded-md whitespace-nowrap cursor-pointer"
          >
            Resolve Gaps in Audit
          </button>
        </div>
      )}

      {/* Printable Formal Engineering Submittal Sheet */}
      <article className="print-sheet bg-white border border-slate-200 rounded-md p-8 lg:p-10 space-y-8">
        {/* Document Control Header */}
        <header className="pb-6 border-b border-slate-300 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-slate-500">
              UAS FLIGHT OPERATIONS SUBMITTAL PACKAGE · REF {pkg.referenceCode}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {pkg.title || 'Untitled UAS Flight Submittal'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
              <span>Prepared by {pkg.operations.operatorCompany || 'Operator Unspecified'}</span>
              <span aria-hidden="true">·</span>
              <span>For {pkg.operations.clientOrganization || 'Client Unspecified'}</span>
              <span aria-hidden="true">·</span>
              <span>Standard: {profile.name}</span>
            </div>
          </div>

          <div className="text-left sm:text-right font-mono text-xs tabular-nums space-y-1">
            <div className="text-slate-500">Revision Date: {pkg.updatedAt}</div>
            <div className="text-slate-500">
              Mission Date: {pkg.operations.plannedDate || 'TBD'} ({pkg.operations.startTime}–{pkg.operations.endTime})
            </div>
            <div
              className={`font-semibold pt-1 ${
                audit.readinessStatus === 'Ready for Client Submittal'
                  ? 'text-emerald-700'
                  : audit.readinessStatus === 'Conditional — Review Warnings'
                    ? 'text-amber-700'
                    : 'text-red-700'
              }`}
            >
              Audit Status: {audit.readinessStatus}
            </div>
          </div>
        </header>

        {/* Compliance Readiness Summary Bar */}
        <section className="print-break-avoid grid grid-cols-2 sm:grid-cols-4 border border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-md">
          <div className="p-4">
            <div className="text-xs text-slate-500">Blockers</div>
            <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900">
              {audit.blockers}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">Missing Docs</div>
            <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900">
              {audit.missingDocs}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">Safety Warnings</div>
            <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900">
              {audit.warnings}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">Checks Verified</div>
            <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900">
              {audit.passed} / {audit.totalChecks}
            </div>
          </div>
        </section>

        {/* 01. Site & Airspace Parameters */}
        <section className="print-break-avoid space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
            01. Site-Specific Location &amp; Airspace Assessment
          </h3>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs">
            <div>
              <dt className="text-slate-500">Site / Facility</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{pkg.site.siteName || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Physical Address</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{pkg.site.address || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Coordinates (Lat / Lon)</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                {pkg.site.latitude || '—'}, {pkg.site.longitude || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Operating Environment</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{pkg.site.environment}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Airspace &amp; LAANC Ceiling</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                Class {pkg.site.airspaceClass} · {pkg.site.airspaceClass === 'G' ? '400 ft Uncontrolled' : `${pkg.site.laancGridCeilingFt} ft Grid`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Nearest Airport / Heliport</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                {pkg.site.nearestAirportCode || '—'} ({pkg.site.nearestAirportDistanceNm} NM)
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Tallest Obstacle / Standoff</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                {pkg.site.tallestObstacleFt} ft AGL / {pkg.site.horizontalStandoffFt} ft lateral
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Weather Minimums &amp; RF Level</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                Max {pkg.site.maxWindLimitKt} kt · Vis ≥{pkg.site.minVisibilitySm} SM · RF {pkg.site.rfInterference}
              </dd>
            </div>
          </dl>

          <div className="pt-2">
            <AirspaceProfileDiagram
              site={pkg.site}
              operations={pkg.operations}
              clientReq={pkg.clientRequirements}
              compact
            />
          </div>
        </section>

        {/* 02. Operational Envelope, Aircraft & Crew */}
        <section className="print-break-avoid space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
            02. Operational Parameters, Aircraft &amp; Crew Roster
          </h3>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs">
            <div>
              <dt className="text-slate-500">Mission Profile</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{pkg.operations.missionType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Max Altitude &amp; Lighting</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                {pkg.operations.maxPlannedAglFt} ft AGL · {pkg.operations.lighting}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">LOS &amp; Over-People Posture</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {pkg.operations.losMode} · {pkg.operations.overPeople}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Aircraft &amp; Registration</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {pkg.operations.aircraftModel || '—'} ·{' '}
                <span className="font-mono">{pkg.operations.aircraftRegNumber || 'Unregistered'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">MTOW / Remote ID / NDAA</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                {pkg.operations.mtowLbs} lbs · {pkg.operations.remoteId} ·{' '}
                {pkg.operations.ndaaCompliant ? 'NDAA Verified' : 'Non-NDAA'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Lost-Link Failsafe</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                {pkg.operations.lostLinkAction}
                {pkg.operations.lostLinkAction === 'Return to Home (RTH)'
                  ? ` @ ${pkg.operations.rthAltitudeFt} ft AGL`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Pilot-in-Command (PIC)</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {pkg.operations.picName || '—'} · Cert{' '}
                <span className="font-mono">{pkg.operations.picCertNumber || '—'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Visual Observer(s)</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {pkg.operations.voCount} assigned{pkg.operations.voNames ? ` (${pkg.operations.voNames})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Aviation Liability Insurance</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                ${pkg.operations.coiCoverageMillions}M ·{' '}
                {pkg.operations.additionalInsuredNamed ? 'Client Addl. Insured' : 'No Addl. Insured'}
              </dd>
            </div>
          </dl>
        </section>

        {/* 03. Operational Map Elements Schedule */}
        <section className="print-break-avoid space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              03. Operational Site Map Annotations ({(pkg.mapElements ?? []).length} Features)
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('map')}
              className="no-print text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              Edit on 3D Earth Map
            </button>
          </div>
          {(pkg.mapElements ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">
              No operational points, lines, or polygons plotted on the Site Map.
            </p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Label</th>
                  <th className="py-2 px-3 font-medium w-28">Category</th>
                  <th className="py-2 px-3 font-medium w-20">Shape</th>
                  <th className="py-2 px-3 font-medium w-44">Coordinates / Geometry</th>
                  <th className="py-2 pl-3 font-medium">Operational Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(pkg.mapElements ?? []).map((el) => (
                  <tr key={el.id}>
                    <td className="py-2 pr-3 font-medium text-slate-900 align-top">{el.label}</td>
                    <td className="py-2 px-3 text-slate-700 align-top whitespace-nowrap">
                      {MAP_CATEGORIES[el.category].shortLabel}
                    </td>
                    <td className="py-2 px-3 capitalize font-mono text-slate-600 align-top">
                      {el.geometry}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-700 align-top">
                      {formatElementMetrics(el)}
                      {el.altitudeAglFt ? ` · ${el.altitudeAglFt} ft` : ''}
                    </td>
                    <td className="py-2 pl-3 text-slate-600 align-top">{el.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 04. Hazard Mitigation Matrix */}
        <section className="print-break-avoid space-y-3">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
            04. Site-Specific Hazard Mitigation Matrix
          </h3>
          {pkg.mitigations.length === 0 ? (
            <p className="text-xs text-slate-500">No hazard mitigations entered.</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Hazard</th>
                  <th className="py-2 px-3 font-medium w-20">Risk</th>
                  <th className="py-2 px-3 font-medium">Control / Mitigation Procedure</th>
                  <th className="py-2 pl-3 font-medium w-28">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pkg.mitigations.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900 align-top">{m.hazard}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 align-top">{m.riskLevel}</td>
                    <td className="py-2.5 px-3 text-slate-700 leading-relaxed align-top">
                      {m.mitigationControl}
                    </td>
                    <td className="py-2.5 pl-3 font-mono text-slate-600 align-top">{m.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 05. Emergency Response & Site Access */}
        <section className="print-break-avoid space-y-3">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
            05. Emergency Staging, Medical &amp; Site Access Protocol
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <div className="text-slate-500 font-medium">Emergency Landing Zones (ELZ)</div>
              <p className="mt-1 text-slate-800 leading-relaxed">
                {pkg.site.emergencyLandingZones || 'Not specified — required prior to launch.'}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-slate-500 font-medium">Nearest Emergency Medical Facility</div>
                <p className="mt-1 text-slate-800">
                  {pkg.site.nearestHospital || 'Not specified.'}
                </p>
              </div>
              <div>
                <div className="text-slate-500 font-medium">Site Access &amp; Escort Check-In</div>
                <p className="mt-1 text-slate-800">
                  {pkg.site.siteAccessNotes || 'Standard client arrival protocol.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 06. Documentation Manifest */}
        <section className="print-break-avoid space-y-3">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
            06. Attached Submittal Documentation Manifest ({attachedDocs.length} Attachments)
          </h3>
          {attachedDocs.length === 0 ? (
            <p className="text-xs text-slate-500">No supporting documents marked attached.</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Document</th>
                  <th className="py-2 px-3 font-medium w-44">Reference #</th>
                  <th className="py-2 px-3 font-medium w-32">Expiration</th>
                  <th className="py-2 pl-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {attachedDocs.map((doc) => {
                  const rec = pkg.documents[doc.key];
                  return (
                    <tr key={doc.key}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{doc.title}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">
                        {rec.referenceNumber || 'Attached'}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-600">
                        {doc.hasExpiration ? rec.expirationDate || 'Not set' : 'N/A'}
                      </td>
                      <td className="py-2 pl-3 text-slate-600">{rec.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* 07. Open Findings Log (if any) */}
        {openGaps.length > 0 && (
          <section className="print-break-avoid space-y-3">
            <h3 className="text-sm font-bold text-red-800 pb-2 border-b border-red-200">
              07. Unresolved Compliance Gaps Flagged by Pre-Submittal Audit
            </h3>
            <ul className="space-y-2 text-xs text-slate-800">
              {openGaps.map((g) => (
                <li key={g.id} className="flex items-start gap-2">
                  <span className="font-mono text-red-700 shrink-0">[{g.citation}]</span>
                  <span>
                    <strong className="font-semibold text-slate-900">{g.title}:</strong> {g.remediation}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sign-Off Block */}
        <footer className="print-break-avoid pt-6 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
          <div className="space-y-6">
            <div className="font-semibold text-slate-900">Remote Pilot-in-Command Attestation</div>
            <div className="border-b border-slate-400 pb-1 text-slate-500">
              Signature / {pkg.operations.picName || 'PIC Name'} (Cert #{pkg.operations.picCertNumber || '—'})
            </div>
            <div className="text-slate-500 font-mono">Date: ______________________</div>
          </div>

          <div className="space-y-6">
            <div className="font-semibold text-slate-900">Client HSE / Aviation Safety Authorization</div>
            <div className="border-b border-slate-400 pb-1 text-slate-500">
              Approved By / {pkg.operations.clientContactName || 'Client Reviewer'}
            </div>
            <div className="text-slate-500 font-mono">Date: ______________________</div>
          </div>
        </footer>
      </article>
    </div>
  );
};
