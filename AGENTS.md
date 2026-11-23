# Agent instructions

A project management system for the construction company "חי עוצמה בבנייה": a webapp that is Hebrew and RTL from the ground up, for phone and desktop. The full decisions are in [DECISIONS](docs/DECISIONS.md). This file holds only what every session needs.

## What to read

- **Task session:** this file, the brief, `docs/tasks/<ID>.md` and the task's section in WORK_PLAN. For the other docs (PRD, ARCHITECTURE, PERMISSIONS, DESIGN, DECISIONS), read only the sections the brief points to, with `rg` and `sed -n`. Never read a whole doc.
- **Project manager:** also [NEXT_SESSION](docs/NEXT_SESSION.md) and `git log`.
- Don't read other sessions' transcripts (`.jsonl`). The state lives in the task files and in Git.

## How we work (A-39)

- **Two layers.** The project manager opens a task session with a brief that follows the [template](docs/handoffs/TEMPLATE.md). The task session builds the code itself and runs one `reviewer` subagent for review and tests. Use the `builder` subagent only for a large, isolated piece in separate files.
- **Models.** Subagents run on Sonnet. Use Opus only for an especially hard design or debugging task.
- **Parallel work (A-33, A-37).** On its own initiative, the project manager finds isolated work within the approved scope and opens sessions for it, without asking for approval of the order. Before that, it checks the existing sessions and worktrees to avoid duplicates. At most two task sessions run at once.
- **The project manager stays short-lived.** It opens a task, updates NEXT_SESSION and closes. It doesn't watch sessions in a loop, write code or run tests. A new manager session starts from NEXT_SESSION and Git.
- **Docs-only changes** are made directly in the session, with no subagents and no code checks (A-36). Read the diff once before committing.
- **Keep output short.** Run tests with a quiet reporter and `| tail -40`. Screenshots stay inside the reviewer.
- **One review per change.** Go back to it only for a concrete finding or a part that changed since. After a rebase that doesn't change content, check the diff; no second review is needed.
- **No approval from Alon is needed to merge (A-26).** The task session merges after the review. The product gates and D31 still apply. Ask Alon only for a missing decision or something outside an approval. Never ask again for an approval already given, and don't reopen G0, G1 or GU (A-18, A-21, A-24).

<<<<<<< Updated upstream
## Sources of truth
=======
## עבודה מעשית וממוקדת תוצאה

החלטת אלון, 22.11.2026: שומרים על מעקב מסודר ב-docs, אבל מצמצמים מורכבות ותהליכים מיותרים. מודדים התקדמות לפי יכולות שנבנו ועובדות.

- מתכננים ומתעדים רק את מה שנחוץ לביצוע, לבדיקה ולהמשך העבודה. לא פותחים סבב תכנון או משימת ניקיון נפרדת בלי צורך ממשי.
- WORK_PLAN מציגה בקצרה מה בונים, תלות, מצב ומה נחשב גמור. לא מעתיקים אליה את כל הדרישות וההחלטות.
- DECISIONS מרכזת החלטות אמיתיות של אלון. במסמכים אחרים מפנים אליה במקום לשכפל אותן, ולא מבקשים שוב אישור שכבר ניתן.
- קובץ משימה מתעד בקצרה מה השתנה, מה נבדק ומה נשאר. נקודת המשך כוללת מצב עדכני, הפעולה הבאה והפניות; אין צורך לשחזר את כל השיחה.
- מסירים כפילויות והוראות מיושנות במהלך עדכון רלוונטי ובמסגרת בעלות הקבצים. לא משנים הנחיות לשיחות שכבר עובדות רק כדי לארגן מחדש את התהליך.
- מריצים בדיקות בהתאם לשינוי ולסיכון. לא חוזרים על בדיקה שעברה בלי שינוי שמשפיע עליה, כשל או חשש מוגדר. בסקירה קוראים את ה-diff ואת תוצאות הבדיקות; לא משחזרים אוטומטית את כל הבדיקות.
- שומרים על שערי המיזוג ואישורי D31 שנקבעו. לא מוסיפים שערים או בקשות אישור לפעולות שכבר אושרו.

### בדיקות ואישורים בלי סבבים מיותרים

עדכון אלון, 22.11.2026: הכללים הבאים גוברים על הוראות תהליך ישנות במסמכי המשימות והתוכנית.

- סקירה אחת לשינוי: מנהל הפרויקט קורא את ההפרש ואת תוצאות הבדיקות. חוזרים רק לממצא קונקרטי או לחלק ששונה מאז; אין בדיקה מלאה מחדש בגלל קומיט נוסף.
- אישור מיזוג שכבר ניתן נשאר בתוקף אחרי rebase ללא שינוי בתוכן המשימה. שיחת המשימה מאמתת זאת באמצעות diff או range-diff, בודקת השפעה של שינויי הבסיס וממזגת בלי להעביר שוב דרך אלון או מנהל הפרויקט רק בגלל SHA חדש. מתעדים את ה-SHA שמוזג. שינוי מהותי בתוכן, בהיקף או פתרון התנגשות שמשנה התנהגות חוזר לסקירה ממוקדת לפני מיזוג.
- אישור GU או בדיקת משתמש שכבר ניתנו אינם נפתחים מחדש כשהתצוגה וההתנהגות לא השתנו. אישור עיצוב אינו כשלעצמו אישור מיזוג.
- לפני בקשת אישור בודקים אם כבר ניתן לאותה פעולה ובאותו היקף. פונים לאלון רק להחלטה חסרה או לחריגה מהאישור, לא להחלטות ביצוע שגרתיות בתוך המשימה.
- אישור ראשון למיזוג ושערי המוצר נשארים. מיגרציות, שירותים חדשים, עלויות, AI בתשלום ופריסה נשארים באישור מפורש לפי ההיקף שאושר; אין הרחבת אישור אוטומטית.

## אמת ומקורות
>>>>>>> Stashed changes

- An Alon decision is not the same as something derived from one, said in a meeting, or recommended. Only a real Alon decision goes into DECISIONS, with a date.
- When sources conflict, the order is: Alon's message, the transcript, the guide, then the demo. Record the conflict.
- Maor relays what Ben wants. His words are not a direct approval from Ben.
- The desktop design matches the demo exactly (A-23), without bringing back scope that was cut. The Excel file is a source for data and calculations only.
- Don't claim something was read or checked unless it was. Don't widen the scope. A task is a note with a due date, with no assignee and no reminders.
- Leads, Make and GREEN API belong to the next phase (A-01). They get no navigation, screen, table or permission.

## Product

- **Depth first (A-03):** schema, permissions and logic functions with tests, including the finance calculations. Screens come only after P1.4.10 and G2.
- **Roles (A-06, A-09, A-13, A-14):** owner, project manager and worker.
  - Manager and worker are roles on the project membership, not on the user. Every permission check is against the project.
  - Only Ben adds or removes access.
  - A manager sees finance only if Ben opened it to them on that project.
  - On a finished project, managers and workers can only view and print.
- **Sign-in (A-09, A-34, A-35):** the email is the username, and there is no two-factor authentication. Don't set up an email or SMTP service, and don't wire up a blocking hook. Email confirmation is off on purpose.
- **Work diary (A-08, A-12, A-16, A-19, A-20):**
  - Only Ben changes a report's date or project.
  - Each person edits only their own reports; Ben can edit all of them.
  - Every version is kept, and nothing is physically deleted.
  - A PDF for a given date is required. It shows the reporter, creation, edits and attached PDFs.
  - The entry time is server time.
  - No legal requirements. Hebrew PDF generation is proven, so there is no spike.
- **Phone as an app (A-02, A-10):**
  - The phone gets its own app-like design: buttons at the bottom, no sidebar, no horizontal scroll and no tab bar (UX-19). "דיווח חדש" (new report) is the prominent middle button.
  - There are two shells, phone and desktop, and every feature delivers both together on top of shared logic.
  - It's a webapp, not React Native.

## Technical (A-21)

- Next.js, cloud Supabase and Vercel. No local Supabase, no Docker.
- Reads go through RLS; writes happen only in database functions. Only `actions.ts` is marked `'use server'`; `queries.ts` and `commands.ts` are `server-only`. Identity and context come from the server.
- 50MB per project document; 25MB per report attachment and cover image. Keep the original file the phone sent. Whoever uploads a document sets its access, and after that only Ben edits it.
- Backups are deferred; go back to Alon before there is real data.

## D31: migrations, costs and services

The existing development project is `izjmvyguzbampoasvnru` in Ireland (A-31). A new migration, new service, cost, paid AI, production or deployment needs explicit approval in advance, stating what, why, the cost and how to roll back. No resets, and no re-running existing migrations. An earlier approval never stretches to cover more.

## Git

- One branch per task, from an up-to-date `origin/main`. Work only in the files the task owns in WORK_PLAN; needing any other file means stopping and opening a serial shared change. Parallel tasks don't edit shared docs.
- Docs go in the same commit as the change. Stage files by name, never `git add .`.
- Before merging: fetch, rebase onto `origin/main`, and verify whatever came in.
- After merging, update local `main` by fast-forward only and verify it matches `origin/main` (A-32). No reset, force or direct push to main, and never overwrite local work.

## Never in git

- Secrets, tokens, and env files with values.
- Client data: contact details, finances, the Excel file, files, backups and raw transcripts. From a transcript, keep only minute references.
- `.claude/settings.local.json`, the source package and the guide's screenshots.

Tests and examples use fake data only.

## Before calling something done

<<<<<<< Updated upstream
- Run the tests the change affects and read their output. Earlier evidence stays valid as long as what it tested hasn't changed (A-36).
- For a change to logic, data or permissions, also check on the server that forbidden actions are refused.
- Check a new screen or layout change at 360, 375, 390, 768, 1024 and 1280, in Hebrew and RTL, with no horizontal scroll. For a spot fix, check only what was affected.
- In the task file, record what was checked, the result, and what wasn't checked.
=======
- ענף לכל משימה, מתוך `origin/main` עדכני.
- עובדים רק בקבצים שבבעלות המשימה ב-WORK_PLAN. צריך קובץ אחר? עוצרים ופותחים משימת שינוי משותף סדרתית.
- משימות מקבילות מתעדות ב-`docs/tasks/<ID>.md` ואינן עורכות מסמכים משותפים.
- התיעוד נכנס באותו קומיט כמו השינוי.
- עושים stage לקבצים בשמם, לא `git add .`.
- לפני מיזוג: fetch, rebase על `origin/main` ואימות בהתאם לשינויים שנכנסו; אין חזרה אוטומטית על בדיקות שלא הושפעו.
- לא ממזגים לפני השער הרשום במשימה. אישור חלקי אינו אישור מיזוג, ואישור G0 אינו אישור G1 או D31.
>>>>>>> Stashed changes

## Language

<<<<<<< Updated upstream
- Agent-facing docs are written in English: AGENTS, briefs, task files, WORK_PLAN and NEXT_SESSION. An existing Hebrew doc switches to English when it's substantially rewritten; a small edit keeps the doc's current language.
- Client-facing docs (PRD, DESIGN and DECISIONS, which quotes Alon) and all UI text stay in plain Hebrew.
- File names and code are in English.
=======
- סודות, סיסמאות, טוקנים וקובצי env עם ערכים.
- נתוני לקוח רגישים: פרטי קשר, כספים, קבצים כולל האקסל, גיבויים ותמלולים גולמיים. מתמלול שומרים הפניות לדקות בלבד.
- הקובץ `.claude/settings.local.json`, חבילת המקור וצילומי המדריך.

בבדיקות ובדוגמאות משתמשים בנתונים בדויים בלבד.

## לפני שאומרים ״גמור״

- מריצים את הבדיקות הרלוונטיות להגדרת הגמור ולשינוי וקוראים את הפלט. בדיקות שכבר עברו נשארות ראיה תקפה כל עוד הקוד, התלויות או הסביבה שהן בודקות לא השתנו באופן שמשפיע עליהן.
- בשינוי לוגיקה, נתונים או הרשאות בודקים בשרת גם מה שאסור, לא רק מה שמותר.
- במסך חדש או בשינוי פריסה/ניווט בודקים ב-360, 375, 390, 768, 1024 ו-1280, בעברית ו-RTL, בלי גלילת דף לרוחב. בטלפון: ניווט תחתון ואפס גלילה לרוחב. בתיקון נקודתי בודקים את המסך, המצב והרוחבים שהושפעו, לא את כל המערכת מחדש.
- שינוי תיעוד בלבד דורש סקירת ההפרש והעקביות הרלוונטית, לא build, בדיקות מסכים או שרת. אין ספירת סעיפים, צילומים או דוחות בדיקה לשם התהליך בלבד.
- רושמים בקובץ המשימה מה נבדק, מה התוצאה ומה לא נבדק.

## שפה

מסמכים וממשק בעברית פשוטה. שמות קבצים וקוד באנגלית.

</div>
>>>>>>> Stashed changes
