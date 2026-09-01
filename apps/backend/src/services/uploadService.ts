import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Profile photo storage (Module 2.2). See the S3 setup walkthrough for what
// bucket/IAM policy this expects — in short: a bucket dedicated to (or a
// prefixed folder within) BFAM's uploads, with public-read only on the
// `profile-photos/` prefix, and an IAM user scoped to PutObject on that
// prefix only.
export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY,
  );
}

let cachedClient: S3Client | null = null;
function getS3Client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({ region: process.env.AWS_REGION });
  }
  return cachedClient;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isAllowedImageContentType(contentType: string): boolean {
  return contentType in ALLOWED_CONTENT_TYPES;
}

/**
 * Uploads a profile photo buffer to S3 under `profile-photos/{userId}/` and
 * returns its public URL. Throws if S3 isn't configured — callers should
 * check `isS3Configured()` first to return a clean 501 instead of a 500.
 */
export async function uploadProfilePhoto(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured on this server');
  }
  const extension = ALLOWED_CONTENT_TYPES[contentType];
  if (!extension) {
    throw new Error(`Unsupported image content type: ${contentType}`);
  }

  const bucket = process.env.AWS_S3_BUCKET as string;
  const region = process.env.AWS_REGION as string;
  const key = `profile-photos/${userId}/${randomUUID()}.${extension}`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
