import '@testing-library/jest-dom';

// The Lottie player needs a real canvas + WebAssembly, neither of which
// exist under jsdom. BallLoader only needs it to render *something*.
jest.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => null,
}));

// jsdom has no matchMedia; motion's reduced-motion check and a few layout
// helpers read it. Report "no preference" and no-op listeners.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
