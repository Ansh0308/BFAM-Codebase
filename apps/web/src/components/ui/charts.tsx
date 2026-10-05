'use client';

import React, { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from './motion';

// Small, dependency-free charts in the BFAM red / black palette. Each one is
// responsive (SVG viewBox), animates in once, and shows a tooltip on hover.
// Every chart also renders an accessible text summary (`aria-label`) and
// exposes its values as data attributes so tests need not read pixels.

const RED = '#D80000';
const INK = '#0B0B0B';

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// ---- Area / line chart ------------------------------------------------------

export interface SeriesPoint {
  label: string;
  value: number;
}

export function AreaChart({
  points,
  format = (n) => n.toLocaleString('en-IN'),
  height = 240,
  testID,
  ariaLabel,
}: {
  points: SeriesPoint[];
  format?: (n: number) => string;
  height?: number;
  testID?: string;
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const x = (i: number) =>
    pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = points.length
    ? `${line} L${x(points.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`
    : '';
  const total = points.reduce((a, p) => a + p.value, 0);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(points.length / 7));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(((ratio * W - pad.l) / innerW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  }

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="relative" data-testid={testID} data-total={total}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-auto"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity="0.28" />
            <stop offset="100%" stopColor={RED} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={INK} strokeOpacity="0.07" />
          </g>
        ))}
        {points.length > 0 && (
          <>
            <motion.path
              d={area}
              fill={`url(#${gradId})`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
            <motion.path
              d={line}
              fill="none"
              stroke={RED}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: EASE_OUT }}
            />
          </>
        )}
        {points.map((p, i) =>
          i % every === 0 || i === points.length - 1 ? (
            <text
              key={p.label + i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill={INK}
              fillOpacity="0.5"
            >
              {p.label}
            </text>
          ) : null,
        )}
        {hp && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke={RED}
              strokeOpacity="0.35"
            />
            <circle
              cx={x(hover)}
              cy={y(hp.value)}
              r={5}
              fill="#fff"
              stroke={RED}
              strokeWidth={2.5}
            />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-ink-black px-3 py-[6px] font-ui text-[12px] text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
          data-testid="chart-tooltip"
        >
          <span className="text-white/60">{hp.label}</span> <strong>{format(hp.value)}</strong>
        </div>
      )}
    </div>
  );
}

// ---- Vertical bar chart -------------------------------------------------------

export function BarChart({
  bars,
  format = (n) => n.toLocaleString('en-IN'),
  height = 200,
  highlightMax = true,
  testID,
  ariaLabel,
}: {
  bars: SeriesPoint[];
  format?: (n: number) => string;
  height?: number;
  highlightMax?: boolean;
  testID?: string;
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? -1) ? i : best), 0);

  return (
    <div data-testid={testID} data-peak={bars[peak]?.label ?? ''} role="img" aria-label={ariaLabel}>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {bars.map((b, i) => {
          const isPeak = highlightMax && i === peak && b.value > 0;
          return (
            <div
              key={b.label}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <motion.div
                className="w-full rounded-t-[4px]"
                style={{
                  backgroundColor: isPeak ? RED : INK,
                  opacity: isPeak ? 1 : hover === i ? 0.85 : 0.18,
                }}
                initial={reduce ? false : { height: 0 }}
                animate={{ height: `${Math.max((b.value / max) * 100, b.value > 0 ? 3 : 0)}%` }}
                transition={{ duration: 0.7, delay: Math.min(i, 24) * 0.02, ease: EASE_OUT }}
                data-value={b.value}
              />
              {hover === i && (
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-black px-2 py-[4px] font-ui text-[12px] text-white shadow-lg">
                  {b.label}: <strong>{format(b.value)}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {bars.map((b, i) => (
          <span
            key={b.label}
            className="flex-1 text-center font-ui text-[10px] text-text-tertiary"
            style={{ visibility: bars.length > 12 && i % 3 !== 0 ? 'hidden' : 'visible' }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Horizontal ranked bars -----------------------------------------------------

export function HBarList({
  rows,
  format = (n) => n.toLocaleString('en-IN'),
  testID,
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  testID?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3" data-testid={testID}>
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate font-ui text-body font-semibold text-ink-black">
              {r.label}
            </span>
            <span className="shrink-0 font-ui text-body text-text-secondary">
              {format(r.value)}
              {r.hint ? <span className="ml-2 text-text-tertiary">{r.hint}</span> : null}
            </span>
          </div>
          <div className="h-[8px] overflow-hidden rounded-[999px] bg-ink-black/[0.06]">
            <motion.div
              className="h-full rounded-[999px] bg-brand-red"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.06, ease: EASE_OUT }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
