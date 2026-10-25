(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/map/IliganProjectMap.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>IliganProjectMap,
    "getMarkerStyleForStatus",
    ()=>getMarkerStyleForStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$compass$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Compass$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/compass.js [app-client] (ecmascript) <export default as Compass>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$project$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/types/project.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$sampleProjects$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/data/sampleProjects.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function getMarkerStyleForStatus(status) {
    switch(status){
        case 'Completed':
            return {
                color: '#16A34A',
                ringColor: 'rgba(22, 163, 74, 0.25)',
                label: 'Completed'
            };
        case 'In Progress':
            return {
                color: '#2563EB',
                ringColor: 'rgba(37, 99, 235, 0.25)',
                label: 'Ongoing (In Progress)'
            };
        case 'Delayed':
            return {
                color: '#DC2626',
                ringColor: 'rgba(220, 38, 38, 0.25)',
                label: 'Delayed'
            };
        case 'Procurement':
            return {
                color: '#F59E0B',
                ringColor: 'rgba(245, 158, 11, 0.25)',
                label: 'Planned (Procurement)'
            };
        case 'Planned':
        default:
            return {
                color: '#F59E0B',
                ringColor: 'rgba(245, 158, 11, 0.25)',
                label: 'Planned'
            };
    }
}
function createStatusDivIcon(status, isSelected) {
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
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].divIcon({
        html: svgHtml,
        className: 'lgu-tracker-custom-pin',
        iconSize: [
            size,
            size
        ],
        iconAnchor: [
            size / 2,
            size - 2
        ],
        popupAnchor: [
            0,
            -(size - 6)
        ]
    });
}
function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function IliganProjectMap({ projects, selectedProject, onSelectMarker, onInspectFullDetails }) {
    _s();
    const mapContainerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const mapInstanceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const markersLayerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const markerMapRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const mappedProjects = projects.filter(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$project$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasValidCoordinates"]);
    // Initialize Leaflet Map centered on Iligan City
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IliganProjectMap.useEffect": ()=>{
            const container = mapContainerRef.current;
            if (!container || mapInstanceRef.current) {
                return;
            }
            const map = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].map(container, {
                center: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$sampleProjects$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ILIGAN_CITY_CENTER"],
                zoom: 13,
                zoomControl: true,
                scrollWheelZoom: true
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            }).addTo(map);
            const markersGroup = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].layerGroup().addTo(map);
            mapInstanceRef.current = map;
            markersLayerRef.current = markersGroup;
            // Handle container resizing cleanly
            const resizeObserver = new ResizeObserver({
                "IliganProjectMap.useEffect": ()=>{
                    map.invalidateSize();
                }
            }["IliganProjectMap.useEffect"]);
            resizeObserver.observe(container);
            return ({
                "IliganProjectMap.useEffect": ()=>{
                    resizeObserver.disconnect();
                    map.remove();
                    mapInstanceRef.current = null;
                    markersLayerRef.current = null;
                    markerMapRef.current.clear();
                }
            })["IliganProjectMap.useEffect"];
        }
    }["IliganProjectMap.useEffect"], []);
    // Synchronize markers whenever filtered projects or selection changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IliganProjectMap.useEffect": ()=>{
            const map = mapInstanceRef.current;
            const markersGroup = markersLayerRef.current;
            if (!map || !markersGroup) {
                return;
            }
            markersGroup.clearLayers();
            markerMapRef.current.clear();
            mappedProjects.forEach({
                "IliganProjectMap.useEffect": (project)=>{
                    const isSelected = selectedProject?.id === project.id;
                    const icon = createStatusDivIcon(project.status, isSelected);
                    const { color, label } = getMarkerStyleForStatus(project.status);
                    const marker = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].marker([
                        project.latitude,
                        project.longitude
                    ], {
                        icon,
                        title: `${project.title} (${project.barangay})`,
                        alt: `${project.title} - ${label}`
                    });
                    const popupContainer = document.createElement('div');
                    popupContainer.className = 'min-w-[240px] max-w-[280px] font-sans text-[#0F172A]';
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
              <strong style="font-family: monospace; color: #0F172A;">${escapeHtml((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$sampleProjects$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatPHP"])(project.allocatedBudget))}</strong>
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
                    const inspectBtn = popupContainer.querySelector(`[data-inspect-project="${project.id}"]`);
                    if (inspectBtn) {
                        inspectBtn.addEventListener('click', {
                            "IliganProjectMap.useEffect": (e)=>{
                                e.stopPropagation();
                                onInspectFullDetails(project);
                            }
                        }["IliganProjectMap.useEffect"]);
                    }
                    marker.bindPopup(popupContainer, {
                        maxWidth: 300,
                        closeButton: true
                    });
                    marker.on('click', {
                        "IliganProjectMap.useEffect": ()=>{
                            onSelectMarker(project);
                        }
                    }["IliganProjectMap.useEffect"]);
                    marker.addTo(markersGroup);
                    markerMapRef.current.set(project.id, marker);
                }
            }["IliganProjectMap.useEffect"]);
        }
    }["IliganProjectMap.useEffect"], [
        mappedProjects,
        selectedProject,
        onSelectMarker,
        onInspectFullDetails
    ]);
    // Pan to selected project when chosen from the side list or marker click
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IliganProjectMap.useEffect": ()=>{
            const map = mapInstanceRef.current;
            if (!map || !selectedProject || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$project$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasValidCoordinates"])(selectedProject)) {
                return;
            }
            const marker = markerMapRef.current.get(selectedProject.id);
            map.flyTo([
                selectedProject.latitude,
                selectedProject.longitude
            ], Math.max(map.getZoom(), 14), {
                duration: 0.45
            });
            if (marker && !marker.isPopupOpen()) {
                marker.openPopup();
            }
        }
    }["IliganProjectMap.useEffect"], [
        selectedProject
    ]);
    const handleResetMapView = ()=>{
        const map = mapInstanceRef.current;
        if (!map) return;
        if (mappedProjects.length > 0) {
            const bounds = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].latLngBounds(mappedProjects.map((p)=>[
                    p.latitude,
                    p.longitude
                ]));
            map.fitBounds(bounds, {
                padding: [
                    44,
                    44
                ],
                maxZoom: 14
            });
        } else {
            map.setView(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$sampleProjects$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ILIGAN_CITY_CENTER"], 13);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative w-full h-full min-h-[420px] sm:min-h-[540px] rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: mapContainerRef,
                "aria-label": "Interactive Map of Government Projects in Iligan City",
                className: "w-full h-full min-h-[420px] sm:min-h-[540px] z-0"
            }, void 0, false, {
                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                lineNumber: 298,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-3 right-3 z-[400] flex items-center gap-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: handleResetMapView,
                    className: "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172B4D] bg-white/95 hover:bg-white border border-[#E2E8F0] rounded-lg shadow-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$compass$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Compass$3e$__["Compass"], {
                            className: "w-3.5 h-3.5 text-[#2563EB]",
                            "aria-hidden": "true"
                        }, void 0, false, {
                            fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                            lineNumber: 311,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "Reset Iligan City View"
                        }, void 0, false, {
                            fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                            lineNumber: 312,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                    lineNumber: 306,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                lineNumber: 305,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-label": "Map Marker Status Legend",
                className: "absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 shadow-sm max-w-[calc(100%-24px)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] font-semibold text-[#172B4D] mb-1.5",
                        children: "Project Status Markers"
                    }, void 0, false, {
                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                        lineNumber: 321,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-[#0F172A]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-flex items-center gap-1.5 whitespace-nowrap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0",
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 326,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Completed"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 330,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                lineNumber: 325,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-flex items-center gap-1.5 whitespace-nowrap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "w-2.5 h-2.5 rounded-full bg-[#2563EB] shrink-0",
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 333,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Ongoing"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 337,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                lineNumber: 332,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-flex items-center gap-1.5 whitespace-nowrap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0",
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 340,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Planned / Procurement"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 344,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                lineNumber: 339,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-flex items-center gap-1.5 whitespace-nowrap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "w-2.5 h-2.5 rounded-full bg-[#DC2626] shrink-0",
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 347,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Delayed"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                        lineNumber: 351,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                                lineNumber: 346,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                        lineNumber: 324,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/map/IliganProjectMap.tsx",
                lineNumber: 317,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/map/IliganProjectMap.tsx",
        lineNumber: 296,
        columnNumber: 5
    }, this);
}
_s(IliganProjectMap, "IHxC/S9TKLRVsABbuC4txcZ84HI=");
_c = IliganProjectMap;
var _c;
__turbopack_context__.k.register(_c, "IliganProjectMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/map/IliganProjectMap.tsx [app-client] (ecmascript, next/dynamic entry)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/map/IliganProjectMap.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_map_IliganProjectMap_tsx_12f9z_fp7w8rh._.js.map