import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.LEADS_BROWSER_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of (process.env.LEADS_INTERACTIONS_ONLY?[]:[360,375,390,768,1024,1280])){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:4180');await expect(page.getByRole('button',{name:'ליד חדש',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const button=page.getByRole('button',{name:'ליד חדש',exact:true});
  if(width<1024){const box=await button.boundingBox();const parent=await button.locator('..').boundingBox();expect(Math.abs(box.width-parent.width)).toBeLessThan(2);}
  await button.click();await expect(page.getByRole('textbox',{name:'שם',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.waitForTimeout(250);await page.screenshot({path:`/tmp/leads-${width}-form.png`,fullPage:true});
  console.log(`PASS RTL/list/form/overflow ${width}`);
 }
 await page.setViewportSize({width:1280,height:900});await page.goto('http://127.0.0.1:4180');
 await page.getByRole('button',{name:'ליד חדש',exact:true}).click();
 await page.getByRole('textbox',{name:'שם',exact:true}).fill('ליד בדיקה');await page.getByRole('textbox',{name:'טלפון',exact:true}).fill('0501234567');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'ביטול עריכת ליד',exact:true})).toBeVisible();await page.getByRole('dialog',{name:'ביטול עריכת ליד',exact:true}).getByRole('button',{name:'חזרה',exact:true}).click();await expect(page.getByRole('textbox',{name:'שם',exact:true})).toHaveValue('ליד בדיקה');
 await page.getByRole('button',{name:'שמירה',exact:true}).click();await expect(page.getByRole('dialog',{name:'ייתכן שהליד כבר קיים'})).toBeVisible();
 await page.getByRole('dialog',{name:'ייתכן שהליד כבר קיים'}).getByRole('button',{name:'חזרה',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'שם',exact:true})).toHaveValue('ליד בדיקה');
 await page.getByRole('button',{name:'שמירה',exact:true}).click();
 await page.evaluate(()=>window.leadsFixture.failNext='UNAVAILABLE');
 await page.getByRole('button',{name:'יצירה בכל זאת',exact:true}).click();
 await expect(page.getByText('הפעולה לא הושלמה. אפשר לנסות שוב.',{exact:true}).last()).toBeVisible();
 await page.getByRole('button',{name:'יצירה בכל זאת',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'שם',exact:true})).toHaveCount(0);
 const requests=await page.evaluate(()=>window.leadsFixture.calls.filter(c=>c.method==='create').map(c=>c.input));
 expect(await page.evaluate(()=>window.leadsFixture.rows.filter(r=>r.name==='ליד בדיקה').length)).toBe(1);expect(new Set(requests.map(r=>r.requestId)).size).toBe(1);expect(requests.at(-1).allowDuplicate).toBe(true);console.log('PASS duplicate cancel/override/failed retry request ID');

 await page.goto('http://127.0.0.1:4180');
 const status=page.getByRole('button',{name:'סטטוס: ליד בדוי 1',exact:true}).filter({visible:true});
 await page.evaluate(()=>window.leadsFixture.failNext='CONFLICT');await page.waitForTimeout(350);await status.click();await page.getByRole('option',{name:'בוצעה שיחה',exact:true}).click();
 await expect(page.getByText('הליד השתנה. הנתונים רועננו; פתחו שוב ונסו מחדש.',{exact:true})).toBeVisible();await expect(status).toContainText('חדש');
 await page.evaluate(()=>window.leadsFixture.failNext='UNAVAILABLE');await page.waitForTimeout(350);await status.click();await page.getByRole('option',{name:'בוצעה שיחה',exact:true}).click();
 await expect(page.getByText('הפעולה לא הושלמה. אפשר לנסות שוב.',{exact:true})).toBeVisible();await expect(status).toContainText('חדש');
 await page.evaluate(()=>window.leadsFixture.delay=400);await page.waitForTimeout(350);await status.click();await page.getByRole('option',{name:'בוצעה שיחה',exact:true}).click();await expect(status).toContainText('בוצעה שיחה');await expect(status).toBeDisabled();await expect(status).toBeEnabled();await page.evaluate(()=>window.leadsFixture.delay=0);
 console.log('PASS status conflict/unavailable rollback, visible optimistic state and success');
 await page.waitForTimeout(350);await page.getByRole('button',{name:/^סינון/}).click();await page.waitForTimeout(350);await page.getByRole('button',{name:/^סטטוסים: /}).click();await page.getByRole('option',{name:'בוצעה שיחה',exact:true}).click();await page.getByRole('option',{name:'נסגרה עבודה',exact:true}).click();await page.getByRole('dialog',{name:'סינון',exact:true}).getByText('חברת שיווק',{exact:true}).click();await page.getByRole('button',{name:'החלה',exact:true}).click();
 await expect(page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 1',exact:true}).filter({visible:true})).toBeVisible();await expect(page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 2',exact:true}).filter({visible:true})).toBeVisible();
 await page.waitForTimeout(350);await page.getByRole('button',{name:/^סינון/}).click();await page.getByRole('button',{name:'ניקוי',exact:true}).click();console.log('PASS multi-status filter');
 await page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 1',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'העברה לארכיון',exact:true}).click();
 await page.getByRole('dialog',{name:'העברה לארכיון',exact:true}).getByRole('button',{name:'העברה לארכיון',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'שם',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 1',exact:true}).filter({visible:true})).toHaveCount(0);
 await page.waitForTimeout(350);await page.getByRole('button',{name:/^סינון/}).click();await page.waitForTimeout(350);await page.getByRole('button',{name:'ארכיון',exact:true}).click();await page.getByRole('option',{name:'בארכיון',exact:true}).click();await page.getByRole('button',{name:'החלה',exact:true}).click();
 await page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 1',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'החזרה מהארכיון',exact:true}).click();await page.getByRole('button',{name:'החזרה',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'שם',exact:true})).toHaveCount(0);
 await page.waitForTimeout(350);await page.getByRole('button',{name:/^סינון/}).click();await page.getByRole('button',{name:'ניקוי',exact:true}).click();
 await page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 1',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'מחיקת ליד',exact:true}).click();await page.getByRole('button',{name:'מחיקה',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'שם',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'פתיחת ליד: ליד בדוי 1',exact:true}).filter({visible:true})).toHaveCount(0);
 console.log('PASS archive/filter/restore/delete confirmations');
 expect(errors).toEqual([]);
} finally {await browser.close();}
