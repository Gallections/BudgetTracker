import { convertAmount, toBaseCurrency } from '../utils/currencyConvert';

const BASE = 'CAD';
// Rates: 1 CAD = 0.74 USD, 1 CAD = 0.68 EUR
const RATES: Record<string, number> = {
  USD: 0.74,
  EUR: 0.68,
  GBP: 0.58,
};

describe('convertAmount', () => {
  it('returns same amount when from and to are identical', () => {
    expect(convertAmount(100, 'CAD', 'CAD', RATES, BASE)).toBe(100);
  });

  it('returns same amount when from and to are identical (non-base)', () => {
    expect(convertAmount(50, 'USD', 'USD', RATES, BASE)).toBe(50);
  });

  it('converts base currency to target correctly', () => {
    // 100 CAD → USD: 100 * 0.74 = 74
    expect(convertAmount(100, 'CAD', 'USD', RATES, BASE)).toBeCloseTo(74, 2);
  });

  it('converts target currency to base correctly', () => {
    // 74 USD → CAD: 74 / 0.74 = 100
    expect(convertAmount(74, 'USD', 'CAD', RATES, BASE)).toBeCloseTo(100, 2);
  });

  it('converts between two non-base currencies', () => {
    // 74 USD → CAD → EUR: 74/0.74 * 0.68 = 68
    expect(convertAmount(74, 'USD', 'EUR', RATES, BASE)).toBeCloseTo(68, 1);
  });

  it('returns original amount when fromCurrency rate is missing', () => {
    expect(convertAmount(100, 'JPY', 'CAD', RATES, BASE)).toBe(100);
  });

  it('returns amount in base when toCurrency rate is missing', () => {
    // 74 USD → CAD (base): 100, then no rate for JPY → returns 100
    expect(convertAmount(74, 'USD', 'JPY', RATES, BASE)).toBeCloseTo(100, 1);
  });

  it('handles zero amount', () => {
    expect(convertAmount(0, 'USD', 'CAD', RATES, BASE)).toBe(0);
  });

  it('handles empty rates gracefully for same-currency', () => {
    expect(convertAmount(100, 'CAD', 'CAD', {}, BASE)).toBe(100);
  });
});

describe('toBaseCurrency', () => {
  it('returns amount unchanged when already base currency', () => {
    expect(toBaseCurrency(100, 'CAD', BASE, RATES)).toBe(100);
  });

  it('converts USD to CAD correctly', () => {
    // 74 USD → 100 CAD
    expect(toBaseCurrency(74, 'USD', BASE, RATES)).toBeCloseTo(100, 2);
  });

  it('converts EUR to CAD correctly', () => {
    // 68 EUR → 100 CAD
    expect(toBaseCurrency(68, 'EUR', BASE, RATES)).toBeCloseTo(100, 2);
  });

  it('returns amount when currency rate is missing', () => {
    expect(toBaseCurrency(100, 'JPY', BASE, RATES)).toBe(100);
  });

  it('returns zero for zero input', () => {
    expect(toBaseCurrency(0, 'USD', BASE, RATES)).toBe(0);
  });
});
