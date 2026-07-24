#!/usr/bin/env node
/**
 * Generate UUIDv4 without dashes for Zabbix items
 * Run: node zabbix/generate-uuids.js
 */
const crypto = require('crypto');

const uuid = () => crypto.randomUUID().replace(/-/g, '');

const items = [
  '1c.healthcheck.status',
  '1c.healthcheck.total_ms',
  '1c.healthcheck.login_page_ms',
  '1c.healthcheck.login_ms',
  '1c.healthcheck.quick_menu_ms',
  '1c.healthcheck.messages_ms',
  '1c.healthcheck.about_open_ms',
  '1c.healthcheck.version',
  '1c.healthcheck.messages_text',
  '1c.healthcheck.licenses_json',
  '1c.healthcheck.error',
];

console.log('// Generated UUIDs (v4, no dashes)');
console.log('// Run: node zabbix/generate-uuids.js');
console.log('');

const result = {};
items.forEach(key => {
  const u = uuid();
  result[key] = u;
  console.log(`${key}: ${u}`);
});

console.log('');
console.log('JSON:');
console.log(JSON.stringify(result, null, 2));
