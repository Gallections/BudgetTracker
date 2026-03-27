import { KEYWORD_CATEGORY_MAP } from '../constants/categories';
import { DEFAULT_CURRENCY } from '../constants/currencies';

export interface ParsedExpense {
  amount: number | null;
  currency: string;
  merchant: string;
  category: string;
  notes: string | null;
}

const CURRENCY_WORD_MAP: Record<string, string> = {
  cad: 'CAD', canadian: 'CAD', dollars: 'CAD', dollar: 'CAD', bucks: 'CAD',
  usd: 'USD', american: 'USD',
  eur: 'EUR', euros: 'EUR', euro: 'EUR',
  gbp: 'GBP', pounds: 'GBP', pound: 'GBP', sterling: 'GBP',
  jpy: 'JPY', yen: 'JPY',
  aud: 'AUD', australian: 'AUD',
  chf: 'CHF', francs: 'CHF', franc: 'CHF',
  cny: 'CNY', yuan: 'CNY', rmb: 'CNY',
};

const FILLER_WORDS = new Set([
  'spent', 'paid', 'pay', 'spend', 'bought', 'buy', 'purchased', 'purchase',
  'at', 'for', 'on', 'a', 'an', 'the', 'i', 'my', 'some', 'about',
  'around', 'in', 'to', 'from', 'and', 'with', 'got',
]);

export function parseExpense(
  transcript: string,
  customCategories?: { name: string; keywords: string[] }[],
  merchantOverrides?: Record<string, string>
): ParsedExpense {
  if (!transcript.trim()) {
    return { amount: null, currency: DEFAULT_CURRENCY, merchant: '', category: 'Uncategorized', notes: null };
  }

  const lower = transcript.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // 1. Extract amount — first number (with optional leading $)
  const amountMatch = transcript.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

  // 2. Detect currency
  let currency = DEFAULT_CURRENCY;
  for (const word of words) {
    if (CURRENCY_WORD_MAP[word]) {
      currency = CURRENCY_WORD_MAP[word];
      break;
    }
  }

  // 3. Extract merchant — words that are not filler, currency, or numeric
  const merchantWords = words.filter(word => {
    if (FILLER_WORDS.has(word)) return false;
    if (CURRENCY_WORD_MAP[word]) return false;
    if (/^\$?\d/.test(word)) return false;
    return true;
  });

  const merchant = merchantWords
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // 4. Check merchant override first (highest precedence)
  if (merchantOverrides && merchant) {
    const override = merchantOverrides[merchant.toLowerCase()];
    if (override) {
      return { amount, currency, merchant, category: override, notes: null };
    }
  }

  // 5. Build combined keyword map: custom category keywords first (higher precedence), then built-ins
  const combinedMap: Record<string, string> = {};
  for (const [kw, cat] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    combinedMap[kw] = cat;
  }
  if (customCategories) {
    for (const cc of customCategories) {
      for (const kw of cc.keywords) {
        if (kw.trim()) combinedMap[kw.toLowerCase().trim()] = cc.name;
      }
    }
  }

  // Sort longest-first so multi-word phrases match before single words
  const sortedKeywords = Object.keys(combinedMap).sort((a, b) => b.length - a.length);

  // 6. Detect category from keywords
  let category = 'Uncategorized';
  for (const keyword of sortedKeywords) {
    if (lower.includes(keyword)) {
      category = combinedMap[keyword];
      break;
    }
  }

  return { amount, currency, merchant, category, notes: null };
}
