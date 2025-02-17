'use server'
import { S3 } from "aws-sdk";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

interface CanvasState {
  images: Array<{
    id: string;
    url: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>;
  shapes: Array<{
    id: string;
    type: "rectangle" | "circle" | "line" | "arrow" | "star" | "triangle";
    x: number;
    y: number;
    width: number;
    height: number;
    points?: number[];
    color: string;
    strokeWidth: number;
  }>;
  lines: Array<{
    id: string;
    points: number[];
    color: string;
    width: number;
  }>;
  createdAt?: string;
}

const s3 = new S3({
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
  region: process.env.NEXT_PUBLIC_AWS_REGION,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Client-side upload handler
export async function handleClientUpload(file: File | { arrayBuffer: () => Promise<ArrayBuffer>; type: string; size: number; name: string }): Promise<string> {
  try {
    // Convert file to FormData
    const formData = new FormData();
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });
    formData.append('file', blob, file.name);

    // Make a POST request to our server action endpoint
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// Server-side upload function
export async function uploadToS3(formData: FormData): Promise<string> {
  'use server'
  
  if (!process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || 
      !process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || 
      !process.env.NEXT_PUBLIC_AWS_REGION || 
      !process.env.NEXT_PUBLIC_AWS_BUCKET_NAME) {
    throw new Error('AWS credentials are not properly configured');
  }

  try {
    const file = formData.get('file') as File;
    if (!file) {
      throw new Error('No file provided');
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    
    // Only process if file size exceeds 5MB
    if (file.size > MAX_FILE_SIZE) {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image file');
      }
      
      const scaleFactor = Math.sqrt(MAX_FILE_SIZE / file.size);
      const newWidth = Math.round(metadata.width * scaleFactor);
      const newHeight = Math.round(metadata.height * scaleFactor);

      buffer = await image
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();
    }

    const fileExtension = file.name.split('.').pop() || 'png';
    const filename = `${Date.now()}-${uuidv4()}.${fileExtension}`;

    const params = {
      Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "no-cache",
    };

    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    throw new Error('Failed to upload image');
  }
}

export async function createRoomBackup(roomId: string, canvasState: CanvasState): Promise<void> {
  try {
    const params = {
      Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME!,
      Key: `room-backups/${roomId}.json`,
      Body: JSON.stringify(canvasState),
      ContentType: 'application/json',
    };

    await s3.putObject(params).promise();
    console.log(`Created backup for room ${roomId}`);
  } catch (error) {
    console.error('Error creating room backup:', error);
    throw error;
  }
}

export async function loadRoomBackup(roomId: string): Promise<CanvasState | null> {
  try {
    const params = {
      Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME!,
      Key: `room-backups/${roomId}.json`,
    };

    const data = await s3.getObject(params).promise();
    if (!data.Body) {
      throw new Error('No backup data found');
    }
    
    return JSON.parse(data.Body.toString()) as CanvasState;
  } catch (error) {
    if ((error as { code?: string }).code === 'NoSuchKey') {
      return null;
    }
    console.error('Error loading room backup:', error);
    throw error;
  }
}

export async function checkRoomBackupExists(roomId: string): Promise<boolean> {
  try {
    const params = {
      Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME!,
      Key: `room-backups/${roomId}.json`,
    };

    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'NotFound') {
      return false;
    }
    console.error('Error checking room backup:', error);
    throw error;
  }
} 