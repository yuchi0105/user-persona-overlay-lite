import styles from './style.css?raw';
import {
  appendTemplateContent,
  AppliedTemplate,
  buildFinalPromptPreview,
  buildInjectionText,
  DEFAULT_DATA,
  InjectionConfig,
  InjectionPlan,
  LibraryItem,
  mapPersonaSettings,
  normalizeAppliedTemplates,
  normalizeLibrary,
  normalizeOverlay,
  normalizePersonaSettings,
  normalizeUndoStack,
  OverlayData,
  personaSettingsEqual,
  PROMPT_POSITIONS,
  PROMPT_ROLES,
  removeAppliedSnapshot,
  resolveInjectionPlan,
} from './core';

const METADATA_KEY = 'user_persona_overlay';
const UNDO_METADATA_KEY = 'user_persona_overlay_undo';
const APPLIED_TEMPLATES_METADATA_KEY = 'user_persona_overlay_applied_templates';
const LIBRARY_STORAGE_KEY = 'user_persona_overlay_library';
const PROMPT_KEY = 'user_persona_overlay';
const WAND_ID = 'persona_overlay_lite_wand';
const STYLE_ID = 'persona_overlay_lite_style';
const BACKDROP_ID = 'upol_backdrop';
const TEXT_DEBOUNCE_MS = 300;
const LOG_PREFIX = '[Persona Overlay Lite]';

type NativeResolution = {
  config: InjectionConfig | null;
  source: 'helper' | 'power-user';
  personaName: string;
  personaContent: string;
  comparisonMessage: string;
};

type HelperPersonaSnapshot = {
  settings: ReturnType<typeof normalizePersonaSettings>;
  name: string;
  description: string;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let libraryEditorId: string | null = null;
let libraryEditorMode: 'preview' | 'edit' = 'preview';
let lastWrittenPrompt = '';
let extensionDetected = false;

function getContext(): TavernContext {
  const api = SillyTavern;
  return typeof api.getContext === 'function' ? api.getContext() : api;
}

function notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const toast = (globalThis as typeof globalThis & {
    toastr?: Record<string, ((text: string) => void) | undefined>;
  }).toastr?.[type];
  if (typeof toast === 'function') {
    toast(message);
  } else {
    console.info(LOG_PREFIX, message);
  }
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getMetadataStore(): Record<string, unknown> | null {
  const metadata = getContext().chatMetadata;
  return metadata && typeof metadata === 'object' ? metadata : null;
}

function persistMetadata(): void {
  const context = getContext();
  const save = context.saveMetadataDebounced ?? context.saveMetadata;
  if (typeof save !== 'function') {
    console.warn(LOG_PREFIX, '目前環境未提供 chatMetadata 保存函式。');
    return;
  }
  try {
    void Promise.resolve(save.call(context)).catch(error => {
      console.warn(LOG_PREFIX, '保存 chatMetadata 失敗。', error);
    });
  } catch (error) {
    console.warn(LOG_PREFIX, '保存 chatMetadata 失敗。', error);
  }
}

function getOverlayData(): OverlayData {
  const store = getMetadataStore();
  return normalizeOverlay(store?.[METADATA_KEY]);
}

function saveOverlayData(patch: Partial<OverlayData>): OverlayData {
  const store = getMetadataStore();
  const next = normalizeOverlay({ ...getOverlayData(), ...patch, version: 1 });
  if (!store) {
    console.warn(LOG_PREFIX, 'chatMetadata 不可用，本次修改未保存。');
    return next;
  }
  store[METADATA_KEY] = next;
  persistMetadata();
  return next;
}

function getUndoStack(): string[] {
  return normalizeUndoStack(getMetadataStore()?.[UNDO_METADATA_KEY]);
}

function saveUndoStack(stack: string[]): void {
  const store = getMetadataStore();
  if (!store) {
    return;
  }
  store[UNDO_METADATA_KEY] = stack;
  persistMetadata();
}

function getAppliedTemplates(): AppliedTemplate[] {
  return normalizeAppliedTemplates(getMetadataStore()?.[APPLIED_TEMPLATES_METADATA_KEY]);
}

function saveAppliedTemplates(records: AppliedTemplate[]): void {
  const store = getMetadataStore();
  if (!store) {
    return;
  }
  store[APPLIED_TEMPLATES_METADATA_KEY] = records;
  persistMetadata();
}

function loadLibrary(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    return raw ? normalizeLibrary(JSON.parse(raw)) : [];
  } catch (error) {
    console.warn(LOG_PREFIX, '讀取 Persona 存檔失敗。', error);
    return [];
  }
}

function saveLibrary(items: LibraryItem[]): boolean {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (error) {
    console.warn(LOG_PREFIX, '寫入 Persona 存檔失敗。', error);
    notify('Persona 存檔寫入失敗。', 'error');
    return false;
  }
}

function readPowerUserPersona(): ReturnType<typeof normalizePersonaSettings> {
  const settings = getContext().powerUserSettings;
  if (!settings || typeof settings !== 'object') {
    return null;
  }
  return normalizePersonaSettings({
    position: settings.persona_description_position,
    depth: settings.persona_description_depth,
    role: settings.persona_description_role,
  });
}

function readPowerUserPersonaContent(): string {
  const settings = getContext().powerUserSettings;
  return settings && typeof settings === 'object' && typeof settings.persona_description === 'string'
    ? settings.persona_description
    : '';
}

function readHelperPersona(): HelperPersonaSnapshot | null {
  try {
    if (typeof getPersona !== 'function') {
      return null;
    }
    const persona = getPersona('current');
    return {
      settings: normalizePersonaSettings(persona),
      name: typeof persona.name === 'string' ? persona.name : '',
      description: typeof persona.description === 'string' ? persona.description : '',
    };
  } catch (error) {
    console.warn(LOG_PREFIX, 'Tavern Helper Persona API 讀取失敗。', error);
    return null;
  }
}

function readPersonaName(): string {
  try {
    return typeof getCurrentPersonaName === 'function' ? getCurrentPersonaName() ?? '（未選擇）' : '（未知）';
  } catch {
    return '（未知）';
  }
}

function expandPersonaContent(content: string): string {
  const context = getContext();
  try {
    return typeof context.substituteParams === 'function'
      ? context.substituteParams(content)
      : content;
  } catch (error) {
    console.warn(LOG_PREFIX, '展開 Persona 巨集失敗，預覽將顯示原始內容。', error);
    return content;
  }
}

function resolveNativePersona(): NativeResolution {
  const powerUser = readPowerUserPersona();
  const helper = readHelperPersona();
  const personaName = helper?.name || readPersonaName();
  const personaContent = expandPersonaContent(helper?.description || readPowerUserPersonaContent());

  if (powerUser && helper?.settings && personaSettingsEqual(powerUser, helper.settings)) {
    return {
      config: mapPersonaSettings(helper.settings),
      source: 'helper',
      personaName,
      personaContent,
      comparisonMessage: 'Helper Persona API 與原生生效設定一致。',
    };
  }
  if (powerUser) {
    return {
      config: mapPersonaSettings(powerUser),
      source: 'power-user',
      personaName,
      personaContent,
      comparisonMessage: helper
        ? 'Helper Persona API 與原生生效設定不同，已採用 powerUserSettings。'
        : 'Helper Persona API 暫不可用，已採用 powerUserSettings。',
    };
  }
  return {
    config: mapPersonaSettings(helper?.settings ?? null),
    source: 'helper',
    personaName,
    personaContent,
    comparisonMessage: helper
      ? 'powerUserSettings 暫不可用，已採用 Helper Persona API。'
      : '目前無法讀取原生 Persona 設定。',
  };
}

function getInjectionState(): { data: OverlayData; text: string; plan: InjectionPlan; native: NativeResolution } {
  const data = getOverlayData();
  const native = resolveNativePersona();
  const plan = resolveInjectionPlan(data, native.config, native.source);
  return { data, text: buildInjectionText(data), plan, native };
}

function writePrompt(text: string, plan: InjectionPlan): void {
  const context = getContext();
  const position = text ? plan.position : PROMPT_POSITIONS.NONE;
  lastWrittenPrompt = text;
  try {
    void Promise.resolve(
      context.setExtensionPrompt(PROMPT_KEY, text, position, plan.depth, false, plan.role),
    ).catch(error => console.error(LOG_PREFIX, '刷新注入失敗。', error));
  } catch (error) {
    console.error(LOG_PREFIX, '刷新注入失敗。', error);
  }
}

function refreshInjection(): void {
  const state = getInjectionState();
  writePrompt(state.text, state.plan);
  updatePreview(state);
}

function scheduleTextSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    commitPanelText();
  }, TEXT_DEBOUNCE_MS);
}

function cancelTextSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function flushTextSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    commitPanelText();
  }
}

function commitPanelText(): void {
  if (!$(`#${BACKDROP_ID}`).length) {
    return;
  }
  saveOverlayData({
    nickname: String($('#upol_nickname').val() ?? ''),
    content: String($('#upol_content').val() ?? ''),
  });
  refreshInjection();
}

function getCurrentChatLabel(): string {
  const context = getContext();
  const selectedChat = String($('#extensionTopBarChatName option:selected').text() ?? '').trim();
  if (selectedChat && selectedChat !== '未選擇聊天') {
    return selectedChat;
  }
  const id = context.getCurrentChatId?.() ?? context.chatId ?? '';
  const character = context.name2 ?? '';
  if (!id) {
    return '尚未載入聊天';
  }
  return character ? `${character} · ${id}` : id;
}

function detectFullExtension(): void {
  const prompt = getContext().extensionPrompts?.[PROMPT_KEY]?.value ?? '';
  extensionDetected = extensionDetected
    || $('#user_persona_overlay_settings').length > 0
    || $('#persona_overlay_settings').length > 0
    || $('#persona_overlay_wand').length > 0
    || $('#persona_overlay_floating_button').length > 0
    || $('#upo_floating_root').length > 0
    || Boolean(prompt && prompt !== lastWrittenPrompt);
  $('#upol_extension_notice').toggleClass('upol-hidden', !extensionDetected);
}

function positionLabel(position: number): string {
  if (position === PROMPT_POSITIONS.IN_PROMPT) {
    return 'Prompt';
  }
  if (position === PROMPT_POSITIONS.IN_CHAT) {
    return 'Chat @ Depth';
  }
  if (position === PROMPT_POSITIONS.BEFORE_PROMPT) {
    return 'Before Prompt';
  }
  return 'None';
}

function roleLabel(role: number): string {
  if (role === PROMPT_ROLES.USER) {
    return 'User';
  }
  if (role === PROMPT_ROLES.ASSISTANT) {
    return 'Assistant';
  }
  return 'System';
}

function updatePreview(existingState?: ReturnType<typeof getInjectionState>): void {
  if (!$(`#${BACKDROP_ID}`).length) {
    return;
  }
  const state = existingState ?? getInjectionState();
  const { data, text, plan, native } = state;
  const active = Boolean(text);
  $('#upol_state')
    .text(data.enabled ? (active ? '已啟用' : '已啟用 · 內容為空') : '未啟用')
    .toggleClass('is-on', active);
  $('#upol_chat_name').text(`目前聊天：${getCurrentChatLabel()}`);
  $('#upol_persona_name').text(native.personaName);
  $('#upol_plan_position').text(positionLabel(plan.position));
  $('#upol_plan_depth').text(String(plan.depth));
  $('#upol_plan_role').text(roleLabel(plan.role));
  $('#upol_follow_source').text(plan.followed
    ? `跟隨原生 Persona · ${plan.source === 'helper' ? 'Helper API' : 'powerUserSettings'}`
    : '使用聊天 fallback');
  $('#upol_follow_comparison').text(native.comparisonMessage);
  $('#upol_follow_warning')
    .toggleClass('upol-hidden', plan.followed)
    .text(plan.fallbackReason ? `⚠ ${plan.fallbackReason}` : '');
  $('#upol_preview').val(buildFinalPromptPreview(native.personaName, native.personaContent, text));
  detectFullExtension();
}

function syncPanel(): void {
  const data = getOverlayData();
  $('#upol_enabled').prop('checked', data.enabled);
  $('#upol_nickname').val(data.nickname);
  $('#upol_content').val(data.content);
  renderAppliedTemplates();
  renderLibrary();
  updatePreview();
}

function saveCurrentToLibrary(): void {
  flushTextSave();
  const data = getOverlayData();
  const name = String($('#upol_library_name').val() ?? '').trim();
  if (!name) {
    notify('請先輸入存檔名稱。', 'warning');
    return;
  }
  if (!data.content.trim()) {
    notify('目前補充 Persona 是空的，沒有建立存檔。', 'warning');
    return;
  }
  const now = Date.now();
  const items = loadLibrary();
  items.push({
    id: createId(),
    name,
    nickname: data.nickname.trim(),
    content: data.content,
    createdAt: now,
    updatedAt: now,
  });
  if (saveLibrary(items)) {
    $('#upol_library_name').val('');
    renderLibrary();
    notify(`已建立 Persona 存檔「${name}」。`, 'success');
  }
}

function applyLibraryItem(id: string): void {
  flushTextSave();
  const item = loadLibrary().find(candidate => candidate.id === id);
  if (!item) {
    notify('找不到這份 Persona 存檔。', 'warning');
    renderLibrary();
    return;
  }
  const data = getOverlayData();
  const content = appendTemplateContent(data.content, item.content);
  if (content === null) {
    notify(`存檔「${item.name}」內容為空，沒有套用。`, 'warning');
    return;
  }
  saveUndoStack([...getUndoStack(), data.content]);
  saveOverlayData({ content });
  saveAppliedTemplates([
    ...getAppliedTemplates(),
    { id: createId(), name: item.name, content: item.content.trim() },
  ]);
  $('#upol_content').val(content);
  renderAppliedTemplates();
  refreshInjection();
  notify(`已將「${item.name}」追加到目前聊天。`, 'success');
}

function undoLastTemplate(): void {
  cancelTextSave();
  const stack = getUndoStack();
  if (!stack.length) {
    notify('沒有可撤回的 Persona 模板套用。');
    return;
  }
  const content = stack[stack.length - 1] ?? '';
  saveUndoStack(stack.slice(0, -1));
  saveOverlayData({ content });
  $('#upol_content').val(content);
  refreshInjection();
  notify('已撤回最近一次 Persona 模板套用。', 'success');
}

function undoAppliedTemplate(id: string): void {
  flushTextSave();
  const records = getAppliedTemplates();
  const record = records.find(candidate => candidate.id === id);
  if (!record) {
    renderAppliedTemplates();
    return;
  }
  const content = removeAppliedSnapshot(getOverlayData().content, record.content);
  if (content === null) {
    notify(`找不到「${record.name || '未命名'}」當時追加的內容；未刪除文字，記錄也已保留。`, 'warning');
    return;
  }
  saveAppliedTemplates(records.filter(candidate => candidate.id !== id));
  saveOverlayData({ content });
  $('#upol_content').val(content);
  renderAppliedTemplates();
  refreshInjection();
  notify(`已撤銷「${record.name || '未命名'}」追加的內容。`, 'success');
}

function renderAppliedTemplates(): void {
  const container = $('#upol_applied_list').empty();
  const records = getAppliedTemplates();
  if (!records.length) {
    container.append($('<div class="upol-list-empty"></div>').text('尚未追加 Persona 存檔'));
    return;
  }
  records.forEach(record => {
    const preview = $('<textarea class="upol-item-preview upol-hidden" readonly></textarea>').val(record.content);
    const previewButton = $('<button type="button" class="upol-button">預覽</button>').on('click', () => {
      preview.toggleClass('upol-hidden');
    });
    const undoButton = $('<button type="button" class="upol-button">撤銷</button>').on('click', () => {
      undoAppliedTemplate(record.id);
    });
    const name = $('<div class="upol-item-name"></div>').text(record.name || '未命名');
    const actions = $('<div class="upol-item-actions"></div>').append(previewButton, undoButton);
    container.append($('<div class="upol-item"></div>').append(name, actions, preview));
  });
}

function openLibraryEditor(id: string, mode: 'preview' | 'edit'): void {
  const item = loadLibrary().find(candidate => candidate.id === id);
  if (!item) {
    renderLibrary();
    return;
  }
  libraryEditorId = id;
  libraryEditorMode = mode;
  const editing = mode === 'edit';
  $('#upol_library_editor').removeClass('upol-hidden');
  $('#upol_library_editor_title').text(editing ? '編輯 Persona 存檔' : '預覽 Persona 存檔');
  $('#upol_library_edit_name').val(item.name).prop('readonly', !editing);
  $('#upol_library_edit_nickname').val(item.nickname).prop('readonly', !editing);
  $('#upol_library_edit_content').val(item.content).prop('readonly', !editing);
  $('#upol_library_edit_save').toggleClass('upol-hidden', !editing);
}

function closeLibraryEditor(): void {
  libraryEditorId = null;
  libraryEditorMode = 'preview';
  $('#upol_library_editor').addClass('upol-hidden');
}

function saveLibraryEditor(): void {
  if (!libraryEditorId || libraryEditorMode !== 'edit') {
    return;
  }
  const items = loadLibrary();
  const item = items.find(candidate => candidate.id === libraryEditorId);
  if (!item) {
    closeLibraryEditor();
    renderLibrary();
    return;
  }
  const name = String($('#upol_library_edit_name').val() ?? '').trim();
  if (!name) {
    notify('存檔名稱不能是空的。', 'warning');
    return;
  }
  item.name = name;
  item.nickname = String($('#upol_library_edit_nickname').val() ?? '').trim();
  item.content = String($('#upol_library_edit_content').val() ?? '');
  item.updatedAt = Date.now();
  if (saveLibrary(items)) {
    closeLibraryEditor();
    renderLibrary();
    notify(`已更新 Persona 存檔「${name}」。`, 'success');
  }
}

function deleteLibraryItem(id: string): void {
  const item = loadLibrary().find(candidate => candidate.id === id);
  if (!item || !globalThis.confirm(`刪除 Persona 存檔「${item.name}」？目前聊天內容不會受影響。`)) {
    return;
  }
  if (saveLibrary(loadLibrary().filter(candidate => candidate.id !== id))) {
    if (libraryEditorId === id) {
      closeLibraryEditor();
    }
    renderLibrary();
  }
}

function renderLibrary(): void {
  const container = $('#upol_library_list').empty();
  const items = loadLibrary();
  if (!items.length) {
    container.append($('<div class="upol-list-empty"></div>').text('尚無 Persona 存檔'));
    return;
  }
  items.forEach(item => {
    const name = $('<div class="upol-item-name"></div>').text(item.name || '未命名');
    if (item.nickname) {
      name.append($('<small></small>').text(`暱稱：${item.nickname}`));
    }
    const preview = $('<button type="button" class="upol-button">預覽</button>')
      .on('click', () => openLibraryEditor(item.id, 'preview'));
    const apply = $('<button type="button" class="upol-button is-primary">套用</button>')
      .on('click', () => applyLibraryItem(item.id));
    const edit = $('<button type="button" class="upol-button">編輯</button>')
      .on('click', () => openLibraryEditor(item.id, 'edit'));
    const remove = $('<button type="button" class="upol-button">刪除</button>')
      .on('click', () => deleteLibraryItem(item.id));
    const actions = $('<div class="upol-item-actions"></div>').append(preview, apply, edit, remove);
    container.append($('<div class="upol-item"></div>').append(name, actions));
  });
}

function setActiveTab(tab: 'chat' | 'library'): void {
  $('.upol-tab').attr('aria-selected', 'false');
  $(`.upol-tab[data-upol-tab="${tab}"]`).attr('aria-selected', 'true');
  $('[data-upol-view]').addClass('upol-hidden');
  $(`[data-upol-view="${tab}"]`).removeClass('upol-hidden');
}

function closePanel(): void {
  flushTextSave();
  $(`#${BACKDROP_ID}`).attr('hidden', 'hidden');
}

function openPanel(): void {
  ensurePanel();
  syncPanel();
  $(`#${BACKDROP_ID}`).removeAttr('hidden');
  $('#upol_nickname').trigger('focus');
}

function ensureStyle(): void {
  const tavernDocument = window.parent?.document ?? document;
  if (!tavernDocument.getElementById(STYLE_ID)) {
    const style = tavernDocument.createElement('style');
    style.id = STYLE_ID;
    style.textContent = styles;
    tavernDocument.head.append(style);
  }
}

function ensurePanel(): void {
  if ($(`#${BACKDROP_ID}`).length) {
    return;
  }
  const panel = $(`
    <div id="${BACKDROP_ID}" hidden>
      <section id="upol_panel" role="dialog" aria-modal="true" aria-labelledby="upol_title">
        <header class="upol-header">
          <div class="upol-title-icon"><i class="fa-solid fa-user-pen"></i></div>
          <div class="upol-title-group">
            <h2 id="upol_title">Persona Overlay Lite</h2>
            <p id="upol_chat_name">目前聊天：尚未載入聊天</p>
          </div>
          <span id="upol_state" class="upol-status-pill">未啟用</span>
          <button id="upol_close" class="upol-icon-button" type="button" aria-label="關閉">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div id="upol_extension_notice" class="upol-notice upol-hidden">
          Persona Overlay Extension 可能同時啟用；兩者共用同一注入 ID，不會建立第二份 Prompt。
        </div>

        <nav class="upol-tabs" aria-label="Persona Overlay Lite">
          <button class="upol-tab" type="button" data-upol-tab="chat" aria-selected="true">目前聊天</button>
          <button class="upol-tab" type="button" data-upol-tab="library" aria-selected="false">Persona 存檔</button>
        </nav>

        <main class="upol-body">
          <div data-upol-view="chat" class="upol-chat-grid">
            <section class="upol-card">
              <div class="upol-card-title">補充 Persona</div>
              <label class="upol-toggle-row">
                <input id="upol_enabled" type="checkbox">
                <span>目前聊天啟用補充 Persona</span>
              </label>
              <label class="upol-field">
                <span>備註名／暱稱</span>
                <input id="upol_nickname" type="text" maxlength="100" autocomplete="off" placeholder="例如：灰嶺嚮導線">
              </label>
              <label class="upol-field">
                <span>補充 Persona</span>
                <textarea id="upol_content" rows="9" placeholder="只會額外注入，不修改原生 Persona 或聊天記錄。"></textarea>
              </label>
              <div class="upol-actions">
                <button id="upol_undo_last" class="upol-button" type="button">
                  <i class="fa-solid fa-rotate-left"></i> 撤回一步
                </button>
              </div>
            </section>

            <div class="upol-stack">
              <section class="upol-card">
                <div class="upol-follow-main"><i class="fa-solid fa-link"></i><span id="upol_follow_source">跟隨原生 Persona</span></div>
                <div class="upol-label" style="margin-top:6px">目前 Persona：<span id="upol_persona_name">（未知）</span></div>
                <div class="upol-plan-grid">
                  <div class="upol-plan-item"><span>位置</span><strong id="upol_plan_position">Prompt</strong></div>
                  <div class="upol-plan-item"><span>Depth</span><strong id="upol_plan_depth">2</strong></div>
                  <div class="upol-plan-item"><span>Role</span><strong id="upol_plan_role">System</strong></div>
                </div>
                <div id="upol_follow_warning" class="upol-warning upol-hidden"></div>
                <div id="upol_follow_comparison" class="upol-label" style="margin-top:9px"></div>
                <div class="upol-actions">
                  <button id="upol_refresh_follow" class="upol-button" type="button">重新讀取 Persona</button>
                </div>
              </section>

              <section class="upol-card">
                <div class="upol-card-title">最終 Prompt 預覽</div>
                <div class="upol-label upol-preview-note">原生使用者角色由 SillyTavern 注入；聊天專屬補充由 Lite 注入。</div>
                <textarea id="upol_preview" rows="8" readonly></textarea>
              </section>

              <section class="upol-card">
                <div class="upol-card-title">已追加模板</div>
                <div id="upol_applied_list" class="upol-list"></div>
              </section>
            </div>
          </div>

          <div data-upol-view="library" class="upol-hidden">
            <section id="upol_library_editor" class="upol-card upol-editor upol-hidden">
              <div class="upol-card-title"><span id="upol_library_editor_title">預覽 Persona 存檔</span></div>
              <label class="upol-field"><span>存檔名稱</span><input id="upol_library_edit_name" type="text"></label>
              <label class="upol-field"><span>暱稱</span><input id="upol_library_edit_nickname" type="text"></label>
              <label class="upol-field"><span>內容</span><textarea id="upol_library_edit_content" rows="8"></textarea></label>
              <div class="upol-actions">
                <button id="upol_library_edit_save" class="upol-button is-primary" type="button">儲存修改</button>
                <button id="upol_library_edit_close" class="upol-button" type="button">關閉</button>
              </div>
            </section>

            <section class="upol-card">
              <div class="upol-card-title">Persona 存檔</div>
              <div class="upol-library-create">
                <input id="upol_library_name" type="text" maxlength="100" placeholder="為目前 Persona 命名">
                <button id="upol_library_save_current" class="upol-button is-primary" type="button">新增存檔</button>
              </div>
              <div id="upol_library_list" class="upol-list"></div>
            </section>
          </div>
        </main>

        <footer class="upol-footer">資料直接沿用 chatMetadata 與 user_persona_overlay_library，不建立副本。</footer>
      </section>
    </div>
  `);
  $('body').append(panel);

  $('#upol_close').on('click', closePanel);
  panel.on('click', event => {
    if (event.target === panel.get(0)) {
      closePanel();
    }
  });
  $('.upol-tab').on('click', function () {
    setActiveTab($(this).data('upol-tab') === 'library' ? 'library' : 'chat');
  });
  $('#upol_enabled').on('change', function () {
    saveOverlayData({ enabled: Boolean((this as HTMLInputElement).checked) });
    refreshInjection();
  });
  $('#upol_nickname, #upol_content').on('input', scheduleTextSave);
  $('#upol_undo_last').on('click', undoLastTemplate);
  $('#upol_refresh_follow').on('click', () => {
    refreshInjection();
    notify('已重新讀取原生 Persona。');
  });
  $('#upol_library_save_current').on('click', saveCurrentToLibrary);
  $('#upol_library_edit_save').on('click', saveLibraryEditor);
  $('#upol_library_edit_close').on('click', closeLibraryEditor);
}

function ensureWandEntry(): void {
  if ($(`#${WAND_ID}`).length) {
    return;
  }
  const menu = $('#extensionsMenu');
  if (!menu.length) {
    return;
  }
  const item = $(
    `<div id="${WAND_ID}" class="list-group-item flex-container flexGap5" role="button" tabindex="0">
      <div class="fa-solid fa-user-pen extensionsMenuExtensionButton"></div>
      <span>Persona Overlay</span>
    </div>`,
  );
  const activate = (event: JQuery.TriggeredEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    menu.hide();
    openPanel();
  };
  item.on('click', activate);
  item.on('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      activate(event);
    }
  });
  menu.append(item);
}

function registerEvents(): void {
  eventOn(tavern_events.CHAT_CHANGED ?? 'chat_id_changed', () => {
    cancelTextSave();
    closeLibraryEditor();
    syncPanel();
    refreshInjection();
  });
  eventOn(tavern_events.PERSONA_CHANGED ?? 'persona_changed', () => {
    refreshInjection();
  });
  eventOn(tavern_events.GENERATION_AFTER_COMMANDS ?? 'GENERATION_AFTER_COMMANDS', () => {
    flushTextSave();
    refreshInjection();
  });
  eventOn(tavern_events.APP_READY ?? 'app_ready', ensureWandEntry);
}

function init(): void {
  ensureStyle();
  ensurePanel();
  ensureWandEntry();
  detectFullExtension();
  registerEvents();
  refreshInjection();
  console.info(LOG_PREFIX, '已載入；直接使用既有 Persona Overlay 資料。');
}

$(() => {
  try {
    init();
  } catch (error) {
    console.error(LOG_PREFIX, '載入失敗。', error);
    notify('Persona Overlay Lite 載入失敗，請查看 Console。', 'error');
  }
});

$(window).on('pagehide', () => {
  cancelTextSave();
  $(document).off('keydown.upol');
  $(`#${WAND_ID}, #${BACKDROP_ID}, #${STYLE_ID}`).remove();
});

$(document).on('keydown.upol', event => {
  if (event.key === 'Escape' && !$(`#${BACKDROP_ID}`).is('[hidden]')) {
    closePanel();
  }
});

export const personaOverlayLite = Object.freeze({
  open: openPanel,
  refresh: refreshInjection,
  promptKey: PROMPT_KEY,
  metadataKey: METADATA_KEY,
  defaults: DEFAULT_DATA,
});
