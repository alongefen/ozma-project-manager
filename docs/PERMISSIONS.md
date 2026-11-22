<div dir="rtl">

# מפת הרשאות

משימה P0.2, 22.11.2026. **לפי הכרעות G1 של אלון. אינה מיגרציה.** מתרגמת את [מטריצת PRD 5](PRD.md#5-מטריצת-תפקיד--פעולה) לכללים ולבדיקות. המודל ב-[ARCHITECTURE](ARCHITECTURE.md).

## 1. כללי היסוד

1. ברירת המחדל היא חסימה. ל-`anon` אין הרשאה על שום טבלה או פונקציה.
2. התפקיד והכספים נקראים מהשיוך לפרויקט, בכל בקשה. לא מה-JWT, לא מהלקוח ולא מהמשתמש.
3. השבתה, סשן מבוטל והסרת שיוך גוברים על כל הרשאה, כולל גישה למסמך.
4. ל-`authenticated` יש SELECT בלבד, מסונן ב-RLS. **כל כתיבה היא פונקציה.**
5. גם ל-`service_role` אין הרשאת כתיבה או קריאה על הטבלאות. יש לו רק `system_*`.
6. באחסון אין policy למשתמשים. השרת חותם רק אחרי בדיקה במסד עם JWT המשתמש.
7. PDF ו-Excel נבנים מקריאות עם JWT המשתמש. אין להם נתיב נתונים משלהם.
8. מה שאסור לדעת עליו מחזיר `NOT_FOUND`: בלי שם, כמות, תצוגה מקדימה או תוצאת חיפוש (PERM-07).

## 2. פונקציות ההחלטה

כולן בסכמה `private`, שאינה חשופה ב-API, עם `security definer` ו-`search_path=''`.

| פונקציה | אמת כאשר |
|---|---|
| `active()` | יש פרופיל פעיל, ה-`session_id` קיים ב-`auth.sessions`, ונוצר לא לפני `sessions_valid_after` |
| `owner()` | `active()` והפרופיל הוא הבעלים |
| `role_in(p)` | התפקיד בשיוך ל-`p`, רק אם `active()` |
| `member(p)` | `owner()`, או שיש `role_in(p)` |
| `manager(p)` | `owner()`, או `role_in(p) = manager` |
| `writable(p)` | `owner()`, או שהפרויקט active ואינו בארכיון |
| `work(p)` | `member(p)` וגם `writable(p)` |
| `manage(p)` | `manager(p)` וגם `writable(p)` |
| `finance(p)` | `owner()`, או `role_in(p) = manager` וגם `finance_access` באותו שיוך |
| `finance_write(p)` | `finance(p)` וגם `writable(p)` |
| `read_document(d)` | `owner()`. אחרת: `member(d.project_id)`, לא בארכיון, וגם אחד: `all`; ‏`selected` ויש לו הרשאה. ב-`owner` איש אחר אינו רואה, גם לא המעלה |
| `read_entry(e)` | `owner()`, או `member(e.project_id)` והדיווח לא בוטל |
| `read_version(v)` | `owner()`, או `read_entry` של הדיווח וגם פרויקט הגרסה הוא הפרויקט הנוכחי שלו |
| `correct_entry_allowed(e)` | לא בוטל, וגם: `owner()`, או שהוא המדווח ו-`work(e.project_id)` |
| `read_file(f)` | הקובץ ready ו-`active()`, וגם: `owner()`; שער פעיל בפרויקט שהוא `member`; ‏`read_document`; או צירוף בגרסה שהיא `read_version` |

ב-policy עוטפים ב-`select` כדי שהפונקציה לא תרוץ לכל שורה ללא צורך.

## 3. RLS לכל טבלה

RLS דלוק ב-17 הטבלאות. לכל אחת policy של SELECT בלבד.

| טבלה | מי קורא | דרך הכתיבה היחידה |
|---|---|---|
| `profiles` | `owner()`, או השורה של עצמו כש-`active()` | `create_profile`, `update_profile`, `set_user_active`, `revoke_user_sessions`, `system_bootstrap_owner`, `system_owner_recovered` |
| `memberships` | `owner()`, או השורה של עצמו כש-`active()` | `set_membership`, `remove_membership`, `set_finance_access` |
| `projects` | `member(id)` | `create_project`, `update_project`, `set_project_status`, `set_project_archived` |
| `project_contacts` | `member(project_id)` | `create_project`, `update_project` |
| `project_private` | `owner()` | `create_project`, `update_project` כשבן קורא |
| `project_finance_settings` | `finance(project_id)` | `create_project`, `set_finance_link` |
| `project_covers` | `owner()`, או פעילה ו-`member(project_id)` | `set_project_cover` |
| `stored_files` | `read_file(id)` | `begin_upload`, `system_finish_upload` |
| `documents` | `read_document(id)` | `create_document`, `set_document_access`, `set_document_archived` |
| `document_grants` | `owner()` | `create_document`, `set_document_access`, וגם מחיקה עם השיוך |
| `tasks` | לא נמחקה ו-`member(project_id)` | `create_task`, `update_task`, `set_task_completed`, `delete_task` |
| `diary_entries` | `read_entry(id)` | `create_entry`, `correct_entry`, `move_entry`, `cancel_entry` |
| `diary_versions` | `read_version` | הוספה מתוך ארבע פונקציות היומן |
| `diary_attachments` | יש גרסה קריאה שמכילה אותו | הוספה מתוך `create_entry`, `correct_entry` |
| `diary_version_files` | `read_version` של הגרסה | הוספה מתוך ארבע פונקציות היומן |
| `transactions` | `finance(project_id)`, ומבוטלת רק `owner()` | `create_transaction`, `update_transaction`, `cancel_transaction` |
| `sensitive_events` | `owner()` | הוספה מתוך הפונקציות בלבד |

## 4. פונקציות המסד

P1.2 בונה את כולן, עם הגוף ועם בדיקה חיובית ושלילית.

הכללים:
- קלט יחיד `input jsonb`, באותם שדות camelCase של החוזה, ופלט `jsonb` באותה צורה. המסד מאמת שוב טיפוס, טווח ואילוץ.
- פונקציית כתיבה היא `security definer`, עם `search_path=''`, ונועלת את השורה ובודקת הרשאה לפני כל בדיקה אחרת או כתיבה.
- **סיסמה לעולם אינה נשלחת למסד.** `create_profile` ו-`revoke_user_sessions` מקבלות את קלט החוזה בלי השדה `password`.
- המסד קובע מבצע, שם וזמן. שדה כזה בקלט נדחה.
- `revoke execute` מ-`public` ומ-`anon`, ואז grant מפורש לפי הטבלאות שלמטה.

### 4.1 כתיבה, ל-`authenticated`

| פונקציה | פעולה בחוזה | הרשאה ותנאי | אירוע בלוג |
|---|---|---|---|
| `create_profile` | createUser | `owner()`. המשתמש כבר ב-Auth, האימייל נקרא משם | `user.created` |
| `update_profile` | updateUser | `owner()`. האימייל מסונכרן מ-Auth | `user.updated` |
| `set_user_active` | setUserActive | `owner()`, לא על הבעלים. מעדכן `sessions_valid_after` | `user.active_changed` |
| `revoke_user_sessions` | resetPassword | `owner()`. מעדכן `sessions_valid_after` | `user.password_reset` |
| `set_membership` | setMembership | `owner()`. משתמש פעיל שאינו הבעלים. לעובד מכבה כספים | `membership.changed` |
| `remove_membership` | removeMembership | `owner()` | `membership.removed` |
| `set_finance_access` | setFinanceAccess | `owner()`. הדלקה רק למנהל | `membership.finance_changed` |
| `create_project` | createProject | `owner()`. יוצר ארבע שורות בטרנזקציה | `project.created` |
| `update_project` | updateProject | `manage(p)`. ‏`businessNumber` ממי שאינו בן נדחה | `project.updated`, בלי ערכים רגישים |
| `set_project_status` | setProjectStatus | `owner()` | `project.status_changed` |
| `set_project_archived` | setProjectArchived | `owner()` | `project.archive_changed` |
| `set_project_cover` | setProjectCover | `owner()`. קובץ cover, ‏ready, שלו, מהפרויקט, שלא נוצל | `project.cover_changed` |
| `begin_upload` | beginUpload | document: ‏`manage(p)`. ‏diary: ‏`work(p)`. ‏cover: ‏`owner()`. סוג, גודל ועד 20 | אין |
| `create_document` | createDocument | `manage(p)`. קובץ document, ‏ready, שלו, מהפרויקט, שלא נוצל. **מי שמעלה חייב לשלוח גישה**, והנבחרים משויכים. החלפה רק `owner()` | `document.created`, ובהחלפה `document.replaced` |
| `set_document_access` | setDocumentAccess | `owner()`. הנבחרים משויכים | `document.access_changed` |
| `set_document_archived` | setDocumentArchived | `owner()` | `document.archive_changed` |
| `create_task` | createTask | `work(p)` | אין |
| `update_task` | updateTask | `work(p)`, לא נמחקה | אין |
| `set_task_completed` | setTaskCompleted | `work(p)`, לא נמחקה | אין |
| `delete_task` | deleteTask | `owner()`. מחיקה רכה | `task.deleted` |
| `create_entry` | createEntry | `work(p)`, בלי עתיד. קובצי diary, ‏ready, שלו, מהפרויקט, שלא נוצלו. כותב גרסה 1 | אין |
| `correct_entry` | correctEntry | `correct_entry_allowed(e)`. קובץ קיים מאותו דיווח, או חדש לפי הכלל של יצירה. כותב גרסה | `entry.corrected`, בלי תוכן |
| `move_entry` | moveEntry | `owner()`. כותב גרסה | `entry.moved` |
| `cancel_entry` | cancelEntry | `owner()`. כותב גרסה | `entry.cancelled` |
| `create_transaction` | createTransaction | `finance_write(p)` | `transaction.created` |
| `update_transaction` | updateTransaction | `finance_write(p)`, לא בוטלה. הפרויקט אינו משתנה | `transaction.updated` |
| `cancel_transaction` | cancelTransaction | `owner()` | `transaction.cancelled` |
| `set_finance_link` | setExcelLink | `finance_write(p)`, ‏HTTPS בלבד | `finance.link_changed` |

### 4.2 קריאה, ל-`authenticated`

| פונקציה | משמשת את | הרשאה |
|---|---|---|
| `get_actor` | getContext, signIn | `active()`. אחרת ריק |
| `project_permissions` | forProject | `member(p)`. מחזירה את דגלי החוזה |
| `project_access_candidates` | listAccessCandidates | `manage(p)`. מזהה ושם של משויכים פעילים בלבד |
| `project_cards` | listProjects, getHome | invoker עם RLS. מונים בלי מבוטל או מחוק |
| `project_manager_names` | getProject | `member(p)`. שמות מנהלים פעילים בלבד |
| `diary_summary` | getSummary, getBook, planReport | invoker עם RLS, לא מבוטלים |
| `finance_month_totals` | getBook | `finance(p)`, פרויקט אחד חובה |
| `finance_all_month_totals` | getAllProjectTotals | `owner()` בלבד |
| `get_pending_upload` | finishUpload | `active()` והוא המעלה, רק pending |
| `authorize_file` | getSignedUrl, readBytes | `read_file(f)`. מחזירה bucket ונתיב |

שאר הקריאות הן SELECT רגיל תחת RLS.

### 4.3 שרת, ל-`service_role` בלבד

| פונקציה | תנאי | אירוע בלוג |
|---|---|---|
| `system_finish_upload` | המבצע פעיל והוא המעלה. ‏pending בלבד, פעם אחת | אין |
| `system_bootstrap_owner` | אין בעלים | `owner.created` |
| `system_owner_recovered` | נוהל שחזור, עם מזהה תמיכה | `owner.password_recovered` |

הפונקציה `private.reject_auth_email` היא hook, עם EXECUTE ל-`supabase_auth_admin` בלבד, ומחזירה שגיאה תמיד.

## 5. כלל ובדיקה לכל שורת מטריצה

שורה P14 שונה מ-PRD 5: שם מנהל אינו קובע גישה בהעלאה, וכאן הוא קובע, לפי הכרעת אלון בסעיף 4 של G1. P0.5 מעדכנת את ה-PRD.

איך קוראים:
- ״מסד״ הוא הכלל המחייב. ״שרת״ הוא הנתיב שקורא לו.
- בעמודת אחסון וייצוא ״אין״ פירושו שהפעולה אינה פותחת שם שום נתיב.
- כל בדיקה שלילית רצה **פעמיים: דרך הפעולה בשרת וישירות מול ה-Data API או האחסון עם JWT אמיתי.**
- לכל בדיקה שלילית מצטרפים גם לא מחובר, מושבת ולא משויך.
- שמות הבדיקות הם המזהה עם `+` לחיובית ו-`-` לשלילית, למשל `P14-`.

הדמויות: **בן**, **מ** מנהל בפרויקט א בלי כספים, **מכ** מנהל בפרויקט א עם כספים, **ע** עובד בפרויקט א, **מע** מנהל ב-א ועובד ב-ב.

### 5.1 כניסה, משתמשים ושיוכים

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P01 | כניסה באימייל וסיסמה | `active()` בכל policy ופונקציה | חותמים רק לסשן תקף | `signIn` ואז `get_actor` | סשן תקף חובה | כל דמות נכנסת, וגם אחרי סגירת דפדפן | סיסמה שגויה, מושבת, סשן שבוטל או משתמש בלי פרופיל: אין אף שורה |
| P02 | צפייה בפרויקט | `member(p)` | שער רק דרך `read_file` | `listProjects`, `getProject` | רק פרויקט קריא | מע רואה א ו-ב | ע אינו מוצא את ב ברשימה, בחיפוש, במונה או במזהה ישיר. מספר חברה חסום לו |
| P03 | הוספה והסרה של גישה לפרויקט | `owner()` ב-`set_membership`, `remove_membership` | ההסרה חוסמת חתימה | `setMembership`, `removeMembership` | ההסרה חוסמת הפקה | בן מוסיף ומסיר רק את א | מ, מכ, ע אינם מוסיפים, משנים או מסירים, גם לא את עצמם |
| P04 | קביעת תפקיד בשיוך | `owner()`, תפקיד רק ב-`memberships` | נגזר מהתפקיד הנוכחי | `setMembership` | נגזר מהתפקיד הנוכחי | בן הופך את ע למנהל ב-א בלבד | ע מעלה את עצמו; מע מבצע פעולת מנהל ב-ב |
| P05 | יצירת חשבון ואיפוס סיסמה | `owner()` ב-`create_profile`, `revoke_user_sessions` | סשן ישן חסום | `createUser`, `resetPassword`, אחרי `requireOwner` | סשן ישן חסום | בן יוצר, הסיסמה עובדת, והאיפוס מבטל סשן פתוח. אפס מיילים | מ או ע יוצר או מאפס; הרשמה, recover ושינוי אימייל עצמי נכשלים |
| P06 | השבתת משתמש | `owner()` ב-`set_user_active` | חסום בבקשה הבאה | `setUserActive` | חסום בבקשה הבאה | בן משבית, הסשן הפתוח נחסם מיד וההיסטוריה נשארת | מ או ע משבית; השבתת הבעלים נדחית גם לבן |

### 5.2 פרויקטים

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P07 | יצירת פרויקט | `owner()` ב-`create_project` | אין | `createProject` | אין | בן יוצר בלי מנהל, וכפילות מחזירה אותו מזהה | מ, מכ, ע נדחים |
| P08 | עריכת פרטי פרויקט | `manage(p)` ב-`update_project` | אין | `updateProject` | אין | בן ומ עורכים את א | ע ב-א, מע ב-ב, מ בפרויקט שהסתיים, ומספר חברה ממ |
| P09 | העלאת תמונת שער | `owner()` ב-`begin_upload`, `set_project_cover` | אסימון cover רק לבן, בלי upsert | `beginUpload`, `setProjectCover` | אין | בן מעלה ומחליף, ומשויך רואה | מ או ע מבקש אסימון; שימוש בקובץ מפרויקט אחר |
| P10 | סיום פרויקט ופתיחה מחדש | `owner()` ב-`set_project_status` | סיום חוסם העלאה | `setProjectStatus` | הקריאה נשארת | בן מסיים ופותח | מ, מכ, ע משנים סטטוס |
| P11 | העברה לארכיון | `owner()` ב-`set_project_archived` | ארכיון חוסם העלאה | `setProjectArchived` | הקריאה נשארת | בן מעביר ומחזיר | מ או ע מעביר |

### 5.3 מסמכים

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P12 | צפייה והורדה של מסמך | `read_document(d)` | `authorize_file`, ‏60 שניות | `listDocuments`, `getSignedUrl` | אין | `all` ונבחר פותחים | מ על ״בן בלבד״, גם כשהוא העלה, לא נבחר, הוסר: אין שם, מונה, חיפוש, תצוגה או חתימה |
| P13 | העלאת מסמך | `manage(p)` ב-`begin_upload`, `create_document` | אסימון document בלי upsert | `beginUpload`, `createDocument` | אין | בן ומ מעלים, כל אחד עם הגישה שהגדיר | ע; מע ב-ב; מעל המגבלה; סוג מזויף; מ בפרויקט שהסתיים |
| P14 | קביעת גישה למסמך בהעלאה | המעלה, ב-`manage(p)`, שולח `access` חובה ל-`create_document`. ‏`project_access_candidates` ב-`manage(p)` | אין חשיפה לפני השורה | `listAccessCandidates`, `createDocument` | אין | בן מגדיר; מ מגדיר בפרויקט שלו כל אחד משלושת המצבים, ורק המותרים רואים | ע; מע ב-ב; בלי גישה; רשימה ריקה; נבחר לא משויך; מ מבקש שמות בפרויקט אחר או מקבל אימייל וכספים |
| P15 | שינוי גישה אחרי העלאה | `owner()` ב-`set_document_access` | החתימה הבאה לפי החדש | `setDocumentAccess` | אין | בן עורך גישה שהגדיר מנהל, והסרה חוסמת גם את המעלה | המעלה, מ או ע משנים; נבחר שאינו משויך |
| P16 | הסרה או החלפה של מסמך | `owner()` ב-`set_document_archived`, ובהחלפה ב-`create_document` | מקור ישן נשאר, בלי DELETE | `setDocumentArchived`, `createDocument` | אין | בן מחליף, מעביר לארכיון ומחזיר | מ מעביר או מחליף; מחיקת אובייקט ישירה |

### 5.4 משימות

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P17 | צפייה במשימות ויצירה | קריאה `member(p)`, יצירה `work(p)` | אין | `listTasks`, `createTask` | אין | בן, מ ו-ע רואים ויוצרים | פרויקט אחר; יצירה של מ או ע בפרויקט שהסתיים |
| P18 | עריכה וסימון של כל פתק | `work(p)` | אין | `updateTask`, `setTaskCompleted` | אין | ע עורך ומסמן פתק של מ | לא משויך; פתק מחוק; פרויקט שהסתיים |
| P19 | מחיקת פתק | `owner()` ב-`delete_task` | אין | `deleteTask` | אין | בן מוחק, והאירוע בלוג | מ, גם יוצר הפתק, או ע מוחקים |

### 5.5 יומן

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P20 | צפייה ביומן פרויקט וביומן הכללי | `read_entry(e)` | `read_file` דרך גרסה קריאה | `listEntries`, `getSummary`, `listVersions` | אותה קריאה | ע רואה את א בשני היומנים, עם קבצים וגרסאות | דיווח מ-ב, מבוטל, או גרסה מפרויקט קודם אינם מופיעים ואינם נספרים |
| P21 | יצירת דיווח | `work(p)` ב-`create_entry` | אסימון diary רק ב-`work(p)` | `beginUpload`, `createEntry` | אין | בן, מ ו-ע יוצרים בדיעבד עם קובץ, והכפילות אחת | עתיד; מדווח או זמן מזויף; קובץ של אחר; פרויקט שהסתיים |
| P22 | תיקון דיווח עצמי | `correct_entry_allowed(e)` | צירוף חדש ב-`work(p)`, הישן נשאר | `correctEntry` | מסומן שנערך | ע מתקן טקסט וקבצים, ונוצרת גרסה | הוסר; דיווחו הישן בפרויקט שהסתיים; שינוי תאריך או פרויקט |
| P23 | תיקון דיווח של אחר | אותו כלל, ורק `owner()` עובר | רק בן מצרף | `correctEntry` | העורך והזמן מסומנים | בן מתקן, והמדווח נשאר | מ מתקן את ע; ע מתקן את מ |
| P24 | העברה או ביטול של דיווח | `owner()` ב-`move_entry`, `cancel_entry` | הקבצים לפי הפרויקט החדש | `moveEntry`, `cancelEntry` | מבוטל אינו בדוח | בן מעביר ומבטל, וכל גרסה נשמרת | מדווח או מ מעביר ומבטל; DELETE נדחה גם לבן |
| P25 | הדפסה או PDF של יומן מתאריך מסוים | RLS של P20 | `readBytes` בודק כל קובץ | `planReport`, `renderReportPart` | `/api/reports/diary` | ע מפיק תאריך ב-א, גם כשהסתיים, עם כל הדיווחים ו-PDF מצורף | ב; דיווח חסום במזהה; הפקה אחרי הסרה |

### 5.6 כספים

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P26 | כספי פרויקט: צפייה, הזנה, עריכה וייצוא | קריאה `finance(p)`, כתיבה `finance_write(p)` | אין | `getBook`, `createTransaction`, `updateTransaction`, `setExcelLink` | `/api/exports/finance` עם `getBook` | בן ו-מכ עובדים ב-א ומייצאים | מ, ע, מכ ב-ב, ומנהל שהפך לעובד: אין שורה, סיכום, קישור או קובץ |
| P27 | ביטול תנועה | `owner()` ב-`cancel_transaction` | אין | `cancelTransaction` | מבוטלת אינה בייצוא | בן מבטל, הסכום יורד והשורה נשמרת | מכ מבטל; עריכה אחרי ביטול; DELETE |
| P28 | פתיחת כספים למנהל בפרויקט מסוים | `owner()` ב-`set_finance_access`, עם CHECK | אין | `setFinanceAccess` | חל בבקשה הבאה | בן פותח וסוגר למ ב-א | מ פותח לעצמו; פתיחה לעובד; א אינו פותח את ב |
| P29 | סיכום כל הפרויקטים וקוביית כספים | `owner()` ב-`finance_all_month_totals` | אין | `getTransferSummary`, `getHome` | אין | בן מקבל גם הסתיים וארכיון, והפירוט שווה לסכום | מכ, גם עם כספים בכל הפרויקטים, אינו מקבל סיכום או קובייה |

### 5.7 לוג וחוסר שינוי

| מזהה | פעולה | מסד | אחסון | שרת | ייצוא | בדיקה חיובית | בדיקה שלילית |
|---|---|---|---|---|---|---|---|
| P30 | קריאת לוג פעולות רגישות | policy של `owner()` | אין | `audit.list` | אין | בן רואה מי, מתי ומה | מ, מכ, ע: אפס שורות |
| P31 | עריכה או מחיקה של גרסה, לוג או קובץ מקור | אין grant, אין פונקציה, והטריגר דוחה | אין policy, אין upsert, אין נתיב מחיקה | אין פעולה כזו | הפקה אינה משנה מקור | פעולה רגילה מוסיפה גרסה ואירוע, וגיבוב המקור זהה | UPDATE, DELETE, דריסה ומחיקת אובייקט בידי ע, מ **ובן** נדחים |

## 6. מצבים חוצים

| מזהה | מצב | הכלל | מה בודקים |
|---|---|---|---|
| X01 | הסרת שיוך | `member` נבדק בכל בקשה | עם אותו JWT נחסמים קריאה, כתיבה, חתימה, PDF ו-Excel ב-א בלבד. ב נשאר |
| X02 | שיוך מחדש | שורה חדשה | בלי כספים ובלי הרשאות מסמך נבחרות |
| X03 | מנהל שהפך לעובד | כספים נכבים באותה טרנזקציה | כספים נחסמים מיד, ואינם חוזרים בקידום |
| X04 | השבתה, איפוס ויציאה | `active()` | JWT שעוד לא פג מקבל אפס שורות, חתימות והפקות |
| X05 | הפעלה מחדש | `sessions_valid_after` | הסשן הישן נשאר חסום, וכניסה חדשה עובדת |
| X06 | פרויקט שהסתיים | `writable(p)` | מ, מכ, ע: קוראים, מדפיסים ומייצאים מה שהותר. כל 11 סוגי הכתיבה שלהם נדחים |
| X07 | ארכיון | `writable(p)` | כמו X06, וגם כשהסטטוס active |
| X08 | פתיחה מחדש | `writable(p)` | הכתיבה חוזרת לפי אותו שיוך |
| X09 | בן בפרויקט שהסתיים | `owner()` עובר ב-`writable` | מותר, לפי PRD 5. A-14 מגביל מנהל ועובד |
| X10 | העברת דיווח | `read_version` | חברי היעד אינם רואים תוכן מגרסת פרויקט המקור |
| X11 | קישור קובץ שהונפק | 60 שניות | בקשה חדשה נחסמת מיד. הקישור הישן מת בתוך 60 שניות |
| X12 | אסימון העלאה אחרי הסרה | בדיקה חוזרת | אובייקט יכול לעלות, אך אינו נעשה מסמך, דיווח או שער ואינו קריא |
| X13 | שתי עריכות | `revision` | השנייה מקבלת CONFLICT, והראשונה נשמרת |
| X14 | ניסיון חוזר | `request_id` | רשומה אחת |
| X15 | קריאה ישירה ל-Data API | grants ו-RLS | אין INSERT, UPDATE, DELETE בשום טבלה, לכל דמות וגם ל-`service_role` |
| X16 | פונקציה חדשה | ברירת מחדל | בדיקת קטלוג נכשלת על טבלה בלי RLS, פונקציה שאינה ברשימה, EXECUTE ל-anon או `search_path` חסר |
| X17 | ניסיונות כניסה חוזרים | מגבלת הספק לפי IP שהועבר | נחסם זמנית, ו-IP אחר ממשיך לעבוד |
| X18 | יותר ממנהל אחד | אין UNIQUE על תפקיד | שני מנהלים עובדים, וכספים נפרדים לכל אחד |

‏11 הכתיבות ב-X06: פרטי פרויקט, העלאה, מסמך, יצירת משימה, עריכתה, סימונה, יצירת דיווח, תיקונו, יצירת תנועה, עריכתה וקישור כספים.

## 7. תשע הבדיקות השליליות של P1.2

| הדרישה ב-WORK_PLAN | בדיקות |
|---|---|
| פעולת מנהל בפרויקט אחר | `P04-`, `P08-`, `P13-` |
| מי שאינו בן משנה שיוך או מעלה את עצמו | `P03-`, `P04-` |
| מוסר ניגש או מתקן דיווח ישן | `P22-`, X01 |
| תיקון, העברה, ביטול של אחר או מחיקת פתק | `P19-`, `P23-`, `P24-` |
| כספים: עובד, מנהל בלי, פרויקט אחר, מנהל שהפך לעובד | `P26-`, `P28-`, X03 |
| כתיבה בפרויקט שהסתיים | `P08-`, `P13-`, `P17-`, `P18-`, `P21-`, `P22-`, X06 |
| שינוי גרסה, לוג או מקור בידי כל משתמש | `P31-`, X15 |
| מחיקה פיזית של דיווח בידי בן | `P24-` |
| זיוף מדווח, הזנה או עריכה | `P21-` |

## 8. לוג

- הפעולות הן רק אלה שבעמודת הלוג בסעיף 4.
- נשמרים לפני ואחרי של תפקיד, כספים, גישה, סטטוס ותנועה (SEC-04). בשינוי פרטי פרויקט נשמרים שמות השדות, ולא טלפון, הערות גישה או מספר חברה.
- סיסמה, JWT, קישור חתום ותוכן דיווח אינם נשמרים. תוכן הדיווח נמצא בגרסאות.
- כניסות ויציאות נשארות בלוג של הספק ואינן בלוג המוצר.
- אין לאפליקציה לוג של גופי בקשות, כתובות חתומות או פרטי לקוח (PRIV-01).

</div>
