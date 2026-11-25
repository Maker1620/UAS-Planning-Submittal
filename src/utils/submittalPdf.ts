import { jsPDF } from 'jspdf';
import { CLIENT_PROFILES, DOCUMENT_CATALOG } from '../data/clientProfiles';
import { formatElementMetrics, MAP_CATEGORIES } from '../data/mapCategories';
import { AuditSummary, SubmittalPackage } from '../types/submittal';

export function generateSubmittalPdfBlob(
  pkg: SubmittalPackage,
  audit: AuditSummary
): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 48;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(34);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  const drawKeyValueRow = (label: string, value: string) => {
    const cleanValue = value || '—';
    const lines = doc.splitTextToSize(cleanValue, maxWidth - 150) as string[];
    const rowHeight = Math.max(15, lines.length * 12 + 4);
    ensureSpace(rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(lines, margin + 150, y);
    y += rowHeight;
  };

  const profile = CLIENT_PROFILES[pkg.clientProfileId];

  // Header Block
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`UAS FLIGHT OPERATIONS SUBMITTAL PACKAGE  |  REF ${pkg.referenceCode}`, margin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(pkg.title || 'Untitled UAS Flight Submittal', maxWidth) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 18 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Prepared by ${pkg.operations.operatorCompany || 'Operator Unspecified'}  ·  Client: ${
      pkg.operations.clientOrganization || 'Client Unspecified'
    }  ·  Standard: ${profile.name}`,
    margin,
    y
  );
  y += 14;
  doc.text(
    `Mission Window: ${pkg.operations.plannedDate || 'TBD'} (${pkg.operations.startTime}–${
      pkg.operations.endTime
    })  ·  Revision: ${pkg.updatedAt}`,
    margin,
    y
  );
  y += 16;

  // Readiness Summary Strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, maxWidth, 34, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  if (audit.readinessStatus === 'Ready for Client Submittal') {
    doc.setTextColor(4, 120, 87);
  } else if (audit.readinessStatus === 'Conditional — Review Warnings') {
    doc.setTextColor(180, 83, 9);
  } else {
    doc.setTextColor(185, 28, 28);
  }
  doc.text(`Audit Status: ${audit.readinessStatus}`, margin + 10, y + 14);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Blockers: ${audit.blockers}   |   Missing Docs: ${audit.missingDocs}   |   Warnings: ${audit.warnings}   |   Passed: ${audit.passed}/${audit.totalChecks}`,
    margin + 10,
    y + 27
  );
  y += 44;

  // 01. Site & Airspace
  drawSectionHeading('01. Site-Specific Location & Airspace Assessment');
  drawKeyValueRow('Site / Facility', pkg.site.siteName);
  drawKeyValueRow('Physical Address', pkg.site.address);
  drawKeyValueRow('Coordinates (Lat / Lon)', `${pkg.site.latitude || '—'}, ${pkg.site.longitude || '—'}`);
  drawKeyValueRow('Operating Environment', pkg.site.environment);
  drawKeyValueRow(
    'Airspace & LAANC Grid',
    `Class ${pkg.site.airspaceClass} · ${
      pkg.site.airspaceClass === 'G'
        ? '400 ft Uncontrolled'
        : `${pkg.site.laancGridCeilingFt} ft Grid (${pkg.site.laancAvailable ? 'LAANC Available' : 'Manual DroneZone'})`
    }`
  );
  drawKeyValueRow(
    'Nearest Airport / Heliport',
    `${pkg.site.nearestAirportCode || '—'} (${pkg.site.nearestAirportDistanceNm} NM)`
  );
  drawKeyValueRow(
    'Obstacle / Standoff',
    `Tallest Obstacle: ${pkg.site.tallestObstacleFt} ft AGL  |  Horizontal Standoff: ${pkg.site.horizontalStandoffFt} ft`
  );
  drawKeyValueRow(
    'Weather & RF Limits',
    `Max Wind ${pkg.site.maxWindLimitKt} kt  |  Min Visibility ${pkg.site.minVisibilitySm} SM  |  RF Interference: ${pkg.site.rfInterference}`
  );

  // 02. Flight Operations, Aircraft & Crew
  drawSectionHeading('02. Operational Parameters, Aircraft & Crew Roster');
  drawKeyValueRow('Mission Profile', pkg.operations.missionType);
  drawKeyValueRow(
    'Max Altitude & Lighting',
    `${pkg.operations.maxPlannedAglFt} ft AGL  |  ${pkg.operations.lighting}  |  ${pkg.operations.losMode}`
  );
  drawKeyValueRow(
    'Over People / Vehicles',
    `${pkg.operations.overPeople}  |  Over Moving Vehicles: ${pkg.operations.overMovingVehicles ? 'Yes' : 'No'}`
  );
  drawKeyValueRow(
    'Aircraft & Registration',
    `${pkg.operations.aircraftModel || '—'} (${pkg.operations.aircraftRegNumber || 'Unregistered'})  |  ${pkg.operations.mtowLbs} lbs`
  );
  drawKeyValueRow(
    'Remote ID & NDAA',
    `${pkg.operations.remoteId}  |  ${pkg.operations.ndaaCompliant ? 'NDAA Compliant' : 'Non-NDAA'}`
  );
  drawKeyValueRow(
    'Lost-Link Failsafe',
    `${pkg.operations.lostLinkAction}${
      pkg.operations.lostLinkAction === 'Return to Home (RTH)'
        ? ` @ ${pkg.operations.rthAltitudeFt} ft AGL`
        : ''
    }`
  );
  drawKeyValueRow(
    'Pilot-in-Command (PIC)',
    `${pkg.operations.picName || '—'}  |  Part 107 #${pkg.operations.picCertNumber || '—'}  |  ${pkg.operations.picFlightHours} hrs`
  );
  drawKeyValueRow(
    'Visual Observer(s)',
    `${pkg.operations.voCount} assigned${pkg.operations.voNames ? ` (${pkg.operations.voNames})` : ''}`
  );
  drawKeyValueRow(
    'Liability Insurance (COI)',
    `$${pkg.operations.coiCoverageMillions}M  |  ${
      pkg.operations.additionalInsuredNamed ? 'Client Additional Insured Confirmed' : 'Additional Insured Pending'
    }`
  );

  // 03. Operational Site Map Annotations
  const elements = pkg.mapElements ?? [];
  drawSectionHeading(`03. Operational Site Map Annotations (${elements.length} Features)`);
  if (elements.length === 0) {
    drawKeyValueRow('Plotted Features', 'No operational map elements plotted.');
  } else {
    elements.forEach((el, idx) => {
      const cat = MAP_CATEGORIES[el.category];
      const summary = `[${cat.shortLabel} · ${el.geometry}] ${formatElementMetrics(el)}${
        el.altitudeAglFt ? ` · ${el.altitudeAglFt} ft AGL` : ''
      }${el.notes ? ` — ${el.notes}` : ''}`;
      drawKeyValueRow(`${idx + 1}. ${el.label}`, summary);
    });
  }

  // 04. Hazard Mitigations
  drawSectionHeading(`04. Site-Specific Hazard Mitigation Matrix (${pkg.mitigations.length})`);
  if (pkg.mitigations.length === 0) {
    drawKeyValueRow('Hazards', 'No hazard mitigations entered.');
  } else {
    pkg.mitigations.forEach((m) => {
      drawKeyValueRow(`[${m.riskLevel}] ${m.hazard}`, `${m.mitigationControl} (Owner: ${m.owner})`);
    });
  }

  // 05. Emergency & Access
  drawSectionHeading('05. Emergency Staging, Medical & Site Access Protocol');
  drawKeyValueRow('Emergency Landing Zones', pkg.site.emergencyLandingZones || 'Not specified');
  drawKeyValueRow('Nearest Hospital', pkg.site.nearestHospital || 'Not specified');
  drawKeyValueRow('Site Access Notes', pkg.site.siteAccessNotes || 'Standard client arrival protocol');

  // 06. Documentation Manifest
  const attachedDocs = DOCUMENT_CATALOG.filter((d) => pkg.documents[d.key].attached);
  drawSectionHeading(`06. Attached Submittal Documentation Manifest (${attachedDocs.length})`);
  if (attachedDocs.length === 0) {
    drawKeyValueRow('Attachments', 'No supporting documents marked attached.');
  } else {
    attachedDocs.forEach((d) => {
      const rec = pkg.documents[d.key];
      const exp = d.hasExpiration ? ` · Exp: ${rec.expirationDate || 'Not set'}` : '';
      const notes = rec.notes ? ` — ${rec.notes}` : '';
      drawKeyValueRow(d.title, `Ref: ${rec.referenceNumber || 'Attached'}${exp}${notes}`);
    });
  }

  // 07. Open Compliance Gaps
  const openGaps = audit.findings.filter(
    (f) => f.severity === 'blocker' || f.severity === 'missing_doc'
  );
  if (openGaps.length > 0) {
    drawSectionHeading(`07. Open Pre-Submittal Compliance Gaps (${openGaps.length})`);
    openGaps.forEach((g) => {
      drawKeyValueRow(`[${g.citation}]`, `${g.title}: ${g.remediation}`);
    });
  }

  // Sign-off footer
  ensureSpace(64);
  y += 14;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y + 22, margin + 230, y + 22);
  doc.line(margin + 270, y + 22, pageWidth - margin, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Remote Pilot-in-Command Attestation', margin, y);
  doc.text('Client HSE / Aviation Safety Authorization', margin + 270, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${pkg.operations.picName || 'PIC'} (Cert #${pkg.operations.picCertNumber || '—'})`,
    margin,
    y + 34
  );
  doc.text(pkg.operations.clientContactName || 'Client Reviewer', margin + 270, y + 34);

  const blob = doc.output('blob');
  const safeRef = (pkg.referenceCode || 'uas-submittal').replace(/[^a-zA-Z0-9-_]/g, '-');
  return {
    blob,
    fileName: `${safeRef}-submittal-package.pdf`,
  };
}
