<div dir="rtl">

# ארכיטקטורה

משימה P0.2, 22.11.2026. **אלון הכריע בתשעת סעיפי G1.** הפירוט הטכני הוא תרגום שלנו להכרעות. **D31-1 אושרה וממתינה לחשבון הלקוח. שום שירות לא הוקם.** המחירים בדולר, לפני מסים, ונבדקו ב-22.11.2026.

## פרק G1: מה הוכרע

### הסטאק

האפליקציה ב-Next.js על Vercel. הנתונים, הכניסה והקבצים ב-Supabase בענן, בפרנקפורט. בלי גיבוי נפרד בשלב הבנייה הראשוני.

### כמה עולה בחודש

| מתי | עלות | הסבר |
|---|---:|---|
| פיתוח, עד ההקמה לייצור | **0$** | סביבת פיתוח חינמית, עם נתונים בדויים בלבד |
| תחילת שימוש, עד 100GB | **65$** | ‏Supabase ‏25$ ו-Vercel ‏40$ |
| גידול, 250GB | **כ-73$** | יותר אחסון ושרת מסד חזק יותר |
| עומס גדול, 1TB | **כ-89$** | מעל התקציב. חוזרים לאלון לפני כן |

ב-Vercel יש 40$ ולא 20$, כי בן הוא בעל החשבון (Q28) ואלון צריך מושב משלו כדי לפרוס. דומיין אינו בסכום: חינם בשנה הראשונה, ואחריה כ-15$ לשנה לסיומת `app`.

### ההכרעות של אלון, 22.11.2026

| מספר | נושא | מה הוכרע |
|---:|---|---|
| 1 | סטאק | אושר: Supabase בענן ו-Vercel |
| 2 | תקציב | אושר: עד 80$ לחודש בשימוש רגיל |
| 3 | גודל קובץ | ״כרגע בסדר״ על ההצעה, ולכן זמנית: 50MB למסמך פרויקט, 25MB לדיווח ולתמונת שער |
| 4 | גישה למסמך (PERM-09) | **שונה: מי שמעלה מגדיר את ההרשאות, ובן יכול לערוך אותן** |
| 5 | מנהלים (PROJ-16) | אושר: אפשר יותר מאחד |
| 6 | גיבוי (A-15, BAK-03) | **נדחה: לא מתעסקים בגיבוי בשלב הבנייה הראשוני** |
| 7 | תיקון דיווח | אושר: רק בן משנה תאריך או פרויקט |
| 8 | ביטול וארכיון | אושר: מבוטל גלוי רק לבן ואינו נספר. ארכיון לצפייה בלבד למנהל ולעובד |
| 9 | ״מקור״ של תמונה | אושר: הקובץ כפי שהטלפון מסר, גם אם אייפון המיר אותו |

### בקשות D31, כל אחת באישור נפרד

| בקשה | מצב | מה | עלות | דרך חזרה |
|---|---|---|---|---|
| **D31-1** | **אושרה. ההקמה רק בחשבון הלקוח, כשיחובר** | ארגון ופרויקט פיתוח ב-Supabase Free בפרנקפורט, בבעלות העסק. אלון Administrator. נועד לבנייה ולבדיקות, בנתונים בדויים | 0$, אם לבן ולאלון יש מקום חינמי פנוי. אחרת חוזרים לאלון | מוחקים את הפרויקט |
| **D31-2** | תבוא בהמשך | המיגרציה הראשונה, כשה-SQL מוכן לסקירה | 0$ | תוצג עם הבקשה |
| **D31-3** | תבוא ב-G4. התקציב אושר, ההקמה לא | ‏Supabase Pro, ‏Vercel Pro עם שני מושבים ודומיין, בבעלות העסק | 65$ לחודש, שימוש מעבר לכלול ודומיין | מייצאים מסד וקבצים ומבטלים |
| **D31-4** | אינה מתבקשת | גיבוי נפרד, נדחה בסעיף 6 | 0$ | אין מה לבטל |

לפני שנכנסים נתונים אמיתיים נשאל את אלון אם ומתי חוזרים לגיבוי.

## 1. סטאק

### 1.1 המלצה וחלופה

| נושא | המלצה: Next.js, Supabase, Vercel | חלופה: Next.js על Render |
|---|---|---|
| מסד | Postgres מנוהל | Render Postgres |
| כניסה | Supabase Auth, כולל יצירה ואיפוס בידי מנהל | ספריית כניסה שבונים ומתחזקים |
| קבצים | Supabase Storage, העלאה ישירה שמתחדשת אחרי ניתוק | R2, ובונים את החתימה וההעלאה |
| הרשאות במסד | RLS מחובר לזהות המשתמש | RLS אפשרי, אבל החיבור לזהות באחריותנו |
| הרצת דפדפן ל-PDF | פונקציה, עד 4GB ו-800 שניות | שרת קבוע של 2GB |
| אזור | מסד וקבצים `eu-central-1`, שרת `fra1` | Frankfurt |
| גיבוי מובנה בתוכנית | מסד יומי ל-7 ימים, בלי קבצים | שחזור לנקודת זמן, 7 ימים ב-Pro |
| יתרון | הכי מעט קוד בכניסה, בהרשאות ובקבצים | חיוב צפוי, בלי מגבלת גוף של פונקציה |
| חיסרון | תלות בשני ספקים ובמגבלות פונקציה | יותר פיתוח ובדיקות באזורים הרגישים |

יצירת PDF בעברית ב-Next.js מוכחת אצל אלון (A-20), ואינה נימוק לבחירת הספק.

### 1.2 אזור ושימוש מסחרי

| ספק | ממצא | מקור |
|---|---|---|
| Supabase | בוחרים אזור מדויק `eu-central-1`, ולא ״Europe״ הכללי, שכולל גם מדינות מחוץ לאיחוד. אין אזור בישראל | [אזורים](https://supabase.com/docs/guides/platform/regions) |
| Supabase | התוכנית החינמית לפיתוח בלבד: מושהית בחוסר פעילות ובלי גיבוי. בתנאי השימוש לא מצאנו איסור מסחרי | [השהיה](https://supabase.com/docs/guides/platform/free-project-pausing), [תנאים](https://supabase.com/terms) |
| Supabase | תוכנית חינמית ובתשלום אינן מתערבבות בארגון, ולכן יש ארגון פיתוח וארגון ייצור. שני פרויקטים חינמיים לכל בעלים או מנהל | [חיוב](https://supabase.com/docs/guides/platform/billing-on-supabase) |
| Vercel | ברירת המחדל היא וושינגטון. חובה לקבוע `fra1` | [אזור הפונקציות](https://vercel.com/docs/functions/configuring-functions/region) |
| Vercel | תוכנית Hobby מותרת רק לשימוש אישי או לא מסחרי, ולכן אינה בשימוש גם לא לתצוגה מקדימה | [תנאים, סעיף 4](https://vercel.com/legal/terms) |
| Vercel | בריפו פרטי מי שדוחף חייב להיות חבר בצוות. Owner ו-Member הם מושבים בתשלום | [חברות לפריסה](https://vercel.com/kb/guide/why-aren-t-commits-triggering-deployments-on-vercel), [מושבים](https://vercel.com/docs/plans/pro-plan) |
| Cloudflare R2 | אפשר להגביל bucket לתחום האיחוד האירופי | [מיקום](https://developers.cloudflare.com/r2/reference/data-location/) |
| Render | יש Frankfurt. תוכנית Hobby מוצגת לפרויקטים אישיים ולאבות טיפוס, ולכן החלופה מחושבת עם Pro | [אזורים](https://render.com/docs/regions), [מחירים](https://render.com/pricing) |

### 1.2.1 תפקידי אלון אצל הספקים

| ספק | תפקיד | למה לא פחות |
|---|---|---|
| Supabase | Administrator, בלי עלות | תפקיד Developer [אינו יכול](https://supabase.com/docs/guides/platform/access-control) ליצור פרויקט, לשנות הגדרות Auth, קצב או מגבלת העלאה. ‏Administrator נספר במכסת שני הפרויקטים החינמיים של אלון. בייצור התפקיד ניתן לפי צורך ונרשם (Q30) |
| Vercel | Member, מושב בתשלום | תפקיד [Member](https://vercel.com/docs/rbac/access-roles#member-role) מנהל הגדרות פרויקט ומשתני ייצור |

### 1.3 מגבלות שמשפיעות על התכנון

| מגבלה | ערך | מה עושים | מקור |
|---|---|---|---|
| גוף בקשה בפונקציה | 4.5MB. ‏20MiB בבטא ציבורית | קבצים עולים ישירות לאחסון ולא דרך Vercel | [מגבלות](https://vercel.com/docs/functions/limitations) |
| גוף תשובה | 4.5MB, למעט תשובה בזרימה | PDF ו-Excel מוחזרים בזרימה, קבצים בקישור חתום | [מגבלות](https://vercel.com/docs/functions/limitations) |
| זיכרון וזמן | 2GB כברירת מחדל, עד 4GB. ‏300 שניות, עד 800 | 4GB, ודוח גדול מחולק | [מגבלות](https://vercel.com/docs/functions/limitations) |
| גודל פונקציה | 250MB | רק נתיב הדוחות כולל Chromium | [מגבלות](https://vercel.com/docs/functions/limitations) |
| קובץ באחסון | 50MB ב-Free, עד 500GB ב-Pro | ‏50MB עובד בשתי הסביבות | [מגבלות קובץ](https://supabase.com/docs/guides/storage/uploads/file-limits) |
| העלאה מעל 6MB | מומלצת העלאה מתחדשת, במקטעים של 6MB | TUS עם אסימון חתום | [העלאה מתחדשת](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) |
| מייל מובנה | לצוות הפרויקט בלבד, שניים בשעה | חוסמים שליחה לגמרי, ראו סעיף 4 | [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| גיבוי מובנה | ‏7 ימים ב-Pro, בלי תוכן הקבצים | אין עבודת גיבוי בשלב הזה, ראו סעיף 8 | [גיבויים](https://supabase.com/docs/guides/platform/backups) |
| HEIC ב-sharp | אין תמיכה מובנית ב-HEVC | פענוח נפרד לעותק התצוגה | [sharp](https://sharp.pixelplumbing.com/api-output/#heif) |

### 1.4 מחירון

| רכיב | מחיר | כלול | מקור |
|---|---:|---|---|
| Supabase Free | 0$ | מסד 500MB, קבצים 1GB, תעבורה 5GB | [מחירון](https://supabase.com/pricing) |
| Supabase Pro | 25$ לחודש | שרת Micro, דיסק 8GB, קבצים 100GB, תעבורה 250GB | [מחירון](https://supabase.com/pricing) |
| שרת Small | 15$, לפני זיכוי של 10$. תוספת של 5$ | 2GB זיכרון | [מחירון](https://supabase.com/pricing) |
| קבצים מעבר לכלול | 0.0213$ ל-GB לחודש | | [מחירון](https://supabase.com/pricing) |
| תעבורה מעבר לכלול | 0.09$ ל-GB | | [מחירון](https://supabase.com/pricing) |
| Vercel Pro | 20$ לחודש | מושב אחד, זיכוי שימוש 20$, CDN עד 1TB | [Pro](https://vercel.com/docs/plans/pro-plan) |
| מושב נוסף ב-Vercel | 20$ לחודש | | [Pro](https://vercel.com/docs/plans/pro-plan) |
| מעבד וזיכרון ב-`fra1` | 0.184$ לשעת מעבד, 0.0152$ ל-GB-שעה | יורד מהזיכוי | [מחירי פרנקפורט](https://vercel.com/docs/pricing/regional-pricing/fra1) |
| Cloudflare R2 | 0.015$ ל-GB לחודש, הורדה חינם | 10GB, מיליון כתיבות | [מחירון](https://developers.cloudflare.com/r2/pricing/) |
| GitHub Actions, ריפו פרטי | 0.006$ לדקת Linux | 12$ לחודש ב-GitHub Free | [כלול](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [תעריף](https://docs.github.com/en/billing/reference/actions-runner-pricing) |
| דומיין | סיומת `app`: ‏15$ לשנה בחידוש | שנה ראשונה חינם ב-Pro | [ההטבה](https://vercel.com/docs/domains/free-domain-with-pro), [מחיר סיומת](https://vercel.com/docs/rest-api/domains-registrar/get-tld-price-data). המחיר נשלף מה-API הרשמי |
| Render Pro | 25$ לחודש | משתמשים ללא הגבלה, תעבורה 25GB | [מחירון](https://render.com/pricing) |
| שרת Render, ‏2GB | 25$ | | [מחירון](https://render.com/pricing) |
| מסד Render, ‏1GB או 2GB | 19$ או 40$, ודיסק 0.30$ ל-GB | | [מחירון](https://render.com/pricing) |

### 1.5 חישוב העלות

הנחות הנפח הן שלנו, כי לא נמסרו נתוני שימוש:

| הנחה | התחלה | גידול |
|---|---:|---:|
| מדווחים | 3 | 10 |
| תמונות לאדם ביום עבודה | 5 | 10 |
| ימי עבודה בחודש | 22 | 22 |
| מקור ועותק תצוגה לתמונה | 4.5MB | 5.5MB |
| תוספת בחודש | כ-1.5GB | כ-12GB |

מכאן 100GB הכלולים מספיקים בתרחיש ההתחלה לכמה שנים. בתרחיש הגידול מגיעים ל-250GB אחרי פחות משנתיים. החישוב ב-GB עשרוני.

| רכיב | עד 100GB | 250GB | 1TB | חלופה שלא נבחרה, 10GB | חלופה שלא נבחרה, 250GB |
|---|---:|---:|---:|---:|---:|
| תוכנית בסיס | Supabase ‏25.00 | 25.00 | 25.00 | Render ‏25.00 | 25.00 |
| שרת מסד | 0 | 5.00 | 5.00 | 19.00 | 40.00 |
| דיסק מסד | 0 | 0 | 0 | 1.50 | 1.50 |
| אחסון קבצים | 0 | 3.20 | 19.17 | 0 | 3.60 |
| אירוח | 40.00 | 40.00 | 40.00 | 25.00 | 25.00 |
| **סך הכול** | **65.00** | **73.20** | **89.17** | **70.50** | **95.10** |

- מניחים שמסד עד 8GB, תעבורת Supabase עד 250GB, ושימוש Vercel בתוך 20$ הזיכוי.
- ה-CI משתמש ב-12$ הכלולים ב-GitHub. אם הם נגמרים ואין תקציב, ההרצות נעצרות.
- תקרת ההוצאה של Supabase דלוקה כברירת מחדל. מעל 100GB מכבים אותה, רק אחרי אישור אלון.
- לא תוכננו גיבוי נפרד, שירות מיילים, AI, אנליטיקה, PITR, סביבות branch או המרת תמונות בתשלום.

## 2. מבנה המערכת

<div dir="ltr">

```text
Browser (mobile shell / desktop shell)
  |-- pages, server actions --> Next.js (Vercel fra1)
  |                               |-- user JWT --> Postgres: RLS reads, RPC writes
  |                               |-- secret key --> Auth admin, Storage signing, system RPC
  |                               `-- PDF / Excel --> streamed response
  `-- TUS upload, signed download --> private Storage (eu-central-1)
```

</div>

העקרונות:

1. **המסד אוכף הרשאה.** בדיקת השרת נותנת הודעה טובה, ואינה במקום המסד.
2. **קריאה דרך RLS. כתיבה דרך פונקציית מסד אחת לכל פעולה.** למשתמש אין INSERT, UPDATE או DELETE על אף טבלה. כך הפעולה, הגרסה והלוג נשמרים בטרנזקציה אחת.
3. **נתוני משתמש נקראים ונכתבים רק עם ה-JWT שלו.** המפתח הסודי משמש רק לניהול Auth, לחתימת קבצים ולפונקציות `system_*`.
4. **לשתי התצוגות חוזה אחד:** אותן שאילתות, פעולות, תשובות ושגיאות. התצוגה אינה מחשבת כסף או הרשאה.
5. **הכסף מחושב במקום אחד,** ב-`src/lib/money`. המסד מסכם שורות גולמיות בלבד.
6. **שינוי ממכשיר אחר מופיע בטעינה הבאה.** אין Realtime, כי הוא לא נדרש.
7. **אין מטמון משותף לנתונים מורשים.** כל העמודים שאחרי כניסה דינמיים, והתשובות `private, no-store`.

ההגנות ל-SEC-01: אימות קלט ב-zod, בדיקת Origin בכל route שכותב, escape רגיל של React ובתבנית הדוח, שאילתות עם פרמטרים ו-HTTPS.

## 3. מודל נתונים

זהו מפרט ל-P1.2 ולא מיגרציה. יש 17 טבלאות ב-`public`. משתמשי הכניסה עצמם ב-`auth.users`.

### 3.1 מיפוי PRD 12

| ישות ב-PRD 12 | טבלאות |
|---|---|
| משתמש | `profiles` |
| שיוך | `memberships` |
| פרויקט | `projects`, `project_private`, `project_finance_settings` |
| תמונת שער | `project_covers`, `stored_files` |
| איש קשר | `project_contacts` |
| מסמך | `documents`, `stored_files` |
| מורשה למסמך | `document_grants` |
| משימה | `tasks` |
| דיווח | `diary_entries` |
| גרסת דיווח | `diary_versions`, `diary_version_files` |
| קובץ מצורף לדיווח | `diary_attachments`, `stored_files` |
| תנועה | `transactions` |
| אירוע רגיש | `sensitive_events` |

מספר החברה וקישור ה-Excel בטבלאות נפרדות, כי RLS מסנן שורות ולא עמודות לפי תפקיד. אין טבלת לקוחות, לידים, סיכומים או קטגוריות.

### 3.2 מוסכמות

- מפתח `id` הוא `uuid` עם `gen_random_uuid()`, אלא אם כתוב אחרת.
- כל עמודה היא NOT NULL, אלא אם מסומנת `?`.
- זמן הוא `timestamptz` ונקבע במסד. תאריך עבודה ויעד הם `date`. ״היום״ לפי `Asia/Jerusalem`.
- כסף הוא `bigint` באגורות.
- שורה נערכת נושאת `revision int`, מתחיל ב-1. עדכון עם מספר ישן מחזיר `CONFLICT` (DATA-03).
- יצירה נושאת `request_id uuid`, ייחודי עם היוצר. ניסיון חוזר מחזיר את אותה רשומה (DIARY-12, PROJ-05).
- טקסט חובה נבדק אחרי trim.
- כל מפתח זר הוא `on delete restrict`, למעט הרשאת מסמך שנמחקת עם השיוך.

### 3.3 טיפוסי enum

| טיפוס | ערכים |
|---|---|
| `project_role` | `manager`, `worker` |
| `project_status` | `active`, `completed` |
| `file_purpose` | `document`, `diary`, `cover` |
| `file_state` | `pending`, `ready`, `rejected` |
| `display_state` | `none`, `ready`, `failed` |
| `document_category` | `specification`, `plans`, `additional_plans`, `renderings` |
| `document_access` | `owner`, `all`, `selected` |
| `version_kind` | `created`, `corrected`, `moved`, `cancelled` |
| `transaction_kind` | `income`, `income_refund`, `expense`, `expense_credit` |

### 3.4 משתמשים ושיוכים

**טבלה `profiles`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK, ‏FK אל `auth.users` |
| `email` | text | UNIQUE, אותיות קטנות וללא רווחים. מסונכרן מ-Auth בלבד |
| `full_name` | text | 1–120 תווים |
| `is_owner` | boolean | ברירת מחדל false |
| `is_active` | boolean | ברירת מחדל true. CHECK שהבעלים אינו מושבת |
| `sessions_valid_after` | timestamptz | סשן שנוצר לפני כן אינו תקף |
| `created_at`, `updated_at` | timestamptz | זמן שרת |
| `created_by?` | uuid | FK אל `profiles`. ריק רק בהקמת הבעלים |
| `revision` | int | |

אינדקסים: אימייל ייחודי, ואינדקס ייחודי חלקי שמאפשר בעלים אחד. **אין עמודת תפקיד.**

**טבלה `memberships`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `project_id` | uuid | PK משותף, FK אל `projects` |
| `user_id` | uuid | PK משותף, FK אל `profiles` |
| `role` | project_role | |
| `finance_access` | boolean | ברירת מחדל false. ‏CHECK: ‏true רק כש-`role = manager` |
| `created_at`, `updated_at` | timestamptz | |
| `revision` | int | |

- אינדקס `(user_id, project_id)`.
- אין הגבלה על מספר המנהלים (PROJ-16).
- בן אינו משויך, כי הוא ניגש להכול.
- הסרה מוחקת את השיוך ורושמת אירוע עם המצב הקודם. שיוך מחדש מתחיל בלי כספים ובלי הרשאות מסמך נבחרות.
- מעבר לעובד מכבה כספים באותה טרנזקציה.

### 3.5 פרויקט

**טבלה `projects`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | 1–200 |
| `business_name` | text | 1–200 |
| `site_address` | text | 1–300 |
| `access_notes?` | text | עד 2,000 |
| `start_date?`, `end_date?` | date | הסיום אינו לפני ההתחלה |
| `status` | project_status | ברירת מחדל active |
| `archived_at?` | timestamptz | נפרד מהסטטוס, הפיך |
| `created_by` | uuid | FK אל `profiles` |
| `request_id` | uuid | UNIQUE עם `created_by` |
| `created_at`, `updated_at` | timestamptz | |
| `revision` | int | |

אינדקס `(status, created_at desc) where archived_at is null`.

**טבלה `project_contacts`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `project_id` | uuid | PK ו-FK. איש קשר אחד לפרויקט |
| `name` | text | 1–120 |
| `phone` | text | 1–40 |
| `email?` | text | |
| `role_title?` | text | עד 120 |

**טבלה `project_private`**, לבן בלבד

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `project_id` | uuid | PK ו-FK |
| `business_number?` | text | עד 30 |

**טבלה `project_finance_settings`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `project_id` | uuid | PK ו-FK |
| `excel_url?` | text | מתחיל ב-`https://`, עד 2,000 |
| `revision` | int | |

**טבלה `project_covers`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK |
| `file_id` | uuid | UNIQUE, ‏FK אל `stored_files` |
| `is_active` | boolean | אינדקס ייחודי חלקי: אחת פעילה לפרויקט |
| `created_by` | uuid | FK |
| `created_at` | timestamptz | |

### 3.6 קבצים ומסמכים

**טבלה `stored_files`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK, וגם שם האובייקט באחסון |
| `purpose` | file_purpose | |
| `project_id` | uuid | FK. הפרויקט שבו הועלה |
| `uploaded_by` | uuid | FK |
| `original_name` | text | 1–255, רק במסד |
| `bucket` | text | |
| `object_path` | text | UNIQUE עם `bucket`, ללא שם לקוח |
| `declared_mime`, `declared_size` | text, bigint | נבדקים לפני ההעלאה |
| `mime?`, `size_bytes?`, `sha256?` | text, bigint, text | נקבעים מהתוכן בשרת. חובה כש-ready |
| `state` | file_state | pending עובר פעם אחת ל-ready או rejected |
| `display_path?` | text | |
| `display_state` | display_state | |
| `created_at` | timestamptz | |
| `ready_at?` | timestamptz | חובה כש-ready |

אינדקס `(project_id, purpose, created_at)`. אחרי ready או rejected אף עמודה אינה משתנה.

**טבלה `documents`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK, וגם UNIQUE `(id, project_id)` |
| `project_id` | uuid | FK |
| `file_id` | uuid | UNIQUE, ‏FK |
| `category` | document_category | |
| `access` | document_access | חובה, בלי ברירת מחדל. קובע מי שמעלה, ורק בן עורך אחר כך |
| `uploaded_by` | uuid | FK |
| `uploaded_by_name` | text | השם בזמן ההעלאה |
| `replaces_document_id?` | uuid | FK עצמי, באותו פרויקט |
| `archived_at?` | timestamptz | רק בן, הפיך |
| `created_at` | timestamptz | |
| `revision` | int | |

אינדקסים: `(project_id, category, created_at desc) where archived_at is null`, ‏`(uploaded_by)`. למעלה אין גישה מיוחדת: הוא רואה לפי מה שהוגדר. שם המסמך הוא שם הקובץ.

**טבלה `document_grants`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `document_id` | uuid | PK משותף |
| `user_id` | uuid | PK משותף |
| `project_id` | uuid | FK משותף `(document_id, project_id)` אל `documents` |
| `created_at` | timestamptz | |

FK משותף `(project_id, user_id)` אל `memberships` עם `on delete cascade`. אינדקס `(user_id, document_id)`. מצב `selected` דורש לפחות אדם אחד בשמירה. אם כולם הוסרו, רק בן רואה.

### 3.7 משימות

**טבלה `tasks`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK |
| `body` | text | 1–2,000 |
| `completed` | boolean | ברירת מחדל false |
| `due_date?` | date | |
| `deleted_at?` | timestamptz | מחיקה של בן, מתועדת |
| `created_by` | uuid | FK |
| `request_id` | uuid | UNIQUE עם `created_by` |
| `created_at`, `updated_at` | timestamptz | |
| `revision` | int | |

אינדקס `(project_id, completed, created_at desc) where deleted_at is null`. אין אחראי, עדיפות או תזכורת.

### 3.8 יומן

**טבלה `diary_entries`**, המצב הנוכחי

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK |
| `work_date` | date | הפונקציה דוחה עתיד. אין גבול לעבר |
| `body` | text | 1–20,000 |
| `reporter_id` | uuid | FK, אינו משתנה |
| `reporter_name` | text | השם ביצירה, אינו משתנה |
| `entered_at` | timestamptz | אינו משתנה |
| `edited_at?` | timestamptz | התיקון או ההעברה האחרונים |
| `edited_by_name?` | text | |
| `cancelled_at?` | timestamptz | חד-כיווני |
| `cancelled_by?` | uuid | FK. קיים יחד עם `cancelled_at` |
| `request_id` | uuid | UNIQUE עם `reporter_id` |
| `revision` | int | שווה למספר הגרסה האחרונה |

אינדקסים, שניהם `where cancelled_at is null`: ‏`(project_id, work_date desc, entered_at desc, id desc)`, ‏`(work_date desc, entered_at desc, id desc)`.

**טבלה `diary_versions`**, הוספה בלבד

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `entry_id` | uuid | PK משותף, FK |
| `version` | int | PK משותף, מ-1 |
| `kind` | version_kind | |
| `project_id` | uuid | FK |
| `work_date` | date | |
| `body` | text | התוכן המלא |
| `cancelled` | boolean | |
| `reporter_name` | text | |
| `editor_id` | uuid | FK |
| `editor_name` | text | |
| `created_at` | timestamptz | זמן שרת |

אינדקס `(project_id, entry_id)`.

**טבלה `diary_attachments`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK, וגם UNIQUE `(id, entry_id)` |
| `entry_id` | uuid | FK |
| `file_id` | uuid | UNIQUE, ‏FK |
| `created_at` | timestamptz | |

**טבלה `diary_version_files`**, הוספה בלבד

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `entry_id`, `version` | uuid, int | PK משותף, FK אל `diary_versions` |
| `attachment_id` | uuid | PK משותף. FK `(attachment_id, entry_id)` אל `diary_attachments` |
| `position` | smallint | 1–20, UNIQUE בגרסה |

אינדקס `(attachment_id)`. הסרת קובץ בתיקון יוצרת גרסה בלי הקובץ, והמקור נשאר בגרסה הקודמת.

### 3.9 כספים

**טבלה `transactions`**

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK |
| `year` | smallint | 2000–2100 |
| `month` | smallint | 1–12 |
| `day?` | smallint | תאריך אמיתי באותו חודש |
| `kind` | transaction_kind | |
| `amount` | bigint | 1 עד 100,000,000,000 אגורות. הסימן נגזר מהסוג |
| `details` | text | 1–500 |
| `position` | bigint | identity. קובע סדר ואינו משתנה בעריכה |
| `cancelled_at?` | timestamptz | חד-כיווני |
| `cancelled_by?` | uuid | FK. קיים יחד עם `cancelled_at` |
| `created_by`, `updated_by` | uuid | FK |
| `request_id` | uuid | UNIQUE עם `created_by` |
| `created_at`, `updated_at` | timestamptz | |
| `revision` | int | |

אינדקסים, שניהם `where cancelled_at is null`: ‏`(project_id, year, month, position)`, ‏`(year, month, project_id)`. אין שורות מס, סיכום או שארית.

### 3.10 לוג

**טבלה `sensitive_events`**, הוספה בלבד

| עמודה | טיפוס | מפתח, אילוץ |
|---|---|---|
| `id` | bigint | PK identity |
| `occurred_at` | timestamptz | זמן שרת |
| `actor_id?` | uuid | FK. ריק רק בפעולת תמיכה |
| `actor_label` | text | שם המבצע או מזהה התמיכה |
| `action` | text | רשימה סגורה, ב-PERMISSIONS |
| `entity_type`, `entity_id` | text | |
| `project_id?` | uuid | FK |
| `before?`, `after?` | jsonb | ללא סיסמה, טוקן או תוכן דיווח |

אינדקסים `(occurred_at desc, id desc)`, ‏`(project_id, occurred_at desc)`.

### 3.11 חוסר שינוי

טריגר דוחה את הפעולות האלה גם כשהן מגיעות מפונקציה שלנו:

| טבלה | מה נדחה |
|---|---|
| `diary_versions`, `diary_version_files`, `sensitive_events` | UPDATE ו-DELETE |
| `diary_entries` | DELETE, שינוי מדווח או מועד הזנה, שינוי אחרי ביטול |
| `diary_attachments` | UPDATE ו-DELETE |
| `stored_files` | DELETE, וכל שינוי אחרי ready או rejected |
| `transactions` | DELETE, שינוי אחרי ביטול |

הגבול הוא A-16: משתמשים, כולל בן, אינם יכולים לשנות. מי שמנהל את חשבון המסד עצמו יכול טכנית. אין הקשחה נגדו, לפי A-19.

## 4. כניסה וסשן

### 4.1 הגדרות Supabase Auth

| הגדרה | ערך | למה |
|---|---|---|
| הרשמה חופשית, אנונימית וספקים חיצוניים | כבויים | רק בן יוצר |
| אימות דו-שלבי (MFA), טלפון | כבויים, כולל רישום TOTP, [שפעיל כברירת מחדל](https://supabase.com/docs/guides/auth/auth-mfa/totp) | A-09 |
| ספק אימייל וסיסמה | פעיל | האימייל הוא שם המשתמש |
| Confirm email | פעיל | שינוי אימייל עצמי אינו נכנס לתוקף |
| Send Email Hook | פונקציית Postgres שמחזירה שגיאה תמיד | אפס מיילים, גם לא מהשירות המובנה. כשהיא פעילה [אין שימוש ב-SMTP](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) |
| אורך סיסמה | 8 ומעלה | [המינימום המומלץ](https://supabase.com/docs/guides/auth/password-security) |
| אורך חיי סשן | ללא תפוגה | כניסה מתמשכת. זו [ברירת המחדל](https://supabase.com/docs/guides/auth/sessions) |
| JWT | שעה | התוקף נבדק ממילא במסד בכל בקשה |
| IP Address Forwarding | פעיל | בלעדיו כל הניסיונות נראים כאילו באו משרת אחד |
| קצב `token` | 30 לחמש דקות ל-IP | חסימה זמנית (AUTH-03). [המנגנון](https://supabase.com/docs/guides/auth/rate-limits) כולל כניסה וריענון |

### 4.2 תהליכים

| תהליך | איך עובד |
|---|---|
| כניסה | שרת Next מנרמל אימייל, נכנס ומעביר IP לספק עם לקוח Auth נפרד במפתח סודי, שאינו קורא נתונים. כך גם בריענון. אחר כך `get_actor`. אין חשבון פעיל: יציאה והודעה כללית |
| סשן מתמשך | `@supabase/ssr`, עוגיות HttpOnly, Secure, ‏SameSite=Lax ל-400 יום, שמתחדשות ב-`src/proxy.ts`. הסיסמה אינה נשמרת |
| תוקף בכל בקשה | המסד בודק פרופיל פעיל, שורה ב-`auth.sessions` לפי `session_id`, וש-`created_at` שלה אינו לפני `sessions_valid_after` |
| יציאה | מוחקת את הסשן הנוכחי. ה-JWT שלו נחסם בבקשה הבאה, כי השורה נעלמה |
| יצירה בידי בן | בדיקת בעלים, `admin.createUser` עם `email_confirm: true`, ואז `create_profile`. משתמש בלי פרופיל חסר כל גישה. בניסיון חוזר, אם האימייל כבר ב-Auth, קודם `create_profile` ורק אם הצליחה `setPassword`. כך לא מאפסים חשבון קיים |
| איפוס בידי בן | `admin.updateUserById` עם הסיסמה החדשה, ואז `revoke_user_sessions`. בן מוסר את הסיסמה בעצמו. כשל בשלב השני מוצג, והניסיון החוזר בטוח |
| שינוי אימייל בידי בן | עדכון ב-Auth עם אישור, ואז `update_profile` שמסנכרן |
| השבתה | `set_user_active(false)`. הבקשה הבאה נחסמת, בלי לחכות לתפוגת JWT או לספק |
| הפעלה מחדש | פעיל, והסשנים הקודמים נשארים בטלים. השיוכים נשמרים |
| איפוס לבן | אלון מאמת בשיחה עם בן במספר מוכר, מריץ סקריפט תפעול עם סיסמה חדשה ו-`system_owner_recovered`, ומוסר בשיחה. אין מעקף באפליקציה |
| הקמת בן | `system_bootstrap_owner` פועלת רק כשאין בעלים |
| תמיכה (Q30) | חשבון אישי רגיל שבן יוצר ומשייך לפי צורך. אין תפקיד תמיכה. גישה לחשבונות הספקים נרשמת ב-OPERATIONS |

כל פעולה ב-`AuthAdmin` קוראת `requireOwner` לפני השימוש במפתח הסודי.

משתמש יכול טכנית להחליף את הסיסמה של עצמו מול ה-API של הספק. אין לזה מסך, וזה אינו משנה הרשאה.

כתובת Auth והמפתח הפומבי אינם סוד. לכן ההרשאות אינן מניחות שכל בקשה עוברת דרך Next.

## 5. חוזה הלוגיקה

### 5.1 בעלות ומקביליות

| נתיב | בונה | תוכן |
|---|---|---|
| `package.json`, lockfile, הגדרות | P1.1 | **כל** התלויות שבסעיף 9 |
| `supabase/**` | P1.2 | 17 הטבלאות, RLS, **כל הפונקציות שב-PERMISSIONS עם הגוף שלהן**, buckets |
| `src/types/database.ts` | P1.2 | נוצר מהסכמה |
| `src/types/contracts/<domain>.ts` | P1.2 | הטיפוסים שלמטה, ו-zod באותו שם עם הסיומת `Schema` |
| `tests/db/support/**` | P1.2 | משתמשי בדיקה, לקוחות לפי תפקיד ונתונים בדויים |
| `src/lib/{auth,db,permissions,storage,audit,format}` | P1.3 | התשתית המשותפת, לפי `Platform` שלמטה |
| `src/lib/money` | P1.4.6 | חישוב יחיד. משמש גם את P1.4.7 |
| `src/features/<domain>/logic/{queries,commands,actions}.ts` | P1.4.x | מימוש החוזה של התחום בלבד |
| `src/features/<domain>/{mobile,desktop}` | P2.x | תצוגה בלבד |

הכללים למשימות המקבילות:

1. שש המשימות שאחרי P1.3 אינן עורכות סכמה, טיפוסים, תלויות או `src/lib`, למעט `src/lib/money` ב-P1.4.6.
2. אין import בין תחומי פיצ׳ר, למעט לפי תלות רשומה: overview, ‏reports ו-finance-export.
3. `commands.ts` קוראת לפונקציית המסד. אסור לה לכתוב לטבלה.
4. **רק `actions.ts` מסומן `'use server'`.** ‏`queries.ts` ו-`commands.ts` מסומנים `server-only`, אחרת לקוח יכול לשלוח context מזויף. `actions.ts` הוא המעטפת היחידה לתצוגות: לוקחת context מהשרת, מאמתת zod ומחזירה `Result`.
5. Server Component קורא ל-`queries.ts`. רכיב לקוח קורא רק ל-`actions.ts`.
6. כל תחום מצהיר `satisfies` מול הממשק שלו.
7. חסר משהו בחוזה? עוצרים ופותחים משימת שינוי משותף סדרתית.
8. כל בדיקה יוצרת פרויקטים ומשתמשים משלה, ומשתמשת בבעלים היחיד של סביבת הבדיקה. בדיקה של סכום כל הפרויקטים מסננת לפרויקטים שלה או רצה לבד. כל המשימות וה-CI חולקים מסד פיתוח אחד בענן, ולכן CI מריץ בדיקות מסד בריצה אחת בכל פעם.

### 5.2 שגיאות והתנהגות

| קוד | מתי |
|---|---|
| `UNAUTHENTICATED` | אין סשן תקף או שהחשבון מושבת |
| `FORBIDDEN` | רואה את הרשומה, והפעולה אסורה |
| `NOT_FOUND` | לא קיים, או אסור לדעת שהוא קיים |
| `VALIDATION` | קלט שגוי, עם שדה והודעה בעברית |
| `CONFLICT` | גרסה ישנה. אינו שומר |
| `PROJECT_READ_ONLY` | הסתיים או בארכיון, ואינו בן |
| `LIMIT` | גודל, כמות או סוג קובץ |
| `RATE_LIMITED` | חסימה זמנית |
| `UNAVAILABLE` | כשל. לעולם לא מוצג כהצלחה |

רשימות יומן ולוג בדפדוף cursor של 50. רשימות אחרות נקראות במלואן ב-`fetchAll`, כדי שמגבלת 1,000 השורות של ה-Data API לא תחתוך נתון. סכומים ומונים תמיד מהמסד.

### 5.3 טיפוסים משותפים

<div dir="ltr">

```ts
export type Uuid = string
export type IsoDate = string // YYYY-MM-DD
export type IsoDateTime = string
export type Agorot = number // safe integer
export type Month = { year: number; month: number }

export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT'
  | 'PROJECT_READ_ONLY' | 'LIMIT' | 'RATE_LIMITED' | 'UNAVAILABLE'

export type AppError = { code: ErrorCode; message: string; fieldErrors?: Record<string, string> }
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }
export type Page<T> = { items: T[]; nextCursor: string | null }

export type Actor = { userId: Uuid; fullName: string; email: string; isOwner: boolean }
export type Db = import('@supabase/supabase-js').SupabaseClient<import('../database').Database>
export type RequestContext = {
  readonly actor: Actor
  readonly db: Db // user JWT, never secret key
  readonly today: IsoDate // Asia/Jerusalem, from server
}

export type Operation<I, O> = (ctx: RequestContext, input: I) => Promise<Result<O>>
export type ActionsOf<T> = {
  [K in keyof T]: T[K] extends Operation<infer I, infer O> ? (input: I) => Promise<Result<O>> : never
}

export type ProjectRole = 'manager' | 'worker'
export type Saved = { id: Uuid; revision: number }
export type Edit = { id: Uuid; expectedRevision: number }

export type ProjectPermissions = {
  view: boolean
  editDetails: boolean
  uploadDocument: boolean
  manageAccess: boolean
  writeTasks: boolean
  deleteTasks: boolean
  report: boolean
  viewFinance: boolean
  writeFinance: boolean
  cancelTransaction: boolean
}
```

</div>

### 5.4 תשתית, P1.3

<div dir="ltr">

```ts
export type FilePurpose = 'document' | 'diary' | 'cover'
export type FileRef = {
  id: Uuid; name: string; mime: string; sizeBytes: number
  displayState: 'none' | 'ready' | 'failed'
}
export type UploadRequest = {
  purpose: FilePurpose; projectId: Uuid
  files: { clientId: Uuid; name: string; mime: string; sizeBytes: number }[]
}
export type UploadTarget = {
  clientId: Uuid
  target: Result<{
    fileId: Uuid; endpoint: string; publishableKey: string; token: string
    bucket: string; path: string
  }>
}

export interface AuthService {
  signIn(input: { email: string; password: string }): Promise<Result<Actor>>
  signOut(): Promise<Result<null>>
  getContext(): Promise<Result<RequestContext>>
}

export interface AuthAdmin {
  createUser: Operation<{ email: string; password: string }, { userId: Uuid }>
  setPassword: Operation<{ userId: Uuid; password: string }, null>
  setEmail: Operation<{ userId: Uuid; email: string }, null>
}

export interface StorageService {
  beginUpload: Operation<UploadRequest, UploadTarget[]>
  finishUpload: Operation<{ fileId: Uuid }, FileRef>
  getSignedUrl: Operation<
    { fileId: Uuid; variant: 'original' | 'display'; download: boolean },
    { url: string; expiresInSeconds: 60 }
  >
  readBytes: Operation<{ fileId: Uuid; variant: 'original' | 'display' }, Uint8Array>
}

export interface PermissionService {
  forProject: Operation<{ projectId: Uuid }, ProjectPermissions>
  requireOwner: Operation<Record<string, never>, null>
}

export type SensitiveEvent = {
  id: number; occurredAt: IsoDateTime; actorName: string; action: string
  entityType: string; entityId: string; projectId: Uuid | null
  before: unknown; after: unknown
}
export interface AuditService {
  list: Operation<{ projectId?: Uuid; cursor?: string }, Page<SensitiveEvent>>
}

export interface Format {
  date(value: IsoDate): string
  dateTime(value: IsoDateTime): string
  money(value: Agorot): string
  searchKey(value: string): string // spaces, quotes, case
  todayInIsrael(now?: Date): IsoDate
}

export interface Platform {
  auth: AuthService
  authAdmin: AuthAdmin
  storage: StorageService
  permissions: PermissionService
  audit: AuditService
  format: Format
  fetchAll<T>(page: (from: number, to: number) => Promise<T[]>): Promise<T[]>
  rpc<I, O>(ctx: RequestContext, name: string, input: I): Promise<Result<O>>
}
```

</div>

### 5.5 עובדים ושיוכים, P1.4.1

<div dir="ltr">

```ts
export type UserAssignment = {
  projectId: Uuid; projectName: string; role: ProjectRole; financeAccess: boolean; revision: number
}
export type UserRow = {
  id: Uuid; fullName: string; email: string; isOwner: boolean; isActive: boolean
  revision: number; assignments: UserAssignment[]
}
export type MemberRow = {
  userId: Uuid; fullName: string; role: ProjectRole
  financeAccess: boolean; isActive: boolean; revision: number
}

export interface UsersApi {
  listUsers: Operation<{ search?: string }, UserRow[]>
  getUser: Operation<{ id: Uuid }, UserRow>
  listProjectMembers: Operation<{ projectId: Uuid }, MemberRow[]>
  createUser: Operation<{ email: string; fullName: string; password: string }, Saved>
  updateUser: Operation<Edit & { fullName: string; email: string }, Saved>
  setUserActive: Operation<Edit & { active: boolean }, Saved>
  resetPassword: Operation<{ id: Uuid; password: string }, null>
  setMembership: Operation<
    { userId: Uuid; projectId: Uuid; role: ProjectRole; expectedRevision: number | null },
    { revision: number; financeAccess: boolean }
  >
  removeMembership: Operation<{ userId: Uuid; projectId: Uuid; expectedRevision: number }, null>
  setFinanceAccess: Operation<
    { userId: Uuid; projectId: Uuid; enabled: boolean; expectedRevision: number },
    { revision: number }
  >
}
```

</div>

### 5.6 פרויקטים, P1.4.2

<div dir="ltr">

```ts
export type ProjectStatus = 'active' | 'completed'
export type ProjectFields = {
  name: string; businessName: string; siteAddress: string
  contact: { name: string; phone: string; email: string | null; roleTitle: string | null }
  startDate: IsoDate | null; endDate: IsoDate | null; accessNotes: string | null
  businessNumber?: string | null // owner only
}
export type ProjectCard = {
  id: Uuid; name: string; businessName: string; siteAddress: string
  status: ProjectStatus; archived: boolean; coverFileId: Uuid | null
  reportCount: number; openTaskCount: number
}
export type ProjectDetails = ProjectFields & {
  id: Uuid; status: ProjectStatus; archived: boolean; revision: number
  coverFileId: Uuid | null; managerNames: string[]; permissions: ProjectPermissions
}

export interface ProjectsApi {
  listProjects: Operation<
    { search?: string; status?: ProjectStatus; archived?: boolean },
    ProjectCard[]
  >
  getProject: Operation<{ id: Uuid }, ProjectDetails>
  createProject: Operation<{ requestId: Uuid; fields: ProjectFields }, Saved>
  updateProject: Operation<Edit & { fields: ProjectFields }, Saved>
  setProjectStatus: Operation<Edit & { status: ProjectStatus }, Saved>
  setProjectArchived: Operation<Edit & { archived: boolean }, Saved>
  setProjectCover: Operation<Edit & { fileId: Uuid }, Saved>
}
```

</div>

### 5.7 משימות, P1.4.3

<div dir="ltr">

```ts
export type TaskRow = {
  id: Uuid; projectId: Uuid; body: string; completed: boolean
  dueDate: IsoDate | null; createdAt: IsoDateTime; revision: number
}

export interface TasksApi {
  listTasks: Operation<
    { projectId: Uuid },
    { open: TaskRow[]; completed: TaskRow[]; openCount: number; completedCount: number; canWrite: boolean }
  >
  createTask: Operation<
    { requestId: Uuid; projectId: Uuid; body: string; dueDate: IsoDate | null; completed: boolean },
    Saved
  >
  updateTask: Operation<Edit & { body: string; dueDate: IsoDate | null }, Saved>
  setTaskCompleted: Operation<Edit & { completed: boolean }, Saved>
  deleteTask: Operation<Edit, null>
}
```

</div>

### 5.8 מסמכים, P1.4.4

<div dir="ltr">

```ts
export type DocumentCategory = 'specification' | 'plans' | 'additional_plans' | 'renderings'
export type DocumentAccess =
  | { mode: 'owner' }
  | { mode: 'all' }
  | { mode: 'selected'; userIds: Uuid[] }
export type DocumentRow = {
  id: Uuid; projectId: Uuid; category: DocumentCategory; file: FileRef
  uploadedByName: string; createdAt: IsoDateTime; archived: boolean; revision: number
  access?: DocumentAccess // owner only
}

export type AccessCandidate = { userId: Uuid; fullName: string }

export interface FilesApi {
  listAccessCandidates: Operation<{ projectId: Uuid }, AccessCandidate[]>
  listDocuments: Operation<
    { projectId: Uuid; category?: DocumentCategory; search?: string; archived?: boolean },
    { items: DocumentRow[]; countByCategory: Record<DocumentCategory, number> }
  >
  getDocument: Operation<{ id: Uuid }, DocumentRow>
  createDocument: Operation<
    {
      projectId: Uuid; fileId: Uuid; category: DocumentCategory
      access: DocumentAccess // set by the uploader, owner or manager
      replacesDocumentId?: Uuid // owner only
    },
    Saved
  >
  setDocumentAccess: Operation<Edit & { access: DocumentAccess }, Saved>
  setDocumentArchived: Operation<Edit & { archived: boolean }, Saved>
}
```

</div>

מנהל שמעלה מקבל מ-`listAccessCandidates` שמות של משויכים פעילים בפרויקט, בלי אימייל, תפקיד או כספים.

פתיחה והורדה דרך `StorageService.getSignedUrl`. כל קובץ בהעלאה מרובה נשמר בקריאה משלו, ולכן כישלון מדווח בשמו.

### 5.9 יומן, P1.4.5

<div dir="ltr">

```ts
export type DateRange = { from?: IsoDate; to?: IsoDate } // inclusive
export type DiaryRow = {
  id: Uuid; projectId: Uuid; projectName: string; workDate: IsoDate; body: string
  reporterId: Uuid; reporterName: string; enteredAt: IsoDateTime
  editedAt: IsoDateTime | null; editedByName: string | null
  cancelledAt: IsoDateTime | null; files: FileRef[]; revision: number
  canCorrect: boolean; canMoveOrCancel: boolean
}
export type DiaryVersion = {
  version: number; kind: 'created' | 'corrected' | 'moved' | 'cancelled'
  projectId: Uuid; workDate: IsoDate; body: string; reporterName: string
  editorName: string; createdAt: IsoDateTime; files: FileRef[]
}
export type DiarySummary = {
  reportCount: number; workDays: number
  byProject: { projectId: Uuid; projectName: string; reportCount: number; workDays: number }[]
}

export interface DiaryApi {
  listEntries: Operation<
    DateRange & { projectId?: Uuid; cancelled?: boolean; cursor?: string },
    Page<DiaryRow>
  >
  getSummary: Operation<DateRange & { projectId?: Uuid }, DiarySummary>
  getEntry: Operation<{ id: Uuid }, DiaryRow>
  listVersions: Operation<{ id: Uuid }, DiaryVersion[]>
  listForReport: Operation<{ scope: ReportScope }, DiaryRow[]>
  createEntry: Operation<
    { requestId: Uuid; projectId: Uuid; workDate: IsoDate; body: string; fileIds: Uuid[] },
    Saved
  >
  correctEntry: Operation<Edit & { body: string; fileIds: Uuid[] }, Saved>
  moveEntry: Operation<Edit & { projectId: Uuid; workDate: IsoDate }, Saved>
  cancelEntry: Operation<Edit, Saved>
}

export type ReportScope =
  | { kind: 'entry'; entryId: Uuid }
  | { kind: 'day'; projectId: Uuid; date: IsoDate }
  | { kind: 'range'; projectId: Uuid; from: IsoDate; to: IsoDate }
```

</div>

`fileIds` הוא הסדר המלא של הקבצים בגרסה החדשה. מדווח, זמן ושם אינם בקלט.

### 5.10 כספים, P1.4.6

<div dir="ltr">

```ts
export type TransactionKind = 'income' | 'income_refund' | 'expense' | 'expense_credit'
export type TransactionFields = Month & {
  day: number | null; kind: TransactionKind; amount: Agorot; details: string
}
export type TransactionRow = TransactionFields & {
  id: Uuid; position: number; cancelledAt: IsoDateTime | null; revision: number
}
export type RawMonthTotals = Month & { income: Agorot; expense: Agorot } // net of credits
export type MoneySummary = {
  income: Agorot
  expense: Agorot // before tax
  tax: Agorot
  totalExpense: Agorot // expense + tax
  netProfit: Agorot
  profitPercentTenths: number | null // 370 = 37.0%
}
export type MonthSummary = Month & MoneySummary & { balance: Agorot }
export type FinanceFilter = { period: 'all' | Month; day?: number; search?: string }
export type MonthBlock = {
  summary: MonthSummary; incomeRows: TransactionRow[]; expenseRows: TransactionRow[]
}
export type FinanceBook = {
  projectId: Uuid; projectName: string; filter: FinanceFilter
  months: MonthBlock[]
  period: MoneySummary & { balance: Agorot }
  filteredRows: { income: Agorot; expense: Agorot }
  workDays: number
  excelLink: { url: string | null; revision: number }
  canWrite: boolean; canCancel: boolean
}

export interface Money {
  parseShekels(text: string): Result<Agorot>
  taxForMonth(income: Agorot): Agorot
  summarizeMonth(raw: RawMonthTotals, previousBalance: Agorot): MonthSummary
  buildMonths(raw: RawMonthTotals[], through?: Month): MonthSummary[]
  summarizePeriod(months: MonthSummary[]): MoneySummary & { balance: Agorot }
}

export interface FinanceApi {
  getBook: Operation<{ projectId: Uuid; filter: FinanceFilter }, FinanceBook>
  listCancelled: Operation<{ projectId: Uuid }, TransactionRow[]>
  getAllProjectTotals: Operation<
    { from?: Month; to?: Month },
    { projectId: Uuid; projectName: string; month: MonthSummary }[]
  >
  createTransaction: Operation<{ requestId: Uuid; projectId: Uuid; fields: TransactionFields }, Saved>
  updateTransaction: Operation<Edit & { fields: TransactionFields }, Saved>
  cancelTransaction: Operation<Edit, Saved>
  setExcelLink: Operation<{ projectId: Uuid; url: string | null; expectedRevision: number }, Saved>
}
```

</div>

הכללים, לפי PRD 11:

| נושא | מימוש |
|---|---|
| הכנסות | `income` פחות `income_refund` |
| הוצאות | `expense` פחות `expense_credit` |
| מס | `sign(income) × floor((abs(income) × 3 + 50) / 100)`, בשלמים, לכל פרויקט וחודש |
| סה"כ הוצאה | הוצאות + מס |
| רווח נקי | הכנסות פחות סה"כ הוצאה |
| שארית | קודמת + רווח נקי, רצף מהחודש הראשון, כולל ריקים ומעבר שנה. חודש ריק אחרי האחרון מקבל את השארית |
| תקופה | סכום החודשים. לא מחשבים מס מחדש על הסכום |
| העברה | סכום המס המעוגל של כל הפרויקטים, גם שהסתיימו ובארכיון |
| אחוז רווח | מעוגל לעשירית, חצי הרחק מאפס. הכנסות אינן חיוביות: null, ומוצג ״—״ |
| טווח חודשים | קוראים את כל החודשים, מחשבים שארית ורק אז חותכים לטווח |
| מסננים | יום וחיפוש משנים את השורות ואת `filteredRows`, לעולם לא את סיכום החודש |
| ימי עבודה | `diary_summary` של הפרויקט בתקופה שנבחרה |
| קלט | עד שתי ספרות אחרי הנקודה, בפענוח טקסט ולא בכפל float |
| כותרות | ״לפני מע״מ״ בשדה, בכותרת ובייצוא |

### 5.11 בית וסיכום, P1.4.7

<div dir="ltr">

```ts
export type HomeData = {
  counters: {
    activeProjects: number; reportsToday: number; customers: number; openTasks: number
  }
  projects: ProjectCard[]
  financeCube: (MoneySummary & { month: Month }) | null // owner only
}
export type TransferMonth = {
  month: Month; transferAmount: Agorot
  projects: { projectId: Uuid; projectName: string; summary: MonthSummary }[]
}

export interface OverviewApi {
  getHome: Operation<Record<string, never>, HomeData>
  getTransferSummary: Operation<{ from?: Month; to?: Month }, TransferMonth[]>
}
```

</div>

| מונה | הגדרה |
|---|---|
| פרויקטים פעילים | גלויים, active ולא בארכיון |
| דיווחים | גלויים, לא מבוטלים, תאריך העבודה הוא היום |
| לקוחות | שמות עסק שונים אחרי `searchKey`, בפרויקטים גלויים שאינם בארכיון |
| משימות פתוחות | סכום התגים של הפרויקטים האלה |
| קובייה | החודש הנוכחי, סכום החודשים המעוגלים לכל פרויקט. בן בלבד |

### 5.12 דוחות, P1.4.8

<div dir="ltr">

```ts
export type ReportPlan = {
  scope: ReportScope; partCount: number; entryCount: number; workDays: number
}
export type BinaryArtifact = { fileName: string; contentType: string; stream: ReadableStream<Uint8Array> }

export interface ReportsApi {
  planReport: Operation<{ scope: ReportScope }, ReportPlan>
  renderReportPart: Operation<{ scope: ReportScope; part: number }, BinaryArtifact>
}
```

</div>

הנתיב: `GET /api/reports/diary`, עם `kind`, מזהים, תאריכים, `part` ו-`download`. אין בו שם לקוח.

### 5.13 ייצוא Excel, P1.4.9

<div dir="ltr">

```ts
export interface FinanceExportApi {
  renderWorkbook: Operation<{ projectId: Uuid; filter: FinanceFilter }, BinaryArtifact>
}
```

</div>

הנתיב: `GET /api/exports/finance`. הוא משתמש ב-`FinanceApi.getBook` ואינו מחשב. גיליון RTL, סכומים מספריים, שורת אחוז רווח, וטקסט נשמר כמחרוזת ולעולם לא כנוסחה.

## 6. קבצים

### 6.1 מגבלת 25MB מול תוכניות בנייה

| סוג תוכנית | חישוב או מקור | מול 25MB | מול 50MB |
|---|---|---|---|
| גיליון וקטורי מ-CAD | לרוב מגה-בתים בודדים. הערכה, לא נמדד | נכנס | נכנס |
| סריקת A0 צבע, ‏200dpi | ‏62 מגה-פיקסל. בדחיסה 1:10 עד 1:20 כ-9–19MB | נכנס | נכנס |
| סריקת A0 צבע, ‏300dpi | ‏139.5 מגה-פיקסל. באותה דחיסה כ-21–42MB | **עלול להידחות** | נכנס |
| סט סרוק של כמה גיליונות | כפולה של הגיליון | נדחה לעיתים קרובות | מפצלים לגיליונות |
| מערכות הגשה של תוכניות | [San Diego](https://www.sandiego.gov/development-services/forms-publications/requirements-digital-plans-documents) מקבלת עד 200MB, ו-[Planning Portal הבריטי](https://www.planningportal.co.uk/services/help/faq/applications/what-is-the-file-size-limit-on-supporting-documents/) רק 10MB | בטווח | בטווח |

שתי הדוגמאות מראות שאין ערך מקובל אחד. לא נמצא תקן ישראלי ולא נבדקו תוכניות של בן. נבחר זמנית 50MB, לפי סעיף 3 של G1. הערך עובד גם בתוכנית החינמית. העלות היא האחסון בלבד, למשל 100 תוכניות של 50MB הן 5GB, כ-0.11$ לחודש מעבר לכלול.

### 6.2 אחסון

| bucket פרטי | תוכן | מגבלה |
|---|---|---|
| `documents` | מקור של מסמך | 50MB |
| `diary` | מקור של צירוף | 25MB |
| `covers` | מקור של תמונת שער | 25MB, תמונות בלבד |
| `display` | עותקי תצוגה | 5MB, ‏JPEG בלבד, נכתב רק בשרת |

- הסוגים: PDF, ‏JPG, ‏PNG, ‏WEBP ו-HEIC, עד 20 בהעלאה ועד 20 לדיווח.
- שם האובייקט הוא מזהה בלבד. [האחסון אינו מקבל עברית בשמות](https://supabase.com/docs/guides/storage/uploads/file-limits), וגם אין פרטי לקוח בכתובות.
- אין policy למשתמשים על `storage.objects`. ברירת המחדל היא חסימה.
- בקוד אין upsert, החלפה או מחיקה של אובייקט.

### 6.3 העלאה מהטלפון

1. הלקוח שולח שם, סוג וגודל ל-`POST /api/storage/uploads`.
2. `begin_upload` בודקת הרשאה ומגבלות ויוצרת `pending`.
3. השרת מנפיק אסימון חתום בלי upsert.
4. הדפדפן מעלה ישירות ל-`/storage/v1/upload/resumable/sign` ב-TUS, במקטעים של 6MB ועם ניסיון חוזר. הקובץ אינו עובר ב-Vercel.
5. ב-`POST /api/storage/uploads/[id]/complete` השרת בודק מעלה, גודל וחתימת תוכן, מחשב SHA-256, יוצר עותק תצוגה וקורא ל-`system_finish_upload`. בניסיון חוזר עותק תצוגה שכבר נכתב אינו שגיאה. קובץ שנכשל באימות נהיה rejected.
6. הדיווח, המסמך או תמונת השער נשמרים בפונקציה שבודקת הרשאה **שוב**. עד אז איש אינו רואה את הקובץ.
7. כשל משאיר את הטקסט והבחירה במסך (UX-09).

העלאה שלא הושלמה נשארת pending ובלתי נראית. אין משימת ניקוי בשלב הזה.

### 6.4 מקור, תצוגה ו-HEIC

| נושא | כלל |
|---|---|
| מקור | הבתים שהדפדפן מסר, בלי שינוי |
| תצוגה | JPEG, עד 1,600 פיקסל בצד הארוך, איכות 80, כיוון מתוקן ובלי מטא-דאטה |
| HEIC | `heic-convert` ואחריו sharp. אין שימוש בהמרת התמונות של Supabase |
| כשל המרה | המקור נשמר, `display_state = failed`, מוצגת הורדה, והדוח מציין שלא צורף |
| אייפון | משתמשים ב-`accept="image/*,application/pdf"` ומאמתים בשרת. ציון מפורש של HEIC [גורם ב-Safari להמרה הפוכה](https://bugs.webkit.org/show_bug.cgi?id=303803). ב-iOS גם [HEIC עשוי להפוך ל-JPEG בבחירה](https://bugs.webkit.org/show_bug.cgi?id=267277) |
| PDF | אין עותק תצוגה. נפתח המקור |

### 6.5 פתיחה והורדה

`GET /api/storage/files/[id]` בודק ב-`authorize_file` בכל בקשה, ומפנה לקישור חתום ל-**60 שניות** (SEC-02). אחרי ביטול גישה כל בקשה חדשה נכשלת. קישור שכבר הונפק פג בתוך 60 שניות, וזה חלק מהבדיקה.

## 7. דוח PDF והדפסה

אין ספייק (A-20). הגישה: תבנית HTML בעברית, Chromium בשרת ו-`pdf-lib` לצירוף עמודים.

| נושא | כלל |
|---|---|
| עברית | `lang=he`, ‏`dir=rtl`, בידוד bidi, וגופן מקומי מוטמע בתיקיית המשימה |
| תוכן | לוגו, פרויקט, תאריך עבודה, מדווח, מועד הזנה, האם ומתי נערך, טקסט כלשונו ותמונות מעותק התצוגה |
| תצוגה, הדפסה והורדה | **אותו PDF.** inline לתצוגה ולהדפסה, attachment להורדה. אין תבנית שנייה, ו-PDF מצורף נמצא גם בהדפסה |
| היקף | דיווח, פרויקט ותאריך, או פרויקט וטווח, מהישן לחדש. בטווח התאריכים וימי העבודה בפתיחה |
| תאריך ריק | מסמך שאומר שאין דיווחים |
| PDF מצורף | אחרי גוף הדוח, לפי סדר הדיווחים. מוצפן, פגום או תמונה שלא הומרה: שורה מפורשת בדוח |
| דוח גדול | חלקים של עד 200 דיווחים ועד 75MB קלט. אם צריך יותר, ״חלק 1 מתוך N״. שום דבר אינו נחתך |
| רשת | Chromium חוסם כל בקשת רשת. התמונות והגופן מוטמעים |
| משלוח | זרימה, ולכן לא חלה מגבלת 4.5MB. הדוח אינו נשמר |

## 8. גיבוי ושחזור: נדחו

אלון, 22.11.2026: ״כרגע לא נתעסק בגיבוי בשלב הבנייה הראשוני״.

- בשלב הבנייה אין גיבוי, שחזור, R2 או ריצה מתוזמנת, ואין משימות או בדיקות שלהם.
- הדרישות A-15, ‏BAK-01, ‏BAK-02 ו-BAK-03 נדחות, ולא נמחקות. P0.5 רושמת זאת.
- בפיתוח יש נתונים בדויים בלבד. הסכמה נבנית מחדש מהמיגרציות שב-git, והנתונים אינם.
- כשיהיה ייצור, Supabase Pro כולל ממילא [גיבוי מסד יומי ל-7 ימים](https://supabase.com/docs/guides/platform/backups). הוא **אינו כולל את הקבצים**, ואינו ממלא את A-15.
- לפני נתונים אמיתיים שואלים את אלון אם ומתי חוזרים לנושא. התכנון הקודם נמצא בסעיף 8 בקומיט `7c81385`.

## 9. תלויות, סביבות ובדיקות

### 9.1 כל התלויות של P1.1

| חבילה | שימוש |
|---|---|
| `next`, `react`, `react-dom`, `typescript`, `tailwindcss` | אפליקציה |
| `server-only`, `zod` | גבול שרת ואימות |
| `@supabase/supabase-js`, `@supabase/ssr` | מסד, כניסה ואחסון |
| `tus-js-client` | העלאה |
| `sharp`, `heic-convert` | עותק תצוגה |
| `puppeteer-core`, `@sparticuz/chromium` | PDF. גרסאות Chromium תואמות |
| `@cantoo/pdf-lib` | צירוף עמודים. `pdf-lib` המקורית לא עודכנה מאז 2021 |
| `exceljs` | Excel |
| `vitest`, `@playwright/test`, `eslint`, `supabase` | פיתוח ובדיקות |

ב-`next.config.ts` מוגדרים מראש החבילות הבינריות, קובצי Chromium ונכסי הדוח. כך P1.4.8 אינה עורכת קובץ משותף.

### 9.2 סביבות

| סביבה | נתונים | מתי |
|---|---|---|
| פיתוח, בדיקות ו-CI | Supabase Free **בענן**, בדויים. בלי Supabase מקומי ובלי Docker | אחרי D31-1. מיגרציה אחרי D31-2 |
| תצוגה מקדימה | אותו מסד פיתוח | רק עם Vercel Pro, אחרי D31-3 |
| ייצור | Supabase Pro, אמיתיים | G4. מפתחות וארגון נפרדים |

משתני הסביבה נקראים בשרת בלבד. רק הכתובת והמפתח הפומבי נמסרים לדפדפן, לצורך העלאה: `SUPABASE_URL`, ‏`SUPABASE_PUBLISHABLE_KEY`, ‏`SUPABASE_SECRET_KEY`. ב-`.env.example` אין ערכים. אין שינוי סכמה מלוח הבקרה, ומיגרציה אינה רצה אוטומטית בפריסה.

העבודה מול הענן:

1. P1.2 כותבת SQL ובדיקות, מביאה את D31-2, מפעילה עם `supabase db push`, ורק אז הבדיקות מול המסד יכולות לעבור. הטיפוסים נוצרים עם `supabase gen types --project-id`.
2. רק משימה סדרתית משנה סכמה. שש המשימות המקבילות יוצרות נתונים עם מזהים ייחודיים ואינן מאפסות את המסד.
3. בדיקות הכניסה מעבירות IP בדוי שונה, כדי לא להיחסם במגבלת הקצב.
4. נתוני בדיקה מצטברים, כי אין מחיקה פיזית. איפוס סביבת הפיתוח מריץ מיגרציות, ולכן רק באישור אלון.
5. ל-CI יש מפתחות של סביבת הפיתוח בלבד, ב-Secrets של GitHub.

### 9.3 בדיקות

| שכבה | כלי | מה חייב לעבור |
|---|---|---|
| חישוב | Vitest | PRD 11.6, מספרים שליליים, רצף חודשים, 100 שורות ו-36 חודשים |
| מסד | Vitest מול Supabase בענן, סביבת הפיתוח | כל בדיקה ב-PERMISSIONS, עם JWT אמיתי ישירות ל-Data API |
| אחסון | Vitest | גישה ישירה, דריסה, גודל, סוג, פקיעת 60 שניות |
| לוגיקה | Vitest | חוזה, שגיאות, idempotency, שתי עריכות מקבילות |
| הפקה | Vitest ו-Chromium | עברית, 160 שורות, תאריך, חלקים, PDF פגום, נוסחה ב-Excel |
| שער עומק | Vitest | בעלים, מנהל עם ובלי כספים, עובד, מנהל ב-א ועובד ב-ב, מוסר ומושבת |
| מסכים | Playwright | שתי המעטפות ברוחבי AGENTS |
| ביצועים | Vitest ו-Playwright | 100 פרויקטים ו-1,000 דיווחים, עד 3 שניות ב-4G |

## 10. סיכונים

| סיכון | טיפול |
|---|---|
| שרת בפרנקפורט ולא בישראל | שרת ומסד באותו אזור, דפדוף ומדידת UX-11 |
| פונקציית `SECURITY DEFINER` עוקפת RLS | `search_path=''`, הרשאה בשורה הראשונה, ביטול EXECUTE כברירת מחדל ובדיקה שלילית לכל פונקציה |
| שינוי בסכמת Auth או Storage של הספק | רק קריאת `auth.users` ו-`auth.sessions`, ובדיקות אחרי שדרוג |
| תוכנית חינמית מושהית | רק פיתוח |
| HEIC גדול או חדש אינו מפוענח | המקור נשמר והכשל גלוי |
| Chromium ו-Puppeteer לא תואמים | נעילת גרסאות ובדיקת קבלה ב-CI |
| נפח תמונות מהיר מההנחות | בדיקת שימוש חודשית והתראת הוצאה |
| אין גיבוי נפרד בשלב הבנייה | החלטת אלון. נתונים בדויים בלבד, ושאלה לפני נתונים אמיתיים |
| מסד פיתוח משותף לכל המשימות | מזהים ייחודיים, סכמה סדרתית ובדיקות CI אחת בכל פעם |
| נעילת ספק | Postgres רגיל וייצוא של מסד וקבצים |

</div>
