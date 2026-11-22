import { describe, expect, it } from "vitest";
import { buildMonths, parseShekels, summarizeMonth, summarizePeriod, taxForMonth } from "@/lib/money";

const raw = (income = 0, expense = 0, year = 2026, month = 1) => ({ year, month, income, expense });
const max = Number.MAX_SAFE_INTEGER;

describe("פענוח שקלים", () => {
  it.each([
    ["0", 0], ["0.29", 29], ["1000.50", 100050], ["-0.50", -50],
    [" 12.3 ", 1230], ["0001.01", 101], ["-0", 0],
    ["90071992547409.91", max], ["-90071992547409.91", -max],
  ])("מפענח %s ללא אובדן אגורות", (input, expected) => {
    expect(parseShekels(input)).toEqual({ ok: true, value: expected });
  });
  it.each(["", " ", "1.001", "NaN", "Infinity", "1e3", "1,000", "₪1", "1.2.3", ".5", "1.", "--1", "90071992547409.92", "-90071992547409.92"]) (
    "דוחה קלט שגוי %s", (input) => {
      expect(parseShekels(input)).toMatchObject({ ok: false, error: { code: "VALIDATION", message: expect.any(String) } });
    },
  );
});

describe("מס ועיגול", () => {
  it.each([[0, 0], [16, 0], [17, 1], [49, 1], [50, 2], [-50, -2], [-17, -1], [-16, 0], [100050, 3002], [max, 270215977642230], [-max, -270215977642230]])(
    "%s אגורות נותנות מס %s", (income, expected) => expect(taxForMonth(income)).toBe(expected),
  );
  it.each([NaN, Infinity, -Infinity, 0.5, max + 1, -max - 1])("דוחה סכום לא בטוח %s", (income) => {
    expect(() => taxForMonth(income)).toThrow(RangeError);
  });
});

describe("סיכום חודש", () => {
  it("כולל מס בהוצאה פעם אחת", () => {
    expect(summarizeMonth(raw(10000000, 6000000), 0)).toEqual({
      year: 2026, month: 1, income: 10000000, expense: 6000000,
      tax: 300000, totalExpense: 6300000, netProfit: 3700000,
      profitPercentTenths: 370, balance: 3700000,
    });
  });
  it("החזר בחודש מאוחר מקטין הכנסה ומס", () => {
    expect(summarizeMonth(raw(-10000000), 0)).toMatchObject({ tax: -300000, netProfit: -9700000, profitPercentTenths: null, balance: -9700000 });
  });
  it("מקבל נטו לאחר זיכוי ספק", () => {
    expect(summarizeMonth(raw(10000, -2000), 0)).toMatchObject({ expense: -2000, totalExpense: -1700, netProfit: 11700, profitPercentTenths: 1170 });
  });
  it.each([[1, 1], [-1, -1]])("מעגל חצי עשירית אחוז הרחק מאפס (%s)", (profit, expected) => {
    expect(summarizeMonth(raw(2000, 1940 - profit), 0).profitPercentTenths).toBe(expected);
  });
  it("ללא הכנסה אין אחוז רווח", () => {
    expect(summarizeMonth(raw(0, 100), -200).profitPercentTenths).toBeNull();
  });
  it("מחשב במדויק גם כשהכפל לחישוב האחוז חורג מ-safe integer", () => {
    expect(summarizeMonth(raw(max), 0)).toMatchObject({ tax: 270215977642230, netProfit: 8736983277098761, profitPercentTenths: 970 });
  });
  it("דוחה חריגה בכל שדה פלט ובקלט", () => {
    expect(() => summarizeMonth(raw(100, max), 0)).toThrow(RangeError);
    expect(() => summarizeMonth(raw(max, -max), 0)).toThrow(RangeError);
    expect(() => summarizeMonth(raw(100), max)).toThrow(RangeError);
    expect(() => summarizeMonth(raw(1, -max + 1), 0)).toThrow(RangeError);
    expect(() => summarizeMonth(raw(0, 0.5), 0)).toThrow(RangeError);
    expect(() => summarizeMonth(raw(), NaN)).toThrow(RangeError);
  });
});

describe("רצף חודשים ותקופות", () => {
  it("ארבעת חודשי הקבלה", () => {
    const months = buildMonths([1, 2, 3, 4].map((month) => raw(10000000, 6000000, 2026, month)));
    expect(months.map((m) => [m.tax, m.netProfit, m.balance])).toEqual([
      [300000, 3700000, 3700000], [300000, 3700000, 7400000],
      [300000, 3700000, 11100000], [300000, 3700000, 14800000],
    ]);
    expect(summarizePeriod(months)).toEqual({ income: 40000000, expense: 24000000, tax: 1200000, totalExpense: 25200000, netProfit: 14800000, profitPercentTenths: 370, balance: 14800000 });
    expect(summarizePeriod(months.slice(2)).balance).toBe(14800000);
  });
  it("מס לתקופה הוא סכום מסי החודשים המעוגלים", () => {
    const months = buildMonths([1, 2, 3].map((month) => raw(17, 0, 2026, month)));
    expect(summarizePeriod(months)).toMatchObject({ income: 51, tax: 3, netProfit: 48, balance: 48, profitPercentTenths: 941 });
    expect(taxForMonth(51)).toBe(2);
  });
  it("מסדר קלט בלי לשנותו, משלים ריקים ומעביר שארית שלילית דרך מעבר שנה", () => {
    const input = Object.freeze([Object.freeze(raw(0, 0, 2027, 2)), Object.freeze(raw(0, 500000, 2026, 12))]);
    const months = buildMonths([...input], { year: 2027, month: 3 });
    expect(months.map((m) => [m.year, m.month, m.balance])).toEqual([[2026, 12, -500000], [2027, 1, -500000], [2027, 2, -500000], [2027, 3, -500000]]);
    expect(months[1]).toMatchObject({ income: 0, expense: 0, tax: 0, netProfit: 0, profitPercentTenths: null });
    expect(summarizePeriod([...months].reverse()).balance).toBe(-500000);
    expect(input[0].month).toBe(2);
  });
  it("through מאריך עד החודש המבוקש כולל, בלי לקצץ נתונים קיימים", () => {
    expect(buildMonths([raw(100, 0, 2026, 3)], { year: 2026, month: 1 })).toHaveLength(1);
    expect(buildMonths([raw(100)], { year: 2026, month: 3 })).toHaveLength(3);
  });
  it("מחשב 36 חודשים בלי תקרת ארבעה חודשים", () => {
    const months = buildMonths([raw(10000)], { year: 2028, month: 12 });
    expect(months).toHaveLength(36);
    expect(months[35]).toMatchObject({ year: 2028, month: 12, balance: 9700 });
  });
  it("קלט ריק אינו ממציא חודש ראשון או זמן נוכחי", () => {
    expect(buildMonths([])).toEqual([]);
    expect(buildMonths([], { year: 2026, month: 12 })).toEqual([]);
    expect(summarizePeriod([])).toEqual({ income: 0, expense: 0, tax: 0, totalExpense: 0, netProfit: 0, profitPercentTenths: null, balance: 0 });
  });
  it("דוחה חודשים לא תקינים וכפילויות במקום להכפיל מס", () => {
    for (const month of [0, 13, 1.5, NaN]) expect(() => buildMonths([raw(0, 0, 2026, month)])).toThrow(RangeError);
    for (const year of [0, -1, 2026.5, Infinity]) expect(() => summarizeMonth(raw(0, 0, year), 0)).toThrow(RangeError);
    expect(() => buildMonths([raw(), raw()])).toThrow(RangeError);
    expect(() => buildMonths([], { year: 2026, month: 13 })).toThrow(RangeError);
    const month = summarizeMonth(raw(), 0);
    expect(() => summarizePeriod([month, month])).toThrow(RangeError);
  });
  it("סכומי ביניים בתקופה מדויקים גם אם רק הסכום הסופי בטוח", () => {
    const months = [raw(max, 0, 2026, 1), raw(max, 0, 2026, 2), raw(-max, 0, 2026, 3)].map((m) => summarizeMonth(m, 0));
    expect(summarizePeriod(months).income).toBe(max);
    expect(() => summarizePeriod(months.slice(0, 2))).toThrow(RangeError);
    expect(() => buildMonths([raw(max), raw(max, 0, 2026, 2)])).toThrow(RangeError);
  });
});

describe("עצמאות פרויקטים וסכום העברה", () => {
  it("שני פרויקטים של 1,000.50 נותנים העברה של 60.04", () => {
    const projects = [buildMonths([raw(100050)]), buildMonths([raw(100050)])];
    expect(projects.map((p) => p[0].tax)).toEqual([3002, 3002]);
    expect(projects.reduce((sum, p) => sum + p[0].tax, 0)).toBe(6004);
  });
  it("שלושה פרויקטים של 0.17 ושינוי אחד מהם", () => {
    const inputs = [raw(17), raw(17), raw(17)];
    const before = inputs.map((m) => buildMonths([m]));
    inputs[0] = raw(100000);
    const after = inputs.map((m) => buildMonths([m]));
    expect(before.reduce((sum, p) => sum + p[0].tax, 0)).toBe(3);
    expect(after.reduce((sum, p) => sum + p[0].tax, 0)).toBe(3002);
    expect(after.slice(1)).toEqual(before.slice(1));
  });
});
