import { Alert, Platform } from 'react-native';

// Regression: react-native's Alert.alert() is a documented no-op on web —
// react-native-web never implements it — so a confirm-before-destructive
// flow (found while wiring up backlog A-16's Leave Team button) silently
// did nothing on web with no visible error. confirmAction() branches to
// window.confirm on web and Alert.alert everywhere else.
import { confirmAction } from '../src/lib/confirm';

describe('confirmAction', () => {
  beforeEach(() => {
    // The React Native jest environment has no browser `window` global by
    // default (unlike an actual web build) — stub just enough of it for
    // confirmAction's web branch to be exercised here.
    (global as unknown as { window: { confirm: (message: string) => boolean } }).window = {
      confirm: () => true,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as unknown as { window?: unknown }).window;
  });

  it('uses window.confirm on web and resolves true when the user confirms', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'web' });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    const result = await confirmAction('Leave this team?', 'Are you sure?', 'Leave Team');

    expect(confirmSpy).toHaveBeenCalledWith('Leave this team?\n\nAre you sure?');
    expect(result).toBe(true);
  });

  it('resolves false on web when the user cancels', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'web' });
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    const result = await confirmAction('Leave this team?', 'Are you sure?', 'Leave Team');

    expect(result).toBe(false);
  });

  it('uses Alert.alert on native and resolves true when the destructive action is pressed', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) =>
        buttons?.find((b) => b.style === 'destructive')?.onPress?.(),
      );

    const result = await confirmAction('Leave this team?', 'Are you sure?', 'Leave Team');

    expect(result).toBe(true);
  });

  it('resolves false on native when Cancel is pressed', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) =>
        buttons?.find((b) => b.style === 'cancel')?.onPress?.(),
      );

    const result = await confirmAction('Leave this team?', 'Are you sure?', 'Leave Team');

    expect(result).toBe(false);
  });
});
