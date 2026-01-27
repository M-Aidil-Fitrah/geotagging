"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DisasterData } from "@/lib/types";
import { getAllReports } from "@/lib/api";
import Pagination from "@/app/components/ui/Pagination";
import UserReportDetailModal from "./UserReportDetailModal";
import InvalidReportFormModal from "./InvalidReportFormModal";
import { 
  MapPin, 
  User, 
  AlertTriangle, 
  Search, 
  Map as MapIcon,
  X,
  RefreshCw,
  Eye,
  Clock,
  Building2,
  FileText as FileIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

// Format date - langsung dari database (sudah WIB)
const formatFullDate = (dateString: Date | string): string => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
};

type SortField = 'id' | 'submittedAt' | 'tingkatKerusakan' | 'namaObjek';
type SortOrder = 'asc' | 'desc';

export default function LaporanView() {
  const router = useRouter();
  
  const [reports, setReports] = useState<DisasterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  
  // Detail modal
  const [selectedReport, setSelectedReport] = useState<DisasterData | null>(null);
  const [showDetailOverlay, setShowDetailOverlay] = useState(false);
  const [showInvalidReportForm, setShowInvalidReportForm] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [reportInvalidReports, setReportInvalidReports] = useState<Array<{
    id: string;
    reason: string;
    reporterName: string | null;
    createdAt: string;
  }>>([]);
  const [loadingInvalidReports, setLoadingInvalidReports] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Load reports
  const loadReports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllReports();
      // Show all reports (not just approved)
      setReports(data);
    } catch (err) {
      console.error("Error loading reports:", err);
      setError("Gagal memuat data laporan");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Load invalid reports when detail modal is shown
  const loadInvalidReports = async (reportId: number) => {
    try {
      setLoadingInvalidReports(true);
      const response = await fetch(`/api/invalid-reports?reportId=${reportId}`);
      const data = await response.json();
      if (data.success) {
        setReportInvalidReports(data.invalidReports || []);
      }
    } catch (error) {
      console.error('Failed to load invalid reports:', error);
      setReportInvalidReports([]);
    } finally {
      setLoadingInvalidReports(false);
    }
  };

  // When report is selected, show detail modal and load invalid reports
  const handleReportSelect = (report: DisasterData) => {
    setSelectedReport(report);
    setShowDetailOverlay(true);
    loadInvalidReports(report.id);
  };

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Apply filters and sorting
  const filteredReports = useMemo(() => {
    let result = [...reports];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        r =>
          r.namaObjek.toLowerCase().includes(query) ||
          r.desaKecamatan.toLowerCase().includes(query) ||
          r.jenisKerusakan.toLowerCase().includes(query) ||
          r.namaPelapor.toLowerCase().includes(query) ||
          r.keteranganKerusakan.toLowerCase().includes(query) ||
          r.id.toString().includes(query)
      );
    }
    
    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'id':
          comparison = a.id - b.id;
          break;
        case 'submittedAt':
          comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          break;
        case 'tingkatKerusakan': {
          const order = { 'Berat': 3, 'Sedang': 2, 'Ringan': 1 };
          comparison = (order[a.tingkatKerusakan as keyof typeof order] || 0) - (order[b.tingkatKerusakan as keyof typeof order] || 0);
          break;
        }
        case 'namaObjek':
          comparison = a.namaObjek.localeCompare(b.namaObjek);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [reports, searchQuery, sortField, sortOrder]);

  // Paginated reports
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReports, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // Navigate to dashboard with coordinates
  const viewOnMap = (report: DisasterData) => {
    router.push(`/dashboard?lat=${report.lat}&lng=${report.lng}&id=${report.id}`);
  };

  // Stats (excluding rejected reports since they're not shown)
  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === "PENDING").length,
    approved: reports.filter(r => r.status === "APPROVED").length,
    belumDitangani: reports.filter(r => r.statusTangani === "BELUM_DITANGANI").length,
  }), [reports]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Berat":
        return {
          bg: "bg-red-50",
          text: "text-red-700",
          badge: "bg-red-100 text-red-700",
          dot: "bg-red-500",
        };
      case "Sedang":
        return {
          bg: "bg-amber-50",
          text: "text-amber-700",
          badge: "bg-amber-100 text-amber-700",
          dot: "bg-amber-500",
        };
      default:
        return {
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          badge: "bg-emerald-100 text-emerald-700",
          dot: "bg-emerald-500",
        };
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600" />;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header - scrolls with content */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Daftar Laporan</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Semua laporan bencana
              </p>
            </div>
            <button 
              onClick={loadReports}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-sm font-medium text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Memuat..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Stats Summary - styled like UserDashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-linear-to-br from-red-500 to-red-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-xl shadow-red-500/30">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">Live</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">{stats.total}</div>
              <div className="text-red-100 font-medium text-xs sm:text-sm">Total Laporan</div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{stats.pending}</div>
              <div className="text-gray-500 font-medium text-xs sm:text-sm">Belum Diverifikasi</div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{stats.approved}</div>
              <div className="text-gray-500 font-medium text-xs sm:text-sm">Terverifikasi</div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-orange-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{stats.belumDitangani}</div>
              <div className="text-gray-500 font-medium text-xs sm:text-sm">Belum Ditangani</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama objek, lokasi, jenis kerusakan, pelapor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && reports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium">Memuat data laporan...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="font-semibold text-red-900 mb-1">Gagal Memuat Data</h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button 
                onClick={loadReports}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredReports.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileIcon className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {searchQuery ? "Tidak ada hasil" : "Belum ada laporan"}
              </h3>
              <p className="text-gray-500 text-sm">
                {searchQuery 
                  ? "Coba ubah kata kunci pencarian"
                  : "Laporan yang telah diverifikasi akan muncul di sini"
                }
              </p>
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && filteredReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4">
                        <button 
                          onClick={() => toggleSort('id')}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                        >
                          ID <SortIcon field="id" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <button 
                          onClick={() => toggleSort('namaObjek')}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                        >
                          Nama Objek <SortIcon field="namaObjek" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Lokasi</span>
                      </th>
                      <th className="text-left py-3 px-4">
                        <button 
                          onClick={() => toggleSort('tingkatKerusakan')}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                        >
                          Tingkat <SortIcon field="tingkatKerusakan" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</span>
                      </th>
                      <th className="text-left py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Pelapor</span>
                      </th>
                      <th className="text-left py-3 px-4">
                        <button 
                          onClick={() => toggleSort('submittedAt')}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                        >
                          Waktu <SortIcon field="submittedAt" />
                        </button>
                      </th>
                      <th className="text-center py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedReports.map((report) => {
                      const colors = getSeverityColor(report.tingkatKerusakan);
                      return (
                        <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              #{report.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {report.fotoLokasi && report.fotoLokasi.length > 0 ? (
                                <img
                                  src={report.fotoLokasi[0]}
                                  alt={report.namaObjek}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0 hidden sm:block"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/40?text=N";
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center shrink-0 hidden sm:flex">
                                  <Building2 className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 text-sm truncate max-w-32" title={report.namaObjek}>
                                  {report.namaObjek.length > 20 ? `${report.namaObjek.slice(0, 20)}...` : report.namaObjek}
                                </p>
                                <p className="text-xs text-gray-500 truncate max-w-32" title={report.jenisKerusakan}>
                                  {report.jenisKerusakan.length > 25 ? `${report.jenisKerusakan.slice(0, 25)}...` : report.jenisKerusakan}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-40">{report.desaKecamatan}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                              {report.tingkatKerusakan}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              report.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                              report.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {report.status === 'PENDING' ? 'Menunggu' : report.status === 'APPROVED' ? 'Telah Diverifikasi' : 'Ditolak'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-24">{report.namaPelapor}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">{formatFullDate(report.submittedAt)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleReportSelect(report)}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Detail"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => viewOnMap(report)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Lihat di Peta"
                              >
                                <MapIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredReports.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal using UserReportDetailModal */}
      {showDetailOverlay && selectedReport && (
        <UserReportDetailModal
          disaster={selectedReport}
          onClose={() => {
            setShowDetailOverlay(false);
            setSelectedReport(null);
          }}
          onOpenInvalidReportForm={() => {
            setShowDetailOverlay(false);
            setShowInvalidReportForm(true);
          }}
          reportInvalidReports={reportInvalidReports}
          loadingInvalidReports={loadingInvalidReports}
          onPhotoClick={setSelectedPhotoUrl}
        />
      )}

      {/* Invalid Report Form Modal */}
      {showInvalidReportForm && selectedReport && (
        <InvalidReportFormModal
          reportId={selectedReport.id}
          reportName={selectedReport.namaObjek}
          onClose={() => setShowInvalidReportForm(false)}
          onSuccess={() => {
            setShowInvalidReportForm(false);
            loadInvalidReports(selectedReport.id);
          }}
        />
      )}

      {/* Photo Viewer Modal */}
      {selectedPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-60"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
            onClick={() => setSelectedPhotoUrl(null)}
          >
            <X className="w-5 h-5" />
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
