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
 *   - TEST_USER          : Login username (default: test)
 *   - TEST_PASSWORD      : Login password (default: Bi3fa8ta)
 *   - TEST_TIMEOUT       : Global timeout in ms (default: 60000)
 */

const { chromium, expect } = require('@playwright/test');
const ZabbixSender = require('./zabbix_sender');

// --- Configuration from environment ---
const config = {
  zabbix: {
    host: process.env.ZABBIX_HOST || 'localhost',
    port: parseInt(process.env.ZABBIX_PORT, 10) || 10051,
    hostname: process.env.ZABBIX_HOSTNAME || '1c-healthcheck',
  },
  test: {
    endpoint: process.env.TEST_ENDPOINT || 'https://1c.sitrak.ru/Sitrak_Cache/en_US/',
    user: process.env.TEST_USER || 'test',
    password: process.env.TEST_PASSWORD || 'Bi3fa8ta',
    timeout: parseInt(process.env.TEST_TIMEOUT, 10) || 60000,
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
    browser = await chromium.launch({
      headless: true,
      firefoxUserPrefs: {
        // Use Firefox for compatibility with 1C web client
        'browser.startup.homepage': 'about:blank',
      },
    });

    // Force Firefox for 1C web client compatibility
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.test.timeout);

    // Step 1: Login
    console.log('[1/5] Navigating to login page...');
    await page.goto(config.test.endpoint);
    results.timings.login_page_ms = Date.now() - t0;

    console.log('[2/5] Logging in...');
    await page.getByRole('textbox', { name: 'User' }).click();
    await page.getByRole('textbox', { name: 'User' }).fill(config.test.user);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(config.test.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    results.timings.login_ms = Date.now() - t0;

    // Step 2: Verify Quick Menu
    console.log('[3/5] Verifying Quick Menu...');
    await expect(page.locator('#themesCell')).toBeVisible({ timeout: 10000 });
    results.timings.quick_menu_ms = Date.now() - t0;

    // Step 3: Verify Messages
    console.log('[4/5] Checking Messages...');
    await expect(page.locator('#messageCell')).toContainText('Messages:', { timeout: 10000 });

    // Extract messages
    const msgDivs = page.locator('#messageCell.messages #messageDiv div[id^="msg"]');
    const messages = await msgDivs.all();
    const messagesArray = [];
    for (const msg of messages) {
      const dataText = await msg.getAttribute('data-text');
      if (dataText) messagesArray.push(dataText);
    }
    results.messages = messagesArray;
    results.timings.messages_ms = Date.now() - t0;

    // Step 4: Open About dialog
    console.log('[5/5] Opening About dialog...');
    await page.locator('div').filter({ hasText: 'Messages:' }).nth(2).click();
    await page.getByTitle('Service and settings').click();
    await page.locator('#MenuAboutButton').click();
    await expect(page.locator('#aboutContainer')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    results.timings.about_open_ms = Date.now() - t0;

    // Step 5: Parse version and licenses
    const aboutText = await page.locator('#aboutContainer').textContent();

    const platformVersion = aboutText.match(/1C:Enterprise 8\.3 \((\d+\.\d+\.\d+\.\d+)\)/)?.[1] || 'unknown';
    results.platformVersion = platformVersion;

    // Parse licenses
    const licenses = [];
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
    console.log(`✓ Messages count: ${messagesArray.length}`);
    console.log(`✓ Licenses count: ${licenses.length}`);

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
      results.zabbixSent = true;
      console.log(`Zabbix response: ${response.raw}`);
    } catch (zbxErr) {
      console.error(`Failed to send to Zabbix: ${zbxErr.message}`);
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
 */
function buildZabbixItems(hostname, results) {
  const items = [
    // Overall status: 1 = success, 0 = failure
    {
      host: hostname,
      key: '1c.healthcheck.status',
      value: results.success ? '1' : '0',
    },
  ];

  // Timings
  if (results.timings.login_page_ms) {
    items.push({ host: hostname, key: '1c.healthcheck.login_page_ms', value: results.timings.login_page_ms });
  }
  if (results.timings.login_ms) {
    items.push({ host: hostname, key: '1c.healthcheck.login_ms', value: results.timings.login_ms });
  }
  if (results.timings.quick_menu_ms) {
    items.push({ host: hostname, key: '1c.healthcheck.quick_menu_ms', value: results.timings.quick_menu_ms });
  }
  if (results.timings.messages_ms) {
    items.push({ host: hostname, key: '1c.healthcheck.messages_ms', value: results.timings.messages_ms });
  }
  if (results.timings.about_open_ms) {
    items.push({ host: hostname, key: '1c.healthcheck.about_open_ms', value: results.timings.about_open_ms });
  }
  if (results.timings.total_ms) {
    items.push({ host: hostname, key: '1c.healthcheck.total_ms', value: results.timings.total_ms });
  }

  // Platform version as a string item
  if (results.platformVersion && results.platformVersion !== 'unknown') {
    items.push({ host: hostname, key: '1c.healthcheck.version', value: results.platformVersion });
  }

  // Messages count
  items.push({ host: hostname, key: '1c.healthcheck.messages_count', value: results.messages.length });

  // Licenses
  items.push({ host: hostname, key: '1c.healthcheck.licenses_count', value: results.licenses.length });

  // Per-license items (used/total)
  results.licenses.forEach((lic, idx) => {
    items.push({
      host: hostname,
      key: `1c.healthcheck.license_used[${idx}]`,
      value: lic.used,
    });
    items.push({
      host: hostname,
      key: `1c.healthcheck.license_total[${idx}]`,
      value: lic.total,
    });
  });

  // Error if any
  if (results.error) {
    items.push({ host: hostname, key: '1c.healthcheck.error', value: results.error });
  }

  return items;
}

// Run
runHealthcheck().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
