/**
 * Convert an amount from one currency to another using cached exchange rates.
 * rates: Record<targetCurrency, rateRelativeToBase>
 * Example: { USD: 0.74, EUR: 0.68 } means 1 CAD = 0.74 USD
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  baseCurrency: string
): number {
  if (fromCurrency === toCurrency) return amount;

  // Convert fromCurrency → baseCurrency
  let amountInBase: number;
  if (fromCurrency === baseCurrency) {
    amountInBase = amount;
  } else {
    const rateFromToBase = rates[fromCurrency];
    if (!rateFromToBase || rateFromToBase === 0) return amount; // fallback: no conversion
    amountInBase = amount / rateFromToBase;
  }

  // Convert baseCurrency → toCurrency
  if (toCurrency === baseCurrency) return amountInBase;
  const rateBaseToTarget = rates[toCurrency];
  if (!rateBaseToTarget) return amountInBase; // fallback: return in base
  return amountInBase * rateBaseToTarget;
}

/**
 * Convert amount to the base currency.
 */
export function toBaseCurrency(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  rates: Record<string, number>
): number {
  return convertAmount(amount, fromCurrency, baseCurrency, rates, baseCurrency);
}
