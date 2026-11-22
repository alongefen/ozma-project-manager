import type { Format } from '@/types/contracts';
import { IsoDateSchema } from '@/types/contracts/schemas';
const timeZone = 'Asia/Jerusalem';
export const format: Format = {
  date(value) {
    if (!IsoDateSchema.safeParse(value).success) throw new RangeError('תאריך לא תקין');
    return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  },
  dateTime(value) {
    const date = new Date(value);
    const p = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const part = (name: string) => p.find(x => x.type === name)?.value;
    return `${part('day')}.${part('month')}.${part('year')} ${part('hour')}:${part('minute')}`;
  },
  money(value) {
    if (!Number.isSafeInteger(value)) throw new RangeError('סכום לא תקין');
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(value / 100);
  },
  searchKey(value) { return value.normalize('NFKC').replace(/[׳‘’`]/g, "'").replace(/[״“”]/g, '"').trim().replace(/\s+/g, ' ').toLocaleLowerCase('he-IL'); },
  todayInIsrael(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); },
};
