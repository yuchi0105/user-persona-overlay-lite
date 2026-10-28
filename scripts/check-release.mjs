import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// 確認 Tavern Helper Script JSON 載入的正是目前 build 出來的 dist，避免發版漏改。
const root = new URL('../', import.meta.url);
const distPath = 'dist/persona-overlay-lite/index.js';
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const script = JSON.parse(readFileSync(new URL('Persona Overlay Lite.json', root), 'utf8'));
const readme = readFileSync(new URL('README.md', root), 'utf8');

const problems = [];
const match = /^import '(https:\/\/cdn\.jsdelivr\.net\/gh\/yuchi0105\/user-persona-overlay-lite@([^/']+)\/dist\/persona-overlay-lite\/index\.js)'$/
  .exec(String(script.content ?? ''));

if (!match) {
  problems.push('Script JSON 的 content 必須是單行 jsDelivr import');
} else {
  const [, url, ref] = match;
  if (/^[0-9a-f]{40}$/.test(ref)) {
    // 以 commit 載入：該 commit 的 dist 必須與目前 build 完全相同。
    let pinned = null;
    try {
      pinned = execFileSync('git', ['show', `${ref}:${distPath}`], { cwd: root, encoding: 'utf8' });
    } catch {
      problems.push(`找不到 commit ${ref} 的 ${distPath}`);
    }
    if (pinned !== null && pinned !== readFileSync(new URL(distPath, root), 'utf8')) {
      problems.push(`commit ${ref} 的 dist 與目前 build 不同，請更新 Script JSON 與 README 的載入網址`);
    }
  } else if (ref !== `v${version}`) {
    problems.push(`載入網址應指向 tag v${version} 或完整 commit hash，目前是 @${ref}`);
  }
  if (!readme.includes(url)) {
    problems.push(`README 的安裝網址應為 ${url}`);
  }
}
if (!String(script.info ?? '').includes(`v${version}`)) {
  problems.push(`Script JSON 的 info 應標示 v${version}`);
}

if (problems.length) {
  console.error(problems.map(problem => `✗ ${problem}`).join('\n'));
  process.exit(1);
}
console.info(`✓ 發版設定一致：v${version}（${match[2]}）`);
