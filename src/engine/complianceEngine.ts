import { CLIENT_PROFILES, GROUND_HAZARD_CATALOG } from '../data/clientProfiles';
import {
  AuditSummary,
  ComplianceFinding,
  DocumentKey,
  SubmittalPackage,
} from '../types/submittal';

function isDateBefore(dateStr: string, referenceDateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const ref = referenceDateStr ? new Date(referenceDateStr + 'T00:00:00') : new Date();
  if (Number.isNaN(d.getTime()) || Number.isNaN(ref.getTime())) return false;
  return d.getTime() < ref.getTime();
}

function monthsBetween(earlierDateStr: string, laterDateStr: string): number | null {
  if (!earlierDateStr) return null;
  const d1 = new Date(earlierDateStr + 'T00:00:00');
  const d2 = laterDateStr ? new Date(laterDateStr + 'T00:00:00') : new Date();
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

export function evaluateSubmittalCompliance(pkg: SubmittalPackage): AuditSummary {
  const findings: ComplianceFinding[] = [];
  const { site, operations, clientRequirements: req, documents, mitigations } = pkg;
  const profile = CLIENT_PROFILES[pkg.clientProfileId];
  const flightDate = operations.plannedDate;

  const isControlledAirspace = site.airspaceClass !== 'G';

  // 1. AIRSPACE AUTHORIZATION (14 CFR §107.41)
  if (isControlledAirspace) {
    const laancDoc = documents.laanc_waiver;
    const exceedsLaancCeiling =
      !site.laancAvailable || operations.maxPlannedAglFt > site.laancGridCeilingFt;

    if (!laancDoc.attached || !laancDoc.referenceNumber.trim()) {
      findings.push({
        id: 'reg-airspace-auth',
        severity: 'blocker',
        category: 'Airspace & Regulatory',
        source: 'FAA Part 107',
        citation: '14 CFR §107.41',
        title: `Controlled Class ${site.airspaceClass} airspace authorization missing`,
        detail: exceedsLaancCeiling
          ? `Planned ${operations.maxPlannedAglFt} ft AGL exceeds the ${site.laancGridCeilingFt} ft LAANC facility ceiling in Class ${site.airspaceClass} airspace. Manual FAA DroneZone authorization is required prior to flight.`
          : `Flight operates inside Class ${site.airspaceClass} controlled airspace (${site.laancGridCeilingFt} ft LAANC grid). An approved LAANC authorization reference must be logged in the submittal package.`,
        remediation: exceedsLaancCeiling
          ? 'Submit a Further Coordination / FAA DroneZone airspace authorization (allow up to 90 days) or lower max planned AGL to stay within the LAANC ceiling.'
          : 'Obtain LAANC clearance for the planned date/time window and attach the authorization ID.',
        targetTab: 'site',
        docKey: 'laanc_waiver',
      });
    } else if (laancDoc.expirationDate && isDateBefore(laancDoc.expirationDate, flightDate)) {
      findings.push({
        id: 'reg-airspace-expired',
        severity: 'blocker',
        category: 'Airspace & Regulatory',
        source: 'FAA Part 107',
        citation: '14 CFR §107.41',
        title: 'Airspace authorization expires before planned flight date',
        detail: `Attached authorization ${laancDoc.referenceNumber} expires on ${laancDoc.expirationDate}, prior to the planned operation on ${flightDate}.`,
        remediation: 'Renew LAANC or FAA airspace authorization to cover the full planned flight date.',
        targetTab: 'audit',
        docKey: 'laanc_waiver',
      });
    } else if (exceedsLaancCeiling) {
      findings.push({
        id: 'reg-airspace-ceiling-warn',
        severity: 'warning',
        category: 'Airspace & Regulatory',
        source: 'FAA Part 107',
        citation: '14 CFR §107.41',
        title: 'Planned AGL exceeds standard LAANC grid ceiling',
        detail: `Planned ${operations.maxPlannedAglFt} ft AGL exceeds the ${site.laancGridCeilingFt} ft UAS Facility Map grid. Confirm attached authorization (${laancDoc.referenceNumber}) explicitly grants Further Coordination up to ${operations.maxPlannedAglFt} ft AGL.`,
        remediation: 'Verify attached approval ceiling matches or exceeds max planned AGL, or reduce flight altitude.',
        targetTab: 'operations',
      });
    } else {
      findings.push({
        id: 'reg-airspace-pass',
        severity: 'passed',
        category: 'Airspace & Regulatory',
        source: 'FAA Part 107',
        citation: '14 CFR §107.41',
        title: `Class ${site.airspaceClass} airspace authorization logged`,
        detail: `Authorization ${laancDoc.referenceNumber} attached for ${operations.maxPlannedAglFt} ft AGL within ${site.laancGridCeilingFt} ft ceiling.`,
        remediation: 'Maintain copy of authorization on-site during operations.',
        targetTab: 'site',
      });
    }
  } else {
    findings.push({
      id: 'reg-airspace-g-pass',
      severity: 'passed',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.41',
      title: 'Class G uncontrolled airspace verified',
      detail: 'No ATC airspace authorization required for standard Class G operations below 400 ft AGL.',
      remediation: 'Confirm no temporary flight restrictions exist immediately before launch.',
      targetTab: 'site',
    });
  }

  // 2. MAX ALTITUDE RULE (14 CFR §107.51(b))
  const structureExceptionCeiling = site.tallestObstacleFt + 400;
  if (operations.maxPlannedAglFt > 400) {
    if (!isControlledAirspace && operations.maxPlannedAglFt <= structureExceptionCeiling && site.tallestObstacleFt > 0) {
      findings.push({
        id: 'reg-alt-structure-warn',
        severity: 'warning',
        category: 'Airspace & Regulatory',
        source: 'FAA Part 107',
        citation: '14 CFR §107.51(b)',
        title: 'Flight above 400 ft AGL relies on 400 ft structure radius exception',
        detail: `Planned altitude (${operations.maxPlannedAglFt} ft AGL) exceeds 400 ft AGL. In Class G airspace this is only lawful while staying within a 400 ft lateral radius of the ${site.tallestObstacleFt} ft structure.`,
        remediation: 'Document the 400 ft lateral radius boundary on the site diagram or lower planned AGL to 400 ft or below.',
        targetTab: 'operations',
      });
    } else {
      findings.push({
        id: 'reg-alt-blocker',
        severity: 'blocker',
        category: 'Airspace & Regulatory',
        source: 'FAA Part 107',
        citation: '14 CFR §107.51(b)',
        title: `Planned altitude (${operations.maxPlannedAglFt} ft AGL) exceeds Part 107 ceiling`,
        detail: isControlledAirspace
          ? `Operations above 400 ft AGL in Class ${site.airspaceClass} airspace are prohibited without a specific FAA §107.51(b) waiver.`
          : `Planned ${operations.maxPlannedAglFt} ft AGL exceeds the 400 ft AGL limit (and structure exception limit of ${structureExceptionCeiling} ft).`,
        remediation: 'Lower max planned AGL to 400 ft or below, or attach an approved §107.51(b) altitude waiver.',
        targetTab: 'operations',
      });
    }
  } else {
    findings.push({
      id: 'reg-alt-pass',
      severity: 'passed',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.51(b)',
      title: `Planned altitude (${operations.maxPlannedAglFt} ft AGL) within 400 ft Part 107 limit`,
      detail: 'Operation stays at or below the standard 400 ft AGL operational ceiling.',
      remediation: 'Configure flight controller max altitude geofence to match planned AGL.',
      targetTab: 'operations',
    });
  }

  // 3. TFR & NOTAM CHECK (14 CFR §107.47)
  if (site.activeTfrPresent) {
    findings.push({
      id: 'reg-tfr-active',
      severity: 'blocker',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.47',
      title: 'Active Temporary Flight Restriction (TFR) reported at site',
      detail: 'An active TFR impacts the mission footprint. Flight is prohibited unless an explicit FAA SGI waiver or TFR authorization is obtained.',
      remediation: 'Reschedule mission outside TFR effective hours or obtain FAA System Operations Support Center (SOSC) authorization.',
      targetTab: 'site',
    });
  } else if (!site.tfrNotamChecked) {
    findings.push({
      id: 'reg-tfr-unchecked',
      severity: 'warning',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.47',
      title: 'TFR & NOTAM check not yet verified',
      detail: 'Submittal does not confirm a preliminary TFR/NOTAM check for the operational coordinates.',
      remediation: 'Verify FAA TFRs and local NOTAMs on the Site & Airspace tab and re-verify 2 hours prior to launch.',
      targetTab: 'site',
    });
  } else {
    findings.push({
      id: 'reg-tfr-pass',
      severity: 'passed',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.47',
      title: 'TFR & NOTAM screening completed with no conflicts',
      detail: 'Preliminary TFR/NOTAM screening confirmed clear; standard pre-launch re-verification applies.',
      remediation: 'Re-check TFR feed on launch morning.',
      targetTab: 'site',
    });
  }

  // 4. NIGHT & CIVIL TWILIGHT OPERATIONS (14 CFR §107.29)
  if (operations.lighting === 'Night' || operations.lighting === 'Civil Twilight') {
    if (!operations.strobe3SmEquipped) {
      findings.push({
        id: 'reg-night-strobe',
        severity: 'blocker',
        category: 'Crew & Aircraft',
        source: 'FAA Part 107',
        citation: '14 CFR §107.29(a)(2)',
        title: `${operations.lighting} flight requires 3 SM anti-collision lighting`,
        detail: `Mission is scheduled during ${operations.lighting}, but the aircraft is not marked as equipped with anti-collision lighting visible for at least 3 statute miles with a flash rate sufficient to avoid collision.`,
        remediation: 'Equip an FAA-compliant 3 SM anti-collision strobe and confirm it in Flight Operations.',
        targetTab: 'operations',
      });
    } else {
      findings.push({
        id: 'reg-night-pass',
        severity: 'passed',
        category: 'Crew & Aircraft',
        source: 'FAA Part 107',
        citation: '14 CFR §107.29',
        title: `${operations.lighting} anti-collision lighting verified`,
        detail: '3 SM anti-collision strobe confirmed equipped for low-light/night flight.',
        remediation: 'Verify strobe battery charge and PIC night recurrent training before flight.',
        targetTab: 'operations',
      });
    }
  }

  // 5. LINE OF SIGHT (VLOS / EVLOS / BVLOS — 14 CFR §107.31 / §107.33)
  if (operations.losMode === 'BVLOS') {
    const hasWaiver = documents.laanc_waiver.attached && documents.laanc_waiver.referenceNumber.trim().length > 0;
    findings.push({
      id: 'reg-bvlos',
      severity: hasWaiver ? 'warning' : 'blocker',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.31',
      title: hasWaiver
        ? 'BVLOS operation requires verification of §107.31 waiver scope'
        : 'BVLOS operation lacks required FAA §107.31 waiver',
      detail: hasWaiver
        ? `BVLOS is selected. Confirm attached waiver (${documents.laanc_waiver.referenceNumber}) specifically authorizes §107.31 BVLOS at this location and altitude.`
        : 'Beyond Visual Line of Sight (BVLOS) flight is strictly prohibited under Part 107 without an approved FAA §107.31 waiver.',
      remediation: 'Attach approved FAA §107.31 BVLOS waiver or revise mission profile to VLOS / EVLOS.',
      targetTab: 'operations',
      docKey: 'laanc_waiver',
    });
  } else if (operations.losMode === 'EVLOS' && operations.voCount < 1) {
    findings.push({
      id: 'reg-evlos-vo',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR §107.33',
      title: 'EVLOS operation requires at least one Visual Observer',
      detail: 'Extended Visual Line of Sight (EVLOS) requires a dedicated Visual Observer maintaining continuous unaided visual contact and two-way communication with the PIC.',
      remediation: 'Assign at least 1 Visual Observer and list VO names in Flight Operations.',
      targetTab: 'operations',
    });
  }

  // 6. OPERATIONS OVER PEOPLE & MOVING VEHICLES (14 CFR §107.145)
  if (operations.overPeople !== 'None (Sterile Area)' || operations.overMovingVehicles) {
    const isCat1 = operations.mtowLbs <= 0.55;
    const hasOopCompliance = isCat1 || (operations.oopParachuteDocEquipped && documents.oop_doc.attached);

    if (!hasOopCompliance) {
      findings.push({
        id: 'reg-oop-blocker',
        severity: 'blocker',
        category: 'Crew & Aircraft',
        source: 'FAA Part 107',
        citation: '14 CFR §107.145',
        title: 'Operations over people or moving vehicles lack Category DOC / waiver',
        detail: `Aircraft MTOW (${operations.mtowLbs} lbs) exceeds Category 1 (0.55 lb) while flight includes "${operations.overPeople}"${operations.overMovingVehicles ? ' and moving vehicle overflight' : ''}. No Category 2/3 Declaration of Compliance or §107.39/145 waiver is attached.`,
        remediation: 'Establish a sterile flight perimeter (no non-participants), or equip an FAA-accepted Category 2/3 parachute system and attach the DOC.',
        targetTab: 'operations',
        docKey: 'oop_doc',
      });
    } else {
      findings.push({
        id: 'reg-oop-pass',
        severity: 'passed',
        category: 'Crew & Aircraft',
        source: 'FAA Part 107',
        citation: '14 CFR §107.145',
        title: 'Operations Over People compliance documented',
        detail: isCat1
          ? 'Aircraft qualifies under Category 1 (<= 0.55 lb MTOW with no exposed rotating parts).'
          : `Category 2/3 DOC (${documents.oop_doc.referenceNumber || 'attached'}) verified alongside parachute system.`,
        remediation: 'Brief crew on restricted area boundaries prior to launch.',
        targetTab: 'operations',
      });
    }
  }

  // 7. REMOTE ID (14 CFR PART 89)
  if (operations.remoteId === 'None') {
    findings.push({
      id: 'reg-remote-id',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR Part 89',
      title: 'Aircraft lacks FAA Remote ID compliance',
      detail: 'All Part 107 aircraft operating outside an FAA-Recognized Identification Area (FRIA) must broadcast Standard Remote ID or use an attached Remote ID Broadcast Module.',
      remediation: 'Select a Standard Remote ID airframe or install a registered Remote ID Broadcast Module.',
      targetTab: 'operations',
    });
  } else {
    findings.push({
      id: 'reg-remote-id-pass',
      severity: 'passed',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR Part 89',
      title: `Remote ID compliance verified (${operations.remoteId})`,
      detail: 'Airframe satisfies 14 CFR Part 89 broadcast identification rules.',
      remediation: 'Confirm Remote ID broadcast status during pre-flight self-test.',
      targetTab: 'operations',
    });
  }

  // 8. MTOW > 55 LBS (14 CFR §107.3)
  if (operations.mtowLbs >= 55) {
    findings.push({
      id: 'reg-mtow-heavy',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR §107.3 / 49 USC §44807',
      title: `Airframe MTOW (${operations.mtowLbs} lbs) exceeds 55 lb Part 107 limit`,
      detail: 'Unmanned aircraft weighing 55 lbs or more at takeoff cannot operate under standard Part 107 and require a 49 U.S.C. §44807 exemption and COA.',
      remediation: 'Switch to a sub-55 lb Part 107 aircraft or attach §44807 exemption documentation.',
      targetTab: 'operations',
    });
  }

  // 9. PIC CERTIFICATION & 24-MONTH CURRENCY (14 CFR §107.65)
  const currencyAgeMonths = monthsBetween(operations.picCurrencyDate, flightDate);
  if (!operations.picName.trim() || !operations.picCertNumber.trim()) {
    findings.push({
      id: 'reg-pic-missing',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR §107.12',
      title: 'Pilot-in-Command (PIC) identity or certificate number missing',
      detail: 'Every commercial flight submittal must identify the certificated Remote PIC and Part 107 certificate number.',
      remediation: 'Enter the PIC full name and FAA Part 107 certificate number in Flight Operations.',
      targetTab: 'operations',
      docKey: 'part107_cert',
    });
  } else if (currencyAgeMonths !== null && currencyAgeMonths > 24) {
    findings.push({
      id: 'reg-pic-currency-expired',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR §107.65',
      title: 'PIC 24-calendar-month aeronautical knowledge currency expired',
      detail: `PIC recurrent training date (${operations.picCurrencyDate}) is ${currencyAgeMonths} months before the planned flight (${flightDate}), exceeding the 24-calendar-month FAA Part 107 currency limit.`,
      remediation: 'Complete FAA ALC-677 Part 107 Small UAS Recurrent training and update currency date.',
      targetTab: 'operations',
      docKey: 'part107_cert',
    });
  } else if (!documents.part107_cert.attached) {
    findings.push({
      id: 'doc-part107-missing',
      severity: 'missing_doc',
      category: 'Client & Documentation',
      source: 'FAA Part 107',
      citation: '14 CFR §107.7',
      title: 'Part 107 Remote Pilot Certificate copy not attached',
      detail: 'Client reviewers require a copy of the PIC certificate and recurrent training proof inside the submittal packet.',
      remediation: 'Attach Part 107 certificate copy and verify certificate reference.',
      targetTab: 'audit',
      docKey: 'part107_cert',
    });
  } else {
    findings.push({
      id: 'reg-pic-pass',
      severity: 'passed',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR §107.65',
      title: `PIC ${operations.picName} certified & current`,
      detail: `Certificate #${operations.picCertNumber} logged; recurrent training (${operations.picCurrencyDate}) is within 24-month currency window.`,
      remediation: 'Carry physical or digital FAA certificate on-site.',
      targetTab: 'operations',
    });
  }

  // 10. AIRCRAFT REGISTRATION (14 CFR PART 48)
  if (!operations.aircraftRegNumber.trim() || !documents.aircraft_reg.attached) {
    findings.push({
      id: 'doc-reg-missing',
      severity: !operations.aircraftRegNumber.trim() ? 'blocker' : 'missing_doc',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR Part 48',
      title: 'FAA aircraft registration missing or unattached',
      detail: !operations.aircraftRegNumber.trim()
        ? 'No FAA registration number (FA-...) entered for the primary airframe.'
        : `Registration #${operations.aircraftRegNumber} entered, but certificate copy is not marked attached for client verification.`,
      remediation: 'Enter the FA- registration number and attach the current FAA registration certificate.',
      targetTab: 'operations',
      docKey: 'aircraft_reg',
    });
  } else if (documents.aircraft_reg.expirationDate && isDateBefore(documents.aircraft_reg.expirationDate, flightDate)) {
    findings.push({
      id: 'doc-reg-expired',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR §48.100',
      title: 'FAA aircraft registration expired',
      detail: `Registration ${operations.aircraftRegNumber} expired on ${documents.aircraft_reg.expirationDate}, prior to the planned flight.`,
      remediation: 'Renew registration via FAA DroneZone and update expiration date.',
      targetTab: 'audit',
      docKey: 'aircraft_reg',
    });
  } else {
    findings.push({
      id: 'doc-reg-pass',
      severity: 'passed',
      category: 'Crew & Aircraft',
      source: 'FAA Part 107',
      citation: '14 CFR Part 48',
      title: `Airframe registration ${operations.aircraftRegNumber} verified`,
      detail: 'Registration certificate attached and active through planned mission window.',
      remediation: 'Confirm registration marking is legible on external aircraft surface.',
      targetTab: 'operations',
    });
  }

  // 11. SITE SAFETY: RTH ALTITUDE VS TALLEST OBSTACLE
  const recommendedRthFt = site.tallestObstacleFt + 50;
  if (operations.lostLinkAction === 'Return to Home (RTH)' && operations.rthAltitudeFt < recommendedRthFt) {
    findings.push({
      id: 'safety-rth-clearance',
      severity: 'blocker',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-OPS-02',
      title: `Lost-link RTH altitude (${operations.rthAltitudeFt} ft) below obstacle clearance margin`,
      detail: `Tallest site obstacle is ${site.tallestObstacleFt} ft AGL. RTH altitude should maintain at least a 50 ft vertical safety buffer (${recommendedRthFt} ft AGL) to prevent collision during autonomous return.`,
      remediation: `Raise RTH altitude to at least ${recommendedRthFt} ft AGL (while staying below airspace ceiling) or configure Hover-in-Place for under-structure flights.`,
      targetTab: 'operations',
    });
  } else {
    findings.push({
      id: 'safety-rth-pass',
      severity: 'passed',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-OPS-02',
      title: 'Lost-link profile clears tallest site obstacle',
      detail:
        operations.lostLinkAction === 'Return to Home (RTH)'
          ? `RTH set to ${operations.rthAltitudeFt} ft AGL, clearing ${site.tallestObstacleFt} ft obstacle by ${operations.rthAltitudeFt - site.tallestObstacleFt} ft.`
          : `Lost-link configured to ${operations.lostLinkAction} for controlled recovery.`,
      remediation: 'Verify failsafe setting in flight controller prior to takeoff.',
      targetTab: 'operations',
    });
  }

  // 12. SITE SAFETY: HORIZONTAL STANDOFF VS CLIENT MINIMUM
  if (site.horizontalStandoffFt < req.minStandoffFt) {
    findings.push({
      id: 'safety-standoff-gap',
      severity: 'blocker',
      category: 'Site & Safety',
      source: 'Client Assessment',
      citation: `${profile.name} · HSE-STD`,
      title: `Horizontal standoff (${site.horizontalStandoffFt} ft) below client minimum (${req.minStandoffFt} ft)`,
      detail: `${profile.name} standards require a minimum ${req.minStandoffFt} ft horizontal safety standoff from critical assets, non-participants, or energized equipment.`,
      remediation: `Increase planned horizontal standoff to at least ${req.minStandoffFt} ft in Site & Airspace or document client-approved engineering exception.`,
      targetTab: 'site',
    });
  } else {
    findings.push({
      id: 'safety-standoff-pass',
      severity: 'passed',
      category: 'Site & Safety',
      source: 'Client Assessment',
      citation: `${profile.name} · HSE-STD`,
      title: `Horizontal standoff (${site.horizontalStandoffFt} ft) meets ${req.minStandoffFt} ft client threshold`,
      detail: 'Lateral separation satisfies client asset and personnel buffer policy.',
      remediation: 'Mark standoff boundary on pre-flight site briefing.',
      targetTab: 'site',
    });
  }

  // 13. SITE SAFETY: AIRPORT / HELIPORT PROXIMITY, WEATHER, ELZ, RF
  if (site.nearestAirportDistanceNm <= 2.0) {
    findings.push({
      id: 'safety-airport-prox',
      severity: 'warning',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-AIR-04',
      title: `Close proximity to ${site.nearestAirportCode || 'nearest airport/heliport'} (${site.nearestAirportDistanceNm} NM)`,
      detail: 'Site lies within 2.0 NM of an active runway or heliport. Low-altitude manned approach and departure corridors require heightened vigilance.',
      remediation: 'Enable ADS-B traffic receiver, assign VO to monitor approach sector, and yield immediately to manned traffic.',
      targetTab: 'site',
    });
  }

  if (site.maxWindLimitKt > 22) {
    findings.push({
      id: 'safety-wind-limit',
      severity: 'warning',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-WX-01',
      title: `Operational wind cutoff (${site.maxWindLimitKt} kt) is elevated`,
      detail: 'Client HSE reviewers typically flag gust/wind abort thresholds above 22 kt (~25 mph) near structures or energized assets.',
      remediation: 'Lower max operational wind abort limit to 20–22 kt or attach airframe wind-rating specifications.',
      targetTab: 'site',
    });
  }

  if (!site.cloudClearanceConfirmed || site.minVisibilitySm < 3) {
    findings.push({
      id: 'reg-weather-mins',
      severity: 'blocker',
      category: 'Airspace & Regulatory',
      source: 'FAA Part 107',
      citation: '14 CFR §107.51(c)-(d)',
      title: 'Weather minimums do not satisfy Part 107 VFR requirements',
      detail: 'Part 107 mandates at least 3 statute miles flight visibility and cloud clearance of 500 ft below and 2,000 ft horizontally from clouds.',
      remediation: 'Set minimum visibility to >= 3 SM and confirm 500/2000 ft cloud clearance protocol in Site & Airspace.',
      targetTab: 'site',
    });
  }

  if (!site.emergencyLandingZones.trim() || !site.nearestHospital.trim()) {
    findings.push({
      id: 'safety-elz-missing',
      severity: 'warning',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-ERP-01',
      title: 'Emergency landing zones or nearest medical facility incomplete',
      detail: 'Client safety reviewers verify pre-identified primary/alternate emergency landing zones (ELZ) and the nearest emergency medical facility.',
      remediation: 'Specify clear ELZ locations and nearest hospital name/address in Site & Airspace.',
      targetTab: 'site',
    });
  }

  // Operational Map Spatial Verification (Google Earth 3D / Satellite plotting)
  const mapElements = pkg.mapElements ?? [];
  const plottedLzs = mapElements.filter((el) => el.category === 'landing_zone');
  const plottedPersonnel = mapElements.filter((el) => el.category === 'personnel');
  const plottedRisks = mapElements.filter((el) => el.category === 'risk');

  if (plottedLzs.length === 0) {
    findings.push({
      id: 'map-lz-unplotted',
      severity: 'warning',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-MAP-01',
      title: 'No Landing / Recovery Zone plotted on the Site Map',
      detail: 'Client aviation reviewers expect launch and emergency landing zones (LZ / ELZ) to be geo-referenced visually on the site map diagram.',
      remediation: 'Open the Site Map (3D Earth) tab and place at least one Landing Zone point or pad polygon.',
      targetTab: 'map',
    });
  } else {
    findings.push({
      id: 'map-lz-plotted',
      severity: 'passed',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-MAP-01',
      title: `${plottedLzs.length} geo-referenced Landing Zone${plottedLzs.length > 1 ? 's' : ''} plotted on Site Map`,
      detail: `Mapped LZ/ELZ markers (${plottedLzs.map((l) => l.label).join(', ')}) included in submittal coordinates schedule.`,
      remediation: 'Verify touchdown surface clearance on site arrival.',
      targetTab: 'map',
    });
  }

  if (operations.voCount > 0 && plottedPersonnel.length === 0) {
    findings.push({
      id: 'map-personnel-unplotted',
      severity: 'warning',
      category: 'Site & Safety',
      source: 'Client Assessment',
      citation: `${profile.name} · MAP-02`,
      title: 'Crew / Visual Observer staging positions not plotted on Site Map',
      detail: `${operations.voCount} Visual Observer(s) are assigned, but no Personnel stations are marked on the operational map to demonstrate sightline coverage.`,
      remediation: 'Plot PIC and Visual Observer positions on the Site Map (3D Earth) tab.',
      targetTab: 'map',
    });
  }

  if (site.groundHazards.length > 0 && plottedRisks.length === 0) {
    findings.push({
      id: 'map-risks-unplotted',
      severity: 'warning',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'SMS-MAP-03',
      title: 'Site ground hazards not visually delineated on Site Map',
      detail: `${site.groundHazards.length} site hazard(s) are checked in Site & Airspace, but no Risk / Hazard points, lines, or exclusion polygons are drawn on the map.`,
      remediation: 'Draw hazard lines or exclusion polygons on the Site Map (3D Earth) tab for client visual verification.',
      targetTab: 'map',
    });
  }

  if (site.rfInterference === 'High') {
    const hasRfMitigation = mitigations.some((m) =>
      (m.hazard + ' ' + m.mitigationControl).toLowerCase().match(/rf|emi|compass|interference|magnetic|atti/)
    );
    if (!hasRfMitigation) {
      findings.push({
        id: 'safety-rf-unmitigated',
        severity: 'warning',
        category: 'Site & Safety',
        source: 'Site Safety Standard',
        citation: 'SMS-SITE-07',
        title: 'High RF / EMI environment lacks documented mitigation control',
        detail: 'Site is rated High RF/EMI interference, which can trigger compass anomalies or C2 link degradation without an explicit mitigation control.',
        remediation: 'Add an RF/EMI compass calibration & ATTI/link-loss recovery mitigation to the Hazard Mitigation Matrix.',
        targetTab: 'audit',
        suggestedMitigation: {
          hazard: 'High RF / EMI Interference',
          riskLevel: 'High',
          mitigationControl:
            'Perform compass calibration >50 ft away from metal/energized structures, monitor C2 signal telemetry continuously, and verify manual non-GPS recovery readiness.',
        },
      });
    }
  }

  // Check each flagged ground hazard against mitigation controls
  const unmitigatedHazards = site.groundHazards.filter((hzId) => {
    const def = GROUND_HAZARD_CATALOG.find((h) => h.id === hzId);
    if (!def) return false;
    const keywords = def.label
      .toLowerCase()
      .split(/[\s/()-]+/)
      .filter((w) => w.length > 4);
    return !mitigations.some((m) => {
      const text = (m.hazard + ' ' + m.mitigationControl).toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });
  });

  unmitigatedHazards.forEach((hzId) => {
    const def = GROUND_HAZARD_CATALOG.find((h) => h.id === hzId);
    if (!def) return;
    findings.push({
      id: `safety-hazard-${hzId}`,
      severity: def.riskLevel === 'High' ? 'blocker' : 'warning',
      category: 'Site & Safety',
      source: 'Site Safety Standard',
      citation: 'JHA-HAZ-CTRL',
      title: `Identified site hazard lacks mitigation entry: ${def.label}`,
      detail: `You flagged "${def.label}" in Site & Airspace, but no corresponding risk mitigation control appears in the submittal Hazard Mitigation Matrix.`,
      remediation: 'Add a site-specific control measure to address this hazard before submitting to client HSE.',
      targetTab: 'audit',
      suggestedMitigation: {
        hazard: def.label,
        riskLevel: def.riskLevel,
        mitigationControl: def.defaultMitigation,
      },
    });
  });

  // 14. CLIENT ASSESSMENT: INSURANCE (COI) COVERAGE, EXPIRY & ADDITIONAL INSURED
  if (operations.coiCoverageMillions < req.minCoiMillions) {
    findings.push({
      id: 'client-coi-limit',
      severity: 'blocker',
      category: 'Client & Documentation',
      source: 'Client Assessment',
      citation: `${profile.name} · INS-01`,
      title: `Aviation liability coverage ($${operations.coiCoverageMillions}M) below client minimum ($${req.minCoiMillions}M)`,
      detail: `${profile.name} mandates at least $${req.minCoiMillions}M in commercial UAS liability coverage. Current submittal lists $${operations.coiCoverageMillions}M (shortfall of $${(req.minCoiMillions - operations.coiCoverageMillions).toFixed(1)}M).`,
      remediation: `Purchase an on-demand or annual policy rider to reach $${req.minCoiMillions}M and upload the updated COI.`,
      targetTab: 'operations',
      docKey: 'coi_insurance',
    });
  } else if (!documents.coi_insurance.attached) {
    findings.push({
      id: 'client-coi-missing',
      severity: 'missing_doc',
      category: 'Client & Documentation',
      source: 'Client Assessment',
      citation: `${profile.name} · INS-01`,
      title: 'Certificate of Insurance (COI) document not attached',
      detail: `Coverage limit ($${operations.coiCoverageMillions}M) meets requirement, but the COI PDF/policy reference is not marked attached.`,
      remediation: 'Attach active COI showing policy number and coverage period.',
      targetTab: 'audit',
      docKey: 'coi_insurance',
    });
  } else if (documents.coi_insurance.expirationDate && isDateBefore(documents.coi_insurance.expirationDate, flightDate)) {
    findings.push({
      id: 'client-coi-expired',
      severity: 'blocker',
      category: 'Client & Documentation',
      source: 'Client Assessment',
      citation: `${profile.name} · INS-01`,
      title: 'Certificate of Insurance (COI) expires before planned flight date',
      detail: `Policy ${documents.coi_insurance.referenceNumber || 'on file'} expires on ${documents.coi_insurance.expirationDate}, prior to the planned flight on ${flightDate}.`,
      remediation: 'Obtain renewed COI covering the mission window and update expiration date.',
      targetTab: 'audit',
      docKey: 'coi_insurance',
    });
  } else {
    findings.push({
      id: 'client-coi-pass',
      severity: 'passed',
      category: 'Client & Documentation',
      source: 'Client Assessment',
      citation: `${profile.name} · INS-01`,
      title: `$${operations.coiCoverageMillions}M aviation liability COI verified`,
      detail: `Meets or exceeds $${req.minCoiMillions}M client minimum; policy active through mission date.`,
      remediation: 'Ensure client legal entity name matches contract.',
      targetTab: 'operations',
    });
  }

  if (req.requireAdditionalInsured && !operations.additionalInsuredNamed) {
    findings.push({
      id: 'client-addl-insured',
      severity: 'blocker',
      category: 'Client & Documentation',
      source: 'Client Assessment',
      citation: `${profile.name} · INS-02`,
      title: 'Client not named as Additional Insured on COI',
      detail: `${profile.name} procurement requires "${operations.clientOrganization || 'the client entity'}" to be explicitly listed as Additional Insured with Waiver of Subrogation on the COI endorsement.`,
      remediation: 'Request an Additional Insured endorsement from your aviation broker and confirm in Flight Operations.',
      targetTab: 'operations',
      docKey: 'coi_insurance',
    });
  }

  // 15. CLIENT ASSESSMENT: NDAA COMPLIANCE
  if (req.requireNdaaAirframe && !operations.ndaaCompliant) {
    findings.push({
      id: 'client-ndaa',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'Client Assessment',
      citation: 'NDAA Sec. 848 / Client IT-Sec',
      title: `Airframe (${operations.aircraftModel || 'Unnamed'}) is not NDAA-compliant`,
      detail: `${profile.name} prohibits non-NDAA-compliant foreign-manufactured flight controllers/telemetry platforms on critical infrastructure or public assets.`,
      remediation: 'Assign an NDAA Section 848 / Blue UAS compliant aircraft or obtain a formal written client cybersecurity exception.',
      targetTab: 'operations',
    });
  } else if (req.requireNdaaAirframe && operations.ndaaCompliant) {
    findings.push({
      id: 'client-ndaa-pass',
      severity: 'passed',
      category: 'Crew & Aircraft',
      source: 'Client Assessment',
      citation: 'NDAA Sec. 848',
      title: 'NDAA-compliant airframe verified',
      detail: `${operations.aircraftModel} satisfies client fleet cybersecurity and procurement policy.`,
      remediation: 'Ensure local-data / offline flight logging mode is enabled.',
      targetTab: 'operations',
    });
  }

  // 16. CLIENT ASSESSMENT: DEDICATED VISUAL OBSERVER & PIC EXPERIENCE
  if (req.requireDedicatedVo && operations.voCount < 1) {
    findings.push({
      id: 'client-vo-required',
      severity: 'blocker',
      category: 'Crew & Aircraft',
      source: 'Client Assessment',
      citation: `${profile.name} · CREW-01`,
      title: 'Client requires a dedicated Visual Observer (VO)',
      detail: `Even on VLOS missions, ${profile.name} safety policies mandate a two-person crew (1 PIC + at least 1 dedicated VO) to monitor ground hazards and manned traffic.`,
      remediation: 'Assign a trained Visual Observer and record their name in Flight Operations.',
      targetTab: 'operations',
    });
  } else if (req.requireDedicatedVo && operations.voCount >= 1) {
    findings.push({
      id: 'client-vo-pass',
      severity: 'passed',
      category: 'Crew & Aircraft',
      source: 'Client Assessment',
      citation: `${profile.name} · CREW-01`,
      title: `Dedicated Visual Observer crew assigned (${operations.voCount} VO)`,
      detail: `Crew roster satisfies two-person safety staffing policy (${operations.voNames || 'VO assigned'}).`,
      remediation: 'Confirm shared radio/intercom check during pre-flight briefing.',
      targetTab: 'operations',
    });
  }

  if (operations.picFlightHours < req.minPicHours) {
    findings.push({
      id: 'client-pic-hours',
      severity: 'warning',
      category: 'Crew & Aircraft',
      source: 'Client Assessment',
      citation: `${profile.name} · CREW-02`,
      title: `PIC logged flight hours (${operations.picFlightHours} hrs) below client preference (${req.minPicHours} hrs)`,
      detail: `${profile.name} vendor qualification typically expects at least ${req.minPicHours} commercial UAS flight hours for complex site missions.`,
      remediation: 'Pair PIC with a senior supervising pilot or include specific platform/mission proficiency logs in the submittal.',
      targetTab: 'operations',
    });
  }

  // 17. CLIENT ASSESSMENT: REQUIRED SUPPORTING DOCUMENTS
  const requiredDocs: {
    enabled: boolean;
    key: DocumentKey;
    title: string;
    citation: string;
    detail: string;
  }[] = [
    {
      enabled: req.requireJha,
      key: 'jha_jsa',
      title: 'Site-Specific Job Hazard Analysis (JHA / JSA) missing',
      citation: `${profile.name} · HSE-01`,
      detail: 'Client HSE requires a signed, site-specific Job Hazard Analysis prior to granting launch authorization.',
    },
    {
      enabled: req.requireErp,
      key: 'erp_plan',
      title: 'Emergency Response Plan (ERP) missing',
      citation: `${profile.name} · HSE-02`,
      detail: 'Documented lost-link, flyaway, battery fire, and client emergency escalation procedures are required.',
    },
    {
      enabled: req.requireSiteAccessAuth,
      key: 'site_access',
      title: 'Landowner / Site Access Authorization missing',
      citation: `${profile.name} · LEGAL-01`,
      detail: 'Written property access or right-of-entry authorization is required for takeoff/landing zones.',
    },
    {
      enabled: req.requireMaintenanceLog,
      key: 'maintenance_log',
      title: 'Pre-Flight Airframe & Battery Maintenance Log missing',
      citation: `${profile.name} · OPS-03`,
      detail: 'Client aviation safety review checks recent airframe airworthiness inspection and LiPo battery health records.',
    },
    {
      enabled: req.requireHseInduction,
      key: 'hse_induction',
      title: 'Client HSE Site Orientation / Safety Induction missing',
      citation: `${profile.name} · HSE-04`,
      detail: 'Crew members must hold active client contractor safety orientation or site badging before arriving on-site.',
    },
    {
      enabled: req.requireSimopsPermit,
      key: 'simops_permit',
      title: 'SIMOPS / Permit-to-Work Clearance missing',
      citation: `${profile.name} · PSM-01`,
      detail: 'Facility process-safety standards require a signed SIMOPS or non-sparking Permit-to-Work clearance.',
    },
    {
      enabled: req.requireAdvanceNotice,
      key: 'advance_notice',
      title: 'Advance Stakeholder Flight Notification not logged',
      citation: `${profile.name} · COMM-01`,
      detail: 'Advance notification (typically 24–72 hrs) to site operations, security, or local stakeholders must be documented.',
    },
  ];

  requiredDocs.forEach((docCheck) => {
    if (!docCheck.enabled) return;
    const record = documents[docCheck.key];
    if (!record.attached) {
      findings.push({
        id: `doc-req-${docCheck.key}`,
        severity: 'missing_doc',
        category: 'Client & Documentation',
        source: 'Client Assessment',
        citation: docCheck.citation,
        title: docCheck.title,
        detail: docCheck.detail,
        remediation: 'Attach or verify this document in the Submittal Documentation Checklist below.',
        targetTab: 'audit',
        docKey: docCheck.key,
      });
    } else if (record.expirationDate && isDateBefore(record.expirationDate, flightDate)) {
      findings.push({
        id: `doc-exp-${docCheck.key}`,
        severity: 'blocker',
        category: 'Client & Documentation',
        source: 'Client Assessment',
        citation: docCheck.citation,
        title: `${docCheck.title.replace(' missing', '')} expired prior to flight`,
        detail: `Document reference ${record.referenceNumber || '(unnumbered)'} expires ${record.expirationDate}, before planned flight date ${flightDate}.`,
        remediation: 'Renew document and update expiration date.',
        targetTab: 'audit',
        docKey: docCheck.key,
      });
    } else {
      findings.push({
        id: `doc-pass-${docCheck.key}`,
        severity: 'passed',
        category: 'Client & Documentation',
        source: 'Client Assessment',
        citation: docCheck.citation,
        title: `${docCheck.title.replace(' missing', '').replace(' not logged', '')} verified`,
        detail: `Document attached${record.referenceNumber ? ` (Ref: ${record.referenceNumber})` : ''}.`,
        remediation: 'Include in final submittal transmittal.',
        targetTab: 'audit',
        docKey: docCheck.key,
      });
    }
  });

  // Sort findings by severity priority: blocker -> missing_doc -> warning -> passed
  const order: Record<ComplianceFinding['severity'], number> = {
    blocker: 0,
    missing_doc: 1,
    warning: 2,
    passed: 3,
  };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const blockers = findings.filter((f) => f.severity === 'blocker').length;
  const missingDocs = findings.filter((f) => f.severity === 'missing_doc').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const passed = findings.filter((f) => f.severity === 'passed').length;

  let readinessStatus: AuditSummary['readinessStatus'] = 'Ready for Client Submittal';
  if (blockers > 0 || missingDocs > 0) {
    readinessStatus = 'Not Ready for Submittal';
  } else if (warnings > 0) {
    readinessStatus = 'Conditional — Review Warnings';
  }

  return {
    findings,
    blockers,
    missingDocs,
    warnings,
    passed,
    totalChecks: findings.length,
    readinessStatus,
  };
}
