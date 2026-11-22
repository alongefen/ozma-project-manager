// טיפוסים מקומיים מינימליים לפי ARCHITECTURE 5.3 ו-5.10.
// ההתאמה לחוזים המשותפים תיבדק בשלב החיבור אחרי P1.3.
export type Agorot = number;
export type Month = { year: number; month: number };
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: "VALIDATION"; message: string; fieldErrors?: Record<string, string> } };
export type RawMonthTotals = Month & { income: Agorot; expense: Agorot };
export type MoneySummary = {
  income: Agorot;
  expense: Agorot;
  tax: Agorot;
  totalExpense: Agorot;
  netProfit: Agorot;
  profitPercentTenths: number | null;
};
export type MonthSummary = Month & MoneySummary & { balance: Agorot };
