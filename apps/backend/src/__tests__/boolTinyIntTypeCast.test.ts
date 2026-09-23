import { boolTinyIntTypeCast } from '../config/sequelize';

// Regression for a real bug found manually testing the Scoring Interface's
// "Start Innings" flow: a raw sequelize.query read of a BOOLEAN/TINYINT(1)
// column (e.g. matches.extras_count_toward_score) came back as the number
// 1/0, not true/false. That number then round-tripped verbatim into
// extras-setting's request body, which zod's `z.boolean()` correctly
// rejects — surfacing as a mystifying 400 "Invalid payload" on a payload
// that looked completely correct when replayed by hand with a real
// boolean. This mysql2 typeCast hook is the fix; these tests pin its
// behavior directly since the rest of this suite mocks sequelize.query
// and never exercises the real MySQL driver.
describe('boolTinyIntTypeCast (fix for the Scoring Interface Start Innings 400 bug)', () => {
  function fakeField(type: string, length: number, stringValue: string | null) {
    return { type, length, string: () => stringValue };
  }

  it('casts a TINYINT(1) value of "1" to the real boolean true', () => {
    const next = jest.fn();
    expect(boolTinyIntTypeCast(fakeField('TINY', 1, '1'), next)).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('casts a TINYINT(1) value of "0" to the real boolean false', () => {
    const next = jest.fn();
    expect(boolTinyIntTypeCast(fakeField('TINY', 1, '0'), next)).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('casts a NULL TINYINT(1) to null, not false', () => {
    const next = jest.fn();
    expect(boolTinyIntTypeCast(fakeField('TINY', 1, null), next)).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  it('leaves a wider TINYINT (length > 1, a real small integer column) to the default cast', () => {
    const next = jest.fn().mockReturnValue(42);
    expect(boolTinyIntTypeCast(fakeField('TINY', 3, '42'), next)).toBe(42);
    expect(next).toHaveBeenCalled();
  });

  it('leaves every other MySQL column type to the default cast', () => {
    const next = jest.fn().mockReturnValue('unchanged');
    expect(boolTinyIntTypeCast(fakeField('VARCHAR', 255, 'hello'), next)).toBe('unchanged');
    expect(next).toHaveBeenCalled();
  });
});
