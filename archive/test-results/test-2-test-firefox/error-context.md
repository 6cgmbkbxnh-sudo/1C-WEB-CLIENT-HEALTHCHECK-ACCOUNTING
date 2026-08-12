# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-2.spec.ts >> test
- Location: tests/test-2.spec.ts:3:5

# Error details

```
Error: expect(locator).toMatchAriaSnapshot(expected) failed

Locator:  locator('#themesCell')
Expected: "- text: Quick menu Автомобили Автосервис Компании Рекламации Управление проверками Управление событиями Управление спецификациями Физические лица ЭПТС DSM Продажи"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toMatchAriaSnapshot" with timeout 5000ms
  - waiting for locator('#themesCell')
    7 × locator resolved to <div id="themesCell">…</div>
      - unexpected value ""

```

```
Error: expect(locator).toMatchAriaSnapshot(expected) failed

Locator:  locator('#themesCell')
Expected: "- text: Quick menu Автомобили Автосервис Компании Рекламации Управление проверками Управление событиями Управление спецификациями Физические лица ЭПТС DSM Продажи"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toMatchAriaSnapshot" with timeout 5000ms
  - waiting for locator('#themesCell')
    7 × locator resolved to <div id="themesCell">…</div>
      - unexpected value ""

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img
      - generic "Functions" [ref=e6]:
        - img
    - generic "Search Ctrl+Shift+F" [ref=e7]:
      - generic [ref=e8]:
        - img
      - generic [ref=e9]:
        - textbox "Search Ctrl+Shift+F" [ref=e10]
        - generic [ref=e11]: Search Ctrl+Shift+F
    - generic [ref=e13]:
      - generic "Notifications" [ref=e14]:
        - img
      - generic "History (Ctrl+Shift+H)" [ref=e15]:
        - img
      - generic "Favorites (Ctrl+Shift+B)" [ref=e16]:
        - img
      - generic "Search in data" [ref=e17]:
        - img
    - generic "Service and settings" [ref=e19]:
      - img
    - generic "About..." [ref=e21]:
      - img
  - generic [ref=e38]:
    - link "Help" [ref=e39] [cursor=pointer]:
      - /url: "#"
    - link "Open help" [ref=e40] [cursor=pointer]:
      - /url: "#"
      - img
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('test', async ({ page }) => {
  4  |   await page.goto('https://1c.sitrak.ru/Sitrak_Cache/en_US/');
  5  |   await page.getByRole('textbox', { name: 'User' }).fill('test');
  6  |   await page.getByRole('textbox', { name: 'User' }).press('Tab');
  7  |   await page.locator('#authWindow').click();
  8  |   await page.getByRole('textbox', { name: 'Password' }).click();
  9  |   await page.getByRole('textbox', { name: 'Password' }).fill('Bi3fa8ta');
  10 |   await page.getByRole('button', { name: 'Log in' }).click();
  11 |   const TC = await expect(page.locator('#themesCell'));
  12 |   console.log('TC:', TC);
  13 |   TC.toMatchAriaSnapshot(`- text: Quick menu Автомобили Автосервис Компании Рекламации Управление проверками Управление событиями Управление спецификациями Физические лица ЭПТС DSM Продажи`);
> 14 |   await expect(page.locator('#themesCell')).toMatchAriaSnapshot(`- text: Quick menu Автомобили Автосервис Компании Рекламации Управление проверками Управление событиями Управление спецификациями Физические лица ЭПТС DSM Продажи`);
     |                                             ^ Error: expect(locator).toMatchAriaSnapshot(expected) failed
  15 | });
```