import { RegularExpense } from '../db/regularExpenses';
import { DateRange } from './dateRanges';

/**
 * Count how many billing cycles of the given frequency fall within [rangeStart, rangeEnd].
 * Both dates are YYYY-MM-DD strings. start is when the expense began.
 */
function countCycles(
  frequency: string,
  expenseStart: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  if (frequency === 'once') {
    // counts once if the expense started within the range
    return expenseStart >= rangeStart && expenseStart <= rangeEnd ? 1 : 0;
  }

  // The effective window starts at the later of expense start and range start
  const windowStart = expenseStart > rangeStart ? expenseStart : rangeStart;
  const windowEnd = rangeEnd;

  if (windowStart > windowEnd) return 0;

  const msPerDay = 86400000;
  const days = (windowEnd.getTime() - windowStart.getTime()) / msPerDay;

  switch (frequency) {
    case 'weekly':    return Math.floor(days / 7) + 1;
    case 'biweekly':  return Math.floor(days / 14) + 1;
    case 'monthly': {
      // Count calendar months that start within the window
      let count = 0;
      const cur = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
      const end = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);
      while (cur <= end) {
        count++;
        cur.setMonth(cur.getMonth() + 1);
      }
      return count;
    }
    case 'quarterly': {
      let count = 0;
      const cur = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
      const end = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);
      while (cur <= end) {
        count++;
        cur.setMonth(cur.getMonth() + 3);
      }
      return count;
    }
    case 'annually': {
      let count = 0;
      const cur = new Date(windowStart.getFullYear(), 0, 1);
      const end = new Date(windowEnd.getFullYear(), 0, 1);
      while (cur <= end) {
        count++;
        cur.setFullYear(cur.getFullYear() + 1);
      }
      return count;
    }
    default:
      return 0;
  }
}

/**
 * Calculate total recurring expense contribution for a date range.
 * Uses start_date (or today if missing) as the expense's inception date.
 */
export function calcRecurringContribution(
  expenses: RegularExpense[],
  range: DateRange
): number {
  const rangeStart = new Date(range.dateFrom + 'T00:00:00');
  const rangeEnd = new Date(range.dateTo + 'T23:59:59');
  const today = new Date();

  let total = 0;

  for (const expense of expenses) {
    const startStr = expense.start_date ?? today.toISOString().split('T')[0];
    const expenseStart = new Date(startStr + 'T00:00:00');

    const cycles = countCycles(expense.frequency, expenseStart, rangeStart, rangeEnd);
    total += cycles * expense.amount;
  }

  return total;
}
