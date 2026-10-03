import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PlayerHeader } from '../src/components/home/PlayerHeader';
import { CoinsExplainer } from '../src/components/coins/CoinsExplainer';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

// Testers asked what the coin number on Home is for. Tapping it must explain what coins
// are, how to earn them and what to do with them, and lead on to the rewards list.

describe('coins explainer', () => {
  beforeEach(() => mockPush.mockClear());

  it('says what coins are, how they are earned and what they are for', async () => {
    const { findByText } = await render(<CoinsExplainer />);
    expect(await findByText('What are BFAM Coins?')).toBeTruthy();
    expect(await findByText('HOW YOU EARN THEM')).toBeTruthy();
    expect(await findByText('Review a match you played')).toBeTruthy();
    expect(await findByText('+20')).toBeTruthy();
    expect(await findByText('Refer a friend')).toBeTruthy();
    expect(await findByText('+100')).toBeTruthy();
    expect(await findByText('WHAT YOU CAN DO WITH THEM')).toBeTruthy();
    expect(await findByText('Pay less for a turf booking')).toBeTruthy();
    expect(await findByText('Redeem rewards')).toBeTruthy();
    expect(await findByText('Buy a membership')).toBeTruthy();
  });

  it('opens from the coin pill on Home with the balance, and links to rewards', async () => {
    const { findByTestId, queryByTestId, findByText } = await render(
      <PlayerHeader points={300} unreadCount={0} />,
    );
    expect(queryByTestId('coins-sheet')).toBeNull();

    await fireEvent.press(await findByTestId('home-coin-balance'));
    expect(await findByTestId('coins-sheet')).toBeTruthy();
    expect(await findByText('What are BFAM Coins?')).toBeTruthy();

    await fireEvent.press(await findByTestId('coins-sheet-rewards'));
    expect(mockPush).toHaveBeenCalledWith('/rewards');
  });

  it('closes again from the close button', async () => {
    const { findByTestId, queryByTestId } = await render(
      <PlayerHeader points={5} unreadCount={0} />,
    );
    await fireEvent.press(await findByTestId('home-coin-balance'));
    await fireEvent.press(await findByTestId('coins-sheet-close'));
    expect(queryByTestId('coins-sheet')).toBeNull();
  });
});
