import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RsvpButtons } from '../src/components/matches/RsvpButtons';

// "CONFI/RM", "MAYB/E" and "CAN'T/PLAY" were breaking mid-word on a phone because three of the
// shared Buttons were squeezed into one row. The invite answers are now compact equal tiles
// whose labels stay on one line.

describe('RsvpButtons', () => {
  it('shows the three answers with whole-word, single-line labels', async () => {
    const { findByText } = await render(<RsvpButtons busy={false} onRespond={() => {}} />);
    for (const label of ['Confirm', 'Maybe', "Can't play"]) {
      const text = await findByText(label);
      expect(text.props.numberOfLines).toBe(1);
    }
  });

  it('reports which answer was tapped', async () => {
    const onRespond = jest.fn();
    const { findByTestId } = await render(<RsvpButtons busy={false} onRespond={onRespond} />);
    await fireEvent.press(await findByTestId('respond-confirmed'));
    await fireEvent.press(await findByTestId('respond-maybe'));
    await fireEvent.press(await findByTestId('respond-cant-play'));
    expect(onRespond.mock.calls.map((c) => c[0])).toEqual(['CONFIRMED', 'MAYBE', 'CANT_PLAY']);
  });

  it('ignores taps while a response is being sent', async () => {
    const onRespond = jest.fn();
    const { findByTestId } = await render(<RsvpButtons busy onRespond={onRespond} />);
    await fireEvent.press(await findByTestId('respond-confirmed'));
    expect(onRespond).not.toHaveBeenCalled();
  });
});
