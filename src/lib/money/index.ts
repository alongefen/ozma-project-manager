import type { Agorot, Month, MonthSummary, MoneySummary, RawMonthTotals, Result } from "./types";
export type { Agorot, Month, MonthSummary, MoneySummary, RawMonthTotals, Result } from "./types";

const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function integer(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new RangeError("הערך חייב להיות מספר שלם בטווח הבטוח");
  return BigInt(value);
}

function safeNumber(value: bigint): number {
  if (value > MAX || value < -MAX) throw new RangeError("תוצאת החישוב מחוץ לטווח הבטוח");
  return Number(value);
}

// המכנה חיובי; מעגלים ערך מוחלט ואז מחזירים סימן, גם בחצי שלילי.
function roundRatio(numerator: bigint, denominator: bigint): bigint {
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = (magnitude * 2n + denominator) / (denominator * 2n);
  return numerator < 0n ? -rounded : rounded;
}

function monthIndex(value: Month): bigint {
  const year = integer(value.year);
  if (year < 1n || !Number.isInteger(value.month) || value.month < 1 || value.month > 12) {
    throw new RangeError("נדרשים שנה חיובית וחודש בין 1 ל-12");
  }
  return (year - 1n) * 12n + BigInt(value.month - 1);
}

function summary(income: bigint, expense: bigint, tax: bigint): MoneySummary {
  const totalExpense = expense + tax;
  const netProfit = income - totalExpense;
  return {
    income: safeNumber(income),
    expense: safeNumber(expense),
    tax: safeNumber(tax),
    totalExpense: safeNumber(totalExpense),
    netProfit: safeNumber(netProfit),
    profitPercentTenths: income > 0n ? safeNumber(roundRatio(netProfit * 1000n, income)) : null,
  };
}

/** טקסט עשרוני בשקלים, סימן אופציונלי ועד שתי ספרות אחרי הנקודה. */
export function parseShekels(text: string): Result<Agorot> {
  const invalid = (): Result<Agorot> => ({
    ok: false,
    error: { code: "VALIDATION", message: "יש להזין סכום בטווח הבטוח עם עד שתי ספרות אחרי הנקודה" },
  });
  if (typeof text !== "string") return invalid();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return invalid();
  const magnitude = BigInt(match[2]) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  if (magnitude > MAX) return invalid();
  return { ok: true, value: Number(match[1] === "-" ? -magnitude : magnitude) };
}

export function taxForMonth(income: Agorot): Agorot {
  return safeNumber(roundRatio(integer(income) * 3n, 100n));
}

/** הקלט כבר כולל החזרים וזיכויים; חישוב טהור לפרויקט אחד. */
export function summarizeMonth(raw: RawMonthTotals, previousBalance: Agorot): MonthSummary {
  monthIndex(raw);
  const previous = integer(previousBalance);
  const totals = summary(integer(raw.income), integer(raw.expense), BigInt(taxForMonth(raw.income)));
  return { year: raw.year, month: raw.month, ...totals, balance: safeNumber(previous + BigInt(totals.netProfit)) };
}

/** חודש אחד לכל קלט; through מאריך את הרצף (כולל), ואינו מסנן נתונים. */
export function buildMonths(raw: RawMonthTotals[], through?: Month): MonthSummary[] {
  const throughIndex = through === undefined ? undefined : monthIndex(through);
  const byMonth = new Map<bigint, RawMonthTotals>();
  let first: bigint | undefined;
  let last: bigint | undefined;
  for (const value of raw) {
    const index = monthIndex(value);
    integer(value.income);
    integer(value.expense);
    if (byMonth.has(index)) throw new RangeError("נדרש סיכום נטו יחיד לכל חודש");
    byMonth.set(index, value);
    if (first === undefined || index < first) first = index;
    if (last === undefined || index > last) last = index;
  }
  if (first === undefined || last === undefined) return [];
  if (throughIndex !== undefined && throughIndex > last) last = throughIndex;
  const months: MonthSummary[] = [];
  let previousBalance = 0;
  for (let index = first; index <= last; index++) {
    const value = byMonth.get(index) ?? {
      year: safeNumber(index / 12n + 1n), month: Number(index % 12n) + 1, income: 0, expense: 0,
    };
    const month = summarizeMonth(value, previousBalance);
    months.push(month);
    previousBalance = month.balance;
  }
  return months;
}

/** מס שכבר עוגל מחובר כמות שהוא; השארית היא של החודש המאוחר בתקופה. */
export function summarizePeriod(months: MonthSummary[]): MoneySummary & { balance: Agorot } {
  let income = 0n;
  let expense = 0n;
  let tax = 0n;
  let balance = 0;
  let last: bigint | undefined;
  const seen = new Set<bigint>();
  for (const month of months) {
    const index = monthIndex(month);
    if (seen.has(index)) throw new RangeError("נדרש סיכום יחיד לכל חודש בתקופה");
    seen.add(index);
    income += integer(month.income);
    expense += integer(month.expense);
    tax += integer(month.tax);
    integer(month.totalExpense);
    integer(month.netProfit);
    integer(month.balance);
    if (month.profitPercentTenths !== null) integer(month.profitPercentTenths);
    if (last === undefined || index > last) {
      last = index;
      balance = month.balance;
    }
  }
  return { ...summary(income, expense, tax), balance };
}
