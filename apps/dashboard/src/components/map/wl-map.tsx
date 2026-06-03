"use client";

/**
 * WLMap — keyless tile-based map using CARTO free dark basemaps.
 * No API key required. Supports markers, circle overlays, and auto-fit.
 * Tile source: CARTO Dark Matter (free, CORS-enabled, CC-BY 4.0).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";

// ── Tile math ──────────────────────────────────────────────────────────

function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
}

function tile2lon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tile2lat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Convert lat/lng to pixel position in the canvas. */
function latlngToPixel(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  const scale = Math.pow(2, zoom) * 256;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const sinCenterLat = Math.sin((centerLat * Math.PI) / 180);
  const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  const worldCenterY = (0.5 - Math.log((1 + sinCenterLat) / (1 - sinCenterLat)) / (4 * Math.PI)) * scale;
  const worldX = ((lng + 180) / 360) * scale;
  const worldCenterX = ((centerLng + 180) / 360) * scale;
  return {
    x: canvasW / 2 + (worldX - worldCenterX),
    y: canvasH / 2 + (worldY - worldCenterY),
  };
}

// ── Types ──────────────────────────────────────────────────────────────

export interface WLMarker {
  lat: number;
  lng: number;
  color?: string;
  radius?: number;
  label?: string;
  /** relative size 0-1 for bubble charts */
  weight?: number;
  tooltip?: string;
}

export interface WLPolygon {
  points: Array<{ lat: number; lng: number }>;
  fillColor?: string;
  strokeColor?: string;
  opacity?: number;
}

export interface WLMapProps {
  markers?: WLMarker[];
  polygons?: WLPolygon[];
  className?: string;
  height?: number | string;
  initialZoom?: number;
  initialCenter?: { lat: number; lng: number };
  /** auto-fit bounds to markers/polygons */
  fitBounds?: boolean;
  showControls?: boolean;
  showAttribution?: boolean;
}

// CARTO Dark Matter free tile URL
const TILE_URL = (z: number, x: number, y: number) =>
  `https://a.basemaps.cartocdn.com/dark_matter/${z}/${x}/${y}.png`;

const TILE_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

// ── Component ──────────────────────────────────────────────────────────

export function WLMap({
  markers = [],
  polygons = [],
  className,
  height = 400,
  initialZoom = 10,
  initialCenter = { lat: 40.7128, lng: -74.006 },
  fitBounds = true,
  showControls = true,
  showAttribution = true,
}: WLMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState(initialCenter);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Auto-fit to markers/polygons
  const autoFit = useCallback(() => {
    const allPoints: Array<{ lat: number; lng: number }> = [
      ...markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...polygons.flatMap((p) => p.points),
    ];
    if (allPoints.length === 0) return;

    const lats = allPoints.map((p) => p.lat);
    const lngs = allPoints.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const newCenter = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
    setCenter(newCenter);

    if (allPoints.length === 1) {
      setZoom(12);
      return;
    }

    const canvas = canvasRef.current;
    const w = canvas?.width ?? 600;
    const h = canvas?.height ?? 400;
    let z = 15;
    while (z > MIN_ZOOM) {
      const p1 = latlngToPixel(minLat, minLng, newCenter.lat, newCenter.lng, z, w, h);
      const p2 = latlngToPixel(maxLat, maxLng, newCenter.lat, newCenter.lng, z, w, h);
      if (Math.abs(p2.x - p1.x) < w * 0.8 && Math.abs(p2.y - p1.y) < h * 0.8) break;
      z--;
    }
    setZoom(Math.min(z, 14));
  }, [markers, polygons]);

  useEffect(() => {
    if (fitBounds && (markers.length > 0 || polygons.length > 0)) {
      autoFit();
    }
  }, [fitBounds, autoFit, markers.length, polygons.length]);

  // Load a tile and cache it
  const loadTile = useCallback((z: number, x: number, y: number): HTMLImageElement | null => {
    const key = `${z}/${x}/${y}`;
    if (tileCache.current.has(key)) return tileCache.current.get(key)!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = TILE_URL(z, x, y);
    img.onload = () => {
      tileCache.current.set(key, img);
      drawMap();
    };
    img.onerror = () => {};
    return null;
  }, []);

  // Main draw function
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    // Tile rendering
    const tileX = lon2tile(center.lng, zoom);
    const tileY = lat2tile(center.lat, zoom);
    const tileCenterLon = tile2lon(tileX, zoom);
    const tileCenterLat = tile2lat(tileY, zoom);
    const tileCenterPx = latlngToPixel(tileCenterLat, tileCenterLon, center.lat, center.lng, zoom, w, h);
    const offsetX = tileCenterPx.x - TILE_SIZE / 2;
    const offsetY = tileCenterPx.y - TILE_SIZE / 2;

    const tilesX = Math.ceil(w / TILE_SIZE) + 2;
    const tilesY = Math.ceil(h / TILE_SIZE) + 2;

    for (let dx = -Math.floor(tilesX / 2) - 1; dx <= Math.ceil(tilesX / 2); dx++) {
      for (let dy = -Math.floor(tilesY / 2) - 1; dy <= Math.ceil(tilesY / 2); dy++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const maxTile = Math.pow(2, zoom);
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
        const img = loadTile(zoom, wrappedTx, ty);
        const px = offsetX + dx * TILE_SIZE;
        const py = offsetY + dy * TILE_SIZE;
        if (img) {
          ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.fillStyle = "#1e1e2e";
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Draw polygons
    for (const poly of polygons) {
      if (poly.points.length < 3) continue;
      ctx.beginPath();
      const first = latlngToPixel(poly.points[0].lat, poly.points[0].lng, center.lat, center.lng, zoom, w, h);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < poly.points.length; i++) {
        const p = latlngToPixel(poly.points[i].lat, poly.points[i].lng, center.lat, center.lng, zoom, w, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = poly.fillColor ?? "rgba(99,102,241,0.25)";
      ctx.fill();
      ctx.strokeStyle = poly.strokeColor ?? "rgba(99,102,241,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw markers
    const maxWeight = markers.length > 0 ? Math.max(...markers.map((m) => m.weight ?? 1)) : 1;
    for (const m of markers) {
      const { x, y } = latlngToPixel(m.lat, m.lng, center.lat, center.lng, zoom, w, h);
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;
      const baseR = m.radius ?? 8;
      const r = m.weight != null ? baseR + (m.weight / maxWeight) * 16 : baseR;
      // Glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      grd.addColorStop(0, (m.color ?? "#6366f1") + "60");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r * 2, 0, Math.PI * 2);
      ctx.fill();
      // Dot
      ctx.fillStyle = m.color ?? "#6366f1";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      if (m.label && zoom >= 8) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(m.label, x, y + r + 14);
      }
    }
  }, [center, zoom, markers, polygons, loadTile]);

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio ?? 1);
      canvas.height = rect.height * (window.devicePixelRatio ?? 1);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      drawMap();
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [drawMap]);

  useEffect(() => {
    cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(drawMap);
  }, [drawMap]);

  // Mouse interaction
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        const scale = Math.pow(2, zoom) * 256;
        const dlng = -(dx / scale) * 360;
        const dlat = (dy / scale) * 360;
        setCenter((c) => ({
          lat: Math.max(-85, Math.min(85, c.lat + dlat)),
          lng: c.lng + dlng,
        }));
      } else {
        // Tooltip hit-test
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        for (const m of markers) {
          if (!m.tooltip) continue;
          const { x, y } = latlngToPixel(m.lat, m.lng, center.lat, center.lng, zoom, canvas.width, canvas.height);
          const r = (m.radius ?? 8) + (m.weight != null ? (m.weight / Math.max(...markers.map((mm) => mm.weight ?? 1))) * 16 : 0);
          if (Math.hypot(mx - x, my - y) < r + 4) {
            setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: m.tooltip });
            return;
          }
        }
        setTooltip(null);
      }
    },
    [center, zoom, markers]
  );

  const onMouseUp = () => { isDragging.current = false; };

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + (e.deltaY < 0 ? 1 : -1))));
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#0d0d14] select-none",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
        className
      )}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[#1e1e2e]/95 border border-white/10 text-white/80 text-xs px-2 py-1 rounded-md shadow-lg backdrop-blur-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            className="w-8 h-8 bg-[#1e1e2e]/90 border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-[#1e1e2e] transition-colors"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="w-8 h-8 bg-[#1e1e2e]/90 border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-[#1e1e2e] transition-colors"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            className="w-8 h-8 bg-[#1e1e2e]/90 border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-[#1e1e2e] transition-colors"
            onClick={() => setIsFullscreen((f) => !f)}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Attribution */}
      {showAttribution && (
        <div className="absolute bottom-2 left-2 text-[10px] text-white/25">
          © CARTO · © OpenStreetMap contributors
        </div>
      )}
    </div>
  );
}
