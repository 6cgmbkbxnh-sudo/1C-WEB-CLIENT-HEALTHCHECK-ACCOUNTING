#!/usr/bin/env node
/**
 * Convert Markdown to PDF using Playwright (Firefox)
 * Usage: node md-to-pdf.js <input.md> [output.pdf]
 */

const { firefox } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace(/\.md$/, '.pdf');

if (!inputFile) {
  console.error('Usage: node md-to-pdf.js <input.md> [output.pdf]');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const markdown = fs.readFileSync(inputFile, 'utf-8');

// Simple Markdown to HTML converter (handles all needed syntax)
function markdownToHtml(md) {
  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background:#f4f4f4;padding:12px;border-radius:4px;overflow-x:auto;font-size:12px;border:1px solid #ddd;"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:13px;color:#c7254e;border:1px solid #ddd;">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    if (match.includes('---')) return '<tr class="separator"><td colspan="999"></td></tr>';
    const cells = match.split('|').filter(c => c.trim());
    const row = cells.map(c => `<td>${c.trim()}</td>`).join('');
    return `<tr>${row}</tr>`;
  });

  // Wrap table rows in table
  html = html.replace(/(<tr[^>]*>[\s\S]*?<\/tr>)/g, '<table style="border-collapse:collapse;margin:12px 0;width:100%;">$1</table>');

  // Fix table header styling
  html = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (match, content) => {
    if (!content.includes('separator')) return match;
    const cleaned = content.replace(/<tr class="separator"><td colspan="999"><\/td><\/tr>/, '');
    const rows = cleaned.split('</tr>').map(r => r.replace('<tr>', '<th>').replace(/<td>/g, '<th>').slice(0, -4) + '</th>');
    const body = cleaned.replace(/<tr>/g, '<tr>').replace(/<th>/g, '<td>');
    return `<table style="border-collapse:collapse;margin:12px 0;width:100%;border:1px solid #ddd;"><thead>${cleaned}</thead><tbody>${cleaned}</tbody></table>`;
  });

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<ul><\/ul>/g, '');
  html = html.replace(/(<ul[^>]*>[\s\S]*?<\/ul>)/g, (match) => {
    const items = match.match(/<li>[\s\S]*?<\/li>/g) || [];
    return `<ul>${items.join('')}</ul>`;
  });

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:2px solid #333;margin:20px 0;">');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<table)/g, '$1');
  html = html.replace(/(<\/table>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<hr[^>]*>)\s*<\/p>/g, '$1');

  // Line breaks within paragraphs
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function convert() {
  const htmlContent = markdownToHtml(markdown);

  const htmlPage = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Техническое задание — 1C Web Client Healthcheck</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 20mm 18mm;
    }
    @page :first-page {
      margin-top: 40mm;
    }
    body {
      font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      max-width: 100%;
    }
    h1 {
      font-size: 22pt;
      color: #1a3a5c;
      border-bottom: 3px solid #1a3a5c;
      padding-bottom: 8px;
      margin-top: 30px;
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      color: #2a5a8c;
      margin-top: 24px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      color: #3a6a9c;
      margin-top: 16px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    p {
      margin: 6px 0;
      text-align: justify;
    }
    code {
      font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace;
    }
    pre {
      font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace;
      font-size: 9.5pt;
      line-height: 1.3;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    table {
      font-size: 10pt;
      width: 100%;
    }
    th, td {
      border: 1px solid #aaa;
      padding: 4px 8px;
      text-align: left;
    }
    th {
      background-color: #e8f0f8;
      font-weight: bold;
    }
    tr.separator {
      display: none;
    }
    ul {
      margin: 6px 0;
      padding-left: 20px;
    }
    li {
      margin: 3px 0;
    }
    hr {
      border: none;
      border-top: 2px solid #1a3a5c;
      margin: 20px 0;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  const tmpHtml = path.join(path.dirname(inputFile), '.tz-preview.html');
  fs.writeFileSync(tmpHtml, htmlPage, 'utf-8');

  const fileUrl = `file://${tmpHtml}`;
  console.log(`Opening: ${fileUrl}`);

  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
  });
  const page = await context.newPage();

  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for content to render
  await page.waitForTimeout(2000);

  await page.pdf({
    path: outputFile,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' },
  });

  console.log(`Saved: ${outputFile}`);
  await browser.close();

  // Cleanup
  fs.unlinkSync(tmpHtml);
}

convert().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
