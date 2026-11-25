import {
  LatLngPoint,
  MapElementCategory,
  MapElementGeometry,
  OperationalMapElement,
} from '../types/submittal';

export interface MapCategoryMeta {
  id: MapElementCategory;
  label: string;
  shortLabel: string;
  glyph: string;
  strokeHex: string;
  fillHex: string;
  strokeRgba3d: string;
  fillRgba3d: string;
  pinBorder: string;
  textClass: string;
  defaultNames: Record<MapElementGeometry, string>;
  description: string;
}

export const MAP_CATEGORIES: Record<MapElementCategory, MapCategoryMeta> = {
  landing_zone: {
    id: 'landing_zone',
    label: 'Landing / Launch Zone',
    shortLabel: 'Landing Zone',
    glyph: 'LZ',
    strokeHex: '#15803d',
    fillHex: '#22c55e',
    strokeRgba3d: '#22c55eff',
    fillRgba3d: '#22c55e55',
    pinBorder: '#14532d',
    textClass: 'text-emerald-700',
    defaultNames: {
      point: 'Landing Zone (LZ)',
      line: 'Approach / Departure Path',
      polygon: 'Landing & Recovery Pad',
    },
    description: 'Primary takeoff, recovery, and alternate emergency landing zones (ELZ).',
  },
  personnel: {
    id: 'personnel',
    label: 'Personnel / Crew',
    shortLabel: 'Personnel',
    glyph: 'VO',
    strokeHex: '#1d4ed8',
    fillHex: '#3b82f6',
    strokeRgba3d: '#3b82f6ff',
    fillRgba3d: '#3b82f650',
    pinBorder: '#1e3a8a',
    textClass: 'text-blue-700',
    defaultNames: {
      point: 'Crew / VO Station',
      line: 'Spotter Sightline / Escort Path',
      polygon: 'Ground Control & Crew Staging',
    },
    description: 'PIC ground station, Visual Observer positions, and site escort checkpoints.',
  },
  risk: {
    id: 'risk',
    label: 'Risk / Hazard',
    shortLabel: 'Risk',
    glyph: '!',
    strokeHex: '#dc2626',
    fillHex: '#ef4444',
    strokeRgba3d: '#ef4444ff',
    fillRgba3d: '#ef444455',
    pinBorder: '#7f1d1d',
    textClass: 'text-red-700',
    defaultNames: {
      point: 'Point Hazard / Obstacle',
      line: 'Hazard Line (Power / Roadway)',
      polygon: 'Exclusion / No-Fly Risk Zone',
    },
    description: 'High-voltage lines, crane swing zones, pedestrian corridors, and RF emitters.',
  },
  flight_area: {
    id: 'flight_area',
    label: 'Flight Area / Corridor',
    shortLabel: 'Flight Area',
    glyph: 'OP',
    strokeHex: '#0369a1',
    fillHex: '#0ea5e9',
    strokeRgba3d: '#38bdf8ff',
    fillRgba3d: '#0ea5e944',
    pinBorder: '#0c4a6e',
    textClass: 'text-sky-700',
    defaultNames: {
      point: 'Hover / Waypoint',
      line: 'Planned Flight Corridor',
      polygon: 'Authorized Flight Volume',
    },
    description: 'Authorized mission flight boundaries, survey polygons, and transit legs.',
  },
  poi: {
    id: 'poi',
    label: 'Point of Interest',
    shortLabel: 'POI',
    glyph: 'P',
    strokeHex: '#b45309',
    fillHex: '#f59e0b',
    strokeRgba3d: '#f59e0bff',
    fillRgba3d: '#f59e0b4d',
    pinBorder: '#78350f',
    textClass: 'text-amber-700',
    defaultNames: {
      point: 'Inspection POI',
      line: 'Asset Inspection Span',
      polygon: 'Target Inspection Structure',
    },
    description: 'Target inspection structures, access gates, rally landmarks, and assets.',
  },
};

export const MAP_CATEGORY_LIST: MapCategoryMeta[] = [
  MAP_CATEGORIES.landing_zone,
  MAP_CATEGORIES.personnel,
  MAP_CATEGORIES.risk,
  MAP_CATEGORIES.flight_area,
  MAP_CATEGORIES.poi,
];

const EARTH_RADIUS_M = 6371000;
const METERS_TO_FEET = 3.28084;
const SQ_METERS_TO_SQ_FEET = 10.76391;
const SQ_METERS_TO_ACRES = 0.000247105;

export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computePathLengthFt(coords: LatLngPoint[]): number {
  if (coords.length < 2) return 0;
  let meters = 0;
  for (let i = 1; i < coords.length; i++) {
    meters += haversineMeters(coords[i - 1], coords[i]);
  }
  return meters * METERS_TO_FEET;
}

export function computePolygonAreaSqM(coords: LatLngPoint[]): number {
  if (coords.length < 3) return 0;
  const avgLatRad =
    (coords.reduce((sum, p) => sum + p.lat, 0) / coords.length) * (Math.PI / 180);
  const mPerDegLat = 111132.92;
  const mPerDegLng = 111320 * Math.cos(avgLatRad);

  let area2 = 0;
  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    const x1 = p1.lng * mPerDegLng;
    const y1 = p1.lat * mPerDegLat;
    const x2 = p2.lng * mPerDegLng;
    const y2 = p2.lat * mPerDegLat;
    area2 += x1 * y2 - x2 * y1;
  }
  return Math.abs(area2) / 2;
}

export function formatElementMetrics(el: OperationalMapElement): string {
  if (el.geometry === 'point' && el.coordinates.length > 0) {
    const p = el.coordinates[0];
    return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }
  if (el.geometry === 'line') {
    const ft = computePathLengthFt(el.coordinates);
    return `${Math.round(ft).toLocaleString()} ft (${el.coordinates.length} pts)`;
  }
  if (el.geometry === 'polygon') {
    const sqM = computePolygonAreaSqM(el.coordinates);
    const acres = sqM * SQ_METERS_TO_ACRES;
    const sqFt = sqM * SQ_METERS_TO_SQ_FEET;
    if (acres >= 0.5) {
      return `${acres.toFixed(2)} ac (${Math.round(sqFt).toLocaleString()} sq ft)`;
    }
    return `${Math.round(sqFt).toLocaleString()} sq ft`;
  }
  return '—';
}

export function getElementAnchorPoint(coords: LatLngPoint[]): LatLngPoint {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  if (coords.length === 1) return coords[0];
  const lat = coords.reduce((acc, p) => acc + p.lat, 0) / coords.length;
  const lng = coords.reduce((acc, p) => acc + p.lng, 0) / coords.length;
  return { lat, lng };
}

function hexToKmlColor(hex: string, alphaHex: string): string {
  const clean = hex.replace('#', '');
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  // KML uses AABBGGRR
  return `${alphaHex}${b}${g}${r}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportElementsToKml(
  packageTitle: string,
  referenceCode: string,
  elements: OperationalMapElement[]
): string {
  const styles = MAP_CATEGORY_LIST.map((cat) => {
    const lineColor = hexToKmlColor(cat.strokeHex, 'ff');
    const polyColor = hexToKmlColor(cat.fillHex, '66');
    return `    <Style id="style-${cat.id}">
      <LineStyle><color>${lineColor}</color><width>3</width></LineStyle>
      <PolyStyle><color>${polyColor}</color></PolyStyle>
    </Style>`;
  }).join('\n');

  const placemarks = elements
    .map((el) => {
      const cat = MAP_CATEGORIES[el.category];
      const altMeters = el.altitudeAglFt ? (el.altitudeAglFt / METERS_TO_FEET).toFixed(1) : '0';
      const altMode = el.altitudeAglFt && el.altitudeAglFt > 0 ? 'relativeToGround' : 'clampToGround';
      let geomXml = '';

      if (el.geometry === 'point' && el.coordinates[0]) {
        const p = el.coordinates[0];
        geomXml = `<Point><altitudeMode>${altMode}</altitudeMode><coordinates>${p.lng},${p.lat},${altMeters}</coordinates></Point>`;
      } else if (el.geometry === 'line' && el.coordinates.length >= 2) {
        const coordStr = el.coordinates.map((p) => `${p.lng},${p.lat},${altMeters}`).join(' ');
        geomXml = `<LineString><tessellate>1</tessellate><altitudeMode>${altMode}</altitudeMode><coordinates>${coordStr}</coordinates></LineString>`;
      } else if (el.geometry === 'polygon' && el.coordinates.length >= 3) {
        const closed = [...el.coordinates, el.coordinates[0]];
        const coordStr = closed.map((p) => `${p.lng},${p.lat},${altMeters}`).join(' ');
        geomXml = `<Polygon><extrude>${el.altitudeAglFt ? 1 : 0}</extrude><tessellate>1</tessellate><altitudeMode>${altMode}</altitudeMode><outerBoundaryIs><LinearRing><coordinates>${coordStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      }

      return `    <Placemark>
      <name>${escapeXml(el.label)}</name>
      <description>${escapeXml(`[${cat.label}] ${el.notes || ''}`.trim())}</description>
      <styleUrl>#style-${el.category}</styleUrl>
      ${geomXml}
    </Placemark>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(`${referenceCode} — ${packageTitle}`)}</name>
${styles}
${placemarks}
  </Document>
</kml>`;
}

export function exportElementsToGeoJson(elements: OperationalMapElement[]) {
  return {
    type: 'FeatureCollection',
    features: elements
      .filter((el) => el.coordinates.length > 0)
      .map((el) => {
        const cat = MAP_CATEGORIES[el.category];
        if (el.geometry === 'point') {
          return {
            type: 'Feature',
            properties: {
              id: el.id,
              label: el.label,
              category: el.category,
              categoryLabel: cat.label,
              notes: el.notes,
              altitudeAglFt: el.altitudeAglFt ?? 0,
            },
            geometry: {
              type: 'Point',
              coordinates: [el.coordinates[0].lng, el.coordinates[0].lat],
            },
          };
        }
        if (el.geometry === 'line') {
          return {
            type: 'Feature',
            properties: {
              id: el.id,
              label: el.label,
              category: el.category,
              categoryLabel: cat.label,
              notes: el.notes,
              lengthFt: Math.round(computePathLengthFt(el.coordinates)),
            },
            geometry: {
              type: 'LineString',
              coordinates: el.coordinates.map((p) => [p.lng, p.lat]),
            },
          };
        }
        const ring = [...el.coordinates, el.coordinates[0]].map((p) => [p.lng, p.lat]);
        return {
          type: 'Feature',
          properties: {
            id: el.id,
            label: el.label,
            category: el.category,
            categoryLabel: cat.label,
            notes: el.notes,
            altitudeAglFt: el.altitudeAglFt ?? 0,
            areaSqFt: Math.round(computePolygonAreaSqM(el.coordinates) * SQ_METERS_TO_SQ_FEET),
          },
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
        };
      }),
  };
}
