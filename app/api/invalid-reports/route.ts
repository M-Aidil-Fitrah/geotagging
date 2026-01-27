import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import type { InvalidReportFormInput, ApiResponse, InvalidReportWithReport } from '@/lib/types';

/**
 * POST /api/invalid-reports
 * Submit laporan keberatan (user dapat melaporkan laporan tidak valid)
 */
export async function POST(request: NextRequest) {
  try {
    const body: InvalidReportFormInput = await request.json();
    
    // Validasi input
    if (!body.reportId || !body.reason || body.reason.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Report ID dan alasan wajib diisi' } as ApiResponse,
        { status: 400 }
      );
    }

    // Cek apakah report exists
    const reportExists = await prisma.report.findUnique({
      where: { id: body.reportId }
    });

    if (!reportExists) {
      return NextResponse.json(
        { success: false, error: 'Laporan tidak ditemukan' } as ApiResponse,
        { status: 404 }
      );
    }

    // Create WIB date (UTC+7) untuk konsistensi dengan Report table
    const wibDate = new Date(Date.now() + (7 * 60 * 60 * 1000));

    // Create invalid report dengan WIB timezone
    const invalidReport = await prisma.invalidReport.create({
      data: {
        reportId: body.reportId,
        reason: body.reason.trim(),
        reporterName: body.reporterName?.trim() || null,
        kontak: body.kontak?.trim() || null,
        createdAt: wibDate,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Laporan tidak valid berhasil dikirim',
      data: invalidReport
    } as ApiResponse);

  } catch (error) {
    console.error('Error creating invalid report:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengirim laporan tidak valid' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/invalid-reports
 * Get invalid reports by reportId (public access untuk user bisa cek count)
 * Untuk GET all tanpa filter, require admin token
 * Query params:
 * - reportId: filter by report ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    // If no reportId specified, require admin authentication
    if (!reportId) {
      const token = request.cookies.get('admin-token')?.value;

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Not authenticated' } as ApiResponse,
          { status: 401 }
        );
      }

      const payload = await verifyToken(token);

      if (!payload) {
        return NextResponse.json(
          { success: false, error: 'Invalid token' } as ApiResponse,
          { status: 401 }
        );
      }
    }

    if (reportId) {
      // Get invalid reports untuk report tertentu
      const invalidReports = await prisma.invalidReport.findMany({
        where: { reportId: parseInt(reportId) },
        include: {
          report: {
            include: {
              reviewedBy: {
                select: {
                  id: true,
                  name: true,
                  username: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Add coordinates from PostGIS geometry
      const transformedReports = await Promise.all(invalidReports.map(async (ir) => {
        // Get coordinates from PostGIS using raw query
        const coordsResult = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
          SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
          FROM reports
          WHERE id = ${ir.reportId}
        `;
        const coords = coordsResult[0];
        
        return {
          ...ir,
          report: {
            ...ir.report,
            lat: coords?.lat,
            lng: coords?.lng
          }
        };
      }));

      return NextResponse.json({
        success: true,
        data: transformedReports,
        count: transformedReports.length
      } as ApiResponse<InvalidReportWithReport[]>);
    }

    // Get all invalid reports with report details
    const invalidReports = await prisma.invalidReport.findMany({
      include: {
        report: {
          include: {
            reviewedBy: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add coordinates from PostGIS geometry
    const transformedReports = await Promise.all(invalidReports.map(async (ir) => {
      // Get coordinates from PostGIS using raw query
      const coordsResult = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
        SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
        FROM reports
        WHERE id = ${ir.reportId}
      `;
      const coords = coordsResult[0];
      
      return {
        ...ir,
        report: {
          ...ir.report,
          lat: coords?.lat,
          lng: coords?.lng
        }
      };
    }));

    return NextResponse.json({
      success: true,
      data: transformedReports,
      count: transformedReports.length
    } as ApiResponse<InvalidReportWithReport[]>);

  } catch (error) {
    console.error('Error fetching invalid reports:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data laporan tidak valid' } as ApiResponse,
      { status: 500 }
    );
  }
}
