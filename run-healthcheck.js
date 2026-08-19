#!/usr/bin/env node
/**
 * 1C Web Client Healthcheck Runner
 * Runs Playwright test and sends results to Zabbix
 *
 * Environment variables:
 *   - ZABBIX_HOST        : Zabbix server IP/hostname (default: localhost)
 *   - ZABBIX_PORT        : Zabbix server port (default: 10051)
 *   - ZABBIX_HOSTNAME    : Hostname registered in Zabbix (default: 1c-healthcheck)
 *   - TEST_ENDPOINT      : URL to test (default: https://1c.sitrak.ru/Sitrak_Cache/en_US/)
 *   - TEST_USER          : Login username
 *   - TEST_PASSWORD      : Login password
 *   - TEST_TIMEOUT       : Global timeout in ms (default: 60000)
 */

const { chromium, expect, firefox } = require('@playwright/test');
const ZabbixSender = require('./zabbix_sender');

// --- Configuration from environment ---
const config = {
  zabbix: {
    host: process.env.ZABBIX_HOST || 'localhost',
    port: parseInt(process.env.ZABBIX_PORT, 10) || 10051,
    hostname: process.env.ZABBIX_HOSTNAME || '1c-healthcheck',
  },
  test: {
    endpoint: process.env.TEST_ENDPOINT || 'https://1c.sitrak.ru/TEST_BP_SITRAK/ru/',
    user: process.env.TEST_USER || '',
    password: process.env.TEST_PASSWORD || '',
    timeout: parseInt(process.env.TEST_TIMEOUT, 10) || 30000,
  },
};

console.log('=== 1C Web Client Healthcheck ===');
console.log(`Target:      ${config.test.endpoint}`);
console.log(`Zabbix:      ${config.zabbix.host}:${config.zabbix.port} (host: ${config.zabbix.hostname})`);
console.log('');

/**
 * Run the healthcheck test
 */
async function runHealthcheck() {
  const zabbix = new ZabbixSender(config.zabbix);
  const results = {
    success: false,
    error: null,
    timings: {},
    platformVersion: 'unknown',
    messages: [],
    licenses: [],
    zabbixSent: false,
  };

  let browser = null;
  const t0 = Date.now();

  try {
    // Use Chromium for reliable locale handling (Firefox redirects to en_US)
    browser = await chromium.launch({
      headless: true,
    });

    // Set Russian locale context for 1C web client
    const context = await browser.newContext({
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.test.timeout);

    // Step 1: Login
    console.log('[1/9] Navigating to login page...');
    await page.goto(config.test.endpoint, { waitUntil: 'domcontentloaded' });
    results.timings.login_page_ms = Date.now() - t0;

    // Wait for auth window to appear
    await page.waitForSelector('#authWindow_basic_login', { timeout: 15000 });

    console.log('[2/9] Logging in...');
    // Use ID-based selectors for 1C auth form
    await page.fill('#authWindow_basic_login', `${config.test.user}`);
    await page.fill('#authWindow_basic_password', `${config.test.password}`);
    await page.click('#authWindow_basic_okButton');
    results.timings.login_ms = Date.now() - t0;

    // Wait for left menu to be rendered (menu items have id pattern themesCell_theme_*)
    await page.waitForFunction(() => {
      return document.querySelectorAll('[id^="themesCell_theme_"]').length > 0;
    }, { timeout: 15000 });

    // Step 2: Verify Left Menu items for 1С:Бухгалтерия
    // Menu items are div.themeBoxName > span with text content, rendered in themesCell_theme_* elements
    console.log('[3/9] Checking Left Menu items...');
    const leftMenuItems = [
      'Главное',
      'Руководителю',
      'Банк и касса',
      'Продажи',
      'Покупки',
      'Склад',
      'Производство',
      'ОС и НМА',
      'Зарплата и кадры',
      'Операции',
      'Отчеты',
      'Справочники',
      'Администрирование',
      'Помощь',
    ];
    
    // Use page.evaluate to find menu items in the DOM directly — already waited above via waitForFunction
    const foundMenuItems = await page.evaluate((items) => {
      let count = 0;
      for (const itemName of items) {
        // Menu items are div.themeBoxName with the text inside
        const boxes = document.querySelectorAll('div.themeBoxName');
        for (const box of boxes) {
          const text = box.textContent?.trim();
          if (text === itemName) {
            count++;
            break;
          }
        }
      }
      return count;
    }, leftMenuItems);
    
    results.timings.left_menu_ms = Date.now() - t0;
    results.leftMenuItemsFound = foundMenuItems;
    results.leftMenuTotal = leftMenuItems.length;
    console.log(`  Found ${foundMenuItems}/${leftMenuItems.length} menu items`);

    // Step 3: Verify Quick Menu (info panel area in 1C:BP)
    console.log('[4/9] Verifying Info Panel...');
    // Check for the main content area with "Начальная страница" or organization info
    const mainContent = page.locator('[id^="VW_page"]');
    const mainContentVisible = await mainContent.count().catch(() => 0);
    if (mainContentVisible > 0) {
      console.log(`✓ Main content area found`);
    }
    results.timings.quick_menu_ms = Date.now() - t0;

    // Step 4: Open About dialog via captionbarMore menu → "О программе..."
    // Click #captionbarMore ONCE to open the dropdown submenu
    // Wait for #MenuAboutButton to appear (submenu item with text "О&nbsp;программе..." - non-breaking space)
    // Use ID selector because text contains &nbsp; which doesn't match regular space in getByText
    console.log('[5/9] Opening About dialog...');
    await page.locator('#captionbarMore').click();
    await page.waitForSelector('#MenuAboutButton', { timeout: 15000 });
    await page.locator('#MenuAboutButton').click();
    console.log('[6/9] About loaded dialog...');

    // Step 5: Parse version and licenses
    const aboutText = await page.locator('#aboutContainer').textContent();
    results.timings.about_open_ms = Date.now() - t0;
    // 1C:BP uses Russian format: 1С:Предприятие 8.3 (8.3.27.1688)
    // Also supports English: 1C:Enterprise 8.3 (8.3.27.1688)
    const platformVersion = aboutText.match(/1[ССС]?:Enterprise\s+8\.3\s+\((\d+\.\d+\.\d+\.\d+)\)/)?.[1] ||
                            aboutText.match(/1С:Предприятие\s+8\.3\s+\((\d+\.\d+\.\d+\.\d+)\)/)?.[1] ||
                            'unknown';
    results.platformVersion = platformVersion;

    // Parse licenses - 1C:BP uses "Текущая:" instead of "Current:"
    const licenses = [];
    const currentSection = aboutText.split('Текущая:')[1];
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
        // 1C:BP uses Russian date format: DD.MM.YYYY HH:MM:SS
        const timestamps = trimmed.match(/(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2})/g);
        const issue = timestamps ? timestamps[0] : '';
        const expiry = timestamps && timestamps[1] ? timestamps[1] : '';
        const companyMatch = trimmed.match(/"([^"]+)"/);
        const license = {
          id: guid,
          used,
          total,
          issue,
          expiry,
          company: companyMatch ? companyMatch[1] : '',
        };
        const sourceMatch = trimmed.match(/(?:источник|source):\s*(.+)/i);
        if (sourceMatch) {
          license.source = sourceMatch[1].trim();
        }
        licenses.push(license);
      }
    }
    results.licenses = licenses;
    results.timings.total_ms = Date.now() - t0;
    results.success = true;

    console.log(`\n✓ Platform version: ${platformVersion}`);
  //  console.log(`✓ Messages count: ${messagesArray.length}`);
    console.log(`✓ Licenses count: ${licenses.length}`);

    // Close About dialog
    console.log('[7/9][Closing About dialog...]');
    await page.locator('#aboutOkButton').click();
    await page.waitForFunction(() => {
      return !document.getElementById('aboutContainer') || 
             document.getElementById('aboutContainer').offsetHeight === 0 ||
             window.getComputedStyle(document.getElementById('aboutContainer')).display === 'none';
    }, { timeout: 5000 });

    // Step 5: Logout
    console.log('[8/9] Logging out...');
    
    // 1) Click user profile button (#LogoutButton) to open logout menu
    await page.waitForSelector('#LogoutButton', {timeout: 1000});
    await page.locator('#LogoutButton').click();
    
    // 2) Click "Завершить работу (выйти)" in the dropdown menu
    await page.waitForSelector('#LogoutCloseButton', {timeout: 2000});
    await page.locator('#LogoutCloseButton').click({ timeout: 5000 });
    
    // 3) Confirm in the modal dialog — click "Завершить работу"
    await page.waitForSelector('text="Завершить работу"', {timeout: 4000});
    await page.locator('text="Завершить работу"').click({ timeout: 5000 });
    
    // 4) Wait for exit page (exit.html with "До новых встреч!")
    await page.waitForFunction(() => {
      return document.body.textContent?.includes('До новых встреч!');
    }, { timeout: 10000 });
    console.log('[9/9] Logged out successfully');
    results.timings.logout_ms = Date.now() - t0;

  } catch (err) {
    results.error = err.message;
    results.timings.total_ms = Date.now() - t0;
    console.error(`\n✗ Error: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Send results to Zabbix
    console.log('\n=== Sending results to Zabbix ===');
    try {
      const items = buildZabbixItems(config.zabbix.hostname, results);
      const response = await zabbix.send(items);
      // Parse response to check if data was actually processed
      const respData = JSON.parse(response.raw);
      if (respData.response === 'success' && respData.info && respData.info.includes('processed: 1')) {
        results.zabbixSent = true;
        console.log(`Zabbix response: ${response.raw}`);
      } else {
        results.zabbixSent = false;
        results.zabbixError = `Response: ${response.raw}`;
        console.error(`Zabbix did not process data: ${response.raw}`);
      }
    } catch (zbxErr) {
      console.error(`Failed to send to Zabbix: ${zbxErr.message}`);
      results.zabbixSent = false;
      results.zabbixError = zbxErr.message;
    }
    zabbix.close();

    // Print summary
    console.log('\n=== Healthcheck Summary ===');
    console.log(JSON.stringify(results, null, 2));

    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);
  }
}

/**
 * Build Zabbix items array from test results
 * Sends a single RAW item with full JSON report.
 * Zabbix template extracts fields via JSONPath in dependent items.
 */
function buildZabbixItems(hostname, results) {
  // Build messages string (concatenated with newline)
//  const messagesText = results.messages.join('\n');

  // Convert timings from ms to seconds (decimal numbers)
  const timingsSec = {};
  for (const [key, value] of Object.entries(results.timings || {})) {
    timingsSec[key] = value / 1000;
  }

  // Build full report JSON
  const report = {
    success: results.success,
    status: results.success ? 1 : 0,
    error: results.error || null,
    platformVersion: results.platformVersion || 'unknown',
    timings: timingsSec,
//    messages: messagesText,
    licenses: results.licenses || [],
    timestamp: new Date().toISOString(),
  };

  // Single RAW item with full JSON report
  return [
    {
      host: hostname,
      key: '1c.healthcheck.report',
      value: JSON.stringify(report),
    },
  ];
}

// Run
runHealthcheck().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
