"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Pagination from '@/app/components/ui/Pagination';
import { 
  AlertTriangle,
  User,
  Clock,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin,
  Eye,
  Trash2,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
}

interface InvalidReportData {
  id: string;
  reportId: number;
  reason: string;
  reporterName: string | null;
  kontak: string | null;
  createdAt: string;
  report: Report;
}

interface GroupedInvalidReports {
  reportId: number;
  report: Report;
  invalidReports: Array<{
    id: string;
    reason: string;
    reporterName: string | null;
    kontak: string | null;
    createdAt: string;
  }>;
}

type SortField = 'reportId' | 'count' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
};

export default function InvalidReportsView() {
  const [invalidReports, setInvalidReports] = useState<InvalidReportData[]>([]);
  const [groupedReports, setGroupedReports] = useState<GroupedInvalidReports[]>([]);
  const [expandedReports, setExpandedReports] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Modal states
  const [selectedInvalidReport, setSelectedInvalidReport] = useState<{
    invalidReport: GroupedInvalidReports['invalidReports'][0];
    report: Report;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Load invalid reports
  const loadInvalidReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/invalid-reports');
      
      if (!response.ok) {
        throw new Error('Gagal memuat laporan tidak valid');
      }

      const data = await response.json();
      
      if (data.success && data.invalidReports && Array.isArray(data.invalidReports)) {
        setInvalidReports(data.invalidReports);
        const grouped = groupInvalidReportsByReportId(data.invalidReports);
        setGroupedReports(grouped);
      } else {
        setInvalidReports([]);
        setGroupedReports([]);
      }
    } catch (error) {
      console.error('Error loading invalid reports:', error);
      alert('Gagal memuat laporan tidak valid. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const groupInvalidReportsByReportId = (reports: InvalidReportData[]): GroupedInvalidReports[] => {
    const grouped = new Map<number, GroupedInvalidReports>();
    
    reports.forEach(ir => {
      if (!grouped.has(ir.reportId)) {
        grouped.set(ir.reportId, {
          reportId: ir.reportId,
          report: ir.report,
          invalidReports: []
        });
      }
      
      grouped.get(ir.reportId)!.invalidReports.push({
        id: ir.id,
        reason: ir.reason,
        reporterName: ir.reporterName,
        kontak: ir.kontak,
        createdAt: ir.createdAt
      });
    });
    
    return Array.from(grouped.values());
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter and sort grouped reports
  const filteredGroupedReports = useMemo(() => {
    let result = [...groupedReports];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.report.namaObjek.toLowerCase().includes(query) ||
        g.report.desaKecamatan.toLowerCase().includes(query) ||
        g.reportId.toString().includes(query) ||
        g.invalidReports.some(ir => 
          ir.reason.toLowerCase().includes(query) ||
          (ir.reporterName?.toLowerCase().includes(query) ?? false)
        )
      );
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'reportId':
          comparison = a.reportId - b.reportId;
          break;
        case 'count':
          comparison = a.invalidReports.length - b.invalidReports.length;
          break;
        case 'createdAt': {
          const aLatest = Math.max(...a.invalidReports.map(ir => new Date(ir.createdAt).getTime()));
          const bLatest = Math.max(...b.invalidReports.map(ir => new Date(ir.createdAt).getTime()));
          comparison = aLatest - bLatest;
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [groupedReports, searchQuery, sortField, sortOrder]);

  // Paginated reports
  const paginatedGroupedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGroupedReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGroupedReports, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredGroupedReports.length / itemsPerPage);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const toggleExpand = (reportId: number) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const deleteInvalidReport = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus laporan tidak valid ini?')) {
      return;
    }

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/admin/invalid-reports/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus laporan tidak valid');
      }

      alert('Laporan tidak valid berhasil dihapus!');
      await loadInvalidReports();
    } catch (error) {
      console.error('Error deleting invalid report:', error);
      alert(`Gagal menghapus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(null);
    }
  };

  useEffect(() => {
    loadInvalidReports();
  }, [loadInvalidReports]);;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-600" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-600" />;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Berat':
        return 'bg-red-100 text-red-700';
      case 'Sedang':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Laporan Tidak Valid</h1>
              <p className="text-gray-500 mt-1 text-sm">Kelola laporan yang dilaporkan tidak valid oleh pengguna</p>
            </div>
            <button
              onClick={loadInvalidReports}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Stats Cards - styled like UserDashboard */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-linear-to-br from-amber-500 to-amber-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-xl shadow-amber-500/30">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">Live</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">{invalidReports.length}</div>
              <div className="text-amber-100 font-medium text-xs sm:text-sm">Total Laporan Tidak Valid</div>
            </div>
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{groupedReports.length}</div>
              <div className="text-gray-500 font-medium text-xs sm:text-sm">Laporan Terpengaruh</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama objek, lokasi, ID, alasan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:bg-white transition-all"
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

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Memuat data...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredGroupedReports.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Tidak ada laporan tidak valid</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? 'Coba ubah kata kunci pencarian' : 'Semua laporan masih valid'}
              </p>
            </div>
          )}

          {/* Table */}
          {!isLoading && filteredGroupedReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4">
                        <button onClick={() => toggleSort('reportId')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900">
                          ID Laporan <SortIcon field="reportId" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Objek</span>
                      </th>
                      <th className="text-left py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Lokasi</span>
                      </th>
                      <th className="text-left py-3 px-4">
                        <button onClick={() => toggleSort('count')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900">
                          Jumlah <SortIcon field="count" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900">
                          Terbaru <SortIcon field="createdAt" />
                        </button>
                      </th>
                      <th className="text-center py-3 px-4">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedGroupedReports.map((group) => {
                      const isExpanded = expandedReports.has(group.reportId);
                      const latestReport = group.invalidReports.reduce((latest, current) => 
                        new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
                      , group.invalidReports[0]);

                      return (
                        <React.Fragment key={group.reportId}>
                          <tr key={group.reportId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                #{group.reportId}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate max-w-32" title={group.report.namaObjek}>
                                  {group.report.namaObjek.length > 20 ? `${group.report.namaObjek.slice(0, 20)}...` : group.report.namaObjek}
                                </p>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${getSeverityBadge(group.report.tingkatKerusakan)}`}>
                                  {group.report.tingkatKerusakan}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate max-w-30">{group.report.desaKecamatan}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                <AlertTriangle className="w-3 h-3" />
                                {group.invalidReports.length}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span className="whitespace-nowrap">{formatDateTime(latestReport.createdAt)}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => toggleExpand(group.reportId)}
                                  className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                  title={isExpanded ? "Tutup Detail" : "Lihat Detail"}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Expanded Detail Rows */}
                          {isExpanded && (
                            <tr key={`expanded-${group.reportId}`}>
                              <td colSpan={6} className="p-0">
                                <div className="bg-amber-50/50 border-t border-b border-amber-100 px-4 py-3">
                                  <div className="space-y-2">
                                    {group.invalidReports.map((ir, idx) => (
                                      <div key={ir.id} className="bg-white rounded-lg border border-amber-200 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                                #{idx + 1}
                                              </span>
                                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {ir.reporterName || 'Anonim'}
                                              </span>
                                              {ir.kontak && (
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                  <Phone className="w-3 h-3" />
                                                  {ir.kontak}
                                                </span>
                                              )}
                                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDateTime(ir.createdAt)}
                                              </span>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">{ir.reason}</p>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              onClick={() => setSelectedInvalidReport({ invalidReport: ir, report: group.report })}
                                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                              title="Detail"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => deleteInvalidReport(ir.id)}
                                              disabled={isDeleting === ir.id}
                                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                              title="Hapus"
                                            >
                                              {isDeleting === ir.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredGroupedReports.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Invalid Report Detail Modal */}
      {selectedInvalidReport && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedInvalidReport(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-linear-to-r from-amber-500 to-orange-500 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">Detail Laporan Tidak Valid</h3>
                  <p className="text-amber-100 text-sm">Laporan #{selectedInvalidReport.report.id}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedInvalidReport(null); }}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors z-10 touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 max-h-[calc(90vh-8rem)] overflow-y-auto">
              {/* Report Info */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Laporan Terkait</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 wrap-break-word">{selectedInvalidReport.report.namaObjek}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedInvalidReport.report.desaKecamatan}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getSeverityBadge(selectedInvalidReport.report.tingkatKerusakan)}`}>
                      {selectedInvalidReport.report.tingkatKerusakan}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reporter Info */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Info Pelapor</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium uppercase">Nama</span>
                    </div>
                    <p className="text-gray-900 text-sm font-medium wrap-break-word">
                      {selectedInvalidReport.invalidReport.reporterName || 'Anonim'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium uppercase">Kontak</span>
                    </div>
                    <p className="text-gray-900 text-sm font-medium wrap-break-word">
                      {selectedInvalidReport.invalidReport.kontak || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Waktu Dilaporkan</h4>
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900 text-sm font-medium">
                    {formatDateTime(selectedInvalidReport.invalidReport.createdAt)} WIB
                  </p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Alasan</h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 min-w-0">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word min-w-0 overflow-hidden">
                      {selectedInvalidReport.invalidReport.reason}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                ID: {selectedInvalidReport.invalidReport.id.substring(0, 8)}...
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    deleteInvalidReport(selectedInvalidReport.invalidReport.id);
                    setSelectedInvalidReport(null);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus
                </button>
                <button
                  onClick={() => setSelectedInvalidReport(null)}
                  className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
