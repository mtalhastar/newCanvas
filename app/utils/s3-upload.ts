'use server'
import { S3 } from "aws-sdk";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3({
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
  region: process.env.NEXT_PUBLIC_AWS_REGION,
});

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB in bytes

export async function uploadToS3(file: File): Promise<string> {
  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    // Only process if file size exceeds 3MB
    if (file.size > MAX_FILE_SIZE) {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      // Calculate scale factor to reduce file size while maintaining aspect ratio
      const scaleFactor = Math.sqrt(MAX_FILE_SIZE / file.size);
      const newWidth = Math.round((metadata.width || 1000) * scaleFactor);
      const newHeight = Math.round((metadata.height || 1000) * scaleFactor);

      // Process image with sharp, maintaining quality
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
      Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME!,
      Key: filename,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "no-cache",
    };

    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
} 