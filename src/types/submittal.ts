export type AirspaceClass = 'B' | 'C' | 'D' | 'E2' | 'G';

export type SiteEnvironment =
  | 'Utility Substation / Corridor'
  | 'Urban / Downtown Core'
  | 'Active Construction Site'
  | 'Industrial / Refinery Facility'
  | 'Suburban / Commercial Campus'
  | 'Rural / Open Terrain'
  | 'Coastal / Marine Infrastructure';

export type MissionType =
  | 'Thermal & Visual Inspection'
  | 'Photogrammetry & Orthomosaic'
  | 'LiDAR Corridor Mapping'
  | 'Structural / Facade Survey'
  | 'Construction Progress Monitoring'
  | 'Volumetric Stockpile Survey';

export type LightingCondition = 'Daylight' | 'Civil Twilight' | 'Night';
export type LineOfSightMode = 'VLOS' | 'EVLOS' | 'BVLOS';
export type OverPeopleMode = 'None (Sterile Area)' | 'Brief Transit' | 'Sustained Over People';
export type RemoteIdType = 'Standard Remote ID' | 'Broadcast Module' | 'None';
export type RfInterferenceLevel = 'Low' | 'Moderate' | 'High';
export type LostLinkAction = 'Return to Home (RTH)' | 'Hover in Place' | 'Land Immediately';

export type ClientProfileId =
  | 'utility_energy'
  | 'commercial_construction'
  | 'oil_gas_industrial'
  | 'telecom_tower'
  | 'municipal_public'
  | 'commercial_real_estate';

export type GroundHazardId =
  | 'high_voltage'
  | 'active_cranes'
  | 'pedestrian_traffic'
  | 'active_roadways'
  | 'heliport_corridor'
  | 'rf_emitters'
  | 'water_body'
  | 'raptors_wildlife'
  | 'confined_structures';

export type DocumentKey =
  | 'part107_cert'
  | 'aircraft_reg'
  | 'coi_insurance'
  | 'laanc_waiver'
  | 'jha_jsa'
  | 'erp_plan'
  | 'site_access'
  | 'maintenance_log'
  | 'hse_induction'
  | 'oop_doc'
  | 'simops_permit'
  | 'advance_notice';

export interface DocumentRecord {
  attached: boolean;
  referenceNumber: string;
  expirationDate: string;
  notes: string;
}

export interface ClientRequirements {
  minCoiMillions: number;
  requireAdditionalInsured: boolean;
  requireDedicatedVo: boolean;
  requireNdaaAirframe: boolean;
  requireJha: boolean;
  requireErp: boolean;
  requireSiteAccessAuth: boolean;
  requireHseInduction: boolean;
  requireSimopsPermit: boolean;
  requireMaintenanceLog: boolean;
  requireAdvanceNotice: boolean;
  minStandoffFt: number;
  minPicHours: number;
}

export interface ClientProfileDefinition {
  id: ClientProfileId;
  name: string;
  sector: string;
  summary: string;
  auditFocus: string;
  defaults: ClientRequirements;
}

export interface SiteAssessment {
  siteName: string;
  address: string;
  latitude: string;
  longitude: string;
  environment: SiteEnvironment;
  airspaceClass: AirspaceClass;
  laancGridCeilingFt: number;
  laancAvailable: boolean;
  nearestAirportCode: string;
  nearestAirportDistanceNm: number;
  tfrNotamChecked: boolean;
  activeTfrPresent: boolean;
  tallestObstacleFt: number;
  horizontalStandoffFt: number;
  rfInterference: RfInterferenceLevel;
  groundHazards: GroundHazardId[];
  emergencyLandingZones: string;
  maxWindLimitKt: number;
  minVisibilitySm: number;
  cloudClearanceConfirmed: boolean;
  nearestHospital: string;
  siteAccessNotes: string;
}

export interface FlightOperations {
  missionType: MissionType;
  plannedDate: string;
  startTime: string;
  endTime: string;
  maxPlannedAglFt: number;
  lighting: LightingCondition;
  losMode: LineOfSightMode;
  overPeople: OverPeopleMode;
  overMovingVehicles: boolean;
  aircraftModel: string;
  aircraftRegNumber: string;
  mtowLbs: number;
  remoteId: RemoteIdType;
  ndaaCompliant: boolean;
  strobe3SmEquipped: boolean;
  oopParachuteDocEquipped: boolean;
  picName: string;
  picCertNumber: string;
  picCurrencyDate: string;
  picFlightHours: number;
  voCount: number;
  voNames: string;
  batterySetsPlanned: number;
  lostLinkAction: LostLinkAction;
  rthAltitudeFt: number;
  coiCoverageMillions: number;
  additionalInsuredNamed: boolean;
  clientOrganization: string;
  clientContactName: string;
  operatorCompany: string;
}

export interface HazardMitigation {
  id: string;
  hazard: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  mitigationControl: string;
  owner: string;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type MapElementGeometry = 'point' | 'line' | 'polygon';

export type MapElementCategory =
  | 'landing_zone'
  | 'personnel'
  | 'risk'
  | 'flight_area'
  | 'poi';

export interface OperationalMapElement {
  id: string;
  geometry: MapElementGeometry;
  category: MapElementCategory;
  label: string;
  notes: string;
  coordinates: LatLngPoint[];
  altitudeAglFt?: number;
}

export interface DriveSyncMetadata {
  rootFolderId?: string;
  folderId: string;
  folderName: string;
  fileId?: string;
  fileName?: string;
  lastSyncedAt?: string;
  webViewLink?: string;
}

export interface SubmittalPackage {
  id: string;
  referenceCode: string;
  title: string;
  updatedAt: string;
  clientProfileId: ClientProfileId;
  clientRequirements: ClientRequirements;
  site: SiteAssessment;
  operations: FlightOperations;
  documents: Record<DocumentKey, DocumentRecord>;
  mitigations: HazardMitigation[];
  mapElements: OperationalMapElement[];
  driveSync?: DriveSyncMetadata;
}

export type FindingSeverity = 'blocker' | 'missing_doc' | 'warning' | 'passed';
export type FindingCategory =
  | 'Airspace & Regulatory'
  | 'Crew & Aircraft'
  | 'Site & Safety'
  | 'Client & Documentation';

export type WorkspaceTab = 'site' | 'map' | 'operations' | 'audit' | 'submittal';

export interface ComplianceFinding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  source: 'FAA Part 107' | 'Client Assessment' | 'Site Safety Standard';
  citation: string;
  title: string;
  detail: string;
  remediation: string;
  targetTab: WorkspaceTab;
  docKey?: DocumentKey;
  suggestedMitigation?: {
    hazard: string;
    riskLevel: 'High' | 'Medium' | 'Low';
    mitigationControl: string;
  };
}

export interface AuditSummary {
  findings: ComplianceFinding[];
  blockers: number;
  missingDocs: number;
  warnings: number;
  passed: number;
  totalChecks: number;
  readinessStatus: 'Not Ready for Submittal' | 'Conditional — Review Warnings' | 'Ready for Client Submittal';
}
