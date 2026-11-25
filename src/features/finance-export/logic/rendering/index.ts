import ExcelJS from 'exceljs';
import type { FinanceBook, MoneySummary, TransactionKind, TransactionRow } from '@/types/contracts/finance';

const moneyFormat = '#,##0.00;[Red]-#,##0.00';
const kindLabels: Record<TransactionKind, string> = {
  income: 'הכנסה',
  income_refund: 'החזר ללקוח',
  expense: 'הוצאה',
  expense_credit: 'זיכוי מספק',
};

// Never pass caller-supplied objects to ExcelJS, which accepts formula objects.
function text(value: string): string {
  if (typeof value !== 'string') throw new TypeError('טקסט חייב להיות מחרוזת');
  // שני תווים שאסורים ב-XML ו-ExcelJS אינו מסיר; בלי זה הקובץ אינו נפתח.
  return value.replace(/[\uFFFE\uFFFF]/g, '');
}

function integer(value: number): number {
  if (!Number.isSafeInteger(value)) throw new TypeError('הערך חייב להיות מספר שלם בטוח');
  return value;
}

function monthLabel(value: { year: number; month: number }): string {
  return `${String(integer(value.month)).padStart(2, '0')}/${integer(value.year)}`;
}

/** Formats an already calculated, already authorized book; performs no finance calculations. */
export async function renderFinanceWorkbook(book: FinanceBook): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('כספים', {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [{ width: 24 }, { width: 28 }, { width: 64 }, { width: 25 }];

  function add(values: (string | number)[]): ExcelJS.Row {
    const row = sheet.addRow(values);
    row.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, color: { argb: 'FF172D3C' } };
      cell.alignment = { horizontal: 'right', vertical: 'top', wrapText: true, readingOrder: 'rtl' };
      if (typeof cell.value === 'number') cell.alignment = { horizontal: 'right', vertical: 'top', readingOrder: 'ltr' };
    });
    return row;
  }

  function heading(label: string): void {
    const row = add([label]);
    sheet.mergeCells(row.number, 1, row.number, 4);
    row.height = 26;
    row.getCell(1).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF234858' } };
  }

  function amount(label: string, agorot: number): void {
    add([label, integer(agorot) / 100]).getCell(2).numFmt = moneyFormat;
  }

  function summary(label: string, value: MoneySummary & { balance: number }): void {
    heading(label);
    amount('הכנסות (לא כולל מע״מ)', value.income);
    amount('הוצאות', value.expense);
    amount('מס', value.tax);
    amount('סה״כ הוצאות', value.totalExpense);
    amount('רווח נקי', value.netProfit);
    const percent = value.profitPercentTenths;
    add(['אחוז רווח', percent === null ? '—' : integer(percent) / 1000]).getCell(2).numFmt = '0.0%';
    amount('שארית', value.balance);
  }

  function transactions(label: string, rows: TransactionRow[]): void {
    heading(label);
    const header = add(['יום', 'סוג', 'פרטים', 'סכום לפני מע״מ']);
    header.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EFF2' } };
    });
    for (const transaction of rows) {
      if (!Object.hasOwn(kindLabels, transaction.kind)) throw new TypeError('סוג תנועה לא תקין');
      const row = add([
        transaction.day === null ? '—' : integer(transaction.day),
        kindLabels[transaction.kind],
        text(transaction.details),
        integer(transaction.amount) / 100,
      ]);
      row.getCell(4).numFmt = moneyFormat;
    }
  }

  heading('דוח כספי — לפני מע״מ');
  add(['פרויקט', text(book.projectName)]);
  add(['תקופה', book.filter.period === 'all' ? 'כל התקופה' : monthLabel(book.filter.period)]);
  if (book.filter.day !== undefined) add(['יום מסונן', integer(book.filter.day)]);
  if (book.filter.search !== undefined) add(['חיפוש', text(book.filter.search)]);
  add(['ימי עבודה', integer(book.workDays)]);
  add([]);
  summary('סיכום תקופה', book.period);
  heading('סיכום שורות מסוננות');
  amount('הכנסות (לא כולל מע״מ)', book.filteredRows.income);
  amount('הוצאות', book.filteredRows.expense);

  for (const month of book.months) {
    add([]);
    heading(`חודש ${monthLabel(month.summary)}`);
    transactions('הכנסות (לא כולל מע״מ)', month.incomeRows);
    transactions('הוצאות', month.expenseRows);
    summary('סיכום חודש', month.summary);
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
