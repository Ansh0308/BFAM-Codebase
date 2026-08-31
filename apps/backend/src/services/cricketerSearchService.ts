// Proxies GET /cricketers/search so no third-party API key ever ships in
// the mobile bundle (Stack §9.4). Only favorite_cricketer_name /
// favorite_cricketer_external_id are ever persisted by callers of this
// service.
//
// Primary source (2026-08-30): the local `cricketers` table, seeded from
// Cricsheet's openly-licensed player registry (see
// src/seed/cricketersSeed.ts) — real "all-time" player coverage (18k+
// names), which no live API offers. If that table hasn't been seeded yet
// (e.g. a fresh dev environment), falls back to the previous API-based
// chain: RAPIDAPI_KEY -> CRICKET_API_KEY -> the built-in fixture list, so
// nothing breaks before the seed step is run.
//
// Photos: the local table has none of its own (Cricsheet doesn't provide
// them) — RapidAPI's rosters are used as a best-effort photo overlay,
// matched by normalized name, when RAPIDAPI_KEY is configured. No match ->
// null photo_url -> the mobile app's icon-avatar fallback renders instead.
//
// Jersey numbers: `cricketers.jersey_number` is a small, honestly-curated
// subset (no comprehensive open jersey-number database exists) meant to be
// expanded over time — see src/seed/data/curated-jersey-numbers.json.

import { QueryTypes } from 'sequelize';
import type { Cricketer } from '@bfam/shared-types';
import { sequelize } from '../config/sequelize';

// DEV/TEST-ONLY fixture data — used only when the `cricketers` table hasn't
// been seeded AND neither RAPIDAPI_KEY nor CRICKET_API_KEY is set.
interface FixtureCricketer extends Cricketer {
  jersey_number: string;
}

const FIXTURE_CRICKETERS: FixtureCricketer[] = [
  {
    name: 'Virat Kohli',
    external_id: 'fixture-virat-kohli',
    photo_url: 'https://h.cricapi.com/img/players/34102.jpg',
    jersey_number: '18',
  },
  {
    name: 'Rohit Sharma',
    external_id: 'fixture-rohit-sharma',
    photo_url: 'https://h.cricapi.com/img/players/8917.jpg',
    jersey_number: '45',
  },
  {
    name: 'MS Dhoni',
    external_id: 'fixture-ms-dhoni',
    photo_url: 'https://h.cricapi.com/img/players/9204.jpg',
    jersey_number: '7',
  },
  {
    name: 'Jasprit Bumrah',
    external_id: 'fixture-jasprit-bumrah',
    photo_url: 'https://h.cricapi.com/img/players/32210.jpg',
    jersey_number: '93',
  },
  {
    name: 'Babar Azam',
    external_id: 'fixture-babar-azam',
    photo_url: 'https://h.cricapi.com/img/players/38335.jpg',
    jersey_number: '56',
  },
];

function searchFixtures(query: string): Cricketer[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return FIXTURE_CRICKETERS;
  return FIXTURE_CRICKETERS.filter((c) => c.name.toLowerCase().includes(needle));
}

interface CricApiPlayer {
  id: string;
  name: string;
  playerImg?: string;
}

interface CricApiSearchResponse {
  status: string;
  data?: CricApiPlayer[];
}

async function searchCricApi(query: string, apiKey: string): Promise<Cricketer[]> {
  const url = new URL('https://api.cricapi.com/v1/players');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('offset', '0');
  url.searchParams.set('search', query);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CricAPI request failed: ${response.status}`);
  }
  const body = (await response.json()) as CricApiSearchResponse;
  if (body.status !== 'success' || !Array.isArray(body.data)) {
    throw new Error('CricAPI returned an unexpected response shape');
  }
  return body.data.map((player) => ({
    name: player.name,
    external_id: player.id,
    photo_url: player.playerImg ?? null,
  }));
}

// Curated national-team ids on RapidAPI's "cricket-api-free-data" roster
// endpoint — discovered by sampling teamid=1..15 (2026-08-30), since the
// free plan doesn't document/expose a team-id lookup of its own. Covers
// India + the other teams a BFAM (India-first) user base is most likely to
// search for a favorite cricketer from.
const RAPIDAPI_TEAM_IDS = [2, 3, 4, 9, 11, 13]; // India, Pakistan, Australia, England, South Africa, New Zealand

interface RapidApiPlayer {
  id: string;
  slug: string;
  title: string;
  image?: string;
}

interface RapidApiRosterResponse {
  status: string;
  response?: RapidApiPlayer[];
}

const RAPIDAPI_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — keep request volume low on the free tier.
let rapidApiCache: { fetchedAt: number; players: Cricketer[] } | null = null;

async function fetchRapidApiRoster(
  teamId: number,
  apiKey: string,
  apiHost: string,
): Promise<Cricketer[]> {
  const url = `https://${apiHost}/cricket-players?teamid=${teamId}`;
  const response = await fetch(url, {
    headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost },
  });
  if (!response.ok) {
    throw new Error(`RapidAPI cricket-players request failed: ${response.status}`);
  }
  const body = (await response.json()) as RapidApiRosterResponse;
  if (body.status !== 'success' || !Array.isArray(body.response)) {
    throw new Error('RapidAPI returned an unexpected response shape');
  }
  return body.response.map((player) => ({
    name: player.title,
    external_id: `rapidapi-${player.id}`,
    photo_url: player.image ?? null,
  }));
}

async function getRapidApiRoster(apiKey: string, apiHost: string): Promise<Cricketer[]> {
  const isFresh = rapidApiCache && Date.now() - rapidApiCache.fetchedAt < RAPIDAPI_CACHE_TTL_MS;
  if (isFresh) return rapidApiCache!.players;

  const rosters = await Promise.all(
    RAPIDAPI_TEAM_IDS.map((teamId) => fetchRapidApiRoster(teamId, apiKey, apiHost)),
  );
  const byExternalId = new Map<string, Cricketer>();
  for (const player of rosters.flat()) {
    byExternalId.set(player.external_id, player);
  }
  rapidApiCache = { fetchedAt: Date.now(), players: Array.from(byExternalId.values()) };
  return rapidApiCache.players;
}

function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
}

/** Best-effort photo lookup by name — never throws; a failed/unconfigured
 * RapidAPI just means no photos get attached. */
async function getPhotoMapByName(): Promise<Map<string, string>> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return new Map();
  try {
    const apiHost = process.env.RAPIDAPI_HOST || 'cricket-api-free-data.p.rapidapi.com';
    const roster = await getRapidApiRoster(apiKey, apiHost);
    const map = new Map<string, string>();
    for (const player of roster) {
      if (player.photo_url) map.set(normalizeNameForMatch(player.name), player.photo_url);
    }
    return map;
  } catch {
    return new Map();
  }
}

interface CricketerRow {
  external_id: string;
  display_name: string;
}

async function countSeededCricketers(): Promise<number> {
  const [row] = await sequelize.query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM cricketers', {
    type: QueryTypes.SELECT,
  });
  return Number(row?.cnt ?? 0);
}

async function searchLocalCricketers(query: string): Promise<Cricketer[]> {
  const needle = query.trim();
  const rows = await sequelize.query<CricketerRow>(
    needle
      ? 'SELECT external_id, display_name FROM cricketers WHERE display_name LIKE :needle ORDER BY display_name LIMIT 20'
      : 'SELECT external_id, display_name FROM cricketers ORDER BY display_name LIMIT 20',
    {
      type: QueryTypes.SELECT,
      replacements: needle ? { needle: `%${needle}%` } : {},
    },
  );

  const photoByName = await getPhotoMapByName();
  return rows.map((row) => ({
    name: row.display_name,
    external_id: row.external_id,
    photo_url: photoByName.get(normalizeNameForMatch(row.display_name)) ?? null,
  }));
}

export async function searchCricketers(query: string): Promise<Cricketer[]> {
  const seededCount = await countSeededCricketers();
  if (seededCount > 0) {
    return searchLocalCricketers(query);
  }

  // Not seeded yet — fall back to the previous API-based chain so dev/test
  // still works without running `npm run db:seed:cricketers` first.
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || 'cricket-api-free-data.p.rapidapi.com';
  if (rapidApiKey) {
    const roster = await getRapidApiRoster(rapidApiKey, rapidApiHost);
    const needle = query.trim().toLowerCase();
    return needle ? roster.filter((c) => c.name.toLowerCase().includes(needle)) : roster;
  }

  const cricApiKey = process.env.CRICKET_API_KEY;
  if (cricApiKey) {
    return searchCricApi(query, cricApiKey);
  }

  return searchFixtures(query);
}

/**
 * Looks up a jersey number for a favorite-cricketer external_id, if known.
 * Checks the curated `cricketers.jersey_number` column first, falling back
 * to the dev/test fixture list. Returns null when nothing is known — the
 * BFAM ID allocator just allocates sequentially as before in that case.
 */
export async function lookupJerseyNumber(
  externalId: string | null | undefined,
): Promise<string | null> {
  if (!externalId) return null;

  if (externalId.startsWith('cricsheet-')) {
    const [row] = await sequelize.query<{ jersey_number: string | null }>(
      'SELECT jersey_number FROM cricketers WHERE external_id = :externalId LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { externalId } },
    );
    return row?.jersey_number ?? null;
  }

  const match = FIXTURE_CRICKETERS.find((c) => c.external_id === externalId);
  return match?.jersey_number ?? null;
}

// Test-only: clears the RapidAPI roster cache between tests.
export function _clearRapidApiCacheForTests() {
  rapidApiCache = null;
}
