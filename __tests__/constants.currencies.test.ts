import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, CurrencyInfo } from '../constants/currencies';

describe('SUPPORTED_CURRENCIES', () => {
  it('contains the 8 required currencies', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    for (const code of ['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY']) {
      expect(codes).toContain(code);
    }
  });

  it('has no duplicate currency codes', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every entry has code, name, and symbol', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(currency.code).toBeTruthy();
      expect(currency.name).toBeTruthy();
      expect(currency.symbol).toBeTruthy();
    }
  });
});

describe('DEFAULT_CURRENCY', () => {
  it('is CAD', () => {
    expect(DEFAULT_CURRENCY).toBe('CAD');
  });

  it('exists in SUPPORTED_CURRENCIES', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    expect(codes).toContain(DEFAULT_CURRENCY);
  });
});
