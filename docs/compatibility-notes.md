# 相容性與驗收備註

## 完整版 Extension 保持不變

Persona Overlay Lite 是獨立 Tavern Helper Script。開發 Lite 時未修改 `songyu4echo1106-code/user-persona-overlay`，也不修改使用者本機的完整版 Extension。

## Safari 風險紀錄

完整版 Extension 的 `bindFloatingIconDrag()` 使用 `pointerdown`、`pointermove`、`pointerup` 與 `setPointerCapture()`。先前在 iOS Safari 已有拖曳失效案例；此風險只記錄，不在本專案修改。Lite v1 沒有 floating icon，因此不受該拖曳路徑影響。

## Lite v1 設計限制

- 不使用 `MutationObserver`、`setInterval` 或 DOM 輪詢。
- 僅由 `CHAT_CHANGED`、`PERSONA_CHANGED`、`GENERATION_AFTER_COMMANDS`、`APP_READY` 與腳本按鈕事件驅動同步。
- 腳本跑在 Tavern Helper 的 iframe 內：`$` 指向酒館主頁面，`window`／`document` 則是 iframe 自己的；鍵盤事件綁在 `window.parent.document`。
- `pagehide` 時撤掉 `user_persona_overlay` 注入；偵測到完整版 Extension 時保留，避免清掉它的 Prompt。
- 撤回紀錄上限 20 筆，只裁掉最舊的紀錄，schema 與完整版相同。
- 手機介面採 bottom sheet，原生輸入、捲動及關閉按鈕均保留。
- 不實作 P2「從其他聊天套用」。
