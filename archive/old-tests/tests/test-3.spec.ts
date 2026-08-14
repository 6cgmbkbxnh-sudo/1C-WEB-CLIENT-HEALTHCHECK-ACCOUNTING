import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://1c.sitrak.ru/TEST_BP_Sitrak/ru_RU/');
  await page.getByRole('textbox', { name: 'Пользователь' }).fill('monitoring');
  await page.getByRole('textbox', { name: 'Пароль' }).click();
  await page.getByRole('textbox', { name: 'Пароль' }).fill('XgarZPqLjf6vJLm8ZBXQ');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByTitle('Сервис и настройки').click();
  await page.getByText('О программе...').click();
  await expect(page.getByText('Бухгалтерия предприятия КОРП, редакция 3.0 (3.0.203.18) (http://v8.1c.ru/')).toHaveValue('Бухгалтерия предприятия КОРП, редакция 3.0 (3.0.203.18) (http://v8.1c.ru/buh8corp/)\nCopyright (С) ООО "1C-Софт", 2009 - 2026. Все права защищены\n(http://www.1c.ru)\n\nРасширения конфигурации:\n- EF_188\n- EF_202\n- SINOTRAK\n- Контур.Диадок (4.64.3)\n- Мониторинг Sinotruk (1.0.2)');
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByText('[КОПИЯ] БП Синотрак РУС (1').click();
  await page.goto('https://1c.sitrak.ru/TEST_BP_Sitrak/ru_RU/exit.html');
});