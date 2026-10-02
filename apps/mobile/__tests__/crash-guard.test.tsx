import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { CrashBoundary } from '../src/lib/crashGuard';

function Boom(): React.ReactElement {
  throw new Error('startup exploded');
}

describe('CrashBoundary', () => {
  it('shows the error on screen instead of closing the app', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { findByText } = await render(
      <CrashBoundary>
        <Boom />
      </CrashBoundary>,
    );
    expect(await findByText(/Something went wrong/)).toBeTruthy();
    expect(await findByText(/startup exploded/)).toBeTruthy();
  });

  it('renders its children when nothing is wrong', async () => {
    const { findByText } = await render(
      <CrashBoundary>
        <Text>all good</Text>
      </CrashBoundary>,
    );
    expect(await findByText('all good')).toBeTruthy();
  });
});
