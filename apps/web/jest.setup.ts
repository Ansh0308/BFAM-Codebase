import '@testing-library/jest-dom';

// The Lottie player needs a real canvas + WebAssembly, neither of which
// exist under jsdom. BallLoader only needs it to render *something*.
jest.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => null,
}));
