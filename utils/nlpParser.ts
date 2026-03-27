import { Category, KEYWORD_CATEGORY_MAP } from '../constants/categories';
import { DEFAULT_CURRENCY } from '../constants/currencies';

export interface ParsedExpense {
  amount: number | null;
  currency: string;
  merchant: string;
  category: Category;
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

// Sort keyword map keys longest-first so multi-word phrases match before single words
const SORTED_KEYWORDS = Object.keys(KEYWORD_CATEGORY_MAP).sort(
  (a, b) => b.length - a.length
);

export function parseExpense(transcript: string): ParsedExpense {
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

  // 3. Detect category — check multi-word phrases first
  let category: Category = 'Uncategorized';
  for (const keyword of SORTED_KEYWORDS) {
    if (lower.includes(keyword)) {
      category = KEYWORD_CATEGORY_MAP[keyword];
      break;
    }
  }

  // 4. Extract merchant — words that are not filler, currency, or numeric
  const merchantWords = words.filter(word => {
    if (FILLER_WORDS.has(word)) return false;
    if (CURRENCY_WORD_MAP[word]) return false;
    if (/^\$?\d/.test(word)) return false;
    return true;
  });

  const merchant = merchantWords
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { amount, currency, merchant, category, notes: null };
}
