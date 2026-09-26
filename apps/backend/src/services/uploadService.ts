import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// File storage (profile photos, staff verification documents). Speaks the S3
// API, so it works with AWS S3 or any S3-compatible store — notably Cloudflare
// R2, which has a generous free tier and no download fees.
//
//   AWS_S3_BUCKET            bucket for PUBLIC files (profile photos)
//   AWS_S3_PRIVATE_BUCKET    bucket for PRIVATE files (staff ID documents);
//                            defaults to AWS_S3_BUCKET, but a separate,
//                            non-public bucket is strongly recommended
//   AWS_REGION               "auto" for Cloudflare R2
//   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
//   S3_ENDPOINT              only for non-AWS stores, e.g.
//                            https://<account>.r2.cloudflarestorage.com
//   S3_PUBLIC_BASE_URL       where public files are served from, e.g.
//                            https://pub-xxxx.r2.dev or a custom domain;
//                            required when S3_ENDPOINT is set
//
// Bucket layout / IAM for AWS S3: public-read only on the `profile-photos/`
// prefix; an IAM user scoped to PutObject/GetObject on the prefixes it needs.
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
    const endpoint = process.env.S3_ENDPOINT?.trim();
    cachedClient = new S3Client({
      region: process.env.AWS_REGION,
      // Non-AWS stores address buckets by path, not by <bucket>.<host>.
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }
  return cachedClient;
}

// Test hook: drop the cached client so a changed environment takes effect.
export function resetS3ClientForTests() {
  cachedClient = null;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isAllowedImageContentType(contentType: string): boolean {
  return contentType in ALLOWED_CONTENT_TYPES;
}

// The URL a browser/app uses to fetch a PUBLIC object.
export function publicObjectUrl(
  bucket: string,
  region: string,
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const base = env.S3_PUBLIC_BASE_URL?.trim();
  if (base) return `${base.replace(/\/+$/, '')}/${key}`;
  if (env.S3_ENDPOINT?.trim()) {
    // A custom S3-compatible store has no AWS-style default address.
    throw new Error('S3_PUBLIC_BASE_URL must be set when S3_ENDPOINT is set');
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Uploads a profile photo buffer under `profile-photos/{userId}/` and returns
 * its public URL. Throws if storage isn't configured — callers should check
 * `isS3Configured()` first to return a clean 501 instead of a 500.
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

  return publicObjectUrl(bucket, region, key);
}

// Staff Verification document upload (module 2.12, PRD §32.14) — under its own
// prefix and with PDF also allowed (ID documents are frequently scanned as
// PDFs, not just images).
const VERIFICATION_DOC_CONTENT_TYPES: Record<string, string> = {
  ...ALLOWED_CONTENT_TYPES,
  'application/pdf': 'pdf',
};

export function isAllowedVerificationDocumentContentType(contentType: string): boolean {
  return contentType in VERIFICATION_DOC_CONTENT_TYPES;
}

const PRIVATE_REF_PREFIX = 's3://';
const DOCUMENT_LINK_TTL_SECONDS = 15 * 60;

export function privateBucketName(env: NodeJS.ProcessEnv = process.env): string {
  return (env.AWS_S3_PRIVATE_BUCKET?.trim() || env.AWS_S3_BUCKET) as string;
}

// A staff ID is personal data: it is stored PRIVATELY and the database keeps
// only an `s3://bucket/key` reference — never a public link. The owner who
// reviews it gets a short-lived signed link (see resolveDocumentUrl).
export async function uploadStaffVerificationDocument(
  staffUserId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured on this server');
  }
  const extension = VERIFICATION_DOC_CONTENT_TYPES[contentType];
  if (!extension) {
    throw new Error(`Unsupported document content type: ${contentType}`);
  }

  const bucket = privateBucketName();
  const key = `staff-verification/${staffUserId}/${randomUUID()}.${extension}`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${PRIVATE_REF_PREFIX}${bucket}/${key}`;
}

export function isPrivateDocumentRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(PRIVATE_REF_PREFIX);
}

export function parsePrivateDocumentRef(ref: string): { bucket: string; key: string } | null {
  const rest = ref.slice(PRIVATE_REF_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

// What the API hands to clients for a stored document: a private reference is
// swapped for a link that works for 15 minutes; a legacy public https URL (or
// null) passes through unchanged.
export async function resolveDocumentUrl(stored: string | null): Promise<string | null> {
  if (!isPrivateDocumentRef(stored)) return stored;
  const parsed = parsePrivateDocumentRef(stored);
  if (!parsed || !isS3Configured()) return null;
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
    { expiresIn: DOCUMENT_LINK_TTL_SECONDS },
  );
}
