import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3 } from '@/app/utils/s3-upload';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const url = await uploadToS3(formData);
    
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('Error in upload route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
} 