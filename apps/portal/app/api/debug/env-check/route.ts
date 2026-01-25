import { NextResponse } from 'next/server'

export async function GET() {
  const envCheck = {
    googleCloudProjectId: {
      exists: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      value: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'SET' : 'NOT SET',
      length: process.env.GOOGLE_CLOUD_PROJECT_ID?.length || 0,
    },
    googleDocumentAIProcessorId: {
      exists: !!process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
      value: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID ? 'SET' : 'NOT SET',
      length: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.length || 0,
    },
    googleApplicationCredentialsJSON: {
      exists: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      value: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'SET (base64)' : 'NOT SET',
      length: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0,
    },
    googleApplicationCredentials: {
      exists: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      value: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET',
    },
    nodeEnv: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    cwd: process.cwd(),
  }

  // Test OCR configuration
  let ocrCheck: any = {}
  try {
    const { verifyOCRSource } = await import('@/lib/ocr/google-document-ai')
    ocrCheck = verifyOCRSource()
  } catch (error: any) {
    ocrCheck = { error: error.message }
  }

  return NextResponse.json({
    envCheck,
    ocrCheck,
    timestamp: new Date().toISOString(),
  })
}
