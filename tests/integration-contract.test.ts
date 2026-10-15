import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/persona-overlay-lite/index.ts', import.meta.url), 'utf8');

test('維持 Extension 相同 prompt ID 與既有資料鍵', () => {
  assert.match(source, /PROMPT_KEY = 'user_persona_overlay'/);
  assert.match(source, /METADATA_KEY = 'user_persona_overlay'/);
  assert.match(source, /UNDO_METADATA_KEY = 'user_persona_overlay_undo'/);
  assert.match(source, /APPLIED_TEMPLATES_METADATA_KEY = 'user_persona_overlay_applied_templates'/);
  assert.match(source, /LIBRARY_STORAGE_KEY = 'user_persona_overlay_library'/);
});

test('生成前會先提交 debounce 內容再刷新注入', () => {
  assert.match(
    source,
    /GENERATION_AFTER_COMMANDS[\s\S]*?flushTextSave\(\);[\s\S]*?refreshInjection\(\);/,
  );
});

test('CHAT_CHANGED 只同步 singleton 面板，不建立第二份 DOM', () => {
  assert.match(source, /CHAT_CHANGED[\s\S]*?syncPanel\(\);/);
  assert.match(source, /if \(\$\(`#\$\{BACKDROP_ID\}`\)\.length\)/);
});

test('Lite v1 沒有輪詢、MutationObserver 或跨聊天資料 API', () => {
  assert.doesNotMatch(source, /setInterval|MutationObserver|getChatMetadata|setChatMetadata/);
});
