import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRuntime } from './helpers/runtime';

const library = [{ id: 'cat', name: '貓派', nickname: '小明', content: '喜歡貓。', createdAt: 1, updatedAt: 1 }];
const runtime = await loadRuntime({ library });
const { $ } = runtime;

function click(selector: string): void {
  $(selector).trigger('click');
}

function clickLibraryButton(label: string): void {
  $('#upol_library_list button').filter((_, button) => $(button).text() === label).first().trigger('click');
}

function openFromWand(): void {
  click('#persona_overlay_lite_wand');
}

function pressEscape(target: Document): void {
  target.dispatchEvent(new target.defaultView!.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

test('魔法棒選單只有一個入口，點擊後開啟面板', () => {
  assert.equal($('#extensionsMenu #persona_overlay_lite_wand').length, 1);
  openFromWand();
  assert.equal($('#upol_backdrop').is('[hidden]'), false);
});

test('Esc 在酒館主頁面按下時會關閉面板', () => {
  pressEscape(runtime.iframe.document);
  assert.equal($('#upol_backdrop').is('[hidden]'), false, 'iframe 不會收到主頁面的鍵盤事件');
  pressEscape(runtime.parent.document);
  assert.equal($('#upol_backdrop').is('[hidden]'), true);
});

test('套用存檔會追加內容，暱稱空白時帶入存檔暱稱', () => {
  openFromWand();
  clickLibraryButton('套用');
  assert.equal($('#upol_content').val(), '喜歡貓。');
  assert.equal($('#upol_nickname').val(), '小明');
  assert.deepEqual(runtime.chatMetadata.user_persona_overlay_undo, ['']);
  assert.equal((runtime.chatMetadata.user_persona_overlay_applied_templates as unknown[]).length, 1);
});

test('撤回一步會同步移除已追加模板記錄', async () => {
  click('#upol_undo_last');
  await runtime.tick();
  assert.equal($('#upol_content').val(), '');
  assert.deepEqual(runtime.chatMetadata.user_persona_overlay_undo, []);
  assert.deepEqual(runtime.chatMetadata.user_persona_overlay_applied_templates, []);
  assert.equal(runtime.popupMessages.length, 0);
  assert.equal($('#upol_applied_list .upol-item').length, 0);
});

test('套用後手動修改過，撤回前會先確認', async () => {
  clickLibraryButton('套用');
  $('#upol_content').val('喜歡貓。\n\n也喜歡狗。').trigger('input');

  runtime.popupAnswers.push(0);
  click('#upol_undo_last');
  await runtime.tick();
  assert.equal(runtime.popupMessages.length, 1);
  assert.equal($('#upol_content').val(), '喜歡貓。\n\n也喜歡狗。');
  assert.equal((runtime.chatMetadata.user_persona_overlay_undo as unknown[]).length, 1);

  runtime.popupAnswers.push(1);
  click('#upol_undo_last');
  await runtime.tick();
  assert.equal($('#upol_content').val(), '');
  assert.deepEqual(runtime.chatMetadata.user_persona_overlay_applied_templates, []);
});

test('預覽會展開補充 Persona 裡的巨集', async () => {
  $('#upol_content').val('{{user}} 喜歡貓。').trigger('input');
  $('#upol_enabled').prop('checked', true).trigger('change');
  await runtime.tick(350);
  assert.match(String($('#upol_preview').val()), /Bob 喜歡貓。/);
  assert.equal(runtime.prompts.user_persona_overlay?.value, '[Supplemental persona for 小明]\n{{user}} 喜歡貓。');
});

test('切換聊天時會把過長的撤回紀錄裁到上限', () => {
  const undo = Array.from({ length: 35 }, (_, index) => `舊內容 ${index}`);
  runtime.setChat('Alice - chat B', { user_persona_overlay_undo: undo });
  runtime.emit('chat_id_changed');
  assert.deepEqual(runtime.chatMetadata.user_persona_overlay_undo, undo.slice(-20));
  assert.equal($('#upol_chat_name').text(), '目前聊天：Alice - chat B');
});

test('腳本卸載時會撤掉注入與 DOM', () => {
  runtime.setChat('Alice - chat A', {
    user_persona_overlay: { version: 1, enabled: true, content: '喜歡貓。', position: 0, depth: 2, role: 0 },
  });
  runtime.emit('chat_id_changed');
  assert.equal(runtime.prompts.user_persona_overlay?.value, '[Supplemental persona for the user]\n喜歡貓。');

  runtime.iframe.dispatchEvent(new runtime.iframe.Event('pagehide'));
  assert.equal(runtime.prompts.user_persona_overlay?.value, '');
  assert.equal(runtime.prompts.user_persona_overlay?.position, -1);
  assert.equal($('#upol_backdrop, #persona_overlay_lite_wand, #persona_overlay_lite_style').length, 0);
});
