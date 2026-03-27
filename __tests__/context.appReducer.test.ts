import { appReducer } from '../context/AppContext';

const initialState = {
  baseCurrency: 'CAD',
  dbReady: false,
  refreshKey: 0,
  theme: 'system' as const,
};

describe('appReducer — initial state', () => {
  it('has correct default baseCurrency', () => {
    expect(initialState.baseCurrency).toBe('CAD');
  });

  it('has dbReady false by default', () => {
    expect(initialState.dbReady).toBe(false);
  });

  it('has refreshKey 0 by default', () => {
    expect(initialState.refreshKey).toBe(0);
  });
});

describe('appReducer — SET_BASE_CURRENCY', () => {
  it('updates baseCurrency', () => {
    const next = appReducer(initialState, { type: 'SET_BASE_CURRENCY', currency: 'USD' });
    expect(next.baseCurrency).toBe('USD');
  });

  it('does not mutate other fields', () => {
    const next = appReducer(initialState, { type: 'SET_BASE_CURRENCY', currency: 'EUR' });
    expect(next.dbReady).toBe(initialState.dbReady);
    expect(next.refreshKey).toBe(initialState.refreshKey);
  });

  it('can be called multiple times', () => {
    const s1 = appReducer(initialState, { type: 'SET_BASE_CURRENCY', currency: 'USD' });
    const s2 = appReducer(s1, { type: 'SET_BASE_CURRENCY', currency: 'GBP' });
    expect(s2.baseCurrency).toBe('GBP');
  });
});

describe('appReducer — DB_READY', () => {
  it('sets dbReady to true', () => {
    const next = appReducer(initialState, { type: 'DB_READY' });
    expect(next.dbReady).toBe(true);
  });

  it('does not mutate other fields', () => {
    const next = appReducer(initialState, { type: 'DB_READY' });
    expect(next.baseCurrency).toBe(initialState.baseCurrency);
    expect(next.refreshKey).toBe(initialState.refreshKey);
  });

  it('is idempotent when called again', () => {
    const s1 = appReducer(initialState, { type: 'DB_READY' });
    const s2 = appReducer(s1, { type: 'DB_READY' });
    expect(s2.dbReady).toBe(true);
  });
});

describe('appReducer — REFRESH', () => {
  it('increments refreshKey by 1', () => {
    const next = appReducer(initialState, { type: 'REFRESH' });
    expect(next.refreshKey).toBe(1);
  });

  it('increments refreshKey on each call', () => {
    const s1 = appReducer(initialState, { type: 'REFRESH' });
    const s2 = appReducer(s1, { type: 'REFRESH' });
    const s3 = appReducer(s2, { type: 'REFRESH' });
    expect(s3.refreshKey).toBe(3);
  });

  it('does not mutate other fields', () => {
    const next = appReducer(initialState, { type: 'REFRESH' });
    expect(next.baseCurrency).toBe(initialState.baseCurrency);
    expect(next.dbReady).toBe(initialState.dbReady);
  });
});

describe('appReducer — state immutability', () => {
  it('returns a new object reference on every action', () => {
    const next = appReducer(initialState, { type: 'REFRESH' });
    expect(next).not.toBe(initialState);
  });

  it('does not modify the original state object', () => {
    const frozen = Object.freeze({ ...initialState });
    expect(() => appReducer(frozen, { type: 'REFRESH' })).not.toThrow();
    expect(frozen.refreshKey).toBe(0);
  });
});

describe('appReducer — SET_THEME', () => {
  it('updates theme to dark', () => {
    const next = appReducer(initialState, { type: 'SET_THEME', theme: 'dark' });
    expect(next.theme).toBe('dark');
  });

  it('updates theme to light', () => {
    const next = appReducer(initialState, { type: 'SET_THEME', theme: 'light' });
    expect(next.theme).toBe('light');
  });

  it('does not mutate other fields', () => {
    const next = appReducer(initialState, { type: 'SET_THEME', theme: 'dark' });
    expect(next.baseCurrency).toBe(initialState.baseCurrency);
    expect(next.refreshKey).toBe(initialState.refreshKey);
  });
});
