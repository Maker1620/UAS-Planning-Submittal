import React from 'react';
import {
  LightingCondition,
  LineOfSightMode,
  LostLinkAction,
  MissionType,
  OverPeopleMode,
  RemoteIdType,
  SubmittalPackage,
  WorkspaceTab,
} from '../types/submittal';

interface FlightOperationsViewProps {
  pkg: SubmittalPackage;
  onUpdatePackage: (updater: (prev: SubmittalPackage) => SubmittalPackage) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
}

const MISSION_TYPES: MissionType[] = [
  'Thermal & Visual Inspection',
  'Photogrammetry & Orthomosaic',
  'LiDAR Corridor Mapping',
  'Structural / Facade Survey',
  'Construction Progress Monitoring',
  'Volumetric Stockpile Survey',
];

const LIGHTING_OPTIONS: LightingCondition[] = ['Daylight', 'Civil Twilight', 'Night'];
const LOS_OPTIONS: LineOfSightMode[] = ['VLOS', 'EVLOS', 'BVLOS'];
const OOP_OPTIONS: OverPeopleMode[] = [
  'None (Sterile Area)',
  'Brief Transit',
  'Sustained Over People',
];
const REMOTE_ID_OPTIONS: RemoteIdType[] = [
  'Standard Remote ID',
  'Broadcast Module',
  'None',
];
const LOST_LINK_OPTIONS: LostLinkAction[] = [
  'Return to Home (RTH)',
  'Hover in Place',
  'Land Immediately',
];

export const FlightOperationsView: React.FC<FlightOperationsViewProps> = ({
  pkg,
  onUpdatePackage,
  onNavigateTab,
}) => {
  const { operations: ops } = pkg;

  const updateOps = <K extends keyof typeof ops>(key: K, value: (typeof ops)[K]) => {
    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      operations: { ...prev.operations, [key]: value },
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Flight Operations, Aircraft &amp; Crew
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Specify operational parameters, airframe specifications, flight crew credentials, and insurance coverage for client review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('audit')}
          className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Review Compliance Gaps
        </button>
      </div>

      {/* Section 1: Mission Schedule & Client Entities */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            01. Mission Schedule &amp; Stakeholder Contacts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Planned flight date is used automatically to validate certificate, registration, and COI expiration dates.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Client / Host Organization
            </label>
            <input
              type="text"
              value={ops.clientOrganization}
              onChange={(e) => updateOps('clientOrganization', e.target.value)}
              placeholder="Cascade Pacific Power & Grid"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Client Safety / Project Contact
            </label>
            <input
              type="text"
              value={ops.clientContactName}
              onChange={(e) => updateOps('clientContactName', e.target.value)}
              placeholder="Name & Title"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              UAS Operator Company
            </label>
            <input
              type="text"
              value={ops.operatorCompany}
              onChange={(e) => updateOps('operatorCompany', e.target.value)}
              placeholder="Your Drone Services LLC"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Mission Profile / Deliverable
            </label>
            <select
              value={ops.missionType}
              onChange={(e) => updateOps('missionType', e.target.value as MissionType)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              {MISSION_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {mt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Planned Flight Date
            </label>
            <input
              type="date"
              value={ops.plannedDate}
              onChange={(e) => updateOps('plannedDate', e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={ops.startTime}
                onChange={(e) => updateOps('startTime', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                End Time
              </label>
              <input
                type="time"
                value={ops.endTime}
                onChange={(e) => updateOps('endTime', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Flight Envelope & Contingencies */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            02. Operational Flight Envelope &amp; Failsafe Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Checked against Part 107 altitude, night (§107.29), BVLOS (§107.31), OOP (§107.145), and obstacle RTH clearance.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Max Planned Altitude (ft AGL)
              </label>
              <input
                type="number"
                min={10}
                max={1200}
                step={5}
                value={ops.maxPlannedAglFt}
                onChange={(e) => updateOps('maxPlannedAglFt', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Lighting Condition
              </label>
              <select
                value={ops.lighting}
                onChange={(e) => updateOps('lighting', e.target.value as LightingCondition)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {LIGHTING_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Line of Sight Mode
              </label>
              <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200 w-full">
                {LOS_OPTIONS.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateOps('losMode', mode)}
                    className={`flex-1 py-1.5 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      ops.losMode === mode
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Operations Over People
              </label>
              <select
                value={ops.overPeople}
                onChange={(e) => updateOps('overPeople', e.target.value as OverPeopleMode)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {OOP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Lost-Link Failsafe Behavior
              </label>
              <select
                value={ops.lostLinkAction}
                onChange={(e) => updateOps('lostLinkAction', e.target.value as LostLinkAction)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {LOST_LINK_OPTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Programmed RTH Altitude (ft AGL)
              </label>
              <input
                type="number"
                min={20}
                max={500}
                step={10}
                value={ops.rthAltitudeFt}
                onChange={(e) => updateOps('rthAltitudeFt', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                Site tallest obstacle: {pkg.site.tallestObstacleFt} ft (+50 ft rec: {pkg.site.tallestObstacleFt + 50} ft)
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Battery Sets Planned
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={ops.batterySetsPlanned}
                onChange={(e) => updateOps('batterySetsPlanned', Number(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ops.overMovingVehicles}
                  onChange={(e) => updateOps('overMovingVehicles', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Flight Crosses Moving Vehicles</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Airframe & Hardware Compliance */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            03. Unmanned Aircraft Specifications &amp; Airworthiness
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Remote ID, NDAA Section 848 cybersecurity eligibility, lighting, and weight class verification.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Primary Aircraft Model
              </label>
              <input
                type="text"
                value={ops.aircraftModel}
                onChange={(e) => updateOps('aircraftModel', e.target.value)}
                placeholder="Skydio X10D / DJI M350 RTK"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                FAA Registration Number
              </label>
              <input
                type="text"
                value={ops.aircraftRegNumber}
                onChange={(e) => updateOps('aircraftRegNumber', e.target.value.toUpperCase())}
                placeholder="FA3M8P92K1"
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Max Takeoff Weight (lbs)
              </label>
              <input
                type="number"
                min={0.1}
                max={150}
                step={0.1}
                value={ops.mtowLbs}
                onChange={(e) => updateOps('mtowLbs', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                FAA Remote ID Method (Part 89)
              </label>
              <select
                value={ops.remoteId}
                onChange={(e) => updateOps('remoteId', e.target.value as RemoteIdType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {REMOTE_ID_OPTIONS.map((rid) => (
                  <option key={rid} value={rid}>
                    {rid}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-slate-100">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={ops.ndaaCompliant}
                onChange={(e) => updateOps('ndaaCompliant', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>NDAA Section 848 / Blue UAS Compliant Airframe</span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={ops.strobe3SmEquipped}
                onChange={(e) => updateOps('strobe3SmEquipped', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>3 SM Anti-Collision Strobe Equipped (§107.29)</span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={ops.oopParachuteDocEquipped}
                onChange={(e) => updateOps('oopParachuteDocEquipped', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>ASTM Parachute / Cat 2–3 OOP System Equipped</span>
            </label>
          </div>
        </div>
      </section>

      {/* Section 4: Crew Roster & Aviation Insurance */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            04. Flight Crew Qualifications &amp; Aviation Liability Insurance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-checked against 24-month Part 107 recurrent currency, client VO mandates, and COI minimums.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Remote Pilot-in-Command (PIC)
              </label>
              <input
                type="text"
                value={ops.picName}
                onChange={(e) => updateOps('picName', e.target.value)}
                placeholder="Full legal name"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Part 107 Certificate Number
              </label>
              <input
                type="text"
                value={ops.picCertNumber}
                onChange={(e) => updateOps('picCertNumber', e.target.value)}
                placeholder="4519823"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Last Recurrent Training Date (§107.65)
              </label>
              <input
                type="date"
                value={ops.picCurrencyDate}
                onChange={(e) => updateOps('picCurrencyDate', e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                PIC Logged Flight Hours
              </label>
              <input
                type="number"
                min={0}
                max={20000}
                value={ops.picFlightHours}
                onChange={(e) => updateOps('picFlightHours', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Dedicated Visual Observers (Count)
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={ops.voCount}
                onChange={(e) => updateOps('voCount', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Visual Observer Name(s)
              </label>
              <input
                type="text"
                value={ops.voNames}
                onChange={(e) => updateOps('voNames', e.target.value)}
                placeholder="e.g., Marcus Vance"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Aviation Liability COI Limit ($ Millions)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={ops.coiCoverageMillions}
                onChange={(e) => updateOps('coiCoverageMillions', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ops.additionalInsuredNamed}
                  onChange={(e) => updateOps('additionalInsuredNamed', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Client Named as Additional Insured</span>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
