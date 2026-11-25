import React from 'react';
import { GROUND_HAZARD_CATALOG } from '../data/clientProfiles';
import {
  AirspaceClass,
  GroundHazardId,
  RfInterferenceLevel,
  SiteEnvironment,
  SubmittalPackage,
  WorkspaceTab,
} from '../types/submittal';
import { AirspaceProfileDiagram } from './AirspaceProfileDiagram';

interface SiteAssessmentViewProps {
  pkg: SubmittalPackage;
  onUpdatePackage: (updater: (prev: SubmittalPackage) => SubmittalPackage) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
}

const AIRSPACE_CLASSES: AirspaceClass[] = ['B', 'C', 'D', 'E2', 'G'];

const SITE_ENVIRONMENTS: SiteEnvironment[] = [
  'Utility Substation / Corridor',
  'Active Construction Site',
  'Urban / Downtown Core',
  'Industrial / Refinery Facility',
  'Suburban / Commercial Campus',
  'Rural / Open Terrain',
  'Coastal / Marine Infrastructure',
];

const RF_LEVELS: RfInterferenceLevel[] = ['Low', 'Moderate', 'High'];

export const SiteAssessmentView: React.FC<SiteAssessmentViewProps> = ({
  pkg,
  onUpdatePackage,
  onNavigateTab,
}) => {
  const { site } = pkg;

  const updateSite = <K extends keyof typeof site>(key: K, value: (typeof site)[K]) => {
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      site: { ...prev.site, [key]: value },
    }));
  };

  const toggleHazard = (hazardId: GroundHazardId) => {
    const exists = site.groundHazards.includes(hazardId);
    const next = exists
      ? site.groundHazards.filter((h) => h !== hazardId)
      : [...site.groundHazards, hazardId];
    updateSite('groundHazards', next);
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Site &amp; Airspace Assessment
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Define physical location parameters, airspace boundaries, obstacle geometry, and ground hazards for automated compliance screening.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('map')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Plot on 3D Earth Map ({(pkg.mapElements ?? []).length})
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('operations')}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Continue to Flight Operations
          </button>
        </div>
      </div>

      {/* Live Engineering Cross-Section */}
      <AirspaceProfileDiagram
        site={pkg.site}
        operations={pkg.operations}
        clientReq={pkg.clientRequirements}
      />

      {/* Section 1: Location & Site Metadata */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">01. Location &amp; Site Identification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinates and property access notes included in the client transmittal header.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Submittal Package Title
            </label>
            <input
              type="text"
              value={pkg.title}
              onChange={(e) =>
                onUpdatePackage((prev) => ({
                  ...prev,
                  title: e.target.value,
                  updatedAt: new Date().toISOString().slice(0, 10),
                }))
              }
              placeholder="e.g., Substation 14B Thermal Inspection"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Submittal Reference Code
            </label>
            <input
              type="text"
              value={pkg.referenceCode}
              onChange={(e) =>
                onUpdatePackage((prev) => ({
                  ...prev,
                  referenceCode: e.target.value,
                  updatedAt: new Date().toISOString().slice(0, 10),
                }))
              }
              placeholder="UAS-2026-104B"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Site / Facility Name
            </label>
            <input
              type="text"
              value={site.siteName}
              onChange={(e) => updateSite('siteName', e.target.value)}
              placeholder="Cascade Grid Substation 14B"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Physical Street Address
            </label>
            <input
              type="text"
              value={site.address}
              onChange={(e) => updateSite('address', e.target.value)}
              placeholder="4120 Industrial Pkwy NE, Tacoma, WA 98422"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Latitude (Decimal Degrees)
            </label>
            <input
              type="text"
              value={site.latitude}
              onChange={(e) => updateSite('latitude', e.target.value)}
              placeholder="47.2694"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Longitude (Decimal Degrees)
            </label>
            <input
              type="text"
              value={site.longitude}
              onChange={(e) => updateSite('longitude', e.target.value)}
              placeholder="-122.3812"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Operating Environment
            </label>
            <select
              value={site.environment}
              onChange={(e) => updateSite('environment', e.target.value as SiteEnvironment)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              {SITE_ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 2: Airspace, Obstacles & Weather */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            02. Airspace Classification, Geometry &amp; Weather Envelope
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluated automatically against FAA Part 107 rules (§107.41, §107.47, §107.51) and client standoff policies.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Airspace Classification
              </label>
              <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200">
                {AIRSPACE_CLASSES.map((cls) => {
                  const active = site.airspaceClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => updateSite('airspaceClass', cls)}
                      className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Class {cls}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {site.airspaceClass === 'G'
                  ? 'Uncontrolled airspace — no LAANC authorization required below 400 ft AGL.'
                  : `Controlled Class ${site.airspaceClass} surface airspace — requires LAANC or FAA DroneZone authorization.`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                LAANC Facility Ceiling (ft AGL)
              </label>
              <input
                type="number"
                min={0}
                max={400}
                step={25}
                value={site.laancGridCeilingFt}
                onChange={(e) => updateSite('laancGridCeilingFt', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="flex flex-col justify-center pt-4">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={site.laancAvailable}
                  onChange={(e) => updateSite('laancAvailable', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>LAANC Auto-Approval Available</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nearest Airport / Heliport (ICAO)
              </label>
              <input
                type="text"
                value={site.nearestAirportCode}
                onChange={(e) => updateSite('nearestAirportCode', e.target.value.toUpperCase())}
                placeholder="KTIW"
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Distance to Nearest Field (NM)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={site.nearestAirportDistanceNm}
                onChange={(e) => updateSite('nearestAirportDistanceNm', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tallest Site Obstacle (ft AGL)
              </label>
              <input
                type="number"
                min={0}
                max={2000}
                value={site.tallestObstacleFt}
                onChange={(e) => updateSite('tallestObstacleFt', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Planned Horizontal Standoff (ft)
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                value={site.horizontalStandoffFt}
                onChange={(e) => updateSite('horizontalStandoffFt', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Max Operational Wind Cutoff (kt)
              </label>
              <input
                type="number"
                min={5}
                max={45}
                value={site.maxWindLimitKt}
                onChange={(e) => updateSite('maxWindLimitKt', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Minimum Flight Visibility (SM)
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={site.minVisibilitySm}
                onChange={(e) => updateSite('minVisibilitySm', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Site RF / EMI Interference Level
              </label>
              <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200 w-full">
                {RF_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => updateSite('rfInterference', lvl)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      site.rfInterference === lvl
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={site.tfrNotamChecked}
                  onChange={(e) => updateSite('tfrNotamChecked', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>TFR &amp; NOTAM Screening Complete</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={site.activeTfrPresent}
                  onChange={(e) => updateSite('activeTfrPresent', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                />
                <span>Active TFR Impacts Mission Footprint</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={site.cloudClearanceConfirmed}
                  onChange={(e) => updateSite('cloudClearanceConfirmed', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>500 ft Below / 2,000 ft Horizontal Cloud Clearance</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Ground Hazards & Emergency Staging */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              03. Site-Specific Ground Hazards &amp; Emergency Staging
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Flagged site hazards are cross-checked against your Hazard Mitigation Matrix in the Compliance Audit.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {site.groundHazards.length} hazards selected
          </span>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {GROUND_HAZARD_CATALOG.map((hz) => {
              const checked = site.groundHazards.includes(hz.id);
              return (
                <label
                  key={hz.id}
                  className={`flex items-start gap-3 p-3.5 rounded-md border transition-colors cursor-pointer ${
                    checked
                      ? 'bg-slate-50 border-blue-600/60'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHazard(hz.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 leading-snug">
                      {hz.label}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">{hz.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Primary &amp; Alternate Emergency Landing Zones (ELZ)
              </label>
              <textarea
                rows={3}
                value={site.emergencyLandingZones}
                onChange={(e) => updateSite('emergencyLandingZones', e.target.value)}
                placeholder="Describe primary and backup clear touchdown zones with coordinates or landmarks..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nearest Emergency Medical Facility
                </label>
                <input
                  type="text"
                  value={site.nearestHospital}
                  onChange={(e) => updateSite('nearestHospital', e.target.value)}
                  placeholder="Hospital name, address, and distance"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Site Access, Escort &amp; Check-In Protocol
                </label>
                <input
                  type="text"
                  value={site.siteAccessNotes}
                  onChange={(e) => updateSite('siteAccessNotes', e.target.value)}
                  placeholder="Gate code, security check-in, radio channel, escort contact..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
