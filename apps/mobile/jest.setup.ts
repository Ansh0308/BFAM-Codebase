import { configure } from '@testing-library/react-native';

// NativeWind v2 runs in `transformOnly` mode under Jest (see babel.config.js)
// and resolves styles at runtime instead of compile time, which adds enough
// overhead to occasionally push a mocked promise's resolution past RTL's
// default 1000ms `waitFor` window. Raise it globally instead of tuning each
// call site.
configure({ asyncUtilTimeout: 5000 });
