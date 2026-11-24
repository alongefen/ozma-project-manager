// The fictional demo content as plain data (no network). Everything is invented: no real people, companies or addresses.
// Dates are relative to "today", so the demo always looks recent; request ids are fixed per item (a retry never duplicates).
import {stableUuid} from '../ops/lib.mjs';

export const DEMO_DOMAIN = '@example.invalid';
export const NAME_PREFIX = 'דוגמה: ';
export const MARK = ' (דמו)';

export const PEOPLE = [
  {key: 'm1', name: `דנה כהן${MARK}`, email: `demo.manager.dana${DEMO_DOMAIN}`, kind: 'manager'},
  {key: 'm2', name: `יוסי לוי${MARK}`, email: `demo.manager.yossi${DEMO_DOMAIN}`, kind: 'manager'},
  {key: 'w1', name: `אבי מזרחי${MARK}`, email: `demo.worker.avi${DEMO_DOMAIN}`, kind: 'worker'},
  {key: 'w2', name: `רועי פרץ${MARK}`, email: `demo.worker.roi${DEMO_DOMAIN}`, kind: 'worker'},
  {key: 'w3', name: `מיכל אדרי${MARK}`, email: `demo.worker.michal${DEMO_DOMAIN}`, kind: 'worker'},
].map(p => ({...p, requestId: stableUuid(`demo:profile:${p.key}`)}));

const KG = 100; // amounts are written in shekels and stored in agorot

export function dateOffset(today, days) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days));
  return d.toISOString().slice(0, 10);
}

// A transaction date `monthsAgo` calendar months back; the day is clamped to the month (and to today for the current month).
export function txDate(today, monthsAgo, day) {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const max = monthsAgo === 0 ? Math.min(last, today.getUTCDate()) : last;
  return {year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: Math.max(1, Math.min(day, max))};
}

const tx = (monthsAgo, day, kind, shekels, details, by = 'owner') => ({monthsAgo, day, kind, amount: shekels * KG, details, by});

export function buildPlan(today = new Date()) {
  const d = n => dateOffset(today, n);
  const contact = (name, phone) => ({name, phone, email: null, roleTitle: 'נציג הלקוח (דמו)'});
  const projects = [
    {
      key: 'A', status: 'active',
      fields: {
        name: `${NAME_PREFIX}בניין מגורים - רחוב הדוגמה 12`, businessName: 'בניין מגורים לדוגמה', siteAddress: 'רחוב הדוגמה 12, עיר לדוגמה',
        contact: contact('לקוח לדוגמה (דמו)', '050-0000001'), startDate: d(120), endDate: null,
        accessNotes: 'פרויקט לדוגמה בלבד. כניסה דרך השער הצפוני (פיקטיבי).', businessNumber: 'DEMO-0001',
      },
      members: [{user: 'm1', role: 'manager', finance: true}, {user: 'm2', role: 'manager', finance: false}, {user: 'w1', role: 'worker'}, {user: 'w2', role: 'worker'}],
      diary: [
        {key: 'a1', by: 'owner', ago: 34, body: 'פתיחת האתר: גידור, חיבור חשמל זמני והצבת מכולת משרד. הובאה ציוד ראשוני.'},
        {key: 'a2', by: 'm1', ago: 30, body: 'סיום חפירה לקומת המרתף. נבדקה יציבות הקרקע, הכול תקין. ממתינים לאישור מהנדס.'},
        {key: 'a3', by: 'w1', ago: 25, body: 'יציקת רצפת המרתף. שלוש משאיות בטון, הכול הושלם עד השעה 15:00.', files: [{kind: 'photo', name: 'יציקת רצפה (דמו).jpg', tone: 0}], correctedBody: 'יציקת רצפת המרתף. ארבע משאיות בטון (תוקן: לא שלוש), הכול הושלם עד השעה 15:00.'},
        {key: 'a4', by: 'w2', ago: 21, body: 'הקמת טפסנות לעמודי קומה ראשונה. חסר חומר ביטון, הוזמן.'},
        {key: 'a5', by: 'm2', ago: 16, body: 'פגישת קבלנים באתר. סוכם לוח זמנים לשלד קומות א-ב.', files: [{kind: 'pdf', name: 'פרוטוקול פגישה (דמו).pdf'}]},
        {key: 'a6', by: 'w1', ago: 12, body: 'ברזל זיון לתקרת קומה א הושלם. ממתינים לבדיקת מפקח.', files: [{kind: 'photo', name: 'ברזל תקרה (דמו).jpg', tone: 1}, {kind: 'photo', name: 'פינת האתר (דמו).jpg', tone: 2}]},
        {key: 'a7', by: 'owner', ago: 7, body: 'ביקור בעלים באתר. נבדקו התקדמות וניקיון. הערות הועברו למנהלת העבודה.'},
        {key: 'a8', by: 'm1', ago: 3, body: 'יציקת תקרת קומה א. מזג אוויר טוב, ללא תקלות.'},
        {key: 'a9', by: 'w2', ago: 1, body: 'פירוק טפסנות והכנה לקומה ב. ניקיון כללי של האתר.'},
      ],
      docs: [
        {key: 'a-d1', by: 'owner', category: 'specification', access: {mode: 'all'}, name: 'מפרט טכני (דמו).pdf', kind: 'pdf'},
        {key: 'a-d2', by: 'owner', category: 'plans', access: {mode: 'all'}, name: 'תוכנית קומת מרתף (דמו).pdf', kind: 'pdf'},
        {key: 'a-d3', by: 'm1', category: 'additional_plans', access: {mode: 'selected', users: ['m1', 'w1']}, name: 'תוכנית חשמל - מנהלת ועובד נבחר (דמו).pdf', kind: 'pdf'},
        {key: 'a-d4', by: 'owner', category: 'renderings', access: {mode: 'all'}, name: 'הדמיית חזית (דמו).jpg', kind: 'photo', tone: 3},
        {key: 'a-d5', by: 'owner', category: 'additional_plans', access: {mode: 'owner'}, name: 'כתב כמויות פנימי - לבעלים בלבד (דמו).xlsx', kind: 'xlsx'},
      ],
      tasks: [
        {key: 'a-t1', body: 'לתאם בדיקת מפקח לתקרת קומה ב', due: d(-5), done: false},
        {key: 'a-t2', body: 'להזמין ברזל לקומה ג', due: d(6), done: false},
        {key: 'a-t3', body: 'להשלים טופס בטיחות שבועי', due: d(2), done: true},
        {key: 'a-t4', body: 'לעדכן את הלקוח בלוח הזמנים', due: d(10), done: false},
      ],
      txs: [
        tx(2, 3, 'income', 400000, 'מקדמה ראשונה מהלקוח (דמו)'),
        tx(2, 10, 'expense', 85000, 'בטון - אספקה ראשונה (דמו)', 'm1'),
        tx(2, 18, 'expense', 62000, 'עבודות עפר וחפירה (דמו)'),
        tx(2, 25, 'expense', 31500, 'שכר פועלים - חודש ראשון (דמו)'),
        tx(1, 2, 'income', 350000, 'תשלום שני מהלקוח (דמו)'),
        tx(1, 9, 'expense', 112000, 'ברזל זיון (דמו)', 'm1'),
        tx(1, 15, 'expense', 47000, 'טפסנות - השכרה (דמו)'),
        tx(1, 20, 'expense_credit', 4200, 'זיכוי על חומר שהוחזר (דמו)'),
        tx(1, 27, 'expense', 33800, 'שכר פועלים - חודש שני (דמו)'),
        tx(0, 1, 'income', 300000, 'תשלום שלישי מהלקוח (דמו)'),
        tx(0, 4, 'expense', 91000, 'בטון - אספקה שנייה (דמו)', 'm1'),
        tx(0, 8, 'expense', 12500, 'הוצאה שנרשמה בטעות (דמו)', 'cancel'),
        tx(0, 12, 'expense', 36000, 'שכר פועלים - חודש שלישי (דמו)', 'fix:34000'),
      ],
    },
    {
      key: 'B', status: 'active',
      fields: {
        name: `${NAME_PREFIX}שיפוץ דירה - שדרות הדוגמה 5`, businessName: 'שיפוץ דירה לדוגמה', siteAddress: 'שדרות הדוגמה 5 דירה 8, עיר לדוגמה',
        contact: contact('לקוחה לדוגמה (דמו)', '050-0000002'), startDate: d(75), endDate: null,
        accessNotes: 'פרויקט לדוגמה בלבד. קומה שלישית, בלי מעלית.', businessNumber: 'DEMO-0002',
      },
      members: [{user: 'm2', role: 'manager', finance: false}, {user: 'w2', role: 'worker'}, {user: 'w3', role: 'worker'}],
      diary: [
        {key: 'b1', by: 'owner', ago: 28, body: 'סיור מקדים בדירה, מדידות וצילום מצב קיים. סוכמה רשימת עבודות.'},
        {key: 'b2', by: 'w3', ago: 24, body: 'פירוק אריחים ישנים במטבח ובשירותים. פינוי פסולת בשתי הובלות.'},
        {key: 'b3', by: 'm2', ago: 19, body: 'הוחלפו צינורות מים בקיר המטבח. נבדק לחץ, אין נזילות.', correctedBody: 'הוחלפו צינורות מים בקיר המטבח ובחדר האמבטיה. נבדק לחץ, אין נזילות.'},
        {key: 'b4', by: 'w2', ago: 14, body: 'טיח וליטוש קירות בסלון. נותר לצבוע.', files: [{kind: 'photo', name: 'קירות סלון (דמו).jpg', tone: 4}]},
        {key: 'b5', by: 'w3', ago: 9, body: 'התקנת ריצוף במטבח, 70% הושלם. חסרות שתי קופסאות אריחים.'},
        {key: 'b6', by: 'm2', ago: 5, body: 'נמסרה ללקוחה הצעת מחיר לארונות המטבח. ממתינים לתשובה.'},
        {key: 'b7', by: 'owner', ago: 2, body: 'בדיקת איכות ביניים. סומנו שלוש נקודות לתיקון קטן.'},
      ],
      docs: [
        {key: 'b-d1', by: 'owner', category: 'specification', access: {mode: 'all'}, name: 'מפרט שיפוץ (דמו).pdf', kind: 'pdf'},
        {key: 'b-d2', by: 'owner', category: 'plans', access: {mode: 'all'}, name: 'תוכנית חלוקה חדשה (דמו).pdf', kind: 'pdf'},
        {key: 'b-d3', by: 'owner', category: 'renderings', access: {mode: 'selected', users: ['m2']}, name: 'הדמיית מטבח - למנהל בלבד (דמו).jpg', kind: 'photo', tone: 5},
        {key: 'b-d4', by: 'owner', category: 'additional_plans', access: {mode: 'owner'}, name: 'תמחור הלקוחה - לבעלים בלבד (דמו).xlsx', kind: 'xlsx'},
      ],
      tasks: [
        {key: 'b-t1', body: 'להזמין שתי קופסאות אריחים חסרות', due: d(-2), done: false},
        {key: 'b-t2', body: 'לתאם צבעי לצביעת הסלון', due: d(4), done: false},
        {key: 'b-t3', body: 'לשלוח ללקוחה את תמונות ההתקדמות', due: d(-8), done: true},
      ],
      txs: [
        tx(2, 5, 'income', 120000, 'מקדמה מהלקוחה (דמו)'),
        tx(2, 12, 'expense', 18000, 'פירוק ופינוי פסולת (דמו)'),
        tx(2, 22, 'expense', 26500, 'חומרי אינסטלציה (דמו)'),
        tx(1, 3, 'income', 90000, 'תשלום שני מהלקוחה (דמו)'),
        tx(1, 11, 'expense', 41000, 'אריחים וחומרי ריצוף (דמו)'),
        tx(1, 19, 'expense', 22000, 'שכר בעלי מקצוע (דמו)'),
        tx(1, 26, 'income_refund', 3500, 'החזר ללקוחה על חומר שלא נוצל (דמו)'),
        tx(0, 2, 'income', 75000, 'תשלום שלישי מהלקוחה (דמו)'),
        tx(0, 6, 'expense', 15500, 'טיח וצבע (דמו)'),
        tx(0, 9, 'expense', 9900, 'כלי עבודה - קנייה כפולה (דמו)', 'cancel'),
        tx(0, 10, 'expense', 24800, 'שכר בעלי מקצוע (דמו)', 'fix:23800'),
      ],
    },
    {
      key: 'C', status: 'completed',
      fields: {
        name: `${NAME_PREFIX}חלל מסחרי - מרכז הדוגמה`, businessName: 'חלל מסחרי לדוגמה', siteAddress: 'מרכז הדוגמה, חנות 14, עיר לדוגמה',
        contact: contact('לקוח מסחרי לדוגמה (דמו)', '050-0000003'), startDate: d(110), endDate: d(6),
        accessNotes: 'פרויקט לדוגמה בלבד. הפרויקט הסתיים: צפייה והדפסה בלבד.', businessNumber: 'DEMO-0003',
      },
      members: [{user: 'm1', role: 'manager', finance: false}, {user: 'w1', role: 'worker'}, {user: 'w3', role: 'worker'}],
      diary: [
        {key: 'c1', by: 'owner', ago: 50, body: 'תחילת עבודות התאמה בחנות: פירוק מחיצות ישנות.'},
        {key: 'c2', by: 'w1', ago: 42, body: 'בניית מחיצות גבס חדשות וחיווט חשמל ראשוני.'},
        {key: 'c3', by: 'm1', ago: 33, body: 'התקנת תקרה אקוסטית ותאורה. נבדק מול התוכנית.', files: [{kind: 'photo', name: 'תקרה ותאורה (דמו).jpg', tone: 6}]},
        {key: 'c4', by: 'w3', ago: 24, body: 'ריצוף ופנלים בקירות. עבודה מדויקת, ללא פסולת מיותרת.'},
        {key: 'c5', by: 'owner', ago: 15, body: 'ביקורת סופית עם הלקוח. נותרו תיקונים קטנים בלבד.'},
        {key: 'c6', by: 'm1', ago: 8, body: 'התיקונים הושלמו, החנות נמסרה ללקוח. הפרויקט נסגר.'},
      ],
      docs: [
        {key: 'c-d1', by: 'owner', category: 'specification', access: {mode: 'all'}, name: 'מפרט חלל מסחרי (דמו).pdf', kind: 'pdf'},
        {key: 'c-d2', by: 'owner', category: 'plans', access: {mode: 'all'}, name: 'תוכנית ריצוף (דמו).pdf', kind: 'pdf'},
        {key: 'c-d3', by: 'owner', category: 'additional_plans', access: {mode: 'owner'}, name: 'סיכום רווחיות - לבעלים בלבד (דמו).xlsx', kind: 'xlsx'},
      ],
      tasks: [
        {key: 'c-t1', body: 'לשלוח ללקוח מסמכי מסירה', due: d(10), done: true},
        {key: 'c-t2', body: 'לארכב את תיק הפרויקט', due: d(4), done: true},
        {key: 'c-t3', body: 'להחזיר ציוד מהאתר', due: d(12), done: true},
      ],
      txs: [
        tx(2, 4, 'income', 200000, 'מקדמה מהלקוח (דמו)'),
        tx(2, 17, 'expense', 56000, 'מחיצות גבס וחומרים (דמו)'),
        tx(2, 28, 'expense', 29000, 'שכר פועלים (דמו)'),
        tx(1, 6, 'income', 180000, 'תשלום שני מהלקוח (דמו)'),
        tx(1, 14, 'expense', 73000, 'תקרה אקוסטית ותאורה (דמו)'),
        tx(1, 22, 'expense', 38000, 'ריצוף ופנלים (דמו)'),
        tx(0, 3, 'income', 150000, 'תשלום סופי מהלקוח (דמו)'),
        tx(0, 5, 'expense', 21000, 'שכר פועלים - סיום (דמו)'),
        tx(0, 7, 'expense', 14500, 'חשבונית כפולה (דמו)', 'cancel'),
        tx(0, 8, 'expense_credit', 5000, 'זיכוי מספק (דמו)'),
      ],
    },
  ];
  return {
    people: PEOPLE, projects,
    stableIds: {entry: (p, e) => stableUuid(`demo:entry:${p.key}:${e.key}`), task: t => stableUuid(`demo:task:${t.key}`), tx: (p, i) => stableUuid(`demo:tx:${p.key}:${i}`), project: p => stableUuid(`demo:project:${p.key}`), file: key => stableUuid(`demo:file:${key}`)},
    today: today.toISOString().slice(0, 10),
  };
}

export function countPlan(plan) {
  const sum = (sel) => plan.projects.reduce((a, p) => a + sel(p), 0);
  const files = p => p.diary.reduce((a, e) => a + (e.files?.length ?? 0), 0);
  return {
    projects: plan.projects.length, completedProjects: plan.projects.filter(p => p.status === 'completed').length,
    people: plan.people.length, managers: plan.people.filter(p => p.kind === 'manager').length, workers: plan.people.filter(p => p.kind === 'worker').length,
    memberships: sum(p => p.members.length), financeOpen: sum(p => p.members.filter(m => m.finance).length),
    diaryEntries: sum(p => p.diary.length), diaryCorrections: sum(p => p.diary.filter(e => e.correctedBody).length), diaryFiles: sum(files),
    documents: sum(p => p.docs.length), ownerOnlyDocuments: sum(p => p.docs.filter(x => x.access.mode === 'owner').length),
    tasks: sum(p => p.tasks.length), tasksDone: sum(p => p.tasks.filter(t => t.done).length),
    transactions: sum(p => p.txs.length), cancelledTransactions: sum(p => p.txs.filter(t => t.by === 'cancel').length), correctedTransactions: sum(p => p.txs.filter(t => String(t.by).startsWith('fix:')).length),
    covers: plan.projects.length,
  };
}
