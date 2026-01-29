"use client";

import { useEffect, useState } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface Report {
  id: number;
  namaObjek: string;
  namaPelapor: string;
  kontak: string;
  desaKecamatan: string;
  jenisKerusakan: string;
  tingkatKerusakan: string;
  keteranganKerusakan: string;
  lat?: number;
  lng?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  statusTangani: 'SUDAH_DITANGANI' | 'BELUM_DITANGANI';
  fotoLokasi: string[];
  submittedAt: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: {
    id: number;
    name: string;
    username: string;
  } | null;
  invalidReportsCount?: number;
}

interface AdminReportDetailModalProps {
  report: Report;
  onClose: () => void;
  onUpdateStatus?: (reportId: number, status: 'APPROVED' | 'REJECTED') => Promise<void>;
  isUpdating?: number | null;
}

export default function AdminReportDetailModal({ 
  report, 
  onClose, 
  onUpdateStatus,
  isUpdating 
}: AdminReportDetailModalProps) {
  const [reportInvalidReports, setReportInvalidReports] = useState<Array<{
    id: string;
    reason: string;
    reporterName: string | null;
    createdAt: string;
  }>>([]);
  const [loadingInvalidReports, setLoadingInvalidReports] = useState(false);

  // Load invalid reports when modal opens
  useEffect(() => {
    const loadInvalidReports = async () => {
      try {
        setLoadingInvalidReports(true);
        const response = await fetch(`/api/invalid-reports?reportId=${report.id}`);
        const data = await response.json();
        if (data.success) {
          setReportInvalidReports(data.invalidReports || []);
        }
      } catch (error) {
        console.error('Error loading invalid reports:', error);
      } finally {
        setLoadingInvalidReports(false);
      }
    };

    loadInvalidReports();
  }, [report.id]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with Image/Gradient */}
        <div className="relative h-48 shrink-0">
          {report.fotoLokasi && report.fotoLokasi.length > 0 ? (
            <div className="absolute inset-0">
              <img 
                src={report.fotoLokasi[0]} 
                alt={report.namaObjek}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"></div>
            </div>
          ) : (
            <div className="h-full bg-linear-to-r from-red-600 to-orange-500"></div>
          )}
          
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 active:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors z-10 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
              report.tingkatKerusakan === 'Berat' ? 'bg-red-500/90 text-white' :
              report.tingkatKerusakan === 'Sedang' ? 'bg-amber-500/90 text-white' :
              'bg-green-500/90 text-white'
            }`}>
              Kerusakan {report.tingkatKerusakan}
            </span>
            <h2 className="text-2xl font-bold drop-shadow-lg wrap-break-word">{report.namaObjek}</h2>
            <p className="text-white/90 text-sm mt-1">ID: #{report.id}</p>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Status Badge */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              report.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
              report.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {report.status === 'PENDING' ? 'Menunggu Verifikasi' : 
               report.status === 'APPROVED' ? '✓ Telah Diverifikasi' : '✗ Ditolak'}
            </span>
          </div>

          {/* Photo Gallery */}
          {report.fotoLokasi && report.fotoLokasi.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Foto Dokumentasi</h3>
              <div className="grid grid-cols-4 gap-2">
                {report.fotoLokasi.map((foto, idx) => (
                  <button
                    key={idx}
                    onClick={() => window.open(foto, '_blank')}
                    className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                  >
                    <img src={foto} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <User className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Pelapor</span>
              </div>
              <p className="text-gray-900 font-medium wrap-break-word">{report.namaPelapor}</p>
              <p className="text-gray-500 text-sm wrap-break-word">{report.kontak}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Lokasi</span>
              </div>
              <p className="text-gray-900 font-medium wrap-break-word">{report.desaKecamatan}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Waktu Lapor</span>
              </div>
              <p className="text-gray-900 font-medium text-sm">
                {formatDateTime(report.submittedAt || report.createdAt)}
              </p>
            </div>
            {report.reviewedAt && report.status !== 'PENDING' && (
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Waktu Review</span>
                </div>
                <p className="text-blue-900 font-medium text-sm">
                  {formatDateTime(report.reviewedAt)}
                </p>
                {report.reviewedBy && (
                  <p className="text-blue-700 text-xs mt-1">oleh {report.reviewedBy.name}</p>
                )}
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Jenis Kerusakan</span>
              </div>
              <p className="text-gray-900 font-medium wrap-break-word">{report.jenisKerusakan}</p>
            </div>
          </div>

          {/* Keterangan */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Keterangan Kerusakan</h3>
            <p className="text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 wrap-break-word whitespace-normal">
              {report.keteranganKerusakan}
            </p>
          </div>

          {/* Coordinates */}
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Koordinat</span>
                <p className="font-mono text-sm mt-1 text-gray-800">{report.lat?.toFixed(6) ?? 'N/A'}, {report.lng?.toFixed(6) ?? 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Laporan Tidak Valid Section */}
          {reportInvalidReports.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Laporan Tidak Valid ({reportInvalidReports.length})
              </h3>
              {loadingInvalidReports ? (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500">Memuat...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportInvalidReports.map((ir) => (
                    <div key={ir.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-amber-700">
                          {ir.reporterName || 'Anonim'}
                        </span>
                        <span className="text-xs text-amber-600">
                          {(() => {
                            const date = new Date(ir.createdAt);
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                            return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
                          })()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {ir.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions - Only for PENDING */}
          {onUpdateStatus && report.status === 'PENDING' && (
            <div className="flex gap-3 p-4 bg-gray-50 rounded-xl">
              <button
                onClick={() => onUpdateStatus(report.id, 'APPROVED')}
                disabled={isUpdating === report.id}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating === report.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Setujui Laporan
              </button>
              <button
                onClick={() => onUpdateStatus(report.id, 'REJECTED')}
                disabled={isUpdating === report.id}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-red-600 to-rose-600 text-white font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating === report.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                Tolak Laporan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
