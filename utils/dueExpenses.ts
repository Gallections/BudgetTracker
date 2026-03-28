import { RegularExpense } from '../db/regularExpenses';

/**
 * Returns monthly recurring expenses that are on/past their due day
 * and have not been posted as a transaction yet this calendar month.
 */
export function getDueExpenses(
  expenses: RegularExpense[],
  today: Date = new Date()
): RegularExpense[] {
  const currentMonth = today.toISOString().slice(0, 7); // 'YYYY-MM'
  const dayOfMonth = today.getDate();

  return expenses.filter(e =>
    e.frequency === 'monthly' &&
    e.due_day !== null &&
    dayOfMonth >= e.due_day &&
    e.last_posted_at !== currentMonth
  );
}
