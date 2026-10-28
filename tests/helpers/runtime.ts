import jqueryFactory from 'jquery';
import { JSDOM } from 'jsdom';

type Listener = (...args: unknown[]) => void;

export type PromptRecord = { value: string; position: number; depth: number; role?: number };

export type Runtime = {
  parent: Window & typeof globalThis;
  iframe: Window & typeof globalThis;
  $: JQueryStatic;
  chatMetadata: Record<string, unknown>;
  prompts: Record<string, PromptRecord>;
  popupAnswers: number[];
  popupMessages: string[];
  emit: (event: string, ...args: unknown[]) => void;
  setChat: (id: string, metadata: Record<string, unknown>) => void;
  tick: (ms?: number) => Promise<void>;
};

/**
 * 模擬酒館助手的執行環境：腳本跑在 iframe，`$` 是主頁面的 jQuery，
 * `window`／`document` 則是 iframe 自己的。
 */
export async function loadRuntime(options: { parentBody?: string; library?: unknown[] } = {}): Promise<Runtime> {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>
      <div id="extensionsMenu"></div>
      ${options.parentBody ?? ''}
      <iframe id="script_iframe"></iframe>
    </body></html>`,
    { url: 'http://localhost/' },
  );
  const parent = dom.window as unknown as Window & typeof globalThis;
  const iframe = (parent.document.getElementById('script_iframe') as HTMLIFrameElement)
    .contentWindow as Window & typeof globalThis;
  const $ = (jqueryFactory as unknown as (window: Window) => JQueryStatic)(parent);

  const listeners = new Map<string, Listener[]>();
  const prompts: Record<string, PromptRecord> = {};
  const popupAnswers: number[] = [];
  const popupMessages: string[] = [];
  const state = { chatId: 'Alice - chat A', chatMetadata: {} as Record<string, unknown> };

  if (options.library) {
    parent.localStorage.setItem('user_persona_overlay_library', JSON.stringify(options.library));
  }

  const context = {
    name2: 'Alice',
    get chatMetadata() {
      return state.chatMetadata;
    },
    powerUserSettings: {
      persona_description: '原生 Persona',
      persona_description_position: 0,
      persona_description_depth: 2,
      persona_description_role: 0,
    },
    extensionPrompts: prompts,
    getCurrentChatId: () => state.chatId,
    substituteParams: (content: string) => content.replaceAll('{{user}}', 'Bob'),
    saveMetadataDebounced: () => undefined,
    setExtensionPrompt: (key: string, value: string, position: number, depth: number, _scan?: boolean, role?: number) => {
      prompts[key] = { value, position, depth, role };
    },
    callGenericPopup: async (content: Element) => {
      popupMessages.push(content.textContent ?? '');
      return popupAnswers.shift() ?? 0;
    },
    POPUP_TYPE: { CONFIRM: 2 },
    POPUP_RESULT: { AFFIRMATIVE: 1 },
  };

  Object.assign(globalThis, {
    window: iframe,
    document: iframe.document,
    $,
    jQuery: $,
    localStorage: parent.localStorage,
    SillyTavern: { getContext: () => context },
    getPersona: () => ({ position: 0, depth: 2, role: 0, name: 'Bob', description: '原生 Persona' }),
    getCurrentPersonaName: () => 'Bob',
    getButtonEvent: (name: string) => `button:${name}`,
    tavern_events: {
      CHAT_CHANGED: 'chat_id_changed',
      PERSONA_CHANGED: 'persona_changed',
      GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
      APP_READY: 'app_ready',
    },
    eventOn: (event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return { stop: () => undefined };
    },
  });

  const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(resolve, ms));
  await import('../../src/persona-overlay-lite/index');
  // jQuery 的 ready callback 是非同步執行的。
  await tick(20);

  return {
    parent,
    iframe,
    $,
    get chatMetadata() {
      return state.chatMetadata;
    },
    prompts,
    popupAnswers,
    popupMessages,
    emit: (event, ...args) => listeners.get(event)?.forEach(listener => listener(...args)),
    setChat: (id, metadata) => {
      state.chatId = id;
      state.chatMetadata = metadata;
    },
    tick,
  };
}
