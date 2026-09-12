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

// Backlog D-2: visual refresh of the 3 Get Started screens — these tests
// lock in the underlying paging/finish behavior (including a bug fixed
// while refreshing the screen: Next previously never scrolled the
// carousel), independent of the visual treatment itself.
describe('Onboarding (backlog D-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the first slide and a "Next" button initially', async () => {
    const { findByText, findByTestId } = await render(<Onboarding />);

    await findByText('BOOK TURFS INSTANTLY');
    const button = await findByTestId('onboarding-next-button');
    expect(button).toBeTruthy();
  });

  it('advances through all 3 slides via Next, then finishes onboarding', async () => {
    const { findByText, findByTestId } = await render(<Onboarding />);

    await findByText('BOOK TURFS INSTANTLY');
    await fireEvent.press(await findByTestId('onboarding-next-button'));
    // slideIndex advances on press (state update), independent of the
    // ScrollView's own native scrollTo, which jsdom/RN test renderer
    // doesn't actually animate.
    await findByText('LIVE SCORING');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('YOUR BFAM ID');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('finishing onboarding persists the has-onboarded flag', async () => {
    const { findByText, findByTestId } = await render(<Onboarding />);
    await findByText('BOOK TURFS INSTANTLY');

    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('LIVE SCORING');
    await fireEvent.press(await findByTestId('onboarding-next-button'));
    await findByText('YOUR BFAM ID');
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
