#!/usr/bin/env node
/**
 * Test script to verify data format matches Zabbix template
 * Simulates test results and validates item keys
 */

const fs = require('fs');
const path = require('path');

console.log('=== Testing Data Format Compatibility ===\n');

// Load the YAML template
const yamlPath = path.join(__dirname, 'zabbix_template.yaml');
const yamlContent = fs.readFileSync(yamlPath, 'utf8');

// Extract all item keys from YAML template
const templateKeys = [];
const lines = yamlContent.split('\n');
let inItems = false;
for (const line of lines) {
  if (line.includes('key:')) {
    const match = line.match(/key:\s*['"]?([^'"\n]+)['"]?/);
    if (match) {
      templateKeys.push(match[1].trim());
    }
  }
}

console.log(`Template defines ${templateKeys.length} items:`);
templateKeys.forEach(key => console.log(`  - ${key}`));
console.log('');

// Simulate test results (successful run)
const mockResults = {
  success: true,
  error: null,
  timings: {
    login_page_ms: 3200,
    login_ms: 1800,
    quick_menu_ms: 2500,
    messages_ms: 150,
    about_open_ms: 2200,
    total_ms: 9850,
  },
  platformVersion: '8.3.25.1200',
  messages: ['System ready', 'Updates available'],
  licenses: [
    {
      id: '123456789',
      used: 45,
      total: 100,
      issue: '1/15/2026 10:30:00 AM',
      expiry: '1/15/2027 10:30:00 AM',
      company: 'Test Company',
      source: 'server',
    },
    {
      id: '987654321',
      used: 10,
      total: 50,
      issue: '2/1/2026 9:00:00 AM',
      expiry: '2/1/2027 9:00:00 AM',
      company: 'Test Company',
      source: 'server',
    },
  ],
};

// Build Zabbix items (same logic as run-healthcheck.js)
function buildZabbixItems(hostname, results) {
  const items = [
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

  // Platform version
  if (results.platformVersion && results.platformVersion !== 'unknown') {
    items.push({ host: hostname, key: '1c.healthcheck.version', value: results.platformVersion });
  }

  // Messages count
  items.push({ host: hostname, key: '1c.healthcheck.messages_count', value: results.messages.length });

  // Licenses
  items.push({ host: hostname, key: '1c.healthcheck.licenses_count', value: results.licenses.length });

  // Per-license items
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

const items = buildZabbixItems('1c-healthcheck', mockResults);

console.log(`Generated ${items.length} Zabbix items:\n`);
items.forEach(item => {
  const inTemplate = templateKeys.includes(item.key);
  const status = inTemplate ? '✓' : '✗';
  console.log(`  ${status} ${item.key} = ${JSON.stringify(item.value)}`);
});

// Check for missing items in template
const templateOnly = templateKeys.filter(k => !items.find(i => i.key === k));
const itemsOnly = items.filter(i => !templateKeys.includes(i.key));

console.log('\n=== Validation Results ===');

if (templateOnly.length > 0) {
  console.log(`\n⚠ Items in template but not sent by test (${templateOnly.length}):`);
  templateOnly.forEach(key => console.log(`  - ${key}`));
} else {
  console.log('\n✓ All template items are covered by test data');
}

if (itemsOnly.length > 0) {
  console.log(`\n⚠ Items sent by test but not in template (${itemsOnly.length}):`);
  itemsOnly.forEach(item => console.log(`  - ${item.key} = ${JSON.stringify(item.value)}`));
} else {
  console.log('\n✓ All test data items are defined in template');
}

console.log('\n=== Sample Zabbix Sender Payload ===\n');
const clock = Math.floor(Date.now() / 1000);
const payload = {
  request: 'sender data',
  data: items.map(item => ({
    host: item.host,
    key: item.key,
    value: item.value,
    clock,
  })),
  clock,
};
console.log(JSON.stringify(payload, null, 2));
