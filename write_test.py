import os

content = r"""import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const t0 = Date.now();

  await page.goto('https://1c.sitrak.ru/Sitrak_Cache/en_US/');
  await page.getByRole('textbox', { name: 'User' }).click();
  await page.getByRole('textbox', { name: 'User' }).fill('test');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Bi3fa8ta');
  await page.getByRole('button', { name: 'Log in' }).click();
  console.log(`1. Форма ввода пароля появилась: ${Date.now() - t0}ms`);

  await expect(page.locator('#themesCell'))
    .toMatchAriaSnapshot(`- text: Quick menu Автомобили Автосервис Компании Рекламации Проверки События Спецификации Физлица ЭПТС DSM Продажи`);
  console.log(`2. Quick menu появилось: ${Date.now() - t0}ms`);

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
  console.log(`3. About открылось: ${Date.now() - t0}ms`);

  // 2-3. Извлечение версии платформы и лицензий из About
  const aboutText = await page.locator('#aboutContainer').textContent();

  const platformVersion = aboutText.match(/1C:Enterprise 8\.3 \(8\.\d+\.\d+\.\d+\.\d+\)/)?.[1] || 'unknown';

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
  };
  console.log(JSON.stringify(report, null, 2));

//  await expect(page.locator('#aboutContainer')).toMatchAriaSnapshot(`- textbox: /1C:Enterprise 8\.3 \(8\.\d+\.\d+\.\d+\)/`);
//  await expect(page.locator('#aboutContainer')).toMatchAriaSnapshot(`- textbox: "/Current: \\d+, Client 1\\/\\d+, 6\\/\\d+\\/\\d+ 5:\\d+:\\d+ PM, 6\\/\\d+\\/\\d+ \\d+:\\d+:\\d+ AM, \\"Синотрак Рус\\", server issued \\d+, server \\d+ 1\\/\\d+, 6\\/\\d+\\/\\d+ 4:\\d+:\\d+ PM, 6\\/\\d+\\/\\d+ \\d+:\\d+:\\d+ AM, \\"Синотрак Рус\\/"`);
  await page.getByRole('button', { name: 'OK' }).click();
});
"""

filepath = '/Users/vi/Documents/vsCode/1c-web-client-healthcheck/tests/test-1.spec.ts'
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('File written successfully')
