"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { DisasterData } from '@/lib/types';
import type { Map, Marker, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  selectedDisaster: DisasterData | null;
  onDisasterSelect: (disaster: DisasterData) => void;
  onOpenDetailOverlay?: (disaster: DisasterData) => void;
  disasters?: DisasterData[];
  isDetailOverlayOpen?: boolean;
  mapCenter?: { lat: number; lng: number } | null;
  shouldOpenMarker?: boolean;
  onMarkerOpened?: () => void;
}

export default function MapComponent({ 
  selectedDisaster, 
  onDisasterSelect, 
  onOpenDetailOverlay, 
  disasters = [], 
  isDetailOverlayOpen = false,
  mapCenter = null,
  shouldOpenMarker = false,
  onMarkerOpened
}: MapComponentProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Refs for map instances with proper Leaflet types
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenMapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const fullscreenMapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const fullscreenMarkersRef = useRef<Marker[]>([]);

  // Lock body scroll
  useEffect(() => {
    if (isFullscreen || selectedPhotoUrl || isDetailOverlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen, selectedPhotoUrl, isDetailOverlayOpen]);

  // Mount check
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Open marker popup when navigating from URL (from "Lihat di Peta" button)
  useEffect(() => {
    if (shouldOpenMarker && selectedDisaster && mapInstanceRef.current && markersRef.current.length > 0) {
      // Find the marker for the selected disaster
      const markerIndex = disasters.findIndex(d => d.id === selectedDisaster.id);
      
      if (markerIndex !== -1 && markersRef.current[markerIndex]) {
        const marker = markersRef.current[markerIndex];
        // Open the popup for this marker
        marker.openPopup();
        
        // Notify parent that marker has been opened
        if (onMarkerOpened) {
          onMarkerOpened();
        }
      }
    }
  }, [shouldOpenMarker, selectedDisaster, disasters, onMarkerOpened]);

  // Create custom icon
  const createCustomIcon = useCallback((L: typeof import('leaflet'), tingkatKerusakan: string): DivIcon => {
    const color = tingkatKerusakan === 'Berat' ? '#dc2626' : tingkatKerusakan === 'Sedang' ? '#f59e0b' : '#10b981';
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background: ${color};
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 3px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="M12 17h.01"/>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -19]
    });
  }, []);

  // Create popup content
  const createPopupContent = useCallback((disaster: DisasterData) => {
    const badgeClass = disaster.tingkatKerusakan === 'Berat' 
      ? 'background: #fef2f2; color: #b91c1c;' 
      : disaster.tingkatKerusakan === 'Sedang' 
        ? 'background: #fffbeb; color: #b45309;' 
        : 'background: #f0fdf4; color: #15803d;';

    return `
      <div style="padding: 4px; min-width: 220px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
          <h3 style="font-weight: bold; color: #111827; font-size: 14px; flex: 1; margin: 0;">${disaster.jenisKerusakan}</h3>
          <span style="padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; ${badgeClass}">
            ${disaster.tingkatKerusakan}
          </span>
        </div>
        ${disaster.fotoLokasi && disaster.fotoLokasi.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <img 
              src="${disaster.fotoLokasi[0]}" 
              alt="Foto lokasi" 
              style="width: 100%; height: 128px; object-fit: cover; border-radius: 8px; cursor: pointer;"
              onclick="window.dispatchEvent(new CustomEvent('openPhoto', { detail: '${disaster.fotoLokasi[0]}' }))"
              onerror="this.style.display='none'"
            />
            ${disaster.fotoLokasi.length > 1 ? `<p style="font-size: 12px; color: #6b7280; margin-top: 6px; text-align: center;">+${disaster.fotoLokasi.length - 1} foto</p>` : ''}
          </div>
        ` : ''}
        <div style="margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p style="font-size: 12px; color: #4b5563; margin: 0;">${disaster.timestamp}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="font-size: 12px; color: #374151; margin: 0;">${disaster.namaPelapor}</span>
          </div>
        </div>
        <button 
          onclick="window.dispatchEvent(new CustomEvent('openDetail', { detail: ${disaster.id} }))"
          style="width: 100%; background: linear-gradient(to right, #dc2626, #ea580c); color: white; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; border: none; cursor: pointer;"
        >
          Lihat Detail
        </button>
      </div>
    `;
  }, []);

  // Cleanup map helper
  const cleanupMap = useCallback((mapRef: React.MutableRefObject<Map | null>, markersRefArr: React.MutableRefObject<Marker[]>) => {
    // Remove markers
    markersRefArr.current.forEach(marker => {
      try {
        marker.remove();
      } catch {
        // Ignore errors during cleanup
      }
    });
    markersRefArr.current = [];

    // Remove map
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {
        // Ignore errors during cleanup
      }
      mapRef.current = null;
    }
  }, []);

  // Initialize normal map
  useEffect(() => {
    if (!isMounted || isFullscreen || isDetailOverlayOpen) return;

    let isCancelled = false;

    const initMap = async () => {
      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (isCancelled || !mapContainerRef.current) return;

      // Clean up existing map first
      cleanupMap(mapInstanceRef, markersRef);

      // Double check container is clean
      if ((mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        delete (mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
      }

      try {
        const L = (await import('leaflet')).default;

        if (isCancelled || !mapContainerRef.current) return;

        // Create new map
        const map = L.map(mapContainerRef.current, {
          center: [5.5483, 95.3238],
          zoom: 10,
          scrollWheelZoom: true,
          zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        mapInstanceRef.current = map;

        // Add markers
        disasters.forEach((disaster) => {
          if (isCancelled) return;
          const icon = createCustomIcon(L, disaster.tingkatKerusakan);
          
          const marker = L.marker([disaster.lat, disaster.lng], { icon })
            .addTo(map)
            .bindPopup(createPopupContent(disaster), { maxWidth: 280 });

          marker.on('click', () => {
            // Langsung zoom in maksimal ke marker yang diklik
            map.setView([disaster.lat, disaster.lng], 18, {
              animate: true,
              duration: 0.5
            });
            
            // Buka popup
            marker.openPopup();
            
            // Trigger sidebar dan detail overlay
            onDisasterSelect(disaster);
            if (onOpenDetailOverlay) {
              onOpenDetailOverlay(disaster);
            }
          });
          
          markersRef.current.push(marker);
        });

        // Pan to selected disaster or mapCenter
        if (mapCenter) {
          map.setView([mapCenter.lat, mapCenter.lng], 15);
        } else if (selectedDisaster) {
          map.setView([selectedDisaster.lat, selectedDisaster.lng], 13);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      cleanupMap(mapInstanceRef, markersRef);
    };
  }, [isMounted, isFullscreen, isDetailOverlayOpen, disasters, selectedDisaster, createCustomIcon, createPopupContent, onDisasterSelect, onOpenDetailOverlay, cleanupMap, mapCenter]);

  // Initialize fullscreen map
  useEffect(() => {
    if (!isMounted || !isFullscreen) return;

    let isCancelled = false;

    const initFullscreenMap = async () => {
      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (isCancelled || !fullscreenMapContainerRef.current) return;

      // Clean up existing map first
      cleanupMap(fullscreenMapInstanceRef, fullscreenMarkersRef);

      // Double check container is clean
      if ((fullscreenMapContainerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        delete (fullscreenMapContainerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
      }

      try {
        const L = (await import('leaflet')).default;

        if (isCancelled || !fullscreenMapContainerRef.current) return;

        const center: [number, number] = selectedDisaster 
          ? [selectedDisaster.lat, selectedDisaster.lng] 
          : [5.5483, 95.3238];
        
        const zoom = selectedDisaster ? 13 : 10;

        const map = L.map(fullscreenMapContainerRef.current, {
          center,
          zoom,
          scrollWheelZoom: true,
          zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        fullscreenMapInstanceRef.current = map;

        // Add markers
        disasters.forEach((disaster) => {
          if (isCancelled) return;
          const icon = createCustomIcon(L, disaster.tingkatKerusakan);
          
          const marker = L.marker([disaster.lat, disaster.lng], { icon })
            .addTo(map)
            .bindPopup(createPopupContent(disaster), { maxWidth: 280 });

          marker.on('click', () => {
            // Langsung zoom in maksimal ke marker yang diklik
            map.setView([disaster.lat, disaster.lng], 18, {
              animate: true,
              duration: 0.5
            });
            
            // Buka popup
            marker.openPopup();
            
            // Trigger sidebar dan detail overlay
            onDisasterSelect(disaster);
            if (onOpenDetailOverlay) {
              onOpenDetailOverlay(disaster);
            }
          });
          
          fullscreenMarkersRef.current.push(marker);
        });
      } catch (error) {
        console.error('Error initializing fullscreen map:', error);
      }
    };

    initFullscreenMap();

    return () => {
      isCancelled = true;
      cleanupMap(fullscreenMapInstanceRef, fullscreenMarkersRef);
    };
  }, [isMounted, isFullscreen, disasters, selectedDisaster, createCustomIcon, createPopupContent, onDisasterSelect, onOpenDetailOverlay, cleanupMap]);

  // Listen for custom events from popup buttons
  useEffect(() => {
    const handleOpenPhoto = (e: CustomEvent<string>) => {
      setSelectedPhotoUrl(e.detail);
    };

    const handleOpenDetail = (e: CustomEvent<number>) => {
      const disaster = disasters.find(d => d.id === e.detail);
      if (disaster) {
        setIsFullscreen(false);
        onDisasterSelect(disaster);
        if (onOpenDetailOverlay) {
          onOpenDetailOverlay(disaster);
        }
      }
    };

    window.addEventListener('openPhoto', handleOpenPhoto as EventListener);
    window.addEventListener('openDetail', handleOpenDetail as EventListener);

    return () => {
      window.removeEventListener('openPhoto', handleOpenPhoto as EventListener);
      window.removeEventListener('openDetail', handleOpenDetail as EventListener);
    };
  }, [disasters, onDisasterSelect, onOpenDetailOverlay]);

  if (!isMounted) {
    return (
      <div className="w-full h-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center rounded-2xl">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Memuat peta...</p>
        </div>
      </div>
    );
  }

  // Fullscreen map portal content
  const fullscreenMapContent = isFullscreen && isMounted ? (
    <div 
      className="fixed inset-0 bg-white flex flex-col"
      style={{ zIndex: 999999 }}
    >
      {/* Fullscreen Map Container */}
      <div 
        ref={fullscreenMapContainerRef} 
        className="flex-1 w-full"
        style={{ minHeight: '100vh' }}
      />
      
      {/* Exit Button - z-index harus lebih tinggi dari leaflet controls */}
      <button
        onClick={() => setIsFullscreen(false)}
        className="absolute top-4 right-4 bg-white hover:bg-gray-50 p-2.5 rounded-lg shadow-lg border border-gray-200 transition-colors"
        style={{ zIndex: 10000 }}
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Legenda - z-index harus lebih tinggi dari leaflet controls */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg border border-gray-200 p-3" style={{ zIndex: 10000 }}>
        <h4 className="text-xs font-bold text-gray-900 mb-2">Tingkat Kerusakan</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-600"></div>
            <span className="text-xs text-gray-700">Berat</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500"></div>
            <span className="text-xs text-gray-700">Sedang</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-600"></div>
            <span className="text-xs text-gray-700">Ringan</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full h-full relative">
      {/* Render fullscreen map via portal to document.body */}
      {isFullscreen && isMounted && typeof document !== 'undefined' && createPortal(
        fullscreenMapContent,
        document.body
      )}

      {/* Normal Map View */}
      {!isFullscreen && (
        <>
          {/* Fullscreen Button */}
          {!isDetailOverlayOpen && (
            <button
              onClick={() => setIsFullscreen(true)}
              className="absolute top-4 right-4 bg-white hover:bg-gray-50 p-2.5 rounded-lg shadow-lg border border-gray-200 transition-colors"
              style={{ zIndex: 1000 }}
              title="Fullscreen"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}

          {/* Legenda */}
          {!isDetailOverlayOpen && (
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md border border-gray-200 p-2.5" style={{ zIndex: 1000 }}>
              <h4 className="text-xs font-bold text-gray-900 mb-1.5">Tingkat Kerusakan</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className="text-xs text-gray-700">Berat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-xs text-gray-700">Sedang</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-600"></div>
                  <span className="text-xs text-gray-700">Ringan</span>
                </div>
              </div>
            </div>
          )}

          {/* Normal Map Container */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-full rounded-2xl"
            style={{ minHeight: '400px' }}
          />
        </>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
          style={{ zIndex: 100001 }}
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
            onClick={() => setSelectedPhotoUrl(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img 
            src={selectedPhotoUrl} 
            alt="Full view" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
