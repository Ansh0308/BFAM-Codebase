// A staff member's ID is personal data. The database holds only a private
// s3:// reference; whatever the API returns must be a short-lived signed link
// (or the legacy public URL, unchanged) — never the raw reference.

const OWNER = 'aaaaaaaa-0000-4000-8000-002801';
const STAFF = 'aaaaaaaa-0000-4000-8000-002802';
const TURF = 'bbbbbbbb-0000-4000-8000-002803';

let rows: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('FROM turfs WHERE turf_id')) {
        return r.turfId === TURF ? [{ turf_id: TURF, owner_id: OWNER }] : [];
      }
      if (sql.includes('FROM turf_staff_assignments tsa')) return rows;
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

// Keep the real resolve logic out of this test (it is covered in
// uploadService.test.ts); what matters here is that the API applies it.
jest.mock('../services/uploadService', () => ({
  isS3Configured: () => true,
  isAllowedVerificationDocumentContentType: () => true,
  uploadStaffVerificationDocument: jest.fn(),
  uploadProfilePhoto: jest.fn(),
  isAllowedImageContentType: () => true,
  resolveDocumentUrl: async (stored: string | null) =>
    stored && stored.startsWith('s3://')
      ? `https://signed.example/${stored.slice(5)}?sig=1`
      : stored,
}));

import request from 'supertest';
import app from '../app';

async function token(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('staff verification documents are never exposed as raw private references', () => {
  beforeEach(() => {
    rows = [
      {
        assignment_id: 'a1',
        turf_id: TURF,
        staff_user_id: STAFF,
        verification_status: 'PENDING',
        verification_document_url: 's3://bfam-private/staff-verification/u/id.pdf',
        phone_number: '+919999999999',
      },
      {
        assignment_id: 'a2',
        turf_id: TURF,
        staff_user_id: 'other',
        verification_status: 'PENDING',
        verification_document_url: 'https://legacy.example/old.pdf',
        phone_number: '+918888888888',
      },
      {
        assignment_id: 'a3',
        turf_id: TURF,
        staff_user_id: 'third',
        verification_status: 'PENDING',
        verification_document_url: null,
        phone_number: '+917777777777',
      },
    ];
  });

  it("gives the owner a signed link in the turf's staff list", async () => {
    const res = await request(app)
      .get(`/owner/turfs/${TURF}/staff`)
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);
    expect(res.status).toBe(200);
    const urls = res.body.results.map(
      (r: { verification_document_url: string | null }) => r.verification_document_url,
    );
    expect(urls).toEqual([
      'https://signed.example/bfam-private/staff-verification/u/id.pdf?sig=1',
      'https://legacy.example/old.pdf',
      null,
    ]);
    expect(JSON.stringify(res.body)).not.toContain('s3://');
  });

  it('gives the staff member a signed link for their own assignment too', async () => {
    const res = await request(app)
      .get('/staff/assignments')
      .set('Authorization', `Bearer ${await token(STAFF, 'TURF_STAFF')}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('s3://');
    expect(res.body.results[0].verification_document_url).toContain('signed.example');
  });
});
