import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockSetItemAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

import Onboarding from '../app/onboarding';

// Backlog D-2 (+ four-chapter redesign): these tests lock in the
// underlying paging/finish behavior across all 4 onboarding screens
// (Book / Play / Compete / Identity), independent of each screen's own
// bespoke visual treatment (photo hero, editorial split, scoreboard,
// jersey-number identity).
describe('Onboarding (four-chapter campaign)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the first slide (Book) and a "Next" button initially', async () => {
    const { findByText, findByTestId } = await render(<Onboarding />);

    await findByText('BOOK TURFS INSTANTLY');
    const button = await findByTestId('onboarding-next-button');
    expect(button).toBeTruthy();
  });

  it('advances through all 4 slides via Next, then finishes onboarding', async () => {
    const { findByText, findByTestId } = await render(<Onboarding />);

    await findByText('BOOK TURFS INSTANTLY');
    await fireEvent.press(await findByTestId('onboarding-next-button'));
    // slideIndex advances on press (state update), independent of the
    // ScrollView's own native scrollTo, which jsdom/RN test renderer
    // doesn't actually animate.
    await findByText('FIND YOUR PLAYERS.');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('PLAY. COMPETE. REPEAT.');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('YOUR BFAM ID.');
    await findByText('Get Started');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('finishing onboarding persists the has-onboarded flag', async () => {
    const { findByText, findByTestId } = await render(<Onboarding />);
    await findByText('BOOK TURFS INSTANTLY');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('FIND YOUR PLAYERS.');
    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('PLAY. COMPETE. REPEAT.');
    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('YOUR BFAM ID.');
    await fireEvent.press(await findByTestId('onboarding-next-button'));

    await waitFor(() =>
      expect(mockSetItemAsync).toHaveBeenCalledWith('bfam_has_onboarded', 'true'),
    );
  });

  it('Skip finishes onboarding immediately from the first slide', async () => {
    const { findByText } = await render(<Onboarding />);
    await findByText('BOOK TURFS INSTANTLY');

    await fireEvent.press(await findByText('Skip'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});
