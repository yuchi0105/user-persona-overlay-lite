import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendTemplateContent,
  buildInjectionText,
  mapPersonaSettings,
  normalizeAppliedTemplates,
  normalizeLibrary,
  normalizeOverlay,
  normalizeUndoStack,
  personaSettingsEqual,
  PROMPT_POSITIONS,
  PROMPT_ROLES,
  removeAppliedSnapshot,
  resolveInjectionPlan,
} from '../src/persona-overlay-lite/core';

test('直接讀取 Extension 既有 overlay schema，舊 followPersona=false 也升級為 Follow', () => {
  const data = normalizeOverlay({
    version: 1,
    enabled: true,
    followPersona: false,
    nickname: '灰嶺嚮導',
    content: '今天穿著白色嚮導制服。',
    position: 1,
    depth: 4,
    role: 2,
  });
  assert.deepEqual(data, {
    version: 1,
    enabled: true,
    followPersona: true,
    nickname: '灰嶺嚮導',
    content: '今天穿著白色嚮導制服。',
    position: 1,
    depth: 4,
    role: 2,
  });
});

test('enabled=false 或 content 為空時完全不注入', () => {
  assert.equal(buildInjectionText(normalizeOverlay({ enabled: false, content: 'secret' })), '');
  assert.equal(buildInjectionText(normalizeOverlay({ enabled: true, content: '   ' })), '');
});

test('Preview 與實際注入共用相同格式', () => {
  const text = buildInjectionText(normalizeOverlay({
    enabled: true,
    nickname: '七七',
    content: '補充設定',
  }));
  assert.equal(text, '[Supplemental persona for 七七]\n補充設定');
});

test('Follow 映射 IN_PROMPT 與 AT_DEPTH/depth/role', () => {
  assert.deepEqual(mapPersonaSettings({ position: 0, depth: 8, role: 1 }), {
    position: PROMPT_POSITIONS.IN_PROMPT,
    depth: 8,
    role: PROMPT_ROLES.USER,
  });
  assert.deepEqual(mapPersonaSettings({ position: 4, depth: 6, role: 2 }), {
    position: PROMPT_POSITIONS.IN_CHAT,
    depth: 6,
    role: PROMPT_ROLES.ASSISTANT,
  });
});

test('無法鏡像的 Persona 位置使用聊天 fallback', () => {
  const data = normalizeOverlay({ position: 2, depth: 3, role: 1 });
  const plan = resolveInjectionPlan(data, mapPersonaSettings({ position: 3, depth: 9, role: 2 }));
  assert.equal(plan.followed, false);
  assert.equal(plan.source, 'fallback');
  assert.equal(plan.position, PROMPT_POSITIONS.BEFORE_PROMPT);
  assert.equal(plan.depth, 3);
  assert.equal(plan.role, PROMPT_ROLES.USER);
});

test('Helper Persona API 只有三項都一致才算與原生設定一致', () => {
  assert.equal(
    personaSettingsEqual(
      { position: 4, depth: 2, role: 0 },
      { position: 4, depth: 2, role: 0 },
    ),
    true,
  );
  assert.equal(
    personaSettingsEqual(
      { position: 4, depth: 2, role: 0 },
      { position: 4, depth: 3, role: 0 },
    ),
    false,
  );
});

test('Persona Library 沿用既有 schema，不搬家', () => {
  const library = normalizeLibrary([{
    id: 'existing-id',
    name: '既有存檔',
    nickname: '嚮導',
    content: '既有內容',
    createdAt: 10,
    updatedAt: 20,
  }], 999);
  assert.deepEqual(library[0], {
    id: 'existing-id',
    name: '既有存檔',
    nickname: '嚮導',
    content: '既有內容',
    createdAt: 10,
    updatedAt: 20,
  });
});

test('套用存檔採追加，不覆蓋目前 Persona', () => {
  assert.equal(appendTemplateContent('原本 Persona', '模板內容'), '原本 Persona\n\n模板內容');
  assert.equal(appendTemplateContent('', '模板內容'), '模板內容');
  assert.equal(appendTemplateContent('原本 Persona', '   '), null);
});

test('單條撤銷只移除可明確找到的 snapshot', () => {
  assert.equal(removeAppliedSnapshot('A\n\nB\n\nC', 'B'), 'A\n\nC');
  assert.equal(removeAppliedSnapshot('A\n\nB', 'B'), 'A');
  assert.equal(removeAppliedSnapshot('已被手動修改', '舊快照'), null);
});

test('Undo 與 applied template metadata 接受 Extension 既有陣列', () => {
  assert.deepEqual(normalizeUndoStack(['A', 1, 'B']), ['A', 'B']);
  assert.deepEqual(normalizeAppliedTemplates([
    { id: 'a', name: '模板 A', content: '內容 A' },
    { id: 2, name: '壞資料', content: '內容' },
  ]), [{ id: 'a', name: '模板 A', content: '內容 A' }]);
});

