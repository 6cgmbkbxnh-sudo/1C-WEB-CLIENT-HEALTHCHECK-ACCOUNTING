import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const t0 = Date.now();

  await page.goto('https://1c.sitrak.ru/Sitrak_Cache/en_US/');
  await page.getByRole('textbox', { name: 'User' }).click();
  await page.getByRole('textbox', { name: 'User' }).fill('test');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Bi3fa8ta');
  await page.getByRole('button', { name: 'Log in' }).click();
  const t1 = Date.now() - t0;

  await expect(page.locator('#themesCell'))
    .toMatchAriaSnapshot(`- text: Quick menu Автомобили Автосервис Компании Рекламации Управление проверками Управление событиями Управление спецификациями Физические лица ЭПТС DSM Продажи`);
  const t2 = Date.now() - t0;

  await expect(page.locator('#messageCell')).toContainText('Messages:');

  // 1. Извлечение сообщений из messageCell
  const msgDivs = page.locator('#messageCell.messages #messageDiv div[id^="msg"]');
  const messages = await msgDivs.all();
  const messagesArray: string[] = [];
  for (const msg of messages) {
    const dataText = await msg.getAttribute('data-text');
    if (dataText) messagesArray.push(dataText);
  }

  await page.locator('div').filter({ hasText: 'Messages:' }).nth(2).click();
  await page.getByTitle('Service and settings').click();
  await page.locator('#MenuAboutButton').click();
  await expect(page.locator('#aboutContainer')).toBeVisible();
  await page.waitForTimeout(2000);
  const t3 = Date.now() - t0;

  // 2-3. Извлечение версии платформы и лицензий из About
  const aboutText = await page.locator('#aboutContainer').textContent();

  const platformVersion = aboutText.match(/1C:Enterprise 8\.3 \((\d+\.\d+\.\d+\.\d+)\)/)?.[1] || 'unknown';

  const licenses: any[] = [];
  const currentSection = aboutText.split('Current:')[1];
  if (currentSection) {
    const lines = currentSection.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!/^\d{9,}/.test(trimmed) || !trimmed.includes('/')) continue;
      const guidMatch = trimmed.match(/^(\d+)/);
      const guid = guidMatch ? guidMatch[1] : '';
      const countMatch = trimmed.match(/(\d+)\/(\d+)/);
      const used = countMatch ? parseInt(countMatch[1], 10) : 0;
      const total = countMatch ? parseInt(countMatch[2], 10) : 0;
      const timestamps = trimmed.match(/(\d+\/\d+\/\d+\s+\d+:\d+:\d+\s+[AP]M)/g);
      const issue = timestamps ? timestamps[0] : '';
      const expiry = timestamps && timestamps[1] ? timestamps[1] : '';
      const companyMatch = trimmed.match(/"([^"]+)"/);
      const license: any = {
        id: guid,
        использовано: used,
        всего: total,
        timestamp_выдачи: issue,
        timestamp_окончания: expiry,
        компания: companyMatch ? companyMatch[1] : '',
      };
      const sourceMatch = trimmed.match(/(?:источник|source):\s*(.+)/i);
      if (sourceMatch) {
        license.источник = sourceMatch[1].trim();
      }
      licenses.push(license);
    }
  }

  const report = {
    platformVersion,
    Messages: messagesArray,
    licenses,
    timings: {
      password_form_ms: t1,
      quick_menu_ms: t2,
      about_open_ms: t3,
    },
  };
  console.log(JSON.stringify(report, null, 2));

//  await expect(page.locator('#aboutContainer')).toMatchAriaSnapshot(`- textbox: /1C:Enterprise 8\.3 \(8\.\d+\.\d+\.\d+\)/`);
//  await expect(page.locator('#aboutContainer')).toMatchAriaSnapshot(`- textbox: "/Current: \\d+, Client 1\\/\\d+, 6\\/\\d+\\/\\d+ 5:\\d+:\\d+ PM, 6\\/\\d+\\/\\d+ \\d+:\\d+:\\d+ AM, \\"Синотрак Рус\\", server issued \\d+, server \\d+ 1\\/\\d+, 6\\/\\d+\\/\\d+ 4:\\d+:\\d+ PM, 6\\/\\d+\\/\\d+ \\d+:\\d+:\\d+ AM, \\"Синотрак Рус\\/"`);
  await page.getByRole('button', { name: 'OK' }).click();
});
