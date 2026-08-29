import { configure } from '@testing-library/react-native';

// The first test in a cold Jest worker (per test file) pays a real
// compile/bundle cost on top of any mocked async work, which has been
// observed to exceed both RTL's default `waitFor` window and Jest's own
// default per-test timeout. Raise both globally instead of tuning each
// call site.
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(15000);
