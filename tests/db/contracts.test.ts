import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DiaryApiInputSchemas, DocumentAccessSchema, MoneySummarySchema, MonthSummarySchema, ProjectsApiInputSchemas, TasksApiInputSchemas, TransactionFieldsSchema } from '../../src/types/contracts/schemas';
describe('חוזי קלט', () => {
  it('חוסם זיוף מדווח וזמן ושדות שאינם בחוזה', () => {
    const input = { requestId: randomUUID(), projectId: randomUUID(), workDate: '2026-01-01', body: 'דיווח', fileIds: [] };
    expect(DiaryApiInputSchemas.createEntry.safeParse(input).success).toBe(true);
    for (const field of ['reporterId', 'enteredAt', 'editedAt']) expect(DiaryApiInputSchemas.createEntry.safeParse({ ...input, [field]: 'forged' }).success).toBe(false);
    expect(DiaryApiInputSchemas.correctEntry.safeParse({ id: randomUUID(), expectedRevision: 1, body: 'א', fileIds: [], projectId: randomUUID() }).success).toBe(false);
  });
  it('מאמת יום בחודש ואגורות שלמות בתחום', () => {
    const input = { year: 2024, month: 2, day: 29, kind: 'income', amount: 17, details: 'בדיקה' };
    expect(TransactionFieldsSchema.safeParse(input).success).toBe(true);
    for (const patch of [{year:2023}, {amount:0}, {amount:1.1}, {amount:100000000001}, {details:' '}]) expect(TransactionFieldsSchema.safeParse({...input,...patch}).success).toBe(false);
  });
  it('דורש גישה מפורשת ונבחר אחד לפחות', () => {
    expect(DocumentAccessSchema.safeParse({mode:'selected',userIds:[]}).success).toBe(false);
    expect(DocumentAccessSchema.safeParse({mode:'all'}).success).toBe(true);
  });
  it('חוסם פתק ריק, ארוך ושדות משימה שלא אושרו', () => {
    const base = { requestId:randomUUID(), projectId:randomUUID(), body:'פתק', dueDate:null, completed:false };
    expect(TasksApiInputSchemas.createTask.safeParse(base).success).toBe(true);
    for(const patch of [{body:' '},{body:'א'.repeat(2001)},{assigneeId:randomUUID()}]) expect(TasksApiInputSchemas.createTask.safeParse({...base,...patch}).success).toBe(false);
  });
  it('מאמת תאריכי פרויקט', () => {
    expect(ProjectsApiInputSchemas.createProject.safeParse({ requestId: randomUUID(), fields: {
      name:'א',businessName:'ב',siteAddress:'ג',contact:{name:'ד',phone:'0',email:null,roleTitle:null},
      startDate:'2026-02-01',endDate:'2026-01-01',accessNotes:null,
    }}).success).toBe(false);
  });
});


describe('חוזי סיכום כספי', () => {
  it.each([0, -300])('מקבל אחוז רווח בעשיריות של %i', (profitPercentTenths) => {
    const summary = {
      income: 10000, expense: profitPercentTenths === 0 ? 9700 : 12700,
      tax: 300, totalExpense: profitPercentTenths === 0 ? 10000 : 13000,
      netProfit: profitPercentTenths === 0 ? 0 : -3000, profitPercentTenths,
    };
    expect(MoneySummarySchema.safeParse(summary).success).toBe(true);
    expect(MonthSummarySchema.safeParse({ ...summary, year: 2026, month: 1, balance: summary.netProfit }).success).toBe(true);
  });
});
