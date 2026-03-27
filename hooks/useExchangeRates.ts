import { useState, useEffect } from 'react';
import { getDatabase } from '../db/db';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_KEY = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY ?? '';

export interface ExchangeRateState {
  rates: Record<string, number>;
  baseCurrency: string;
  loading: boolean;
  stale: boolean; // true = using cached/fallback data (offline or no key)
  lastUpdated: string | null;
}

async function loadCachedRates(
  baseCurrency: string
): Promise<{ rates: Record<string, number>; fetchedAt: string } | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ target_currency: string; rate: number; fetched_at: string }>(
    'SELECT target_currency, rate, fetched_at FROM exchange_rate_cache WHERE base_currency = ?',
    [baseCurrency]
  );
  if (rows.length === 0) return null;
  const rates: Record<string, number> = {};
  let fetchedAt = rows[0].fetched_at;
  for (const row of rows) {
    rates[row.target_currency] = row.rate;
    if (row.fetched_at < fetchedAt) fetchedAt = row.fetched_at; // oldest
  }
  return { rates, fetchedAt };
}

async function saveRatesToCache(
  baseCurrency: string,
  rates: Record<string, number>,
  fetchedAt: string
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM exchange_rate_cache WHERE base_currency = ?',
      [baseCurrency]
    );
    for (const [target, rate] of Object.entries(rates)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO exchange_rate_cache (base_currency, target_currency, rate, fetched_at) VALUES (?, ?, ?, ?)',
        [baseCurrency, target, rate, fetchedAt]
      );
    }
  });
}

async function fetchFreshRates(
  baseCurrency: string
): Promise<Record<string, number> | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${baseCurrency}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== 'success') return null;
    // Remove the base currency itself from rates (it's always 1)
    const { [baseCurrency]: _self, ...rates } = data.conversion_rates as Record<string, number>;
    return rates;
  } catch {
    return null;
  }
}

export function useExchangeRates(baseCurrency: string): ExchangeRateState {
  const [state, setState] = useState<ExchangeRateState>({
    rates: {},
    baseCurrency,
    loading: true,
    stale: false,
    lastUpdated: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState(s => ({ ...s, loading: true }));

      const cached = await loadCachedRates(baseCurrency);
      const now = Date.now();

      if (cached) {
        const age = now - new Date(cached.fetchedAt).getTime();
        if (age < CACHE_TTL_MS) {
          // Cache is fresh — use it immediately
          if (!cancelled) {
            setState({
              rates: cached.rates,
              baseCurrency,
              loading: false,
              stale: false,
              lastUpdated: cached.fetchedAt,
            });
          }
          return;
        }
        // Cache is stale — show stale data immediately, then try to refresh
        if (!cancelled) {
          setState({
            rates: cached.rates,
            baseCurrency,
            loading: false,
            stale: true,
            lastUpdated: cached.fetchedAt,
          });
        }
      }

      // Try fetching fresh rates
      const freshRates = await fetchFreshRates(baseCurrency);
      if (cancelled) return;

      if (freshRates) {
        const fetchedAt = new Date().toISOString();
        await saveRatesToCache(baseCurrency, freshRates, fetchedAt);
        if (!cancelled) {
          setState({
            rates: freshRates,
            baseCurrency,
            loading: false,
            stale: false,
            lastUpdated: fetchedAt,
          });
        }
      } else if (!cached) {
        // No cache, no network — empty rates (1:1 fallback)
        if (!cancelled) {
          setState({
            rates: {},
            baseCurrency,
            loading: false,
            stale: true,
            lastUpdated: null,
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [baseCurrency]);

  return state;
}
