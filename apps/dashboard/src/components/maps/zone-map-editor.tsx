"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  type ZoneMapEditorProps,
  type MapZone,
  type ColorPreset,
  type ZoneOverlapResult,
} from "./types";
import { useGoogleMaps } from "./google-maps-provider";

// Color presets
const COLOR_PRESETS: ColorPreset[] = [
  { name: "Red", value: "#dc2626", hex: "#dc2626" },
  { name: "Blue", value: "#2563eb", hex: "#2563eb" },
  { name: "Green", value: "#16a34a", hex: "#16a34a" },
  { name: "Yellow", value: "#eab308", hex: "#eab308" },
  { name: "Purple", value: "#9333ea", hex: "#9333ea" },
  { name: "Pink", value: "#ec4899", hex: "#ec4899" },
  { name: "Orange", value: "#ea580c", hex: "#ea580c" },
  { name: "Teal", value: "#0d9488", hex: "#0d9488" },
  { name: "Indigo", value: "#4f46e5", hex: "#4f46e5" },
  { name: "Cyan", value: "#06b6d4", hex: "#06b6d4" },
  { name: "Lime", value: "#84cc16", hex: "#84cc16" },
  { name: "Slate", value: "#64748b", hex: "#64748b" },
];

/**
 * Zone Map Editor Component
 * Allows drawing, editing, and managing delivery zones on a Google Map
 */
export function ZoneMapEditor({
  zones,
  onZonesChange,
  onZoneSelect,
  defaultCenter = { lat: 37.7749, lng: -122.4194 },
  defaultZoom = 12,
  className,
  readOnly = false,
}: ZoneMapEditorProps) {
  const { isLoaded, google } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [drawingManager, setDrawingManager] = useState<any | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(
    COLOR_PRESETS[0].value,
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneOverlaps, setZoneOverlaps] = useState<ZoneOverlapResult[]>([]);
  const [undoStack, setUndoStack] = useState<MapZone[][]>([]);
  const [redoStack, setRedoStack] = useState<MapZone[][]>([]);
  const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !google?.maps) {
      return;
    }

    const map = new google.maps.Map(mapRef.current, {
      zoom: defaultZoom,
      center: defaultCenter,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      ],
    });

    mapInstanceRef.current = map;

    // Initialize drawing manager
    if (!readOnly && google.maps.drawing) {
      const manager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: true,
        drawingControlOptions: {
          position: google.maps.ControlPosition.TOP_CENTER,
          drawingModes: ["polygon", "rectangle"],
        },
        polygonOptions: {
          fillColor: selectedColor,
          strokeColor: selectedColor,
          fillOpacity: 0.35,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          clickable: true,
          editable: true,
          draggable: true,
        },
        rectangleOptions: {
          fillColor: selectedColor,
          strokeColor: selectedColor,
          fillOpacity: 0.35,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          clickable: true,
          editable: true,
          draggable: true,
        },
      });

      manager.setMap(map);
      setDrawingManager(manager);

      // Handle shape completion
      google.maps.event.addListener(
        manager,
        "polygoncomplete",
        (arg?: unknown) => {
          handlePolygonComplete(arg as google.maps.Polygon);
        },
      );

      google.maps.event.addListener(
        manager,
        "rectanglecomplete",
        (arg?: unknown) => {
          handleRectangleComplete(arg as google.maps.Rectangle);
        },
      );
    }

    // Draw existing zones
    zones.forEach((zone) => drawZone(map, zone));

    return () => {
      // Cleanup
      if (drawingManager) {
        drawingManager.setMap(null);
      }
    };
  }, [isLoaded, google, defaultCenter, defaultZoom, readOnly]);

  // Draw a zone on the map
  const drawZone = useCallback(
    (map: google.maps.Map, zone: MapZone) => {
      if (polygonsRef.current.has(zone.id)) {
        return; // Already drawn
      }
      if (!google) return;

      const polygon = new google.maps.Polygon({
        paths: zone.vertices,
        fillColor: zone.color,
        strokeColor: zone.color,
        fillOpacity: 0.35,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        clickable: true,
        editable: !readOnly,
        draggable: !readOnly,
        map,
      });

      polygon.addListener("click", () => {
        setSelectedZoneId(zone.id);
        onZoneSelect?.(zone.id);
      });

      polygonsRef.current.set(zone.id, polygon);
    },
    [readOnly, onZoneSelect],
  );

  // Handle polygon drawing completion
  const handlePolygonComplete = (polygon: google.maps.Polygon) => {
    const paths = polygon.getPaths();
    const vertices: Array<{ lat: number; lng: number }> = [];

    paths.forEach((path) => {
      path.forEach((latLng) => {
        vertices.push({
          lat: latLng.lat(),
          lng: latLng.lng(),
        });
      });
    });

    const newZone: MapZone = {
      id: `zone-${Date.now()}`,
      name: `Zone ${zones.length + 1}`,
      color: selectedColor,
      vertices,
      rate: 0,
      metadata: {},
    };

    addZone(newZone);
    polygon.setMap(null);
  };

  // Handle rectangle drawing completion
  const handleRectangleComplete = (rectangle: google.maps.Rectangle) => {
    const bounds = rectangle.getBounds();
    const ne = bounds?.getNorthEast();
    const sw = bounds?.getSouthWest();

    if (!ne || !sw) return;

    const vertices: Array<{ lat: number; lng: number }> = [
      { lat: ne.lat(), lng: sw.lng() },
      { lat: ne.lat(), lng: ne.lng() },
      { lat: sw.lat(), lng: ne.lng() },
      { lat: sw.lat(), lng: sw.lng() },
    ];

    const newZone: MapZone = {
      id: `zone-${Date.now()}`,
      name: `Zone ${zones.length + 1}`,
      color: selectedColor,
      vertices,
      rate: 0,
      metadata: {},
    };

    addZone(newZone);
    rectangle.setMap(null);
  };

  // Add a new zone
  const addZone = (zone: MapZone) => {
    const newZones = [...zones, zone];
    setUndoStack([...undoStack, zones]);
    setRedoStack([]);
    onZonesChange(newZones);

    if (mapInstanceRef.current && google?.maps) {
      drawZone(mapInstanceRef.current, zone);
    }
  };

  // Update zone
  const updateZone = (zoneId: string, updates: Partial<MapZone>) => {
    const newZones = zones.map((z) =>
      z.id === zoneId ? { ...z, ...updates } : z,
    );
    setUndoStack([...undoStack, zones]);
    setRedoStack([]);
    onZonesChange(newZones);

    // Redraw zone
    const polygon = polygonsRef.current.get(zoneId);
    if (polygon && mapInstanceRef.current && google?.maps) {
      polygon.setMap(null);
      polygonsRef.current.delete(zoneId);
      const updatedZone = newZones.find((z) => z.id === zoneId);
      if (updatedZone) {
        drawZone(mapInstanceRef.current, updatedZone);
      }
    }
  };

  // Delete zone
  const deleteZone = (zoneId: string) => {
    const newZones = zones.filter((z) => z.id !== zoneId);
    setUndoStack([...undoStack, zones]);
    setRedoStack([]);
    onZonesChange(newZones);

    const polygon = polygonsRef.current.get(zoneId);
    if (polygon) {
      polygon.setMap(null);
      polygonsRef.current.delete(zoneId);
    }

    setSelectedZoneId(null);
  };

  // Detect zone overlaps
  const detectOverlaps = () => {
    const overlaps: ZoneOverlapResult[] = [];

    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        if (zonesOverlap(zones[i], zones[j])) {
          overlaps.push({
            zone1Id: zones[i].id,
            zone2Id: zones[j].id,
          });
        }
      }
    }

    setZoneOverlaps(overlaps);
  };

  // Check if two zones overlap
  const zonesOverlap = (zone1: MapZone, zone2: MapZone): boolean => {
    if (!google?.maps) return false;
    const gmaps = google.maps;
    if (!("geometry" in gmaps)) return false;

    const poly1 = new gmaps.Polygon({ paths: zone1.vertices });
    const poly2 = new gmaps.Polygon({ paths: zone2.vertices });

    // Simple check: see if any vertex of zone1 is inside zone2
    for (const vertex of zone1.vertices) {
      const point = new gmaps.LatLng(vertex.lat, vertex.lng);
      if (gmaps.geometry.poly.containsLocation(point, poly2)) {
        return true;
      }
    }

    // Check if any vertex of zone2 is inside zone1
    for (const vertex of zone2.vertices) {
      const point = new gmaps.LatLng(vertex.lat, vertex.lng);
      if (gmaps.geometry.poly.containsLocation(point, poly1)) {
        return true;
      }
    }

    return false;
  };

  // Import zones from GeoJSON
  const importGeometries = (geojson: string) => {
    try {
      const data = JSON.parse(geojson);
      const newZones: MapZone[] = [];

      if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        data.features.forEach((feature: any, index: number) => {
          const coordinates = feature.geometry?.coordinates?.[0] || [];
          const vertices = coordinates.map((coord: [number, number]) => ({
            lat: coord[1],
            lng: coord[0],
          }));

          newZones.push({
            id: `zone-${Date.now()}-${index}`,
            name:
              feature.properties?.name || `Zone ${zones.length + index + 1}`,
            color:
              feature.properties?.color ||
              COLOR_PRESETS[index % COLOR_PRESETS.length].value,
            vertices,
            rate: feature.properties?.rate,
            metadata: feature.properties,
          });
        });
      }

      const allZones = [...zones, ...newZones];
      setUndoStack([...undoStack, zones]);
      setRedoStack([]);
      onZonesChange(allZones);

      newZones.forEach((zone) => {
        if (mapInstanceRef.current) {
          drawZone(mapInstanceRef.current, zone);
        }
      });
    } catch (error) {
      console.error("Error importing GeoJSON:", error);
    }
  };

  // Export zones as GeoJSON
  const exportAsGeoJSON = () => {
    const features = zones.map((zone) => ({
      type: "Feature",
      properties: {
        id: zone.id,
        name: zone.name,
        color: zone.color,
        rate: zone.rate,
        ...zone.metadata,
      },
      geometry: {
        type: "Polygon",
        coordinates: [zone.vertices.map((v) => [v.lng, v.lat])],
      },
    }));

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    return JSON.stringify(geojson, null, 2);
  };

  // Undo/Redo
  const undo = () => {
    if (undoStack.length === 0) return;

    const previousZones = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, zones]);
    setUndoStack(undoStack.slice(0, -1));
    onZonesChange(previousZones);

    // Redraw all zones
    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    polygonsRef.current.clear();

    if (mapInstanceRef.current) {
      previousZones.forEach((zone) => drawZone(mapInstanceRef.current!, zone));
    }
  };

  const redo = () => {
    if (redoStack.length === 0) return;

    const nextZones = redoStack[redoStack.length - 1];
    setUndoStack([...undoStack, zones]);
    setRedoStack(redoStack.slice(0, -1));
    onZonesChange(nextZones);

    // Redraw all zones
    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    polygonsRef.current.clear();

    if (mapInstanceRef.current) {
      nextZones.forEach((zone) => drawZone(mapInstanceRef.current!, zone));
    }
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <div className={cn("flex gap-4 h-screen bg-wl-bg-surface", className)}>
      {/* Map */}
      <div className="flex-1 rounded-lg overflow-hidden shadow-lg">
        <div
          ref={mapRef}
          className="w-full h-full"
          style={{ minHeight: "400px" }}
        />
      </div>

      {/* Sidebar */}
      {!readOnly && (
        <div className="w-80 flex flex-col gap-4 p-4 bg-wl-bg-overlay rounded-lg shadow-lg overflow-y-auto">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
              Zone Editor
            </h3>
            <p className="text-xs text-wl-text-secondary">
              {zones.length} zone{zones.length !== 1 ? "s" : ""} created
            </p>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => detectOverlaps()}
              className="flex-1"
            >
              Check Overlaps
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={undo}
              disabled={undoStack.length === 0}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={redo}
              disabled={redoStack.length === 0}
            >
              Redo
            </Button>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 block">
              Zone Color
            </label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    setSelectedColor(color.value);
                    if (selectedZone) {
                      updateZone(selectedZone.id, { color: color.value });
                    }
                  }}
                  className={cn(
                    "w-full aspect-square rounded-lg border-2 transition-transform",
                    selectedColor === color.value
                      ? "border-wl-primary-500 scale-105"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Zone List */}
          <div className="flex-1 border-t border-wl-border-default pt-4">
            <label className="text-xs font-semibold text-wl-text-secondary uppercase mb-3 block">
              Zones
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {zones.length === 0 ? (
                <p className="text-xs text-wl-text-secondary text-center py-4">
                  No zones yet. Draw one on the map!
                </p>
              ) : (
                zones.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => {
                      setSelectedZoneId(zone.id);
                      onZoneSelect?.(zone.id);
                    }}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all",
                      selectedZoneId === zone.id
                        ? "bg-wl-primary-500/20 border border-wl-primary-500"
                        : "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: zone.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={zone.name}
                          onChange={(e) =>
                            updateZone(zone.id, { name: e.target.value })
                          }
                          className={cn(
                            "w-full bg-transparent text-sm font-medium text-wl-text-primary",
                            "focus:outline-none focus:ring-2 focus:ring-wl-primary-500 rounded px-1",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {zone.rate !== undefined && (
                          <p className="text-xs text-wl-text-secondary mt-1">
                            Rate: ${zone.rate.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteZone(zone.id);
                        }}
                        className="text-wl-danger-500 hover:text-wl-danger-600 p-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Overlap Warnings */}
          {zoneOverlaps.length > 0 && (
            <div className="border border-wl-warning-500/30 rounded-lg p-3 bg-wl-warning-bg">
              <p className="text-xs font-semibold text-wl-warning-400 mb-2">
                Overlapping Zones
              </p>
              <ul className="text-xs text-wl-warning-400 space-y-1">
                {zoneOverlaps.map((overlap) => (
                  <li key={`${overlap.zone1Id}-${overlap.zone2Id}`}>
                    • {zones.find((z) => z.id === overlap.zone1Id)?.name} &
                    {zones.find((z) => z.id === overlap.zone2Id)?.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Export/Import */}
          <div className="flex gap-2 pt-4 border-t border-wl-border-default">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const geojson = exportAsGeoJSON();
                const blob = new Blob([geojson], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "zones.geojson";
                a.click();
              }}
              className="flex-1"
            >
              Export
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".geojson,.json";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      importGeometries(content);
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="flex-1"
            >
              Import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
