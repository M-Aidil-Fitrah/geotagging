import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ReportStatus } from '@prisma/client';
import { verifyToken } from '@/lib/jwt';
import { getReportsWithCoordinates } from '@/lib/postgis-helper';

// GET /api/admin/reports - Get all reports with all statuses (admin only)
export async function GET(request: NextRequest) {
  try {
    // Verify JWT token
    const token = request.cookies.get('admin-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // REMOVED PAGINATION - Get all reports without limit
    // const page = parseInt(searchParams.get('page') || '1');
    // const limit = parseInt(searchParams.get('limit') || '50');

    // Get ALL reports dengan koordinat dari PostGIS
    const allReports = await getReportsWithCoordinates(
      status && Object.values(ReportStatus).includes(status as ReportStatus)
        ? { status }
        : undefined
    );

    const totalCount = allReports.length;

    // Get reviewedBy data untuk setiap report
    const reportIds = allReports
      .map(r => r.reviewedById)
      .filter((id): id is number => id !== null);
    
    const users = reportIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reportIds } },
          select: { id: true, name: true, username: true },
        })
      : [];

    const usersMap = new Map(users.map(u => [u.id, u]));

    // Get invalid reports counts for all reports
    const invalidReportsCounts = await prisma.invalidReport.groupBy({
      by: ['reportId'],
      _count: {
        id: true,
      },
    });
    const invalidReportsCountMap = new Map(
      invalidReportsCounts.map(item => [item.reportId, item._count.id])
    );

    // Transform data dengan reviewedBy dan invalidReportsCount
    const transformedReports = allReports.map((report) => ({
      ...report,
      reviewedBy: report.reviewedById ? usersMap.get(report.reviewedById) || null : null,
      invalidReportsCount: invalidReportsCountMap.get(report.id) || 0,
    }));

    // Get counts by status
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      prisma.report.count({ where: { status: ReportStatus.APPROVED } }),
      prisma.report.count({ where: { status: ReportStatus.REJECTED } }),
    ]);

    return NextResponse.json({
      success: true,
      reports: transformedReports,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
        totalDisplayed: totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching admin reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
