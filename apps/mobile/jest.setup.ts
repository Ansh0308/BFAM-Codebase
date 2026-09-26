import { configure } from '@testing-library/react-native';

// The first test in a cold Jest worker (per test file) pays a real
// compile/bundle cost on top of any mocked async work, which has been
// observed to exceed both RTL's default `waitFor` window and Jest's own
// default per-test timeout. Raise both globally instead of tuning each
// call site.
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(15000);

// lottie-react-native needs its native module, which doesn't exist under
// Jest. BallLoader (and LoadingOverlay) only need it to render *something*,
// so stand in a plain View.
jest.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: 'lottie-loader', ...props }),
  };
});
