'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass } from 'lucide-react';
import {
  LGUProject,
  ProjectStatus,
  hasValidCoordinates,
} from '@/types/project';
import { ILIGAN_CITY_CENTER, formatPHP } from '@/data/sampleProjects';
import { lguStatusTone } from '@/lib/statusPalette';

interface IliganProjectMapProps {
  projects: LGUProject[];
  selectedProject: LGUProject | null;
  onSelectMarker: (project: LGUProject) => void;
  onInspectFullDetails: (project: LGUProject) => void;
}

/** Legend order and labels; colors come from the shared status palette. */
const LEGEND: { status: ProjectStatus; label: string }[] = [
  { status: 'Completed', label: 'Completed' },
  { status: 'In Progress', label: 'Ongoing (In Progress)' },
  { status: 'Procurement', label: 'Procurement' },
  { status: 'Planned', label: 'Planned' },
  { status: 'Delayed', label: 'Delayed' },
];

/** Marker fill, selection ring, and label for an LGU project status. */
export function getMarkerStyleForStatus(status: ProjectStatus): {
  color: string;
  ringColor: string;
  label: string;
} {
  const entry = LEGEND.find((l) => l.status === status) ?? LEGEND[3];
  const color = lguStatusTone(entry.status).fill;
  return { color, ringColor: `${color}40`, label: entry.label };
}

function createStatusDivIcon(status: ProjectStatus, isSelected: boolean): L.DivIcon {
  const { color } = getMarkerStyleForStatus(status);
  const size = isSelected ? 38 : 32;

  const svgHtml = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.28));
      transform: ${isSelected ? 'scale(1.08)' : 'scale(1)'};
      transition: transform 150ms ease;
    ">
      <svg viewBox="0 0 32 38" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 1C8.268 1 2 7.268 2 15C2 24.25 16 36.5 16 36.5C16 36.5 30 24.25 30 15C30 7.268 23.732 1 16 1Z" fill="${color}" stroke="#FFFFFF" stroke-width="${isSelected ? '3' : '2.2'}"/>
        <circle cx="16" cy="14.5" r="5.5" fill="#FFFFFF"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'lgu-tracker-custom-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
    popupAnchor: [0, -(size - 6)],
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function IliganProjectMap({
  projects,
  selectedProject,
  onSelectMarker,
  onInspectFullDetails,
}: IliganProjectMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  const mappedProjects = projects.filter(hasValidCoordinates);

  // Initialize Leaflet Map centered on Iligan City
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) {
      return;
    }

    const map = L.map(container, {
      center: ILIGAN_CITY_CENTER,
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersGroup;

    // Handle container resizing cleanly
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      markerMapRef.current.clear();
    };
  }, []);

  // Synchronize markers whenever filtered projects or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) {
      return;
    }

    markersGroup.clearLayers();
    markerMapRef.current.clear();

    mappedProjects.forEach((project) => {
      const isSelected = selectedProject?.id === project.id;
      const icon = createStatusDivIcon(project.status, isSelected);
      const { color, label } = getMarkerStyleForStatus(project.status);

      const marker = L.marker([project.latitude, project.longitude], {
        icon,
        title: `${project.title} (${project.barangay})`,
        alt: `${project.title} - ${label}`,
      });

      const popupContainer = document.createElement('div');
      popupContainer.className = 'min-w-[240px] max-w-[280px] font-sans text-ink';
      popupContainer.innerHTML = `
        <div style="padding: 2px 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-family: monospace; font-size: 11px; font-weight: 600; color: #172B4D;">
              ${escapeHtml(project.referenceCode)}
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: ${color};">
              <span style="width: 7px; height: 7px; border-radius: 9999px; background-color: ${color}; display: inline-block;"></span>
              ${escapeHtml(project.status)}
            </span>
          </div>
          <div style="font-weight: 700; font-size: 13.5px; line-height: 1.35; color: #0F172A; margin-bottom: 4px;">
            ${escapeHtml(project.title)}
          </div>
          <div style="font-size: 12px; color: #64748B; margin-bottom: 10px;">
            ${escapeHtml(project.barangay)} · Iligan City
          </div>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px; margin-bottom: 8px;">
            <div>
              <span style="display: block; color: #64748B; font-size: 10.5px;">Allocated Budget</span>
              <strong style="font-family: monospace; color: #0F172A;">${escapeHtml(formatPHP(project.allocatedBudget))}</strong>
            </div>
            <div>
              <span style="display: block; color: #64748B; font-size: 10.5px;">Completion</span>
              <strong style="font-family: monospace; color: #0F172A;">${project.progressPercentage}%</strong>
            </div>
            <div>
              <span style="display: block; color: #64748B; font-size: 10.5px;">Start Date</span>
              <span style="font-family: monospace; color: #0F172A;">${escapeHtml(project.startDate)}</span>
            </div>
            <div>
              <span style="display: block; color: #64748B; font-size: 10.5px;">Target Completion</span>
              <span style="font-family: monospace; color: #0F172A;">${escapeHtml(project.targetCompletionDate)}</span>
            </div>
          </div>
          <button
            type="button"
            data-inspect-project="${escapeHtml(project.id)}"
            style="
              width: 100%;
              padding: 7px 12px;
              background-color: #172B4D;
              color: #FFFFFF;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              border: none;
              text-align: center;
            "
          >
            View Full Project Details
          </button>
        </div>
      `;

      const inspectBtn = popupContainer.querySelector(
        `[data-inspect-project="${project.id}"]`
      );
      if (inspectBtn) {
        inspectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onInspectFullDetails(project);
        });
      }

      marker.bindPopup(popupContainer, {
        maxWidth: 300,
        closeButton: true,
      });

      marker.on('click', () => {
        onSelectMarker(project);
      });

      marker.addTo(markersGroup);
      markerMapRef.current.set(project.id, marker);
    });
  }, [mappedProjects, selectedProject, onSelectMarker, onInspectFullDetails]);

  // Pan to selected project when chosen from the side list or marker click
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedProject || !hasValidCoordinates(selectedProject)) {
      return;
    }

    const marker = markerMapRef.current.get(selectedProject.id);
    map.flyTo([selectedProject.latitude, selectedProject.longitude], Math.max(map.getZoom(), 14), {
      duration: 0.45,
    });
    if (marker && !marker.isPopupOpen()) {
      marker.openPopup();
    }
  }, [selectedProject]);

  const handleResetMapView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mappedProjects.length > 0) {
      const bounds = L.latLngBounds(
        mappedProjects.map((p) => [p.latitude, p.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
    } else {
      map.setView(ILIGAN_CITY_CENTER, 13);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[420px] sm:min-h-[540px] rounded-card overflow-hidden border border-line bg-sunken">
      {/* Leaflet Canvas */}
      <div
        ref={mapContainerRef}
        aria-label="Interactive Map of Government Projects in Iligan City"
        className="w-full h-full min-h-[420px] sm:min-h-[540px] z-0"
      />

      {/* Top-Right Reset Iligan City View Button */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        <button
          type="button"
          onClick={handleResetMapView}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-white/95 hover:bg-white border border-line rounded-lg shadow-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          <Compass className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
          <span>Reset Iligan City View</span>
        </button>
      </div>

      {/* Bottom-Left Status Marker Legend */}
      <div
        aria-label="Map Marker Status Legend"
        className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-line rounded-lg px-3.5 py-2.5 shadow-sm max-w-[calc(100%-24px)]"
      >
        <p className="text-[11px] font-semibold text-ink mb-1.5">
          Project Status Markers
        </p>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-ink">
          {LEGEND.map(({ status, label }) => (
            <span key={status} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: lguStatusTone(status).fill }}
                aria-hidden="true"
              />
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
