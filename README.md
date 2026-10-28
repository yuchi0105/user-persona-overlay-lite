# Persona Overlay Lite

Persona Overlay Lite 是 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 的 Tavern Helper 腳本。它替每個聊天保存一份 Supplemental Persona，生成時額外注入，但不修改原生 Persona、角色卡或聊天訊息。

本專案以 [`songyu4echo1106-code/user-persona-overlay`](https://github.com/songyu4echo1106-code/user-persona-overlay) 的資料格式與注入行為為唯一相容基準，並沿用 [`StageDog/tavern_helper_template`](https://github.com/StageDog/tavern_helper_template) 的 `src`／`dist` 專案結構。

## 安裝

下載並匯入 [`Persona Overlay Lite.json`](./Persona%20Overlay%20Lite.json) 至 Tavern Helper。腳本會從 jsDelivr 載入固定 commit 的 build：

```text
https://cdn.jsdelivr.net/gh/yuchi0105/user-persona-overlay-lite@c74510c929e398deb01c99a00d58dcf2d999f4b1/dist/persona-overlay-lite/index.js
```

安裝後由 SillyTavern 輸入欄旁的魔法棒開啟：

```text
魔法棒 → Persona Overlay
```

停用或重新載入腳本時，Lite 會撤掉自己的注入；若偵測到完整版 Extension 同時啟用，則保留共用的 Prompt。

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

預覽會像實際生成一樣展開 `{{user}}` 等巨集。這是完整效果的預覽；實際生成時，原生使用者角色仍由 SillyTavern 注入，Lite 只注入聊天專屬補充，避免同一份 Persona 重複出現在 Prompt。

## 撤回紀錄

「撤回一步」每次套用存檔都會保存一份套用前的內容。為避免聊天檔越來越大，`chatMetadata.user_persona_overlay_undo` 只保留最近 20 筆；開啟聊天時，超過上限的舊紀錄會自動裁掉。

撤回時會一併移除對應的「已追加模板」記錄；若套用後又手動修改過內容，會先詢問是否覆蓋。

## 開發

```bash
npm install
npm run check
npm run serve
```

`npm run check` 依序執行 typecheck、測試（含以 jsdom 模擬 Tavern Helper iframe 的行為測試）、production build，並確認 Script JSON 與 README 的 jsDelivr tag 和 `package.json` 版本一致。GitHub Actions 會在每次 push 執行相同檢查，並確認 `dist/` 已重新 build。

發版時先 commit 新的 `dist/`，再把 `Persona Overlay Lite.json` 與 README 的載入網址改成該 commit 的完整 hash（也可以改用 `v<版本>` tag，但 tag 必須先推上 GitHub，否則 jsDelivr 抓不到檔案）。`npm run check:release` 會確認載入的 commit 與目前 build 的 `dist/` 完全相同。

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

