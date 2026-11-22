import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { renderFinanceWorkbook } from '@/features/finance-export/logic/rendering';
import { financeBookFixture } from './fixtures';

async function read(book = financeBookFixture()) {
  const bytes = await renderFinanceWorkbook(book);
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(Array.from(bytes.slice(0, 2))).toEqual([80, 75]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return workbook;
}
function cells(sheet: ExcelJS.Worksheet) {
  const result: ExcelJS.Cell[] = [];
  sheet.eachRow(row => row.eachCell(cell => result.push(cell)));
  return result;
}
function section(sheet: ExcelJS.Worksheet, heading: string, occurrence = 0) {
  const headings = cells(sheet).filter(c => Number(c.col) === 1 && c.value === heading);
  const start = headings[occurrence]?.row;
  expect(start).toBeDefined();
  return (label: string) => {
    const match = cells(sheet).find(c => Number(c.col) === 1 && Number(c.row) > Number(start) && c.value === label);
    expect(match, label).toBeDefined();
    return sheet.getCell(Number(match!.row), 2);
  };
}

describe('finance workbook rendering', () => {
  it('round trips Hebrew RTL, numeric transaction values and exact filtered input order', async () => {
    const book = financeBookFixture();
    const original = structuredClone(book);
    const workbook = await read(book);
    const sheet = workbook.getWorksheet('כספים')!;
    expect(sheet.views[0].rightToLeft).toBe(true);
    expect(cells(sheet).some(c => String(c.value).includes('לפני מע״מ'))).toBe(true);
    expect(cells(sheet).some(c => c.value === book.projectName)).toBe(true);
    const rows = [...book.months[0].incomeRows, ...book.months[0].expenseRows];
    const found = rows.map(row => {
      const cell = cells(sheet).find(c => c.value === row.details)!;
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(sheet.getCell(Number(cell.row), 1).value).toBe(row.day ?? '—');
      expect(sheet.getCell(Number(cell.row), 4).value).toBe(row.amount / 100);
      expect(sheet.getCell(Number(cell.row), 4).type).toBe(ExcelJS.ValueType.Number);
      return Number(cell.row);
    });
    expect(found).toEqual([...found].sort((a, b) => a - b));
    expect(cells(sheet).filter(c => ['הכנסה', 'החזר ללקוח', 'הוצאה', 'זיכוי מספק'].includes(String(c.value)))).toHaveLength(5);
    expect(book).toEqual(original);
  });

  it('copies calculated month/period summaries instead of recalculating visible rows', async () => {
    const sheet = (await read()).getWorksheet('כספים')!;
    for (const heading of ['סיכום תקופה', 'סיכום חודש']) {
      const value = section(sheet, heading);
      for (const [label, expected] of [ ['הכנסות', 9876.54], ['הוצאות', 3456.78], ['מס', 123.45],
        ['סה״כ הוצאות', 3580.23], ['רווח נקי', 6296.31], ['שארית', 8123.45], ['אחוז רווח', 0.637] ] as const) {
        expect(value(label).value, `${heading}: ${label}`).toBe(expected);
        expect(value(label).type).toBe(ExcelJS.ValueType.Number);
      }
      expect(value('אחוז רווח').numFmt).toBe('0.0%');
    }
    const filtered = section(sheet, 'סיכום שורות מסוננות');
    expect(filtered('הכנסות').value).toBe(98.45);
    expect(filtered('הוצאות').value).toBe(49.88);
    expect(cells(sheet).some(c => c.value === 'חודש 12/2026')).toBe(true);
    expect(cells(sheet).some(c => c.value === 'חודש 01/2027')).toBe(true);
    const empty = section(sheet, 'סיכום חודש', 1);
    expect(empty('שארית').value).toBe(8123.45);
    expect(empty('אחוז רווח').value).toBe('—');
    expect(empty('הכנסות').value).toBe(0);
  });

  it('preserves negative summaries, zero percentages and an empty book', async () => {
    const book = financeBookFixture();
    book.months = [];
    book.period = { income: -101, expense: -202, tax: -3, totalExpense: -205, netProfit: 104, balance: -999, profitPercentTenths: 0 };
    const sheet = (await read(book)).getWorksheet('כספים')!;
    const value = section(sheet, 'סיכום תקופה');
    expect(value('הכנסות').value).toBe(-1.01);
    expect(value('הוצאות').value).toBe(-2.02);
    expect(value('מס').value).toBe(-0.03);
    expect(value('שארית').value).toBe(-9.99);
    expect(value('אחוז רווח').value).toBe(0);
  });

  it.each(['=SUM(1,2)', '+123', '-123', '@SUM(A1)', '=HYPERLINK("https://example.invalid","בדיקה")'])('keeps hostile text as literal strings: %s', async text => {
    const book = financeBookFixture();
    book.projectName = text;
    book.filter.search = text;
    book.months[0].incomeRows[0].details = text;
    const workbook = await read(book);
    const sheet = workbook.getWorksheet('כספים')!;
    const matches = cells(sheet).filter(c => c.value === text);
    expect(matches.length).toBeGreaterThanOrEqual(3);
    matches.forEach(c => expect(c.type).toBe(ExcelJS.ValueType.String));
    workbook.eachSheet(s => cells(s).forEach(c => expect(c.type).not.toBe(ExcelJS.ValueType.Formula)));
  });

  it('strips U+FFFE and U+FFFF from text, which XML cannot carry, and reads back', async () => {
    const book = financeBookFixture();
    book.projectName = '\uFFFEפרויקט\uFFFF בדוי';
    book.filter.search = 'חיפוש\uFFFF\uFFFE בדוי';
    book.months[0].incomeRows[0].details = 'פרטים בדויים\uFFFE\uFFFF';
    const values = cells((await read(book)).getWorksheet('כספים')!).map(c => c.value);
    for (const clean of ['פרויקט בדוי', 'חיפוש בדוי', 'פרטים בדויים']) expect(values).toContain(clean);
  });

  it.each(['projectName', 'search', 'details'])('rejects formula objects passed into text field %s', async field => {
    const book = financeBookFixture();
    const malicious = { formula: '1+1', result: 2 } as unknown as string;
    if (field === 'projectName') book.projectName = malicious;
    else if (field === 'search') book.filter.search = malicious;
    else book.months[0].incomeRows[0].details = malicious;
    await expect(renderFinanceWorkbook(book)).rejects.toThrow();
  });

  it('copies a negative percentage and selected month without recomputing them', async () => {
    const book = financeBookFixture();
    book.filter = { period: { year: 2026, month: 12 } };
    book.period.profitPercentTenths = -127;
    const sheet = (await read(book)).getWorksheet('כספים')!;
    expect(section(sheet, 'סיכום תקופה')('אחוז רווח').value).toBe(-0.127);
    expect(cells(sheet).some(c => c.value === '12/2026')).toBe(true);
  });

  it('rejects formula objects in numeric fields as well', async () => {
    const book = financeBookFixture();
    book.months[0].incomeRows[0].amount = { formula: '1+1' } as unknown as number;
    await expect(renderFinanceWorkbook(book)).rejects.toThrow();
  });

  it('exports 36 months of 100 transactions without truncation', async () => {
    const book = financeBookFixture();
    const base = book.months[0];
    book.months = Array.from({ length: 36 }, (_, m) => ({
      summary: { ...base.summary, year: 2024 + Math.floor(m / 12), month: m % 12 + 1 },
      incomeRows: Array.from({ length: 100 }, (_, i) => ({ ...base.incomeRows[0],
        id: `row-${m}-${i}`, year: 2024 + Math.floor(m / 12), month: m % 12 + 1,
        position: i, details: `בדוי-${m}-${i}`, amount: m * 100 + i })), expenseRows: [],
    }));
    const sheet = (await read(book)).getWorksheet('כספים')!;
    const detailCells = cells(sheet).filter(c => typeof c.value === 'string' && c.value.startsWith('בדוי-'));
    expect(detailCells).toHaveLength(3600);
    expect(detailCells.map(c => c.value)).toEqual(book.months.flatMap(m => m.incomeRows.map(r => r.details)));
    expect(sheet.getCell(Number(detailCells.at(-1)!.row), 4).value).toBe(35.99);
  });
});
