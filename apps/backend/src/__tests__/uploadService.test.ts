// File storage: works with AWS S3 or any S3-compatible store (Cloudflare R2),
// and staff ID documents are kept PRIVATE — the database only ever holds an
// s3:// reference, and clients get short-lived signed links.

const mockSend = jest.fn();
const mockS3ClientCtor = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: function S3Client(this: { send: unknown }, config: unknown) {
    mockS3ClientCtor(config);
    this.send = mockSend;
  },
  PutObjectCommand: function PutObjectCommand(
    this: { kind: string; input: unknown },
    input: unknown,
  ) {
    this.kind = 'put';
    this.input = input;
  },
  GetObjectCommand: function GetObjectCommand(
    this: { kind: string; input: unknown },
    input: unknown,
  ) {
    this.kind = 'get';
    this.input = input;
  },
}));

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

import {
  isPrivateDocumentRef,
  parsePrivateDocumentRef,
  publicObjectUrl,
  resetS3ClientForTests,
  resolveDocumentUrl,
  uploadProfilePhoto,
  uploadStaffVerificationDocument,
} from '../services/uploadService';

const KEYS = [
  'AWS_S3_BUCKET',
  'AWS_S3_PRIVATE_BUCKET',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_ENDPOINT',
  'S3_PUBLIC_BASE_URL',
] as const;
const saved: Record<string, string | undefined> = {};

function configure(extra: Partial<Record<(typeof KEYS)[number], string>> = {}) {
  process.env.AWS_S3_BUCKET = 'bfam-public';
  process.env.AWS_REGION = 'ap-south-1';
  process.env.AWS_ACCESS_KEY_ID = 'id';
  process.env.AWS_SECRET_ACCESS_KEY = 'secret';
  for (const [k, v] of Object.entries(extra)) process.env[k] = v;
}

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  resetS3ClientForTests();
  mockSend.mockResolvedValue({});
  mockGetSignedUrl.mockResolvedValue('https://signed.example/doc?sig=abc');
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('publicObjectUrl', () => {
  it('defaults to the AWS S3 address', () => {
    expect(publicObjectUrl('b', 'ap-south-1', 'p/x.jpg', {})).toBe(
      'https://b.s3.ap-south-1.amazonaws.com/p/x.jpg',
    );
  });

  it('uses S3_PUBLIC_BASE_URL when set (trailing slash tolerated)', () => {
    expect(
      publicObjectUrl('b', 'auto', 'p/x.jpg', { S3_PUBLIC_BASE_URL: 'https://pub-1.r2.dev/' }),
    ).toBe('https://pub-1.r2.dev/p/x.jpg');
  });

  it('refuses to guess an address for a custom S3-compatible endpoint', () => {
    expect(() =>
      publicObjectUrl('b', 'auto', 'p/x.jpg', {
        S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      }),
    ).toThrow(/S3_PUBLIC_BASE_URL/);
  });
});

describe('uploadProfilePhoto', () => {
  it('uses plain AWS settings by default', async () => {
    configure();
    const url = await uploadProfilePhoto('user-1', Buffer.from('x'), 'image/png');
    expect(mockS3ClientCtor).toHaveBeenCalledWith({ region: 'ap-south-1' });
    expect(url).toMatch(
      /^https:\/\/bfam-public\.s3\.ap-south-1\.amazonaws\.com\/profile-photos\/user-1\/.+\.png$/,
    );
  });

  it('talks to an S3-compatible endpoint (Cloudflare R2) with path-style addressing', async () => {
    configure({
      AWS_REGION: 'auto',
      S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      S3_PUBLIC_BASE_URL: 'https://pub-1.r2.dev',
    });
    const url = await uploadProfilePhoto('user-1', Buffer.from('x'), 'image/webp');
    expect(mockS3ClientCtor).toHaveBeenCalledWith({
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      forcePathStyle: true,
    });
    expect(url).toMatch(/^https:\/\/pub-1\.r2\.dev\/profile-photos\/user-1\/.+\.webp$/);
    const put = mockSend.mock.calls[0][0];
    expect(put.input).toMatchObject({ Bucket: 'bfam-public', ContentType: 'image/webp' });
  });

  it('rejects unsupported types and an unconfigured server', async () => {
    configure();
    await expect(uploadProfilePhoto('u', Buffer.from('x'), 'image/gif')).rejects.toThrow(
      /Unsupported/,
    );
    for (const k of KEYS) delete process.env[k];
    await expect(uploadProfilePhoto('u', Buffer.from('x'), 'image/png')).rejects.toThrow(
      /not configured/,
    );
  });
});

describe('uploadStaffVerificationDocument (private)', () => {
  it('stores in the PRIVATE bucket and returns an s3:// reference, never a public URL', async () => {
    configure({ AWS_S3_PRIVATE_BUCKET: 'bfam-private' });
    const ref = await uploadStaffVerificationDocument(
      'staff-1',
      Buffer.from('x'),
      'application/pdf',
    );
    expect(ref).toMatch(/^s3:\/\/bfam-private\/staff-verification\/staff-1\/.+\.pdf$/);
    expect(ref).not.toContain('http');
    expect(mockSend.mock.calls[0][0].input).toMatchObject({
      Bucket: 'bfam-private',
      ContentType: 'application/pdf',
    });
  });

  it('falls back to the main bucket when no private bucket is configured', async () => {
    configure();
    const ref = await uploadStaffVerificationDocument('staff-1', Buffer.from('x'), 'image/jpeg');
    expect(ref).toMatch(/^s3:\/\/bfam-public\/staff-verification\/staff-1\//);
  });
});

describe('private document references', () => {
  it('recognises and parses them', () => {
    expect(isPrivateDocumentRef('s3://b/k/x.pdf')).toBe(true);
    expect(isPrivateDocumentRef('https://b.s3.amazonaws.com/k')).toBe(false);
    expect(isPrivateDocumentRef(null)).toBe(false);
    expect(parsePrivateDocumentRef('s3://bucket/staff-verification/u/a.pdf')).toEqual({
      bucket: 'bucket',
      key: 'staff-verification/u/a.pdf',
    });
    expect(parsePrivateDocumentRef('s3://bucket-only')).toBeNull();
    expect(parsePrivateDocumentRef('s3://bucket/')).toBeNull();
  });
});

describe('resolveDocumentUrl', () => {
  it('turns a private reference into a signed link that expires in 15 minutes', async () => {
    configure();
    const url = await resolveDocumentUrl('s3://bfam-private/staff-verification/u/a.pdf');
    expect(url).toBe('https://signed.example/doc?sig=abc');
    const [, command, options] = mockGetSignedUrl.mock.calls[0];
    expect(command.input).toEqual({ Bucket: 'bfam-private', Key: 'staff-verification/u/a.pdf' });
    expect(options).toEqual({ expiresIn: 900 });
  });

  it('passes a legacy public URL and null through untouched', async () => {
    configure();
    expect(await resolveDocumentUrl('https://old.example/doc.pdf')).toBe(
      'https://old.example/doc.pdf',
    );
    expect(await resolveDocumentUrl(null)).toBeNull();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('returns null rather than a broken link when storage is not configured or the reference is malformed', async () => {
    expect(await resolveDocumentUrl('s3://b/k.pdf')).toBeNull(); // unconfigured
    configure();
    expect(await resolveDocumentUrl('s3://nokey')).toBeNull();
  });
});
