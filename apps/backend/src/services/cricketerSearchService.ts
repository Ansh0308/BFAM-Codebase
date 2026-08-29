// Proxies GET /cricketers/search to CricAPI (https://www.cricapi.com) so the
// CRICKET_API_KEY never ships in the mobile bundle (Stack §9.4). Only
// favorite_cricketer_name / favorite_cricketer_external_id are ever
// persisted by callers of this service — no local cricketer table.
//
// If CRICKET_API_KEY is not configured (dev/test environments), falls back
// to a small built-in fixture list filtered by substring match, so the
// search screen and its tests work without a real API key. This fallback is
// DEV/TEST-ONLY — production must have CRICKET_API_KEY set to hit the real
// API.

import type { Cricketer } from '@bfam/shared-types';

// DEV/TEST-ONLY fixture data — used only when CRICKET_API_KEY is unset.
const FIXTURE_CRICKETERS: Cricketer[] = [
  {
    name: 'Virat Kohli',
    external_id: 'fixture-virat-kohli',
    photo_url: 'https://h.cricapi.com/img/players/34102.jpg',
  },
  {
    name: 'Rohit Sharma',
    external_id: 'fixture-rohit-sharma',
    photo_url: 'https://h.cricapi.com/img/players/8917.jpg',
  },
  {
    name: 'MS Dhoni',
    external_id: 'fixture-ms-dhoni',
    photo_url: 'https://h.cricapi.com/img/players/9204.jpg',
  },
  {
    name: 'Jasprit Bumrah',
    external_id: 'fixture-jasprit-bumrah',
    photo_url: 'https://h.cricapi.com/img/players/32210.jpg',
  },
  {
    name: 'Babar Azam',
    external_id: 'fixture-babar-azam',
    photo_url: 'https://h.cricapi.com/img/players/38335.jpg',
  },
  {
    name: 'Steve Smith',
    external_id: 'fixture-steve-smith',
    photo_url: 'https://h.cricapi.com/img/players/6636.jpg',
  },
  {
    name: 'Ben Stokes',
    external_id: 'fixture-ben-stokes',
    photo_url: 'https://h.cricapi.com/img/players/9147.jpg',
  },
  {
    name: 'Kane Williamson',
    external_id: 'fixture-kane-williamson',
    photo_url: 'https://h.cricapi.com/img/players/8917.jpg',
  },
  {
    name: 'Shubman Gill',
    external_id: 'fixture-shubman-gill',
    photo_url: 'https://h.cricapi.com/img/players/56479.jpg',
  },
  {
    name: 'Glenn Maxwell',
    external_id: 'fixture-glenn-maxwell',
    photo_url: 'https://h.cricapi.com/img/players/8998.jpg',
  },
];

interface CricApiPlayer {
  id: string;
  name: string;
  playerImg?: string;
}

interface CricApiSearchResponse {
  status: string;
  data?: CricApiPlayer[];
}

function searchFixtures(query: string): Cricketer[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return FIXTURE_CRICKETERS;
  return FIXTURE_CRICKETERS.filter((c) => c.name.toLowerCase().includes(needle));
}

export async function searchCricketers(query: string): Promise<Cricketer[]> {
  const apiKey = process.env.CRICKET_API_KEY;

  if (!apiKey) {
    return searchFixtures(query);
  }

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
