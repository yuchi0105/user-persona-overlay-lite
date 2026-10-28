import { readFileSync } from 'node:fs';

// 確認 Tavern Helper Script JSON 載入的 tag 與 package.json 版本一致，避免發版漏改。
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const script = JSON.parse(readFileSync(new URL('Persona Overlay Lite.json', root), 'utf8'));
const readme = readFileSync(new URL('README.md', root), 'utf8');
const expectedUrl = `https://cdn.jsdelivr.net/gh/yuchi0105/user-persona-overlay-lite@v${version}/dist/persona-overlay-lite/index.js`;

const problems = [];
if (script.content !== `import '${expectedUrl}'`) {
  problems.push(`Script JSON 的 content 應載入 ${expectedUrl}`);
}
if (!String(script.info ?? '').includes(`v${version}`)) {
  problems.push(`Script JSON 的 info 應標示 v${version}`);
}
if (!readme.includes(expectedUrl)) {
  problems.push(`README 的安裝網址應為 ${expectedUrl}`);
}

if (problems.length) {
  console.error(problems.map(problem => `✗ ${problem}`).join('\n'));
  process.exit(1);
}
console.info(`✓ 發版設定一致：v${version}`);
