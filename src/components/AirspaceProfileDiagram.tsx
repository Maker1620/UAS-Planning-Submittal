import React from 'react';
import { ClientRequirements, FlightOperations, SiteAssessment } from '../types/submittal';

interface AirspaceProfileDiagramProps {
  site: SiteAssessment;
  operations: FlightOperations;
  clientReq: ClientRequirements;
  compact?: boolean;
}

export const AirspaceProfileDiagram: React.FC<AirspaceProfileDiagramProps> = ({
  site,
  operations,
  clientReq,
  compact = false,
}) => {
  const isControlled = site.airspaceClass !== 'G';
  const effectiveCeiling = isControlled
    ? site.laancAvailable
      ? site.laancGridCeilingFt
      : 0
    : 400;

  const maxAltitudeScale = Math.max(
    450,
    operations.maxPlannedAglFt + 60,
    site.tallestObstacleFt + 100,
    operations.rthAltitudeFt + 60,
    effectiveCeiling + 60
  );

  // SVG coordinate system
  const svgW = 640;
  const svgH = compact ? 220 : 256;
  const padTop = 26;
  const padBottom = 38;
  const padLeft = 58;
  const padRight = 24;
  const plotH = svgH - padTop - padBottom;
  const plotW = svgW - padLeft - padRight;
  const groundY = padTop + plotH;

  const altToY = (ft: number) => {
    const clamped = Math.max(0, Math.min(ft, maxAltitudeScale));
    return groundY - (clamped / maxAltitudeScale) * plotH;
  };

  const y400 = altToY(400);
  const yCeiling = altToY(effectiveCeiling);
  const yPlanned = altToY(operations.maxPlannedAglFt);
  const yObstacle = altToY(site.tallestObstacleFt);
  const yRth = altToY(operations.rthAltitudeFt);

  const rthSafe =
    operations.lostLinkAction !== 'Return to Home (RTH)' ||
    operations.rthAltitudeFt >= site.tallestObstacleFt + 50;

  const ceilingViolation =
    (isControlled && (!site.laancAvailable || operations.maxPlannedAglFt > site.laancGridCeilingFt)) ||
    operations.maxPlannedAglFt > 400;

  const standoffViolation = site.horizontalStandoffFt < clientReq.minStandoffFt;

  // Grid ticks
  const ticks = [0, 100, 200, 300, 400];
  if (maxAltitudeScale > 480) {
    ticks.push(500);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
        <div className="text-xs font-semibold text-slate-800">
          Vertical Airspace &amp; Obstacle Clearance Profile
        </div>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600">
          <span>Class {site.airspaceClass}</span>
          <span aria-hidden="true">·</span>
          <span>Max AGL {operations.maxPlannedAglFt} ft</span>
          <span aria-hidden="true">·</span>
          <span>Standoff {site.horizontalStandoffFt} ft</span>
        </div>
      </div>

      <div className="p-3">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto block"
          role="img"
          aria-label={`Elevation diagram showing Class ${site.airspaceClass} airspace ceiling at ${effectiveCeiling} feet, planned flight at ${operations.maxPlannedAglFt} feet, and tallest obstacle at ${site.tallestObstacleFt} feet`}
        >
          {/* Subtle elevation gridlines */}
          {ticks.map((ft) => {
            const y = altToY(ft);
            return (
              <g key={ft}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgW - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400"
                  style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {ft} ft
                </text>
              </g>
            );
          })}

          {/* Controlled airspace ceiling band */}
          {isControlled && (
            <rect
              x={padLeft}
              y={padTop}
              width={plotW}
              height={Math.max(0, yCeiling - padTop)}
              fill="#fef2f2"
              opacity="0.7"
            />
          )}

          {/* Planned flight operational envelope */}
          <rect
            x={padLeft + 150}
            y={yPlanned}
            width={plotW - 220}
            height={Math.max(2, groundY - yPlanned)}
            fill={ceilingViolation ? '#fee2e2' : '#dbeafe'}
            opacity="0.45"
          />

          {/* 400 ft Part 107 reference line */}
          <line
            x1={padLeft}
            y1={y400}
            x2={svgW - padRight}
            y2={y400}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={svgW - padRight - 4}
            y={y400 - 5}
            textAnchor="end"
            className="fill-slate-500"
            style={{ fontSize: '9.5px', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            400 ft Part 107 Ceiling
          </text>

          {/* LAANC ceiling line for controlled airspace */}
          {isControlled && (
            <>
              <line
                x1={padLeft}
                y1={yCeiling}
                x2={svgW - padRight}
                y2={yCeiling}
                stroke="#dc2626"
                strokeWidth="1.5"
                strokeDasharray="6 3"
              />
              <text
                x={padLeft + 8}
                y={Math.max(padTop + 12, yCeiling - 5)}
                className="fill-red-700"
                style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}
              >
                Class {site.airspaceClass} LAANC Grid: {site.laancAvailable ? `${site.laancGridCeilingFt} ft` : '0 ft (Manual Auth)'}
              </text>
            </>
          )}

          {/* Tallest obstacle silhouette */}
          <g>
            <rect
              x={padLeft + 34}
              y={yObstacle}
              width="42"
              height={Math.max(4, groundY - yObstacle)}
              fill="#cbd5e1"
              stroke="#64748b"
              strokeWidth="1.2"
            />
            {/* Cross-bracing technical lines */}
            {groundY - yObstacle > 24 && (
              <>
                <line
                  x1={padLeft + 34}
                  y1={yObstacle}
                  x2={padLeft + 76}
                  y2={groundY}
                  stroke="#94a3b8"
                  strokeWidth="0.75"
                />
                <line
                  x1={padLeft + 76}
                  y1={yObstacle}
                  x2={padLeft + 34}
                  y2={groundY}
                  stroke="#94a3b8"
                  strokeWidth="0.75"
                />
              </>
            )}
            <text
              x={padLeft + 55}
              y={Math.max(padTop + 10, yObstacle - 6)}
              textAnchor="middle"
              className="fill-slate-700"
              style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}
            >
              Obs {site.tallestObstacleFt} ft
            </text>
          </g>

          {/* Horizontal Standoff Dimension Line */}
          <g>
            <line
              x1={padLeft + 76}
              y1={groundY - 12}
              x2={padLeft + 150}
              y2={groundY - 12}
              stroke={standoffViolation ? '#dc2626' : '#15803d'}
              strokeWidth="1.5"
            />
            <line
              x1={padLeft + 76}
              y1={groundY - 17}
              x2={padLeft + 76}
              y2={groundY - 7}
              stroke={standoffViolation ? '#dc2626' : '#15803d'}
              strokeWidth="1.5"
            />
            <line
              x1={padLeft + 150}
              y1={groundY - 17}
              x2={padLeft + 150}
              y2={groundY - 7}
              stroke={standoffViolation ? '#dc2626' : '#15803d'}
              strokeWidth="1.5"
            />
            <text
              x={padLeft + 113}
              y={groundY - 18}
              textAnchor="middle"
              className={standoffViolation ? 'fill-red-700' : 'fill-emerald-700'}
              style={{ fontSize: '9.5px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}
            >
              {site.horizontalStandoffFt} ft
            </text>
          </g>

          {/* Planned Max AGL top border & aircraft marker */}
          <line
            x1={padLeft + 150}
            y1={yPlanned}
            x2={svgW - padRight - 70}
            y2={yPlanned}
            stroke={ceilingViolation ? '#dc2626' : '#1d4ed8'}
            strokeWidth="2"
          />
          <circle
            cx={padLeft + 250}
            cy={yPlanned}
            r="4"
            fill={ceilingViolation ? '#dc2626' : '#1d4ed8'}
          />
          <text
            x={padLeft + 260}
            y={yPlanned - 6}
            className={ceilingViolation ? 'fill-red-700' : 'fill-blue-700'}
            style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}
          >
            Planned Max {operations.maxPlannedAglFt} ft AGL
          </text>

          {/* RTH altitude trajectory line */}
          {operations.lostLinkAction === 'Return to Home (RTH)' && (
            <g>
              <line
                x1={padLeft + 24}
                y1={yRth}
                x2={svgW - padRight - 40}
                y2={yRth}
                stroke={rthSafe ? '#15803d' : '#dc2626'}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={svgW - padRight - 42}
                y={yRth + 12}
                textAnchor="end"
                className={rthSafe ? 'fill-emerald-700' : 'fill-red-700'}
                style={{ fontSize: '9.5px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}
              >
                RTH {operations.rthAltitudeFt} ft ({rthSafe ? 'Clears Obs +50 ft' : 'Below Obs +50 ft Margin'})
              </text>
            </g>
          )}

          {/* Ground plane */}
          <line
            x1={padLeft}
            y1={groundY}
            x2={svgW - padRight}
            y2={groundY}
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Launch / Recovery Zone marker */}
          <rect
            x={svgW - padRight - 64}
            y={groundY - 4}
            width="44"
            height="4"
            fill="#1d4ed8"
          />
          <text
            x={svgW - padRight - 42}
            y={groundY + 15}
            textAnchor="middle"
            className="fill-slate-600"
            style={{ fontSize: '9.5px', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            Launch / ELZ
          </text>
          <text
            x={padLeft + 55}
            y={groundY + 15}
            textAnchor="middle"
            className="fill-slate-600"
            style={{ fontSize: '9.5px', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            Asset / Structure
          </text>
          <text
            x={padLeft + 113}
            y={groundY + 15}
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            Min {clientReq.minStandoffFt} ft
          </text>
        </svg>
      </div>
    </div>
  );
};
