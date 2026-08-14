import { test, expect } from '@playwright/test';

test('test2', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('https://1c.sitrak.ru/TEST_BP_Sitrak/ru_RU/');
    await page.getByRole('textbox', { name: 'Пользователь' }).fill('monitoring');
    await page.getByRole('textbox', { name: 'Пароль' }).click();
    await page.getByRole('textbox', { name: 'Пароль' }).fill('XgarZPqLjf6vJLm8ZBXQ');
    await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByTitle('Сервис и настройки').click();
  await page.getByText('О программе...').click();
    await page.getByText('О программе...').click();
});