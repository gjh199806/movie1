const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/js/core_services.js'), 'utf8');
const sandbox = { module: { exports: {} }, URL, Map, Set, String, Array, JSON };
vm.runInNewContext(source, sandbox, { filename: 'core_services.js' });
const core = sandbox.module.exports;

test('escapeHtml escapes markup and attribute delimiters', () => {
  assert.equal(core.escapeHtml(`<script a="x">'&</script>`), '&lt;script a=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;');
});

test('safeJsonParse falls back for invalid JSON', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(core.safeJsonParse('{bad', { ok: false }))), { ok: false });
  assert.deepEqual(JSON.parse(JSON.stringify(core.safeJsonParse('[1,2]', []))), [1, 2]);
});

test('normalizeHttpUrl only accepts credential-free HTTP(S)', () => {
  assert.equal(core.normalizeHttpUrl('https://example.com/'), 'https://example.com');
  assert.equal(core.normalizeHttpUrl('javascript:alert(1)'), null);
  assert.equal(core.normalizeHttpUrl('https://user:pass@example.com'), null);
});

test('groupSearchResults merges duplicate works but preserves source options', () => {
  const grouped = core.groupSearchResults([
    { vod_id: '1', vod_name: 'Dune: Part Two', vod_year: '2024', type_name: 'Movie', source_code: 'a', source_name: 'Source A' },
    { vod_id: '9', vod_name: 'Dune Part Two', vod_year: '2024', type_name: 'Movie', source_code: 'b', source_name: 'Source B' },
    { vod_id: '1', vod_name: 'Dune: Part Two', vod_year: '2024', type_name: 'Movie', source_code: 'a', source_name: 'Source A' },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].source_count, 2);
  assert.deepEqual(Array.from(grouped[0].source_options, x => x.source_code).sort(), ['a', 'b']);
});


test('groupSearchResults keeps different years separate', () => {
  const grouped = core.groupSearchResults([
    { vod_id: '1', vod_name: 'The Office', vod_year: '2005', type_name: 'TV', source_code: 'a' },
    { vod_id: '2', vod_name: 'The Office', vod_year: '2024', type_name: 'TV', source_code: 'b' },
  ]);
  assert.equal(grouped.length, 2);
});

test('groupSearchResults only exposes one choice per source for a grouped work', () => {
  const grouped = core.groupSearchResults([
    { vod_id: '1', vod_name: 'Example Movie', vod_year: '2024', type_name: 'Movie', source_code: 'a', source_name: 'Source A' },
    { vod_id: '2', vod_name: 'Example Movie', vod_year: '2024', type_name: 'Movie', source_code: 'a', source_name: 'Source A' },
    { vod_id: '3', vod_name: 'Example Movie', vod_year: '2024', type_name: 'Movie', source_code: 'b', source_name: 'Source B' },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].source_count, 2);
});

test('normalizeHttpUrl rejects malformed values and strips fragments', () => {
  assert.equal(core.normalizeHttpUrl('https://example.com/path#fragment'), 'https://example.com/path');
  assert.equal(core.normalizeHttpUrl('not a URL'), null);
  assert.equal(core.normalizeHttpUrl('file:///tmp/test'), null);
});

test('active JavaScript API sources stay in sync with the Rust source registry', () => {
  const root = require('node:path').join(__dirname, '..');
  const jsConfig = fs.readFileSync(require('node:path').join(root, 'public/js/config.js'), 'utf8');
  const rust = fs.readFileSync(require('node:path').join(root, 'src-tauri/src/lib.rs'), 'utf8');
  const block = jsConfig.match(/const API_SITES = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'API_SITES registry should exist');
  const jsIds = new Set([...block[1].matchAll(/^\s{4}([A-Za-z0-9_]+):\s*\{/gm)].map(m => m[1]));
  // testSource is an intentional placeholder and must not be treated as a production API.
  jsIds.delete('testSource');
  const rustIds = new Set([...rust.matchAll(/m\.insert\("([A-Za-z0-9_]+)"\.to_string\(\)/g)].map(m => m[1]));
  assert.deepEqual([...jsIds].sort(), [...rustIds].sort());
});

test('player resume uses the same encoded progress key as progress saving', () => {
  const root = require('node:path').join(__dirname, '..');
  const playerHandler = fs.readFileSync(require('node:path').join(root, 'public/js/player_dplayer_handler.js'), 'utf8');
  const playerUtils = fs.readFileSync(require('node:path').join(root, 'public/js/player_utils.js'), 'utf8');
  assert.match(playerHandler, /const progressId = typeof getVideoId === 'function'/);
  assert.match(playerHandler, /const progressKey = 'videoProgress_' \+ progressId/);
  assert.match(playerUtils, /const progressKey = `videoProgress_\$\{getVideoId\(\)\}`/);
});

test('player page exposes an explicit retry action and loads its implementation', () => {
  const root = require('node:path').join(__dirname, '..');
  const html = fs.readFileSync(require('node:path').join(root, 'public/player.html'), 'utf8');
  const coreLogic = fs.readFileSync(require('node:path').join(root, 'public/js/player_core_logic.js'), 'utf8');
  assert.match(html, /id="retryPlaybackButton"[^>]*onclick="retryCurrentPlayback\(\)"/);
  assert.match(html, /src="js\/player_core_logic\.js"/);
  assert.match(coreLogic, /function retryCurrentPlayback\(\)/);
});

test('native HTTP request validates URL scheme and caps response size', () => {
  const root = require('node:path').join(__dirname, '..');
  const rust = fs.readFileSync(require('node:path').join(root, 'src-tauri/src/lib.rs'), 'utf8');
  assert.match(rust, /matches!\(parsed_url\.scheme\(\), "http" \| "https"\)/);
  assert.match(rust, /parsed_url\.username\(\)/);
  assert.match(rust, /MAX_RESPONSE_BYTES: usize = 15 \* 1024 \* 1024/);
});
