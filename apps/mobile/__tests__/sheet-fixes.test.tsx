import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

// Tester-sheet fixes: booking date/time pickers (rows 9-11), back button that works
// without history (row 20), and the skill rating explanation (row 19).

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: jest.fn(),
    canGoBack: () => mockCanGoBack,
  }),
}));

import {
  DateField,
  TimeField,
  formatDateForDisplay,
  formatTimeForDisplay,
} from '../src/components/DateTimeFields';
import { BackButton } from '../src/components/BackButton';
import { SkillRatingCard } from '../src/components/profile/ProfileParts';

describe('display formats', () => {
  it('shows dates as DD-MM-YYYY and times in 12-hour form', () => {
    expect(formatDateForDisplay('2026-10-07')).toBe('07-10-2026');
    expect(formatTimeForDisplay('18:00')).toBe('6:00 PM');
    expect(formatTimeForDisplay('00:15')).toBe('12:15 AM');
    expect(formatTimeForDisplay('12:30')).toBe('12:30 PM');
  });
});

describe('DateField', () => {
  it('lets you pick a date from wheels and returns YYYY-MM-DD', async () => {
    const onChange = jest.fn();
    const year = String(new Date().getFullYear());
    const { getByTestId, queryByTestId } = await render(
      <DateField label="Booking Date (MM-DD-YYYY)" value="" onChange={onChange} testID="d" />,
    );
    await fireEvent.press(getByTestId('d-trigger'));
    expect(getByTestId('d-done')).toBeTruthy();

    await fireEvent.press(getByTestId('d-month-option-10'));
    await fireEvent.press(getByTestId('d-day-option-07'));
    await fireEvent.press(getByTestId(`d-year-option-${year}`));
    await fireEvent.press(getByTestId('d-done'));

    expect(onChange).toHaveBeenCalledWith(`${year}-10-07`);
    expect(queryByTestId('d-panel')).toBeNull();
  });

  it('does not confirm until month, day and year are all chosen', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <DateField label="Date" value="" onChange={onChange} testID="d" />,
    );
    await fireEvent.press(getByTestId('d-trigger'));
    await fireEvent.press(getByTestId('d-month-option-10'));
    await fireEvent.press(getByTestId('d-done'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('TimeField', () => {
  it('picks hour and minute and returns HH:MM', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <TimeField label="Start Time" value="" onChange={onChange} testID="t" />,
    );
    await fireEvent.press(getByTestId('t-trigger'));
    await fireEvent.press(getByTestId('t-hour-option-18'));
    await fireEvent.press(getByTestId('t-minute-option-30'));
    await fireEvent.press(getByTestId('t-done'));
    expect(onChange).toHaveBeenCalledWith('18:30');
  });
});

describe('BackButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('goes back when there is history', async () => {
    mockCanGoBack = true;
    const { getByTestId } = await render(<BackButton fallback="/(tabs)/matches" />);
    await fireEvent.press(getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('goes to the fallback when the page was opened directly or refreshed', async () => {
    mockCanGoBack = false;
    const { getByTestId } = await render(<BackButton fallback="/(tabs)/matches" />);
    await fireEvent.press(getByTestId('back-button'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/matches');
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('SkillRatingCard', () => {
  it('explains how the rating is decided, on demand', async () => {
    const { getByTestId, queryByTestId, findByText } = await render(
      <SkillRatingCard rating={500} />,
    );
    expect(queryByTestId('skill-rating-rules')).toBeNull();

    await fireEvent.press(getByTestId('skill-rating-how'));
    expect(getByTestId('skill-rating-rules')).toBeTruthy();
    expect(await findByText(/20 points per wicket/)).toBeTruthy();
    expect(await findByText(/Player of the Match/)).toBeTruthy();
  });
});
