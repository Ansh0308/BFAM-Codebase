import { resolveMatchWindow, formatIst } from '../domain/matchSlot';
import { bookingStartInstant } from '../domain/time';

const SLOT = { booking_date: '2026-10-10', start_time: '18:00:00', end_time: '20:00:00' };
const at = (hhmm: string) => bookingStartInstant(SLOT.booking_date, hhmm);
const match = (from: string, to: string | null) => ({
  scheduled_start_time: at(from),
  scheduled_end_time: to ? at(to) : null,
});
const times = (w: { start: Date; end: Date }) => [formatIst(w.start), formatIst(w.end)];

describe('resolveMatchWindow', () => {
  it('gives the first match in an empty slot the whole slot', () => {
    expect(times(resolveMatchWindow(SLOT, []))).toEqual(['18:00', '20:00']);
  });

  it('puts a second match after the first when no time is asked for', () => {
    const w = resolveMatchWindow(SLOT, [match('18:00', '18:45')]);
    expect(times(w)).toEqual(['18:45', '20:00']);
  });

  it('accepts an explicit start and end inside the slot', () => {
    const w = resolveMatchWindow(SLOT, [match('18:00', '18:45')], {
      start_time: '19:00',
      end_time: '19:30',
    });
    expect(times(w)).toEqual(['19:00', '19:30']);
  });

  it('ends a match when the next one begins if no end is given', () => {
    const w = resolveMatchWindow(SLOT, [match('19:00', '19:45')], { start_time: '18:00' });
    expect(times(w)).toEqual(['18:00', '19:00']);
  });

  it('treats a match from before slots could be split as filling the whole slot', () => {
    expect(() => resolveMatchWindow(SLOT, [match('18:00', null)])).toThrow(/already full/);
    expect(() =>
      resolveMatchWindow(SLOT, [match('18:00', null)], { start_time: '18:30', end_time: '19:00' }),
    ).toThrow(/overlaps another match/);
  });

  it('says the slot is full once matches reach the end of it', () => {
    expect(() => resolveMatchWindow(SLOT, [match('18:00', '20:00')])).toThrow(/already full/);
  });

  it('rejects overlap and names the clashing match', () => {
    expect(() =>
      resolveMatchWindow(SLOT, [match('18:00', '19:00')], {
        start_time: '18:30',
        end_time: '19:30',
      }),
    ).toThrow(/18:00-19:00/);
    expect(() =>
      resolveMatchWindow(SLOT, [match('19:00', '19:30')], {
        start_time: '18:30',
        end_time: '19:15',
      }),
    ).toThrow(/overlaps/);
  });

  it('allows back-to-back matches', () => {
    const w = resolveMatchWindow(SLOT, [match('18:00', '19:00')], {
      start_time: '19:00',
      end_time: '19:45',
    });
    expect(times(w)).toEqual(['19:00', '19:45']);
  });

  it('rejects times outside the booked slot', () => {
    expect(() => resolveMatchWindow(SLOT, [], { start_time: '17:30', end_time: '18:30' })).toThrow(
      /inside the booked slot \(18:00-20:00\)/,
    );
    expect(() => resolveMatchWindow(SLOT, [], { start_time: '19:30', end_time: '20:30' })).toThrow(
      /inside the booked slot/,
    );
  });

  it('rejects a match shorter than 15 minutes, or ending before it starts', () => {
    expect(() => resolveMatchWindow(SLOT, [], { start_time: '18:00', end_time: '18:10' })).toThrow(
      /at least 15 minutes/,
    );
    expect(() => resolveMatchWindow(SLOT, [], { start_time: '19:00', end_time: '18:30' })).toThrow(
      /at least 15 minutes/,
    );
  });

  it('rejects malformed times', () => {
    expect(() => resolveMatchWindow(SLOT, [], { start_time: '6pm', end_time: '19:00' })).toThrow(
      /Times must look like/,
    );
  });
});
