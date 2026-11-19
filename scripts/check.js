'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const files = ['server.js', 'index.html', 'upgrade.html', 'admin.html'];
let checked = 0;
for (const file of files) {
  if (!fs.existsSync(file)) throw new Error('Missing expected file: ' + file);
  const source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.js')) {
    new vm.Script(source, { filename: file });
    checked++;
    continue;
  }
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (let n = 0; n < scripts.length; n++) {
    const attrs = scripts[n][1] || '';
    const body = scripts[n][2] || '';
    if (!body.trim() || /\bsrc\s*=/.test(attrs)) continue;
    new vm.Script(body, { filename: file + ':inline-script-' + (n + 1) });
    checked++;
  }
}
console.log('Syntax check passed for ' + checked + ' JavaScript source block(s).');
