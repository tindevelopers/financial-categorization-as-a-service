import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { getWasabiService } from '@/lib/storage/WasabiArchiveService';

/**
 * Cron job to archive documents older than 90 days to Wasabi S3
 * Run daily via Vercel Cron
 * 
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/archive-old-documents",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const wasabiService = getWasabiService();

    // Get documents eligible for archival (hot storage, older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: documents, error: docError } = await supabase
      .from('financial_documents')
      .select('id, user_id, original_filename, file_size, created_at')
      .eq('storage_tier', 'hot')
      .lt('created_at', ninetyDaysAgo.toISOString())
      .limit(100); // Process 100 documents per run

    if (docError) {
      throw new Error(`Failed to fetch documents: ${docError.message}`);
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        archived: 0,
        message: 'No documents to archive',
      });
    }

    // Archive each document
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const doc of documents) {
      try {
        const result = await wasabiService.archiveDocument(doc.id);
        
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${doc.original_filename}: ${result.error}`);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${doc.original_filename}: ${error.message}`);
      }
    }

    // Log summary
    console.log(`Archive job completed:`, results);

    return NextResponse.json({
      success: true,
      archived: results.success,
      failed: results.failed,
      total_processed: documents.length,
      errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined, // Max 10 errors
    });

  } catch (error: any) {
    console.error('Archive cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}

