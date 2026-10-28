import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRuntime } from './helpers/runtime';

const runtime = await loadRuntime({ parentBody: '<div id="user_persona_overlay_settings"></div>' });

test('完整版 Extension 同時啟用時，卸載 Lite 不會清掉共用的注入', () => {
  runtime.setChat('Alice - chat A', {
    user_persona_overlay: { version: 1, enabled: true, content: '喜歡貓。', position: 0, depth: 2, role: 0 },
  });
  runtime.emit('chat_id_changed');
  runtime.iframe.dispatchEvent(new runtime.iframe.Event('pagehide'));
  assert.equal(runtime.prompts.user_persona_overlay?.value, '[Supplemental persona for the user]\n喜歡貓。');
});
