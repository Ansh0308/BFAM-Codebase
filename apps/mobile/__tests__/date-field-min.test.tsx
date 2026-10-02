import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DateField } from '../src/components/DateTimeFields';

// Turf booking and rescheduling pick a date from the in-page picker on the web (the
// native date picker has no web version, so it showed nothing there). A booking can't
// be in the past.

describe('DateField with a minimum date', () => {
  const year = String(new Date().getFullYear());

  it('does not accept a date before the minimum', async () => {
    const onChange = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <DateField label="Date" value="" onChange={onChange} minDate={`${year}-06-15`} testID="d" />,
    );
    await fireEvent.press(getByTestId('d-trigger'));
    await fireEvent.press(getByTestId('d-month-option-06'));
    await fireEvent.press(getByTestId('d-day-option-10'));
    await fireEvent.press(getByTestId(`d-year-option-${year}`));

    expect(await findByTestId('d-too-early')).toBeTruthy();
    await fireEvent.press(getByTestId('d-done'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts the minimum date itself and later ones', async () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <DateField label="Date" value="" onChange={onChange} minDate={`${year}-06-15`} testID="d" />,
    );
    await fireEvent.press(getByTestId('d-trigger'));
    await fireEvent.press(getByTestId('d-month-option-06'));
    await fireEvent.press(getByTestId('d-day-option-15'));
    await fireEvent.press(getByTestId(`d-year-option-${year}`));
    expect(queryByTestId('d-too-early')).toBeNull();
    await fireEvent.press(getByTestId('d-done'));
    expect(onChange).toHaveBeenCalledWith(`${year}-06-15`);
  });

  it('shows the chosen date in the given format', async () => {
    const { getByText } = await render(
      <DateField
        label="Date"
        value="2026-10-15"
        onChange={jest.fn()}
        formatValue={(v) => `picked ${v}`}
        testID="d"
      />,
    );
    expect(getByText('picked 2026-10-15')).toBeTruthy();
  });
});
