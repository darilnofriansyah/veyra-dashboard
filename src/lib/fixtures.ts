import type { Budget, Transaction } from "./finance";

export const fixtureCategories = ["Housing", "Food & Dining", "Transport", "Bills & Utilities", "Shopping"];

function monthKey(now: string, offset: number) {
  const [year, month] = now.slice(0, 7).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(key: string, day: number) {
  return `${key}-${String(day).padStart(2, "0")}`;
}

export function createFixtureTransactions(now: string): Transaction[] {
  const months = [monthKey(now, 0), monthKey(now, -1), monthKey(now, -2)];
  const rows = (key: string, income: number, scale: number): Transaction[] => [
    { id: `${key}-salary`, date: isoDate(key, 1), merchant: "Salary", category: "Income", amount: income, type: "income" },
    { id: `${key}-rent`, date: isoDate(key, 2), merchant: "Apartment", category: "Housing", amount: Math.round(3_200_000 * scale), type: "expense" },
    { id: `${key}-grocer`, date: isoDate(key, 5), merchant: "Farmers Market", category: "Food & Dining", amount: Math.round(1_160_000 * scale), type: "expense" },
    { id: `${key}-grab`, date: isoDate(key, 9), merchant: "Grab", category: "Transport", amount: Math.round(420_000 * scale), type: "expense" },
    { id: `${key}-pln`, date: isoDate(key, 12), merchant: "PLN", category: "Bills & Utilities", amount: Math.round(630_000 * scale), type: "expense" },
    { id: `${key}-coffee`, date: isoDate(key, 16), merchant: "Kopi Tuku", category: "Food & Dining", amount: Math.round(185_000 * scale), type: "expense" },
    { id: `${key}-shop`, date: isoDate(key, 20), merchant: "Tokopedia", category: "Shopping", amount: Math.round(920_000 * scale), type: "expense" }
  ];

  return [
    ...rows(months[0], 15_600_000, 1),
    ...rows(months[1], 14_400_000, 1.08),
    ...rows(months[2], 14_000_000, 1.02)
  ];
}

export function createFixtureBudgets(): Budget[] {
  return [
    { category: "Housing", limit: 3_800_000 },
    { category: "Food & Dining", limit: 1_700_000 },
    { category: "Transport", limit: 900_000 },
    { category: "Bills & Utilities", limit: 900_000 },
    { category: "Shopping", limit: 1_500_000 }
  ];
}
