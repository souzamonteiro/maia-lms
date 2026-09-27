import { test, expect } from '@playwright/test';

test('Markdown draft, language switching, autosave, safe preview, conflicts and home curation', async ({page,context})=>{
  await page.goto('/auth/login');
  await page.getByLabel('Email',{exact:true}).fill('admin@example.com');
  await page.getByLabel('Password',{exact:true}).fill('Admin-test-password-123');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('link',{name:'Administer',exact:true}).click();
  await page.locator('[name=title]').fill('Editorial course');
  await page.locator('[name=slug]').fill('editorial-course');
  await page.locator('[name=summary]').fill('A course prepared in the new author studio.');
  await page.locator('[name=accessMode]').selectOption('OPEN_FREE');
  await page.locator('.module-title').fill('Introduction');
  await page.locator('.lesson-title').fill('Markdown lesson');
  const markdown='# Hello\n\n**Strong text**\n\n<script>alert("unsafe")</script>';
  await page.locator('.lesson-content').fill(markdown);
  for(const language of ['pt-BR','es','en']) {
    await page.locator('#languageSelect').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(page.locator('.lesson-content')).toHaveValue(markdown);
    await expect(page.locator('[name=title]')).toHaveValue('Editorial course');
  }
  await page.getByRole('button',{name:'Preview content',exact:true}).click();
  await expect(page.locator('.content-preview h1')).toHaveText('Hello');
  await expect(page.locator('.content-preview strong')).toHaveText('Strong text');
  await expect(page.locator('.content-preview script')).toHaveCount(0);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  const card=page.locator('#admin-list .card').filter({has:page.getByRole('heading',{name:'Editorial course',exact:true})});
  await card.getByRole('button',{name:'Publish',exact:true}).click();
  await expect(card).toContainText('PUBLISHED');
  const list=await (await page.request.get('/api/v1/admin/courses')).json();
  const course=list.find(c=>c.slug==='editorial-course');
  const old=(await (await page.request.get(`/api/v1/courses/${course.id}`)).json()).modules[0].lessons[0].id;
  await page.locator('.lesson-content').fill('## A new draft\n\nOnly the author sees this.');
  await expect(page.locator('#save-status')).toContainText('Draft saved',{timeout:10000});
  expect((await (await page.request.get(`/api/v1/lessons/${old}`)).json()).body).toBe(markdown);
  const draft=await (await page.request.get(`/api/v1/admin/courses/${course.id}`)).json();
  expect(draft.modules[0].lessons[0].body).toContain('Only the author');
  await card.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(page.locator('.lesson-content')).toHaveValue('## A new draft\n\nOnly the author sees this.');
  // A second editor saves first: local work must not overwrite it silently.
  const other=await context.newPage();await other.goto('/admin');
  await other.locator('#admin-list .card').filter({has:other.getByRole('heading',{name:'Editorial course',exact:true})}).getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('.lesson-content').fill('First editor wins');
  await expect(page.locator('#save-status')).toContainText('Draft saved',{timeout:10000});
  await other.locator('.lesson-content').fill('Keep this conflicting local text');
  await expect(other.locator('#save-status')).toContainText('Another editor changed',{timeout:10000});
  await expect(other.locator('.lesson-content')).toHaveValue('Keep this conflicting local text');
  other.on('dialog',dialog=>dialog.accept());await other.close();
  // Curate the public home. This leaves the published course content unchanged.
  await page.getByRole('link',{name:'Manage homepage',exact:true}).click();
  await page.getByRole('button',{name:'Add course placement'}).click();
  await page.locator('.placement-course').selectOption(course.id);
  await page.locator('.placement-slot').selectOption('featured');
  await page.getByRole('button',{name:'Save homepage'}).click();
  await expect(page.locator('#home-status')).toHaveText('Homepage saved.');
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Featured courses',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Editorial course',exact:true})).toBeVisible();
  await page.goto(`/lessons/${old}`);
  await expect(page.locator('.lesson-body h1')).toHaveText('Hello');
  await page.screenshot({path:'test-results/markdown-lesson.png',fullPage:true});
});

test('recovers a local draft after reload and reorders lessons with keyboard-accessible controls',async({page})=>{
  await page.goto('/auth/login');
  await page.getByLabel('Email',{exact:true}).fill('admin@example.com');
  await page.getByLabel('Password',{exact:true}).fill('Admin-test-password-123');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('link',{name:'Administer',exact:true}).click();
  await page.locator('[name=title]').fill('Recover this course');
  await page.locator('.lesson-content').fill('Local text not saved to the server');
  page.on('dialog',dialog=>dialog.accept());
  await page.reload();
  await expect(page.locator('[name=title]')).toHaveValue('Recover this course');
  await expect(page.locator('.lesson-content')).toHaveValue('Local text not saved to the server');
  await page.locator('.lesson-title').fill('First');
  await page.locator('.lesson-editor > .row-controls').getByRole('button',{name:'Duplicate',exact:true}).click();
  await page.locator('.lesson-title').nth(1).fill('Second');
  await page.locator('.lesson-editor').nth(1).locator(':scope > .row-controls').getByRole('button',{name:'Move up',exact:true}).click();
  await expect(page.locator('.lesson-title').first()).toHaveValue('Second');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#editor')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/studio-mobile.png',fullPage:true});
});
