import { ACCOUNT_TYPES, AccountType } from '../db/savings';

describe('ACCOUNT_TYPES', () => {
  it('contains all required account types', () => {
    const required: AccountType[] = ['Chequing', 'Savings', 'Investment', 'Cash', 'Crypto', 'Other'];
    for (const type of required) {
      expect(ACCOUNT_TYPES).toContain(type);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(ACCOUNT_TYPES).size).toBe(ACCOUNT_TYPES.length);
  });
});
