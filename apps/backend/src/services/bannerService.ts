import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { BannerNotFoundError } from '../domain/errors';

export interface BannerRow {
  banner_id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// Home Page Carousel (backlog B-6): every banner the player-facing app
// should currently show — active, and (if scheduled) within its
// starts_at/ends_at window — ordered for the carousel to render in.
export async function listActiveBanners(): Promise<BannerRow[]> {
  const now = new Date();
  return sequelize.query<BannerRow>(
    `SELECT * FROM home_banners
     WHERE is_active = TRUE
       AND (starts_at IS NULL OR starts_at <= :now)
       AND (ends_at IS NULL OR ends_at >= :now)
     ORDER BY display_order ASC, created_at ASC`,
    { type: QueryTypes.SELECT, replacements: { now } },
  );
}

// Admin CMS (backlog B-6): every banner regardless of active/scheduling
// state, for the management list.
export async function listAllBanners(): Promise<BannerRow[]> {
  return sequelize.query<BannerRow>(
    'SELECT * FROM home_banners ORDER BY display_order ASC, created_at ASC',
    { type: QueryTypes.SELECT },
  );
}

export interface CreateBannerInput {
  title: string;
  image_url: string;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export async function createBanner(actorUserId: string, input: CreateBannerInput) {
  const bannerId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('home_banners', [
    {
      banner_id: bannerId,
      title: input.title,
      image_url: input.image_url,
      link_url: input.link_url ?? null,
      display_order: input.display_order ?? 0,
      is_active: input.is_active ?? true,
      starts_at: input.starts_at ? new Date(input.starts_at) : null,
      ends_at: input.ends_at ? new Date(input.ends_at) : null,
      created_by: actorUserId,
      created_at: now,
      updated_at: now,
    },
  ]);
  return { banner_id: bannerId };
}

export interface UpdateBannerInput {
  title?: string;
  image_url?: string;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

async function fetchBanner(bannerId: string): Promise<BannerRow | null> {
  const [row] = await sequelize.query<BannerRow>(
    'SELECT * FROM home_banners WHERE banner_id = :bannerId',
    { type: QueryTypes.SELECT, replacements: { bannerId } },
  );
  return row ?? null;
}

export async function updateBanner(bannerId: string, input: UpdateBannerInput) {
  const existing = await fetchBanner(bannerId);
  if (!existing) throw new BannerNotFoundError();

  const values: Record<string, unknown> = { updated_at: new Date() };
  if (input.title !== undefined) values.title = input.title;
  if (input.image_url !== undefined) values.image_url = input.image_url;
  if (input.link_url !== undefined) values.link_url = input.link_url;
  if (input.display_order !== undefined) values.display_order = input.display_order;
  if (input.is_active !== undefined) values.is_active = input.is_active;
  if (input.starts_at !== undefined) {
    values.starts_at = input.starts_at ? new Date(input.starts_at) : null;
  }
  if (input.ends_at !== undefined) {
    values.ends_at = input.ends_at ? new Date(input.ends_at) : null;
  }

  await sequelize.getQueryInterface().bulkUpdate('home_banners', values, { banner_id: bannerId });
  return fetchBanner(bannerId);
}

export async function deleteBanner(bannerId: string) {
  const existing = await fetchBanner(bannerId);
  if (!existing) throw new BannerNotFoundError();
  await sequelize.getQueryInterface().bulkDelete('home_banners', { banner_id: bannerId });
}
