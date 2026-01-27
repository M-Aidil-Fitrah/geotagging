import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ReportStatus } from '@prisma/client';
import { getReportsWithCoordinates } from '@/lib/postgis-helper';

// GET /api/reports - Get all approved reports (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeAll = searchParams.get('includeAll') === 'true';

    // Default: hanya tampilkan approved reports untuk public
    // includeAll=true: tampilkan semua KECUALI REJECTED (untuk user dashboard/laporan)
    // Rejected reports hanya ditampilkan di admin
    let statusFilter: string | undefined;
    
    if (includeAll) {
      // For user views - exclude REJECTED, show PENDING and APPROVED only
      statusFilter = undefined; // Will be filtered below
    } else if (status && Object.values(ReportStatus).includes(status as ReportStatus)) {
      statusFilter = status;
    } else {
      statusFilter = ReportStatus.APPROVED;
    }

    // Get reports dengan koordinat dari PostGIS
    const reports = await getReportsWithCoordinates(
      statusFilter ? { status: statusFilter } : undefined
    );

    // Filter out REJECTED reports for includeAll (user views)
    const filteredReports = includeAll 
      ? reports.filter(r => r.status !== 'REJECTED')
      : reports;

    // Get reviewedBy data untuk setiap report
    const reportIds = filteredReports.map(r => r.reviewedById).filter((id): id is number => id !== null);
    const users = reportIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reportIds } },
          select: { id: true, name: true, username: true },
        })
      : [];

    const usersMap = new Map(users.map(u => [u.id, u]));

    // Get invalid reports count per report
    const invalidReportCounts = await prisma.invalidReport.groupBy({
      by: ['reportId'],
      _count: {
        id: true
      }
    });

    const invalidReportCountsMap = new Map(
      invalidReportCounts.map((irc: { reportId: number; _count: { id: number } }) => [irc.reportId, irc._count.id])
    );

    // Transform data untuk compatibility dengan frontend
    const transformedReports = filteredReports.map((report) => ({
      ...report,
      timestamp: getRelativeTime(report.submittedAt),
      reviewedBy: report.reviewedById ? usersMap.get(report.reviewedById) || null : null,
      invalidReportsCount: invalidReportCountsMap.get(report.id) || undefined,
    }));

    return NextResponse.json({
      success: true,
      reports: transformedReports,
      count: transformedReports.length,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// POST /api/reports - Create new report (public)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      lat,
      lng,
      namaPelapor,
      kontak,
      desaKecamatan,
      namaObjek,
      jenisKerusakan,
      tingkatKerusakan,
      keteranganKerusakan,
      fotoLokasi = [],
    } = body;

    // Validasi required fields
    if (!lat || !lng || !namaPelapor || !kontak || !desaKecamatan || !namaObjek || 
        !jenisKerusakan || !tingkatKerusakan || !keteranganKerusakan) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validasi tingkatKerusakan enum
    if (!['Ringan', 'Sedang', 'Berat'].includes(tingkatKerusakan)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tingkatKerusakan value' },
        { status: 400 }
      );
    }

    // Create new report with PostGIS geometry
    const { Prisma } = await import('@prisma/client');
    
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO reports (
          location,
          "namaPelapor",
          kontak,
          "desaKecamatan",
          "namaObjek",
          "jenisKerusakan",
          "tingkatKerusakan",
          "keteranganKerusakan",
          "fotoLokasi",
          status,
          "statusTangani",
          "autoApproved",
          "submittedAt",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326),
          ${namaPelapor},
          ${kontak},
          ${desaKecamatan},
          ${namaObjek},
          ${jenisKerusakan},
          ${tingkatKerusakan}::"TingkatKerusakan",
          ${keteranganKerusakan},
          ${fotoLokasi}::text[],
          'PENDING'::"ReportStatus",
          'BELUM_DITANGANI'::"StatusTangani",
          false,
          NOW(),
          NOW(),
          NOW()
        )
      `
    );

    // Get created report
    const reports = await prisma.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM reports ORDER BY id DESC LIMIT 1`
    );

    const createdReport = await prisma.$queryRaw<Array<{
      id: number;
      lat: number;
      lng: number;
      namaPelapor: string;
      kontak: string;
      desaKecamatan: string;
      namaObjek: string;
      jenisKerusakan: string;
      tingkatKerusakan: string;
      fotoLokasi: string[];
      keteranganKerusakan: string;
      status: string;
      submittedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    }>>(
      Prisma.sql`
        SELECT 
          id,
          ST_Y(location::geometry) as lat,
          ST_X(location::geometry) as lng,
          "namaPelapor",
          kontak,
          "desaKecamatan",
          "namaObjek",
          "jenisKerusakan",
          "tingkatKerusakan"::text as "tingkatKerusakan",
          "fotoLokasi",
          "keteranganKerusakan",
          status::text as status,
          "submittedAt",
          "createdAt",
          "updatedAt"
        FROM reports
        WHERE id = ${reports[0].id}
      `
    );

    return NextResponse.json({
      success: true,
      message: 'Laporan berhasil dikirim dan menunggu verifikasi admin',
      data: createdReport[0],
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

// Helper functions
function getRelativeTime(date: Date | string): string {
  // Get current time and convert to WIB (UTC+7)
  const now = new Date();
  const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  // submittedDate from database is ALREADY in WIB - do NOT add 7 hours again!
  const submittedDate = new Date(date);
  
  // Calculate difference: current WIB time - submitted WIB time
  const diffInMs = wibNow.getTime() - submittedDate.getTime();
  
  // Handle future dates (timezone issues)
  if (diffInMs < 0) {
    return 'baru saja';
  }
  
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'baru saja';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} menit lalu`;
  } else if (diffInHours < 24) {
    return `${diffInHours} jam lalu`;
  } else if (diffInDays === 1) {
    return 'kemarin';
  } else {
    return `${diffInDays} hari lalu`;
  }
}
