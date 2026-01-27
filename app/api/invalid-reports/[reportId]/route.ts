import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import type { ApiResponse } from '@/lib/types';

/**
 * GET /api/invalid-reports/[reportId]
 * Get invalid reports untuk report tertentu (public access)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const reportIdNum = parseInt(reportId);

    if (isNaN(reportIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Report ID tidak valid' } as ApiResponse,
        { status: 400 }
      );
    }

    // Get invalid reports untuk report tertentu
    const invalidReports = await prisma.invalidReport.findMany({
      where: { reportId: reportIdNum },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: invalidReports,
      count: invalidReports.length
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching invalid reports for report:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data laporan tidak valid' } as ApiResponse,
      { status: 500 }
    );
  }
}
