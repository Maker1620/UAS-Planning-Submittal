import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  AltitudeMode,
  APILoadingStatus,
  InfoWindow,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  Polygon,
  Polyline,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  GestureHandling,
  Map3D,
  Map3DClickEvent,
  Map3DRef,
  MapMode,
  Marker3D,
  Polygon3D,
  Polyline3D,
} from '@vis.gl/react-google-maps/3d';
import {
  Check,
  Compass,
  Crosshair,
  Download,
  Globe,
  Layers,
  Map as MapIcon,
  MapPin,
  Minus,
  MousePointer2,
  Pentagon,
  RotateCcw,
  Settings,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {
  computePathLengthFt,
  computePolygonAreaSqM,
  exportElementsToGeoJson,
  exportElementsToKml,
  formatElementMetrics,
  getElementAnchorPoint,
  MAP_CATEGORIES,
  MAP_CATEGORY_LIST,
} from '../data/mapCategories';
import {
  LatLngPoint,
  MapElementCategory,
  MapElementGeometry,
  OperationalMapElement,
  SubmittalPackage,
  WorkspaceTab,
} from '../types/submittal';

interface OperationalMapViewProps {
  pkg: SubmittalPackage;
  apiKeyPresent: boolean;
  driveConnected: boolean;
  uploadingArtifact: string | null;
  onUpdatePackage: (updater: (prev: SubmittalPackage) => SubmittalPackage) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onOpenSettings: () => void;
  onUploadArtifactToDrive: (kind: 'kml' | 'geojson') => void;
}

type DrawTool = 'select' | MapElementGeometry;
type ViewMode = '3d' | '2d';

const FEET_TO_METERS = 0.3048;

function detectWebGL2(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function parseSiteCenter(pkg: SubmittalPackage): LatLngPoint {
  const lat = parseFloat(pkg.site.latitude);
  const lng = parseFloat(pkg.site.longitude);
  if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng };
  }
  const firstEl = pkg.mapElements?.[0];
  if (firstEl && firstEl.coordinates.length > 0) {
    return firstEl.coordinates[0];
  }
  return { lat: 47.6062, lng: -122.3321 };
}

function extractLatLngFrom3DPosition(
  pos: { lat: number | (() => number); lng: number | (() => number) } | null | undefined
): LatLngPoint | null {
  if (!pos) return null;
  const rawLat = typeof pos.lat === 'function' ? pos.lat() : Number(pos.lat);
  const rawLng = typeof pos.lng === 'function' ? pos.lng() : Number(pos.lng);
  if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) return null;
  return { lat: rawLat, lng: rawLng };
}

interface Map2DPanControllerProps {
  panTarget: { lat: number; lng: number; zoom?: number; seq: number } | null;
}

const Map2DPanController: React.FC<Map2DPanControllerProps> = ({ panTarget }) => {
  const map = useMap('flightdossier-2d-map');
  useEffect(() => {
    if (!map || !panTarget) return;
    map.panTo({ lat: panTarget.lat, lng: panTarget.lng });
    if (panTarget.zoom) {
      map.setZoom(panTarget.zoom);
    }
  }, [map, panTarget]);
  return null;
};

const MapsStatusErrorOverlay: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const apiStatus = useApiLoadingStatus();
  if (apiStatus !== APILoadingStatus.FAILED && apiStatus !== APILoadingStatus.AUTH_FAILURE) {
    return null;
  }
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-slate-50 text-slate-700">
      <Globe className="w-8 h-8 text-red-500 mb-3" />
      <div className="text-sm font-semibold text-slate-900">
        Unable to Load Google Maps Platform
      </div>
      <p className="mt-1.5 text-xs text-slate-600 max-w-md">
        Verify your Google Maps JavaScript API key, billing status, or referrer restrictions, or enter your own API key in Settings.
      </p>
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap cursor-pointer"
      >
        <Settings className="w-3.5 h-3.5" />
        Open API Settings
      </button>
    </div>
  );
};

export const OperationalMapView: React.FC<OperationalMapViewProps> = ({
  pkg,
  apiKeyPresent,
  driveConnected,
  uploadingArtifact,
  onUpdatePackage,
  onNavigateTab,
  onOpenSettings,
  onUploadArtifactToDrive,
}) => {
  const webgl2Supported = useMemo(() => detectWebGL2(), []);

  const [viewMode, setViewMode] = useState<ViewMode>(webgl2Supported ? '3d' : '2d');
  const [showHybridLabels, setShowHybridLabels] = useState(true);
  const [drawTool, setDrawTool] = useState<DrawTool>('select');
  const [activeCategory, setActiveCategory] = useState<MapElementCategory>('landing_zone');
  const [filterCategory, setFilterCategory] = useState<'all' | MapElementCategory>('all');
  const [draftVertices, setDraftVertices] = useState<LatLngPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [pan2DTarget, setPan2DTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    seq: number;
  } | null>(null);

  const map3dRef = useRef<Map3DRef | null>(null);
  const elements = pkg.mapElements ?? [];
  const siteCenter = useMemo(() => parseSiteCenter(pkg), [pkg.site.latitude, pkg.site.longitude, pkg.id]);

  // Reset draft & recenter when switching submittal packages
  useEffect(() => {
    setDraftVertices([]);
    setSelectedId(null);
    setDrawTool('select');
    if (map3dRef.current) {
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: { lat: siteCenter.lat, lng: siteCenter.lng, altitude: 0 },
          range: 420,
          tilt: 55,
          heading: 0,
          roll: 0,
        },
        durationMillis: 900,
      });
    }
    setPan2DTarget({ lat: siteCenter.lat, lng: siteCenter.lng, zoom: 17, seq: Date.now() });
  }, [pkg.id]);

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId]
  );

  const filteredElements = useMemo(() => {
    if (filterCategory === 'all') return elements;
    return elements.filter((el) => el.category === filterCategory);
  }, [elements, filterCategory]);

  const addElement = useCallback(
    (geometry: MapElementGeometry, coordinates: LatLngPoint[]) => {
      const catMeta = MAP_CATEGORIES[activeCategory];
      const existingSameCat = elements.filter((el) => el.category === activeCategory).length;
      const defaultAgl =
        activeCategory === 'flight_area'
          ? pkg.operations.maxPlannedAglFt
          : activeCategory === 'risk' && geometry !== 'point'
            ? Math.min(pkg.site.tallestObstacleFt || 80, 200)
            : 0;

      const newEl: OperationalMapElement = {
        id: `mapel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        geometry,
        category: activeCategory,
        label: `${catMeta.defaultNames[geometry]} #${existingSameCat + 1}`,
        notes: '',
        coordinates,
        altitudeAglFt: defaultAgl,
      };

      onUpdatePackage((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString().slice(0, 10),
        mapElements: [...(prev.mapElements ?? []), newEl],
      }));
      setSelectedId(newEl.id);
    },
    [activeCategory, elements, onUpdatePackage, pkg.operations.maxPlannedAglFt, pkg.site.tallestObstacleFt]
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<OperationalMapElement>) => {
      onUpdatePackage((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString().slice(0, 10),
        mapElements: (prev.mapElements ?? []).map((el) =>
          el.id === id ? { ...el, ...patch } : el
        ),
      }));
    },
    [onUpdatePackage]
  );

  const deleteElement = useCallback(
    (id: string) => {
      onUpdatePackage((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString().slice(0, 10),
        mapElements: (prev.mapElements ?? []).filter((el) => el.id !== id),
      }));
      setSelectedId((curr) => (curr === id ? null : curr));
    },
    [onUpdatePackage]
  );

  const finalizeDraft = useCallback(() => {
    if (drawTool === 'line' && draftVertices.length >= 2) {
      addElement('line', draftVertices);
      setDraftVertices([]);
      setDrawTool('select');
    } else if (drawTool === 'polygon' && draftVertices.length >= 3) {
      addElement('polygon', draftVertices);
      setDraftVertices([]);
      setDrawTool('select');
    }
  }, [drawTool, draftVertices, addElement]);

  const cancelDraft = useCallback(() => {
    setDraftVertices([]);
    setDrawTool('select');
  }, []);

  // Keyboard shortcuts for finishing (Enter) or canceling (Escape) active drawing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (drawTool === 'select') return;
      if (e.key === 'Escape') {
        cancelDraft();
      } else if (e.key === 'Enter' && (drawTool === 'line' || drawTool === 'polygon')) {
        finalizeDraft();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawTool, cancelDraft, finalizeDraft]);

  const handleCoordinateClick = useCallback(
    (point: LatLngPoint) => {
      if (drawTool === 'select') return;
      if (drawTool === 'point') {
        addElement('point', [point]);
        setDrawTool('select');
        return;
      }
      if (drawTool === 'line' || drawTool === 'polygon') {
        setDraftVertices((prev) => [...prev, point]);
      }
    },
    [drawTool, addElement]
  );

  const handle3DMapClick = useCallback(
    (ev: Map3DClickEvent) => {
      const pt = extractLatLngFrom3DPosition(ev.detail.position);
      if (!pt) return;
      handleCoordinateClick(pt);
    },
    [handleCoordinateClick]
  );

  const handle2DMapClick = useCallback(
    (ev: MapMouseEvent) => {
      if (!ev.detail.latLng) return;
      handleCoordinateClick({ lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng });
    },
    [handleCoordinateClick]
  );

  const handle2DMapDoubleClick = useCallback(() => {
    if (drawTool === 'line' && draftVertices.length >= 2) {
      finalizeDraft();
    } else if (drawTool === 'polygon' && draftVertices.length >= 3) {
      finalizeDraft();
    }
  }, [drawTool, draftVertices.length, finalizeDraft]);

  const focusOnPoint = useCallback(
    (pt: LatLngPoint, range = 260, tilt = 55) => {
      if (viewMode === '3d' && map3dRef.current) {
        map3dRef.current.flyCameraTo({
          endCamera: {
            center: { lat: pt.lat, lng: pt.lng, altitude: 0 },
            range,
            tilt,
            heading: 0,
            roll: 0,
          },
          durationMillis: 900,
        });
      } else {
        setPan2DTarget({ lat: pt.lat, lng: pt.lng, zoom: 18, seq: Date.now() });
      }
    },
    [viewMode]
  );

  const handleCameraPreset = (tilt: number, heading = 0, range = 420) => {
    if (viewMode === '3d' && map3dRef.current) {
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: { lat: siteCenter.lat, lng: siteCenter.lng, altitude: 0 },
          range,
          tilt,
          heading,
          roll: 0,
        },
        durationMillis: 800,
      });
    } else {
      setPan2DTarget({ lat: siteCenter.lat, lng: siteCenter.lng, zoom: 17, seq: Date.now() });
    }
  };

  const handleExportKml = () => {
    const kml = exportElementsToKml(pkg.title, pkg.referenceCode, elements);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.referenceCode || 'flight-site'}-operations.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGeoJson = () => {
    const gj = exportElementsToGeoJson(elements);
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.referenceCode || 'flight-site'}-operations.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncLzsToSite = () => {
    const lzs = elements.filter((el) => el.category === 'landing_zone');
    if (lzs.length === 0) return;
    const summary = lzs
      .map((lz) => {
        const anchor = getElementAnchorPoint(lz.coordinates);
        return `${lz.label} (${anchor.lat.toFixed(5)}, ${anchor.lng.toFixed(5)})${lz.notes ? ` — ${lz.notes}` : ''}`;
      })
      .join('. ');

    onUpdatePackage((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      site: {
        ...prev.site,
        emergencyLandingZones: summary,
      },
    }));
    setSyncNotice(`Synced ${lzs.length} landing zone(s) to Site Assessment`);
    setTimeout(() => setSyncNotice(null), 2800);
  };

  const draftCatMeta = MAP_CATEGORIES[activeCategory];
  const draftLengthFt = drawTool === 'line' ? computePathLengthFt(draftVertices) : 0;
  const draftAreaSqFt =
    drawTool === 'polygon' && draftVertices.length >= 3
      ? computePolygonAreaSqM(draftVertices) * 10.76391
      : 0;

  const canFinishDraft =
    (drawTool === 'line' && draftVertices.length >= 2) ||
    (drawTool === 'polygon' && draftVertices.length >= 3);

  const countsByCategory = useMemo(() => {
    const counts: Record<MapElementCategory, number> = {
      landing_zone: 0,
      personnel: 0,
      risk: 0,
      flight_area: 0,
      poi: 0,
    };
    elements.forEach((el) => {
      counts[el.category] += 1;
    });
    return counts;
  }, [elements]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Operational Site Map (Google Earth 3D &amp; Satellite)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Draw labeled points, lines, and polygons to map landing zones, crew positions, site hazards, flight volumes, and inspection POIs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportKml}
            disabled={elements.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export KML
          </button>
          <button
            type="button"
            onClick={handleExportGeoJson}
            disabled={elements.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export GeoJSON
          </button>
          {driveConnected && (
            <>
              <button
                type="button"
                onClick={() => onUploadArtifactToDrive('kml')}
                disabled={elements.length === 0 || Boolean(uploadingArtifact)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingArtifact === 'kml' ? 'Uploading KML…' : 'Upload KML to Drive'}
              </button>
              <button
                type="button"
                onClick={() => onUploadArtifactToDrive('geojson')}
                disabled={elements.length === 0 || Boolean(uploadingArtifact)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingArtifact === 'geojson' ? 'Uploading GeoJSON…' : 'Upload GeoJSON to Drive'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('audit')}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            Check Compliance Audit
          </button>
        </div>
      </div>

      {!apiKeyPresent && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="text-xs font-semibold text-amber-950">
              Google Maps JavaScript API Key Not Configured
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Add your own Google Maps JavaScript API key in Settings to enable interactive 3D Earth and 2D Satellite mapping.
              All other tabs (Site &amp; Airspace, Flight Operations, Compliance Audit, and Submittal Package) and your plotted coordinate exports remain fully functional.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Add Maps API Key in Settings
          </button>
        </div>
      )}

      {/* Unified Drawing & View Toolbar */}
      <section className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Drawing Tool Segmented Control */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Tool</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200">
              {(
                [
                  { id: 'select', label: 'Inspect / Pan', icon: MousePointer2 },
                  { id: 'point', label: 'Draw Point', icon: MapPin },
                  { id: 'line', label: 'Draw Line', icon: Minus },
                  { id: 'polygon', label: 'Draw Polygon', icon: Pentagon },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = drawTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setDraftVertices([]);
                      setDrawTool(t.id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map View Mode & Camera Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                disabled={!webgl2Supported}
                title={
                  webgl2Supported
                    ? 'Photorealistic 3D Google Earth view'
                    : 'WebGL2 is required for 3D Earth tiles'
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 ${
                  viewMode === '3d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>3D Earth</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('2d')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === '2d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 shrink-0" />
                <span>2D Satellite</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowHybridLabels((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                showHybridLabels
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Map Labels</span>
            </button>

            {viewMode === '3d' && (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCameraPreset(55, 0, 420)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  3D Tilt
                </button>
                <button
                  type="button"
                  onClick={() => handleCameraPreset(0, 0, 480)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
                >
                  Top-Down
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleCameraPreset(viewMode === '3d' ? 55 : 0, 0, 420)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Recenter Site
            </button>
          </div>
        </div>

        {/* Category Selector Strip */}
        <div className="px-4 py-2.5 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">Element Type</span>
            {MAP_CATEGORY_LIST.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 border-slate-900 shadow-xs'
                      : 'bg-white/60 text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: cat.strokeHex }}
                    aria-hidden="true"
                  />
                  <span>{cat.shortLabel}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {countsByCategory[cat.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Site Origin: {siteCenter.lat.toFixed(5)}, {siteCenter.lng.toFixed(5)}
          </div>
        </div>
      </section>

      {/* Active Drawing Prompt Bar */}
      {drawTool !== 'select' && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-800 flex flex-wrap items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: draftCatMeta.strokeHex }}
              aria-hidden="true"
            />
            <span className="font-semibold text-slate-900">
              Drawing {draftCatMeta.shortLabel} ({drawTool}):
            </span>
            {drawTool === 'point' ? (
              <span>Click anywhere on the map to place a labeled marker.</span>
            ) : (
              <span>
                Click on the map to add vertices ({draftVertices.length} placed
                {drawTool === 'line' && draftVertices.length >= 2
                  ? ` · ${Math.round(draftLengthFt).toLocaleString()} ft`
                  : ''}
                {drawTool === 'polygon' && draftVertices.length >= 3
                  ? ` · ${Math.round(draftAreaSqFt).toLocaleString()} sq ft`
                  : ''}
                ). Press Enter or click Finish when complete.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(drawTool === 'line' || drawTool === 'polygon') && (
              <>
                <button
                  type="button"
                  onClick={() => setDraftVertices((prev) => prev.slice(0, -1))}
                  disabled={draftVertices.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md disabled:opacity-45 whitespace-nowrap cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo Vertex
                </button>
                <button
                  type="button"
                  onClick={finalizeDraft}
                  disabled={!canFinishDraft}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-45 whitespace-nowrap cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Finish {drawTool === 'line' ? 'Line' : 'Polygon'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={cancelDraft}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Split Workspace: Map Canvas + Operational Elements Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Map Canvas Container (explicit height to prevent CF2 collapse) */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="relative w-full h-[560px] bg-slate-900">
            {apiKeyPresent && <MapsStatusErrorOverlay onOpenSettings={onOpenSettings} />}
            {!apiKeyPresent ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 text-slate-700">
                <Globe className="w-8 h-8 text-slate-400 mb-3" />
                <div className="text-sm font-semibold text-slate-900">
                  Interactive 3D Earth &amp; Satellite Canvas Paused
                </div>
                <p className="mt-1.5 text-xs text-slate-600 max-w-md leading-relaxed">
                  Enter a Google Maps JavaScript API key in Settings (stored locally in your browser) to render photorealistic 3D Earth tiles and draw operational elements on the map.
                </p>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Open Settings
                </button>
              </div>
            ) : viewMode === '3d' ? (
              <Map3D
                ref={map3dRef}
                id="flightdossier-3d-map"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                mode={showHybridLabels ? MapMode.HYBRID : MapMode.SATELLITE}
                gestureHandling={GestureHandling.GREEDY}
                defaultCenter={{ lat: siteCenter.lat, lng: siteCenter.lng, altitude: 0 }}
                defaultRange={420}
                defaultTilt={55}
                defaultHeading={0}
                defaultRoll={0}
                onClick={handle3DMapClick}
                style={{ width: '100%', height: '100%' }}
              >
                {/* Saved 3D Elements */}
                {elements.map((el) => {
                  const cat = MAP_CATEGORIES[el.category];
                  const isSelected = el.id === selectedId;
                  const altMeters = (el.altitudeAglFt ?? 0) * FEET_TO_METERS;
                  const altMode =
                    altMeters > 0
                      ? AltitudeMode.RELATIVE_TO_GROUND
                      : AltitudeMode.CLAMP_TO_GROUND;

                  if (el.geometry === 'point' && el.coordinates[0]) {
                    const p = el.coordinates[0];
                    return (
                      <Marker3D
                        key={el.id}
                        position={{ lat: p.lat, lng: p.lng, altitude: altMeters }}
                        altitudeMode={altMode}
                        extruded={altMeters > 0}
                        label={el.label}
                        title={el.label}
                        onClick={() => setSelectedId(el.id)}
                      >
                        <Pin
                          background={cat.strokeHex}
                          borderColor={isSelected ? '#ffffff' : cat.pinBorder}
                          glyphColor="#ffffff"
                          glyphText={cat.glyph}
                          scale={isSelected ? 1.25 : 1.0}
                        />
                      </Marker3D>
                    );
                  }

                  if (el.geometry === 'line' && el.coordinates.length >= 2) {
                    const path3d = el.coordinates.map((pt) => ({
                      lat: pt.lat,
                      lng: pt.lng,
                      altitude: altMeters,
                    }));
                    const mid = getElementAnchorPoint(el.coordinates);
                    return (
                      <React.Fragment key={el.id}>
                        <Polyline3D
                          path={path3d}
                          altitudeMode={altMode}
                          strokeColor={cat.strokeRgba3d}
                          strokeWidth={isSelected ? 8 : 5}
                          drawsOccludedSegments
                          extruded={altMeters > 0}
                          onClick={() => setSelectedId(el.id)}
                        />
                        <Marker3D
                          position={{ lat: mid.lat, lng: mid.lng, altitude: altMeters }}
                          altitudeMode={altMode}
                          label={el.label}
                          title={el.label}
                          onClick={() => setSelectedId(el.id)}
                        >
                          <Pin
                            background={cat.strokeHex}
                            borderColor="#ffffff"
                            glyphColor="#ffffff"
                            glyphText={cat.glyph}
                            scale={0.85}
                          />
                        </Marker3D>
                      </React.Fragment>
                    );
                  }

                  if (el.geometry === 'polygon' && el.coordinates.length >= 3) {
                    const closedPath = [...el.coordinates, el.coordinates[0]].map((pt) => ({
                      lat: pt.lat,
                      lng: pt.lng,
                      altitude: altMeters,
                    }));
                    const centroid = getElementAnchorPoint(el.coordinates);
                    return (
                      <React.Fragment key={el.id}>
                        <Polygon3D
                          path={closedPath}
                          altitudeMode={altMode}
                          extruded={altMeters > 0}
                          fillColor={cat.fillRgba3d}
                          strokeColor={cat.strokeRgba3d}
                          strokeWidth={isSelected ? 5 : 3}
                          drawsOccludedSegments
                          onClick={() => setSelectedId(el.id)}
                        />
                        <Marker3D
                          position={{ lat: centroid.lat, lng: centroid.lng, altitude: altMeters }}
                          altitudeMode={altMode}
                          label={el.label}
                          title={el.label}
                          onClick={() => setSelectedId(el.id)}
                        >
                          <Pin
                            background={cat.strokeHex}
                            borderColor="#ffffff"
                            glyphColor="#ffffff"
                            glyphText={cat.glyph}
                            scale={0.85}
                          />
                        </Marker3D>
                      </React.Fragment>
                    );
                  }

                  return null;
                })}

                {/* In-Progress Draft Vertices / Line / Polygon in 3D */}
                {draftVertices.map((pt, idx) => (
                  <Marker3D
                    key={`draft-3d-${idx}`}
                    position={{ lat: pt.lat, lng: pt.lng, altitude: 2 }}
                    altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                    label={`${idx + 1}`}
                  >
                    <Pin
                      background="#ffffff"
                      borderColor={draftCatMeta.strokeHex}
                      glyphColor={draftCatMeta.strokeHex}
                      glyphText={String(idx + 1)}
                      scale={0.75}
                    />
                  </Marker3D>
                ))}

                {draftVertices.length >= 2 && drawTool === 'line' && (
                  <Polyline3D
                    path={draftVertices.map((pt) => ({ lat: pt.lat, lng: pt.lng, altitude: 2 }))}
                    altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                    strokeColor={draftCatMeta.strokeRgba3d}
                    strokeWidth={5}
                    drawsOccludedSegments
                  />
                )}

                {draftVertices.length >= 2 && drawTool === 'polygon' && (
                  <Polyline3D
                    path={draftVertices.map((pt) => ({ lat: pt.lat, lng: pt.lng, altitude: 2 }))}
                    altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                    strokeColor={draftCatMeta.strokeRgba3d}
                    strokeWidth={4}
                    drawsOccludedSegments
                  />
                )}

                {draftVertices.length >= 3 && drawTool === 'polygon' && (
                  <Polygon3D
                    path={[...draftVertices, draftVertices[0]].map((pt) => ({
                      lat: pt.lat,
                      lng: pt.lng,
                      altitude: 2,
                    }))}
                    altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                    fillColor={draftCatMeta.fillRgba3d}
                    strokeColor={draftCatMeta.strokeRgba3d}
                    strokeWidth={3}
                    drawsOccludedSegments
                  />
                )}
              </Map3D>
            ) : (
              <GoogleMap
                id="flightdossier-2d-map"
                mapId="DEMO_MAP_ID"
                mapTypeId={showHybridLabels ? 'hybrid' : 'satellite'}
                defaultCenter={siteCenter}
                defaultZoom={17}
                gestureHandling="greedy"
                disableDoubleClickZoom={drawTool === 'line' || drawTool === 'polygon'}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                onClick={handle2DMapClick}
                onDblclick={handle2DMapDoubleClick}
                style={{ width: '100%', height: '100%' }}
              >
                <Map2DPanController panTarget={pan2DTarget} />

                {/* Saved 2D Elements */}
                {elements.map((el) => {
                  const cat = MAP_CATEGORIES[el.category];
                  const isSelected = el.id === selectedId;

                  if (el.geometry === 'point' && el.coordinates[0]) {
                    return (
                      <AdvancedMarker
                        key={el.id}
                        position={el.coordinates[0]}
                        draggable={drawTool === 'select'}
                        title={el.label}
                        onClick={() => setSelectedId(el.id)}
                        onDragEnd={(ev) => {
                          if (!ev.latLng) return;
                          updateElement(el.id, {
                            coordinates: [{ lat: ev.latLng.lat(), lng: ev.latLng.lng() }],
                          });
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <Pin
                            background={cat.strokeHex}
                            borderColor={isSelected ? '#ffffff' : cat.pinBorder}
                            glyphColor="#ffffff"
                            glyphText={cat.glyph}
                            scale={isSelected ? 1.15 : 0.95}
                          />
                          <div className="mt-0.5 px-1.5 py-0.5 bg-slate-950/85 text-white text-[10px] font-medium rounded-xs border border-white/25 whitespace-nowrap max-w-[160px] truncate shadow-sm">
                            {el.label}
                          </div>
                        </div>
                      </AdvancedMarker>
                    );
                  }

                  if (el.geometry === 'line' && el.coordinates.length >= 2) {
                    const mid = getElementAnchorPoint(el.coordinates);
                    return (
                      <React.Fragment key={el.id}>
                        <Polyline
                          path={el.coordinates}
                          strokeColor={cat.strokeHex}
                          strokeOpacity={0.95}
                          strokeWeight={isSelected ? 5 : 3.5}
                          onClick={() => setSelectedId(el.id)}
                        />
                        <AdvancedMarker
                          position={mid}
                          title={el.label}
                          onClick={() => setSelectedId(el.id)}
                        >
                          <div
                            className="px-1.5 py-0.5 bg-slate-950/85 text-white text-[10px] font-medium rounded-xs border whitespace-nowrap max-w-[160px] truncate shadow-sm"
                            style={{ borderColor: cat.strokeHex }}
                          >
                            {el.label}
                          </div>
                        </AdvancedMarker>
                      </React.Fragment>
                    );
                  }

                  if (el.geometry === 'polygon' && el.coordinates.length >= 3) {
                    const centroid = getElementAnchorPoint(el.coordinates);
                    return (
                      <React.Fragment key={el.id}>
                        <Polygon
                          paths={el.coordinates}
                          strokeColor={cat.strokeHex}
                          strokeOpacity={0.95}
                          strokeWeight={isSelected ? 3.5 : 2}
                          fillColor={cat.fillHex}
                          fillOpacity={isSelected ? 0.34 : 0.22}
                          onClick={() => setSelectedId(el.id)}
                        />
                        <AdvancedMarker
                          position={centroid}
                          title={el.label}
                          onClick={() => setSelectedId(el.id)}
                        >
                          <div
                            className="px-1.5 py-0.5 bg-slate-950/85 text-white text-[10px] font-medium rounded-xs border whitespace-nowrap max-w-[160px] truncate shadow-sm"
                            style={{ borderColor: cat.strokeHex }}
                          >
                            {el.label}
                          </div>
                        </AdvancedMarker>
                      </React.Fragment>
                    );
                  }

                  return null;
                })}

                {/* In-Progress Draft Vertices / Line / Polygon in 2D */}
                {draftVertices.map((pt, idx) => (
                  <AdvancedMarker key={`draft-2d-${idx}`} position={pt}>
                    <div
                      className="w-5 h-5 rounded-full bg-white text-[10px] font-mono font-semibold flex items-center justify-center border-2 shadow-sm"
                      style={{ borderColor: draftCatMeta.strokeHex, color: draftCatMeta.strokeHex }}
                    >
                      {idx + 1}
                    </div>
                  </AdvancedMarker>
                ))}

                {draftVertices.length >= 2 && drawTool === 'line' && (
                  <Polyline
                    path={draftVertices}
                    strokeColor={draftCatMeta.strokeHex}
                    strokeOpacity={0.9}
                    strokeWeight={3}
                  />
                )}

                {draftVertices.length >= 2 && drawTool === 'polygon' && (
                  <Polygon
                    paths={draftVertices}
                    strokeColor={draftCatMeta.strokeHex}
                    strokeOpacity={0.9}
                    strokeWeight={2.5}
                    fillColor={draftCatMeta.fillHex}
                    fillOpacity={0.22}
                  />
                )}

                {/* InfoWindow for Selected Element in 2D Mode */}
                {selectedElement && selectedElement.coordinates.length > 0 && (
                  <InfoWindow
                    position={getElementAnchorPoint(selectedElement.coordinates)}
                    onCloseClick={() => setSelectedId(null)}
                  >
                    <div className="p-1 max-w-[220px] space-y-1 text-slate-900">
                      <div className="text-[11px] font-mono text-slate-500">
                        {MAP_CATEGORIES[selectedElement.category].label} ·{' '}
                        {selectedElement.geometry}
                      </div>
                      <div className="text-xs font-semibold">{selectedElement.label}</div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-600">
                        {formatElementMetrics(selectedElement)}
                      </div>
                      {selectedElement.notes && (
                        <p className="text-[11px] text-slate-600 leading-snug">
                          {selectedElement.notes}
                        </p>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}
          </div>

          {/* Map Footer Caption & Attribution Guidance */}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              {viewMode === '3d'
                ? 'Drag to pan · Right-drag or Ctrl+drag to tilt & orbit · Scroll to zoom'
                : 'Drag point markers in Inspect mode to fine-tune GPS coordinates'}
            </span>
            <span>
              Pre-flight site assessment &amp; submittal illustration only — not for real-time aircraft navigation.
            </span>
          </div>
        </div>

        {/* Right Operational Elements Inspector & Label Editor */}
        <aside className="xl:col-span-4 bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
          <div className="px-4 py-3.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Plotted Operational Elements
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                {elements.length} total · {countsByCategory.landing_zone} LZ ·{' '}
                {countsByCategory.personnel} Crew · {countsByCategory.risk} Risk
              </p>
            </div>
            {countsByCategory.landing_zone > 0 && (
              <button
                type="button"
                onClick={handleSyncLzsToSite}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Sync LZs
              </button>
            )}
          </div>

          {syncNotice && (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-medium">
              {syncNotice}
            </div>
          )}

          {/* Filter Dropdown */}
          <div className="px-4 py-2.5 bg-slate-50/50 flex items-center justify-between gap-2">
            <label htmlFor="map-el-filter" className="text-xs font-medium text-slate-600">
              Filter Layer
            </label>
            <select
              id="map-el-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'all' | MapElementCategory)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="all">All Categories ({elements.length})</option>
              {MAP_CATEGORY_LIST.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} ({countsByCategory[cat.id]})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Element Inline Editor */}
          {selectedElement && (
            <div className="p-4 bg-blue-50/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  Edit Selected Element
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Done
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedElement.label}
                  onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Category
                  </label>
                  <select
                    value={selectedElement.category}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        category: e.target.value as MapElementCategory,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    {MAP_CATEGORY_LIST.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    3D Height / AGL (ft)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={selectedElement.altitudeAglFt ?? 0}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        altitudeAglFt: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Operational Notes
                </label>
                <textarea
                  rows={2}
                  value={selectedElement.notes}
                  onChange={(e) => updateElement(selectedElement.id, { notes: e.target.value })}
                  placeholder="Clearance instructions, sightline notes, hazard details..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  {formatElementMetrics(selectedElement)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteElement(selectedElement.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Scrollable List of Operational Elements */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-200">
            {filteredElements.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  No operational elements plotted yet.
                </p>
                <p className="text-xs text-slate-500">
                  Select a tool above (Point, Line, or Polygon) and click on the Google Earth map to mark Landing Zones, Personnel, Risks, or POIs.
                </p>
              </div>
            ) : (
              filteredElements.map((el) => {
                const cat = MAP_CATEGORIES[el.category];
                const isSelected = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onClick={() => {
                      setSelectedId(el.id);
                      focusOnPoint(getElementAnchorPoint(el.coordinates));
                    }}
                    className={`px-4 py-3 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: cat.strokeHex }}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {el.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        <span className={cat.textClass}>{cat.shortLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{el.geometry}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatElementMetrics(el)}
                        </span>
                        {el.altitudeAglFt ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{el.altitudeAglFt} ft AGL</span>
                          </>
                        ) : null}
                      </div>
                      {el.notes && (
                        <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                          {el.notes}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteElement(el.id);
                      }}
                      aria-label={`Delete ${el.label}`}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
