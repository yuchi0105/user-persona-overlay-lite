# Persona Overlay Lite

Persona Overlay Lite 是 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 的 Tavern Helper 腳本。它替每個聊天保存一份 Supplemental Persona，生成時額外注入，但不修改原生 Persona、角色卡或聊天訊息。

本專案以 [`songyu4echo1106-code/user-persona-overlay`](https://github.com/songyu4echo1106-code/user-persona-overlay) 的資料格式與注入行為為唯一相容基準，並沿用 [`StageDog/tavern_helper_template`](https://github.com/StageDog/tavern_helper_template) 的 `src`／`dist` 專案結構。

## 安裝

下載並匯入 [`Persona Overlay Lite.json`](./Persona%20Overlay%20Lite.json) 至 Tavern Helper。腳本會從 jsDelivr 載入：

```text
https://cdn.jsdelivr.net/gh/yuchi0105/user-persona-overlay-lite@v1.0.2/dist/persona-overlay-lite/index.js
```

安裝後由 SillyTavern 輸入欄旁的魔法棒開啟：

```text
魔法棒 → Persona Overlay
```

## Zero-copy 相容

Lite 不建立另一套聊天變數，也不搬移或轉換資料，直接讀寫完整版 Extension 的既有 key：

```text
chatMetadata.user_persona_overlay
chatMetadata.user_persona_overlay_undo
chatMetadata.user_persona_overlay_applied_templates
localStorage["user_persona_overlay_library"]
```

Extension 與 Lite 共用 `setExtensionPrompt` ID `user_persona_overlay`，即使同時啟用也只會更新同一份 Prompt，不會建立第二份 Supplemental Persona。

## Follow 規則

- 原生 `IN_PROMPT` → Overlay `IN_PROMPT`
- 原生 `AT_DEPTH` → Overlay `IN_CHAT`，同步 `depth` 與 `role`
- `AFTER_CHAR`、`TOP_AN`、`BOTTOM_AN`、`NONE` 或未知位置 → 使用該聊天既有的 `position/depth/role` fallback

Lite 會比較 Tavern Helper `getPersona('current')` 與 SillyTavern `powerUserSettings`。三項生效配置一致時使用 Helper API；不同時採用完整版 Extension 已驗證的 `powerUserSettings`。

## 最終 Prompt 預覽

面板的「最終 Prompt 預覽」會合併顯示：

1. 目前選擇的 SillyTavern 原生使用者角色內容
2. 此聊天已啟用的 Supplemental Persona

這是完整效果的預覽。實際生成時，原生使用者角色仍由 SillyTavern 注入，Lite 只注入聊天專屬補充，避免同一份 Persona 重複出現在 Prompt。

## 開發

```bash
npm install
npm run check
npm run serve
```

主要路徑：

```text
src/persona-overlay-lite/index.ts
dist/persona-overlay-lite/index.js
```

`npm run serve` 會在本機啟動含 CORS header 的零依賴開發伺服器。開發版 Script JSON 可將 import URL 暫時改為：

```text
http://localhost:5500/dist/persona-overlay-lite/index.js
```

## v1 範圍

包含目前聊天編輯、Follow 狀態、Preview、Persona 存檔、追加模板、安全撤銷與事件同步。不包含跨聊天套用、懸浮魚、Extension Settings、Server plugin、MutationObserver 或輪詢。

