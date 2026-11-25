import { ClientProfileDefinition, ClientProfileId, DocumentKey, GroundHazardId } from '../types/submittal';

export const CLIENT_PROFILES: Record<ClientProfileId, ClientProfileDefinition> = {
  utility_energy: {
    id: 'utility_energy',
    name: 'Utility & Energy Infrastructure',
    sector: 'Transmission, Substations & Power Generation',
    summary:
      'High-consequence electrical and energy infrastructure audits requiring elevated insurance, NDAA-compliant airframes, energized standoff buffers, and formal HSE documentation.',
    auditFocus: 'NERC/Utility HSE · $5M Liability · NDAA Sec. 848 · Energized Asset Clearance',
    defaults: {
      minCoiMillions: 5,
      requireAdditionalInsured: true,
      requireDedicatedVo: true,
      requireNdaaAirframe: true,
      requireJha: true,
      requireErp: true,
      requireSiteAccessAuth: true,
      requireHseInduction: true,
      requireSimopsPermit: false,
      requireMaintenanceLog: true,
      requireAdvanceNotice: true,
      minStandoffFt: 100,
      minPicHours: 50,
    },
  },
  commercial_construction: {
    id: 'commercial_construction',
    name: 'Commercial Construction (GC)',
    sector: 'Active Job Sites, High-Rise & Civil Engineering',
    summary:
      'General contractor safety reviews focused on active crane conflict deconfliction, worker-under-flight protection, job hazard analysis, and site superintendent coordination.',
    auditFocus: 'OSHA 1926 Coordination · $2M Liability · Crane & Crew Deconfliction · JHA',
    defaults: {
      minCoiMillions: 2,
      requireAdditionalInsured: true,
      requireDedicatedVo: true,
      requireNdaaAirframe: false,
      requireJha: true,
      requireErp: true,
      requireSiteAccessAuth: true,
      requireHseInduction: true,
      requireSimopsPermit: false,
      requireMaintenanceLog: true,
      requireAdvanceNotice: true,
      minStandoffFt: 50,
      minPicHours: 25,
    },
  },
  oil_gas_industrial: {
    id: 'oil_gas_industrial',
    name: 'Oil, Gas & Petrochemical',
    sector: 'Refineries, Tank Farms & Midstream Facilities',
    summary:
      'Strict process-safety and SIMOPS compliance standards requiring $10M aviation liability, SIMOPS/hot-work permitting, dedicated spotters, and NDAA-vetted hardware.',
    auditFocus: 'Process Safety & SIMOPS · $10M Liability · Permit-to-Work · Strict Standoff',
    defaults: {
      minCoiMillions: 10,
      requireAdditionalInsured: true,
      requireDedicatedVo: true,
      requireNdaaAirframe: true,
      requireJha: true,
      requireErp: true,
      requireSiteAccessAuth: true,
      requireHseInduction: true,
      requireSimopsPermit: true,
      requireMaintenanceLog: true,
      requireAdvanceNotice: true,
      minStandoffFt: 150,
      minPicHours: 100,
    },
  },
  telecom_tower: {
    id: 'telecom_tower',
    name: 'Telecom & Tower Assets',
    sector: 'Cellular Towers, Microwave Links & Broadcast Masts',
    summary:
      'RF/EMI hazard controls, guy-wire obstacle clearance, carrier site access authorization, and minimum aviation liability verification.',
    auditFocus: 'RF/EMI Mitigation · Guy-Wire Clearance · Carrier Site Access · $2M Liability',
    defaults: {
      minCoiMillions: 2,
      requireAdditionalInsured: true,
      requireDedicatedVo: false,
      requireNdaaAirframe: false,
      requireJha: true,
      requireErp: true,
      requireSiteAccessAuth: true,
      requireHseInduction: false,
      requireSimopsPermit: false,
      requireMaintenanceLog: true,
      requireAdvanceNotice: true,
      minStandoffFt: 50,
      minPicHours: 25,
    },
  },
  municipal_public: {
    id: 'municipal_public',
    name: 'Municipal & Public Works',
    sector: 'Bridges, Parks, Water Treatment & Public Infrastructure',
    summary:
      'Public agency procurement requirements prioritizing NDAA-compliant fleets, pedestrian privacy and safety buffers, advance public notification, and additional insured coverage.',
    auditFocus: 'NDAA Fleet Compliance · Public Notice · $2M Liability · Pedestrian Safety',
    defaults: {
      minCoiMillions: 2,
      requireAdditionalInsured: true,
      requireDedicatedVo: false,
      requireNdaaAirframe: true,
      requireJha: true,
      requireErp: true,
      requireSiteAccessAuth: true,
      requireHseInduction: false,
      requireSimopsPermit: false,
      requireMaintenanceLog: true,
      requireAdvanceNotice: true,
      minStandoffFt: 75,
      minPicHours: 25,
    },
  },
  commercial_real_estate: {
    id: 'commercial_real_estate',
    name: 'Commercial Real Estate & Survey',
    sector: 'Retail Centers, Industrial Parks & Land Development',
    summary:
      'Property management and surveying requirements covering property owner authorization, standard $1M aviation liability, emergency response plan, and pedestrian avoidance.',
    auditFocus: 'Property Access Release · $1M Liability · Pedestrian & Vehicle Buffer',
    defaults: {
      minCoiMillions: 1,
      requireAdditionalInsured: false,
      requireDedicatedVo: false,
      requireNdaaAirframe: false,
      requireJha: false,
      requireErp: true,
      requireSiteAccessAuth: true,
      requireHseInduction: false,
      requireSimopsPermit: false,
      requireMaintenanceLog: true,
      requireAdvanceNotice: false,
      minStandoffFt: 35,
      minPicHours: 10,
    },
  },
};

export const GROUND_HAZARD_CATALOG: {
  id: GroundHazardId;
  label: string;
  description: string;
  defaultMitigation: string;
  riskLevel: 'High' | 'Medium' | 'Low';
}[] = [
  {
    id: 'high_voltage',
    label: 'High-Voltage Power Lines / Energized Equipment',
    description: 'Transmission lines, transformers, or substation busbars within flight area.',
    defaultMitigation:
      'Maintain minimum energized standoff distance, disable compass-reliant autonomous tracks near busbars, brief VO on wire-strike sightlines, and verify non-GPS attitude recovery.',
    riskLevel: 'High',
  },
  {
    id: 'active_cranes',
    label: 'Active Cranes / Moving Heavy Equipment',
    description: 'Tower cranes, mobile booms, or concrete pumps operating on site.',
    defaultMitigation:
      'Coordinate radio channel with crane operator prior to launch, establish hard geofence altitude/lateral boundary clear of maximum boom swing radius, and assign dedicated VO.',
    riskLevel: 'High',
  },
  {
    id: 'pedestrian_traffic',
    label: 'Non-Participant Pedestrians / Public Access',
    description: 'Sidewalks, parking areas, or adjacent public walkways near flight zone.',
    defaultMitigation:
      'Deploy high-visibility cones and signage around launch/recovery zone, brief VO to call immediate hold/climb if non-participants enter safety perimeter, avoid direct overflight.',
    riskLevel: 'High',
  },
  {
    id: 'active_roadways',
    label: 'Active Roadways / Vehicle Corridors',
    description: 'Public roads, highways, or active haul routes adjacent to site.',
    defaultMitigation:
      'Restrict flight paths to remain laterally offset from active traffic lanes; prohibit hovering over moving vehicles and limit any required crossing to perpendicular brief transit.',
    riskLevel: 'Medium',
  },
  {
    id: 'heliport_corridor',
    label: 'Hospital Heliport / Low-Altitude Helicopter Corridor',
    description: 'Nearby hospital helipad, medevac path, or tour helicopter route.',
    defaultMitigation:
      'Monitor local CTAF/ADS-B receiver continuously, pre-notify heliport operations where required, and execute immediate descent to safe hover/landing upon manned traffic detection.',
    riskLevel: 'High',
  },
  {
    id: 'rf_emitters',
    label: 'High-Power RF Emitters / Broadcast Antennas',
    description: 'Cellular sectors, microwave dishes, radar, or substation EMI.',
    defaultMitigation:
      'Conduct ground RF spectrum/link check prior to ascent, set pre-verified obstacle-clear RTH altitude, avoid hovering directly in front of directional microwave/sector faces.',
    riskLevel: 'High',
  },
  {
    id: 'water_body',
    label: 'Open Water / Marine Exposure',
    description: 'Retention ponds, rivers, coastal piers, or marine vessels.',
    defaultMitigation:
      'Verify minimum 30% battery reserve for return-to-shore margin, disable downward VPS over reflective water surfaces below 15 ft AGL, and stage recovery over dry hardstand.',
    riskLevel: 'Medium',
  },
  {
    id: 'raptors_wildlife',
    label: 'Aggressive Birds / Protected Wildlife',
    description: 'Nesting raptors, gulls, or environmentally sensitive habitat.',
    defaultMitigation:
      'Monitor airspace for territorial birds during pre-flight; if approached, climb vertically to break pursuit and relocate/abort flight rather than diving laterally.',
    riskLevel: 'Low',
  },
  {
    id: 'confined_structures',
    label: 'Guy Wires / Tight Structural Clearances',
    description: 'Unmarked guy wires, catwalks, scaffolding, or overhead pipe racks.',
    defaultMitigation:
      'Walk and map all wire anchor points on site diagram prior to launch, assign VO at 90-degree orthogonal angle for depth judgment, and limit groundspeed to 5 kt near structures.',
    riskLevel: 'High',
  },
];

export const DOCUMENT_CATALOG: {
  key: DocumentKey;
  title: string;
  category: 'Regulatory & Crew' | 'Insurance & Legal' | 'Safety & Site Plans';
  description: string;
  hasExpiration: boolean;
  placeholderRef: string;
}[] = [
  {
    key: 'part107_cert',
    title: 'FAA Part 107 Remote Pilot Certificate',
    category: 'Regulatory & Crew',
    description: 'Copy of PIC Remote Pilot Certificate and recurrent training completion certificate.',
    hasExpiration: true,
    placeholderRef: 'CERT-4489210',
  },
  {
    key: 'aircraft_reg',
    title: 'FAA Aircraft Registration Certificate',
    category: 'Regulatory & Crew',
    description: 'Current FA- registration certificate matching airframe serial and Remote ID.',
    hasExpiration: true,
    placeholderRef: 'FA3X9K2M1P',
  },
  {
    key: 'coi_insurance',
    title: 'Certificate of Aviation Liability Insurance (COI)',
    category: 'Insurance & Legal',
    description: 'Active UAS hull/liability COI naming client as Additional Insured when required.',
    hasExpiration: true,
    placeholderRef: 'POL-UAS-992841',
  },
  {
    key: 'laanc_waiver',
    title: 'LAANC Authorization / FAA Part 107 Waiver',
    category: 'Regulatory & Crew',
    description: 'Approved LAANC authorization code or FAA DroneZone waiver/airspace authorization.',
    hasExpiration: true,
    placeholderRef: 'LAANC-2026-88412',
  },
  {
    key: 'jha_jsa',
    title: 'Site-Specific Job Hazard Analysis (JHA / JSA)',
    category: 'Safety & Site Plans',
    description: 'Signed hazard identification and risk mitigation matrix tailored to the mission site.',
    hasExpiration: false,
    placeholderRef: 'JHA-2026-114',
  },
  {
    key: 'erp_plan',
    title: 'Emergency Response Plan (ERP)',
    category: 'Safety & Site Plans',
    description: 'Lost-link, flyaway, battery thermal runaway, injury, and ATC/client escalation procedures.',
    hasExpiration: false,
    placeholderRef: 'ERP-REV-4.2',
  },
  {
    key: 'site_access',
    title: 'Landowner / Property Access Authorization',
    category: 'Insurance & Legal',
    description: 'Written permission to launch, recover, and operate over client or third-party property.',
    hasExpiration: true,
    placeholderRef: 'AUTH-SITE-772',
  },
  {
    key: 'maintenance_log',
    title: 'Pre-Flight Airframe & Battery Maintenance Log',
    category: 'Safety & Site Plans',
    description: 'Recent inspection sign-off, firmware verification, and LiPo cycle/health records.',
    hasExpiration: false,
    placeholderRef: 'MNT-2026-Q4',
  },
  {
    key: 'hse_induction',
    title: 'Client HSE Site Orientation / Safety Induction',
    category: 'Safety & Site Plans',
    description: 'Proof of completed client safety onboarding, site badging, or contractor clearance.',
    hasExpiration: true,
    placeholderRef: 'HSE-IND-509',
  },
  {
    key: 'simops_permit',
    title: 'SIMOPS / Permit-to-Work Clearance',
    category: 'Safety & Site Plans',
    description: 'Facility simultaneous operations approval or non-sparking/hot-work authorization.',
    hasExpiration: true,
    placeholderRef: 'PTW-2026-089',
  },
  {
    key: 'oop_doc',
    title: 'OOP Category Declaration of Compliance / Parachute Cert',
    category: 'Regulatory & Crew',
    description: 'FAA-accepted DOC for Category 2/3 Operations Over People or §107.39/145 waiver.',
    hasExpiration: true,
    placeholderRef: 'DOC-ASTM-3322',
  },
  {
    key: 'advance_notice',
    title: 'Client / Stakeholder Advance Flight Notification',
    category: 'Insurance & Legal',
    description: 'Documented 24–72 hour advance notice to facility operations, security, or local stakeholders.',
    hasExpiration: false,
    placeholderRef: 'NTF-2026-441',
  },
];
