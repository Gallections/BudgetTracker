import { Colors } from '../constants/colors';

const REQUIRED_KEYS = [
  'background', 'surface', 'primary', 'primaryLight',
  'text', 'textSecondary', 'border',
  'danger', 'warning', 'success',
  'tabBar', 'tabBarBorder',
] as const;

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

describe('Colors.light', () => {
  it('contains all required keys', () => {
    for (const key of REQUIRED_KEYS) {
      expect(Colors.light).toHaveProperty(key);
    }
  });

  it('all values are valid hex color strings', () => {
    for (const [key, value] of Object.entries(Colors.light)) {
      expect(value).toMatch(HEX_REGEX);
    }
  });

  it('has no extra unexpected keys', () => {
    expect(Object.keys(Colors.light).sort()).toEqual([...REQUIRED_KEYS].sort());
  });
});

describe('Colors.dark', () => {
  it('contains all required keys', () => {
    for (const key of REQUIRED_KEYS) {
      expect(Colors.dark).toHaveProperty(key);
    }
  });

  it('all values are valid hex color strings', () => {
    for (const [key, value] of Object.entries(Colors.dark)) {
      expect(value).toMatch(HEX_REGEX);
    }
  });

  it('has the same keys as light theme', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });
});

describe('Colors light vs dark', () => {
  it('primary colors differ between themes', () => {
    expect(Colors.light.primary).not.toBe(Colors.dark.primary);
  });

  it('background colors differ between themes', () => {
    expect(Colors.light.background).not.toBe(Colors.dark.background);
  });

  it('danger color is the same in both themes', () => {
    expect(Colors.light.danger).toBe(Colors.dark.danger);
  });
});
