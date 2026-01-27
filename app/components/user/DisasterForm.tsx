"use client";

import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, MapPin, Loader2, AlertCircle, SwitchCamera } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { LeafletMouseEvent } from 'leaflet';
import { createReport, uploadPhotos } from '@/lib/api';
import type { TingkatKerusakan, Report } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => {
    // Fix default marker icon
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      });
    }
    return mod.Marker;
  }),
  { ssr: false }
);

interface DisasterFormProps {
  onClose: () => void;
  onSubmit: (data: Report) => void;
}

interface FormData {
  namaPelapor: string;
  kontak: string;
  desaKecamatan: string;
  namaObjek: string;
  jenisKerusakan: string;
  tingkatKerusakan: TingkatKerusakan;
  keteranganKerusakan: string;
  lat: number | null;
  lng: number | null;
  fotoLokasi: string[];
}

interface CapturedPhoto {
  dataUrl: string;
  file: File;
}

// Map click handler component - properly imported dynamically
const MapClickHandler = dynamic(
  () => import('react-leaflet').then((mod) => {
    function MapClickHandlerComponent({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
      const { useMapEvents } = mod;
      useMapEvents({
        click: (e: LeafletMouseEvent) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
      });
      return null;
    }
    return MapClickHandlerComponent;
  }),
  { ssr: false }
);

export default function DisasterForm({ onClose, onSubmit }: DisasterFormProps) {
  const [formData, setFormData] = useState<FormData>({
    namaPelapor: '',
    kontak: '',
    desaKecamatan: '',
    namaObjek: '',
    jenisKerusakan: '',
    tingkatKerusakan: 'Sedang' as TingkatKerusakan,
    keteranganKerusakan: '',
    lat: null,
    lng: null,
    fotoLokasi: [],
  });

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [photoMode, setPhotoMode] = useState<'capture' | 'upload' | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapCenter] = useState<[number, number]>([5.5483, 95.3238]);
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // ========== TAMBAHAN BARU: State untuk Camera Switch ==========
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  // ================================================================

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // PERBAIKAN: Auto-stop camera saat max photos tercapai
  useEffect(() => {
    if (capturedPhotos.length >= 3 && isCameraActive) {
      console.log('Max photos reached, stopping camera...');
      stopCamera();
      // Auto proceed to location after short delay
      setTimeout(() => {
        if (photoMode === 'capture') {
          getCurrentLocation();
        }
      }, 500);
    }
  }, [capturedPhotos.length, isCameraActive, photoMode]);

  // ========== TAMBAHAN BARU: Check Multiple Cameras ==========
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCanSwitchCamera(videoDevices.length > 1);
        console.log(`Found ${videoDevices.length} camera(s)`);
      } catch (error) {
        console.error('Error checking cameras:', error);
      }
    };
    
    if (isCameraActive) {
      checkCameras();
    }
  }, [isCameraActive]);
  // ============================================================

  // Get current location
  const getCurrentLocation = () => {
    setLoadingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation tidak didukung di browser Anda');
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, lat: latitude, lng: longitude }));

        // Reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          const village = data.address.village || data.address.suburb || '';
          const district = data.address.county || data.address.city_district || '';
          const city = data.address.city || data.address.town || '';
          const locationName = `${village}${district ? ', ' + district : ''}${city ? ', ' + city : ''}`;

          setFormData(prev => ({ ...prev, desaKecamatan: locationName }));
        } catch (error) {
          console.error('Error getting location name:', error);
        }

        setLoadingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationError('Gagal mendapatkan lokasi. Pastikan GPS aktif dan izin lokasi diberikan.');
        setLoadingLocation(false);
      }
    );
  };

  // ========== PERBAIKAN: Start camera dengan facing mode parameter ==========
  const startCamera = async (preferredFacingMode?: 'user' | 'environment') => {
    setCameraError('');
    setIsCameraActive(false);

    // Stop existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    const modeToUse = preferredFacingMode || facingMode;

    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser. Please use a modern browser (Chrome, Firefox, Safari).');
      }

      // Try with facingMode first (mobile devices)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: modeToUse },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        console.log(`Camera started with ${modeToUse} facingMode`);
      } catch {
        // Fallback for desktop - just get any video device
        console.log('Falling back to default video device (desktop)');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        // On desktop, disable camera switch button
        setCanSwitchCamera(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        // Update state immediately when video is ready
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log(`Camera ready and playing`);
                setIsCameraActive(true);
                setFacingMode(modeToUse);
              })
              .catch((playError) => {
                console.error('Error playing video:', playError);
                setCameraError('Gagal memulai kamera. Coba lagi.');
                stopCamera();
              });
          }
        };

        // Fallback timeout - check if video is ready but event didn't fire
        setTimeout(() => {
          if (videoRef.current && videoRef.current.readyState >= 2 && streamRef.current?.active && !isCameraActive) {
            console.log('Fallback: setting camera active via timeout');
            setIsCameraActive(true);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setCameraError('Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('Kamera tidak ditemukan pada perangkat Anda.');
        } else if (error.name === 'NotReadableError') {
          setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.');
        } else {
          setCameraError('Gagal mengakses kamera: ' + error.message);
        }
      } else {
        setCameraError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
      }
      setPhotoMode(null);
    }
  };
  // ==========================================================================

  // ========== PERBAIKAN: Function untuk Switch Camera ==========
  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    console.log(`Switching camera from ${facingMode} to ${newMode}`);
    setFacingMode(newMode);
    startCamera(newMode);
  };
  // ==================================================================

  // Stop camera
  const stopCamera = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.label);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
    }
    setIsCameraActive(false);
  };

  // ========== PERBAIKAN: Capture photo dengan mirror untuk front camera ==========
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Mirror horizontal jika pakai front camera
    if (facingMode === 'user') {
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      context.drawImage(video, 0, 0);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        // Convert blob to File
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setCapturedPhotos(prev => [...prev, { dataUrl, file }]);
        };
        reader.readAsDataURL(blob);
      }
    }, 'image/jpeg', 0.8);
  };
  // ===============================================================================

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (capturedPhotos.length >= 3) {
      alert('Maksimal 3 foto');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        alert(`File ${file.name} tidak didukung. Hanya JPG, JPEG, PNG, dan HEIC yang diperbolehkan.`);
        return;
      }

      if (file.size > maxSize) {
        alert(`File ${file.name} terlalu besar. Maksimal 2MB per foto.`);
        return;
      }

      if (capturedPhotos.length >= 3) {
        alert('Maksimal 3 foto');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setCapturedPhotos(prev => {
          if (prev.length >= 3) return prev;
          return [...prev, { dataUrl, file }];
        });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Handle photo mode selection
  const handlePhotoModeSelect = (mode: 'capture' | 'upload') => {
    setPhotoMode(mode);
    if (mode === 'capture') {
      startCamera();
    }
  };

  // Handle map click
  const handleMapClick = async (lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    setFormData(prev => ({ ...prev, lat, lng }));

    // Reverse geocoding
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      const village = data.address.village || data.address.suburb || '';
      const district = data.address.county || data.address.city_district || '';
      const city = data.address.city || data.address.town || '';
      const locationName = `${village}${district ? ', ' + district : ''}${city ? ', ' + city : ''}`;

      setFormData(prev => ({ ...prev, desaKecamatan: locationName }));
    } catch (error) {
      console.error('Error getting location name:', error);
    }
  };

  // Handle submit with comprehensive error handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.lat || !formData.lng) {
      setSubmitError('Koordinat lokasi harus diisi');
      alert('Koordinat lokasi harus diisi');
      return;
    }

    if (capturedPhotos.length === 0) {
      setSubmitError('Minimal 1 foto harus diupload');
      alert('Minimal 1 foto harus diupload');
      return;
    }

    // Validasi format kontak
    const kontakValue = formData.kontak.trim();
    if (kontakValue.length < 10 || kontakValue.length > 15) {
      setSubmitError('Nomor kontak harus antara 10-15 digit');
      alert('Nomor kontak harus antara 10-15 digit');
      return;
    }

    // Cek apakah kontak hanya angka
    if (!/^[0-9]+$/.test(kontakValue)) {
      setSubmitError('Nomor kontak hanya boleh berisi angka');
      alert('Nomor kontak hanya boleh berisi angka');
      return;
    }

    setIsSubmitting(true);
    setIsUploadingPhotos(true);
    setSubmitError('');
    setUploadProgress('');

    const startTime = Date.now();
    const TIMEOUT_MS = 60000; // 60 seconds timeout

    try {
      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('NETWORK_ERROR: Tidak ada koneksi internet. Pastikan Anda terhubung ke internet dan coba lagi.');
      }

      // 1. Upload photos first with timeout
      setUploadProgress(`Mengunggah ${capturedPhotos.length} foto...`);
      const files = capturedPhotos.map(photo => photo.file);
      
      const uploadPromise = uploadPhotos(files);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: Upload foto memakan waktu terlalu lama. Periksa koneksi internet Anda dan coba lagi.')), TIMEOUT_MS)
      );

      const uploadedPaths = await Promise.race([uploadPromise, timeoutPromise]);
      
      if (!uploadedPaths || uploadedPaths.length === 0) {
        throw new Error('Gagal mengunggah foto. Tidak ada file yang berhasil diupload.');
      }

      setIsUploadingPhotos(false);
      setUploadProgress('Foto berhasil diunggah, mengirim laporan...');

      // Check network again before submit
      if (!navigator.onLine) {
        throw new Error('NETWORK_ERROR: Koneksi internet terputus. Foto sudah terupload, tapi laporan belum terkirim. Coba lagi.');
      }

      // 2. Submit report with uploaded photo paths
      const reportData = {
        lat: formData.lat,
        lng: formData.lng,
        namaPelapor: formData.namaPelapor.trim(),
        kontak: kontakValue,
        desaKecamatan: formData.desaKecamatan.trim(),
        namaObjek: formData.namaObjek.trim(),
        jenisKerusakan: formData.jenisKerusakan.trim(),
        tingkatKerusakan: formData.tingkatKerusakan,
        keteranganKerusakan: formData.keteranganKerusakan.trim(),
        fotoLokasi: uploadedPaths,
      };

      const submitPromise = createReport(reportData);
      const submitTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: Pengiriman laporan memakan waktu terlalu lama. Periksa koneksi internet Anda dan coba lagi.')), TIMEOUT_MS)
      );

      const report = await Promise.race([submitPromise, submitTimeoutPromise]);

      const elapsedTime = Date.now() - startTime;
      console.log(`Report submitted successfully in ${elapsedTime}ms`);

      // Success!
      setUploadProgress('');
      alert('Laporan berhasil dikirim! Menunggu verifikasi admin.');
      onSubmit(report);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      
      let errorMessage = 'Gagal mengirim laporan. Silakan coba lagi.';
      
      if (error instanceof Error) {
        const errMsg = error.message;
        
        if (errMsg.includes('NETWORK_ERROR')) {
          errorMessage = errMsg.replace('NETWORK_ERROR: ', '');
        } else if (errMsg.includes('TIMEOUT')) {
          errorMessage = errMsg.replace('TIMEOUT: ', '');
        } else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
          errorMessage = 'Koneksi internet bermasalah atau server tidak dapat dijangkau. Periksa koneksi Anda dan coba lagi.';
        } else if (errMsg.includes('kontak') || errMsg.includes('pattern') || errMsg.includes('string')) {
          errorMessage = 'Format nomor kontak tidak valid. Pastikan hanya berisi angka (10-15 digit).';
        } else if (errMsg.includes('413') || errMsg.includes('too large')) {
          errorMessage = 'Ukuran foto terlalu besar. Gunakan foto dengan ukuran lebih kecil.';
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setSubmitError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhotos(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Tambah Laporan Bencana</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Photo Mode Selection */}
          {!photoMode && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Pilih Metode Pengambilan Foto</h3>
                <p className="text-sm text-gray-600">Min 1 - Maks 3 foto</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handlePhotoModeSelect('capture')}
                  className="p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all text-center"
                >
                  <Camera className="w-12 h-12 mx-auto mb-3 text-red-600" />
                  <h4 className="font-semibold text-gray-900 mb-1">Ambil Foto</h4>
                  <p className="text-sm text-gray-600">Lokasi otomatis dari GPS</p>
                </button>

                <button
                  type="button"
                  onClick={() => handlePhotoModeSelect('upload')}
                  className="p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all text-center"
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-red-600" />
                  <h4 className="font-semibold text-gray-900 mb-1">Upload Foto</h4>
                  <p className="text-sm text-gray-600">Pilih lokasi di peta</p>
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Format: JPG, PNG, JPEG, HEIC • Ukuran maks: 2MB per foto
              </p>
            </div>
          )}

          {/* Camera Capture */}
          {photoMode === 'capture' && capturedPhotos.length < 3 && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                {/* ========== TAMBAHAN BARU: Tombol Switch Camera ========== */}
                {isCameraActive && canSwitchCamera && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
                    title="Ganti Kamera"
                  >
                    <SwitchCamera className="w-6 h-6" />
                  </button>
                )}
                {/* ========================================================= */}

                {/* ========== PERBAIKAN: Indicator Kamera Aktif ========== */}
                {isCameraActive && (
                  <div className="absolute top-4 left-4 z-10 bg-red-600 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    {canSwitchCamera 
                      ? (facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan')
                      : 'Kamera Aktif'
                    }
                  </div>
                )}
                {/* ======================================================= */}

                {!isCameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p className="text-lg font-semibold">Mengaktifkan Kamera...</p>
                    <p className="text-sm text-gray-300 mt-2">Mohon izinkan akses kamera</p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <p className="text-center mb-4">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError('');
                        startCamera();
                      }}
                      className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-gray-100"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}

                {/* Video dengan mirror effect untuk front camera */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {isCameraActive && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={capturedPhotos.length >= 3}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-5 h-5" />
                    Ambil Foto ({capturedPhotos.length}/3)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setPhotoMode(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              )}

              {capturedPhotos.length >= 3 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-green-700 font-medium">✓ Maksimal 3 foto sudah tercapai</p>
                </div>
              )}
            </div>
          )}

          {/* File Upload */}
          {photoMode === 'upload' && !showMap && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/heic"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={capturedPhotos.length >= 3}
                className="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-transparent"
              >
                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-semibold text-gray-900 mb-1">Upload Foto</p>
                <p className="text-sm text-gray-600">Min 1 - Maks 3 foto (JPG, JPEG, PNG, HEIC)</p>
                <p className="text-xs text-gray-500 mt-1">Maksimal 2MB per foto</p>
              </button>

              {capturedPhotos.length === 0 && (
                <button
                  type="button"
                  onClick={() => setPhotoMode(null)}
                  className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                >
                  ← Kembali ke Pilihan Metode
                </button>
              )}
            </div>
          )}

          {/* Location Loading */}
          {loadingLocation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-blue-700 font-medium">Mengambil lokasi Anda...</p>
            </div>
          )}

          {/* Location Error */}
          {locationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{locationError}</p>
              </div>
            </div>
          )}

          {/* Map for Upload Mode */}
          {photoMode === 'upload' && showMap && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-700 text-sm font-medium text-center">
                  Klik pada peta untuk menentukan lokasi kejadian
                </p>
              </div>

              <div className="h-96 rounded-xl overflow-hidden border-2 border-gray-200">
                {typeof window !== 'undefined' && (
                  <MapContainer
                    center={selectedPosition || mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <MapClickHandler onLocationSelect={handleMapClick} />
                    {selectedPosition && (
                      <Marker position={selectedPosition} />
                    )}
                  </MapContainer>
                )}
              </div>
            </div>
          )}

          {/* Photo Preview */}
          {capturedPhotos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Foto Lokasi ({capturedPhotos.length}/3)
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {capturedPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img
                      src={photo.dataUrl}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Proceed to Location Button */}
              {!formData.lat && !formData.lng && (
                <button
                  type="button"
                  onClick={() => {
                    if (photoMode === 'capture') {
                      getCurrentLocation();
                    } else {
                      setShowMap(true);
                    }
                  }}
                  className="w-full px-6 py-4 bg-linear-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Lanjut ke Lokasi {photoMode === 'capture' ? '(GPS Otomatis)' : '(Pilih di Peta)'}
                </button>
              )}
            </div>
          )}

          {/* Coordinates Display */}
          {formData.lat && formData.lng && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-1">Koordinat Lokasi</h3>
              <p className="text-sm text-green-700 font-mono">
                {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
              </p>
            </div>
          )}

          {/* Form Fields */}
          {(formData.lat && formData.lng) && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nama Pelapor *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.namaPelapor}
                    onChange={(e) => setFormData(prev => ({ ...prev, namaPelapor: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Nama lengkap"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nomor Kontak (WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.kontak}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, kontak: value }));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="081234567890"
                    minLength={10}
                    maxLength={15}
                    inputMode="numeric"
                  />
                  <p className="text-xs text-gray-500 mt-1">Nomor hanya berisi angka 10-15 digit. Hanya ditampilkan untuk keperluan admin.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Desa / Kecamatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.desaKecamatan}
                    onChange={(e) => setFormData(prev => ({ ...prev, desaKecamatan: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50"
                    placeholder="Otomatis dari koordinat"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nama Objek / Bangunan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.namaObjek}
                    onChange={(e) => setFormData(prev => ({ ...prev, namaObjek: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Contoh: Jembatan Krueng Raya, Jalan Nasional ... , Rumah Sakit ..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Jenis Kerusakan*
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.jenisKerusakan}
                    onChange={(e) => setFormData(prev => ({ ...prev, jenisKerusakan: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Contoh: Rumah terendam banjir, Jalan tergenang, Jembatan rusak, Sawah terendam, Fasilitas umum terdampak"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Tingkat Kerusakan *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Ringan', 'Sedang', 'Berat'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, tingkatKerusakan: level as TingkatKerusakan }))}
                        className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                          formData.tingkatKerusakan === level
                            ? level === 'Berat'
                              ? 'bg-red-600 text-white'
                              : level === 'Sedang'
                              ? 'bg-amber-500 text-white'
                              : 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Keterangan Kerusakan & Kebutuhan *
                  </label>
                  <textarea
                    required
                    value={formData.keteranganKerusakan}
                    onChange={(e) => setFormData(prev => ({ ...prev, keteranganKerusakan: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder="Contoh: Air setinggi ±70 cm masuk ke rumah sejak malam hari. Perabotan rusak dan warga belum bisa beraktivitas normal. Saat ini membutuhkan bantuan air bersih, sembako, dan selimut."
                  />
                </div>
              </div>

              {/* Upload Progress */}
              {isUploadingPhotos && uploadProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <div className="flex-1">
                      <p className="text-blue-700 font-medium text-sm">{uploadProgress}</p>
                      <p className="text-blue-600 text-xs mt-1">Harap tunggu, jangan tutup halaman ini...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Error */}
              {submitError && !isSubmitting && (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{submitError}</p>
                    {submitError.includes('internet') || submitError.includes('koneksi') ? (
                      <p className="text-xs mt-2 text-red-500">Tip: Pastikan Anda memiliki koneksi internet yang stabil dan coba lagi.</p>
                    ) : submitError.includes('kontak') ? (
                      <p className="text-xs mt-2 text-red-500">Tip: Nomor kontak harus berisi 10-15 digit angka saja (contoh: 081234567890).</p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploadingPhotos && uploadProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <div className="flex-1">
                      <p className="text-blue-700 font-medium text-sm">{uploadProgress}</p>
                      <p className="text-blue-600 text-xs mt-1">Harap tunggu, jangan tutup halaman ini...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Error */}
              {submitError && !isSubmitting && (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{submitError}</p>
                    {submitError.includes('internet') || submitError.includes('koneksi') ? (
                      <p className="text-xs mt-2 text-red-500">Tip: Pastikan Anda memiliki koneksi internet yang stabil dan coba lagi.</p>
                    ) : submitError.includes('kontak') ? (
                      <p className="text-xs mt-2 text-red-500">Tip: Nomor kontak harus berisi 10-15 digit angka saja (contoh: 081234567890).</p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-4 bg-linear-to-r from-red-600 to-orange-600 text-white rounded-xl font-bold hover:from-red-700 hover:to-orange-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    'Kirim Laporan'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}