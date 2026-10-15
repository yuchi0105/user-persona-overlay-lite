# 相容性與驗收備註

## 完整版 Extension 保持不變

Persona Overlay Lite 是獨立 Tavern Helper Script。開發 Lite 時未修改 `songyu4echo1106-code/user-persona-overlay`，也不修改使用者本機的完整版 Extension。

## Safari 風險紀錄

完整版 Extension 的 `bindFloatingIconDrag()` 使用 `pointerdown`、`pointermove`、`pointerup` 與 `setPointerCapture()`。先前在 iOS Safari 已有拖曳失效案例；此風險只記錄，不在本專案修改。Lite v1 沒有 floating icon，因此不受該拖曳路徑影響。

## Lite v1 設計限制

- 不使用 `MutationObserver`、`setInterval` 或 DOM 輪詢。
- 僅由 `CHAT_CHANGED`、`PERSONA_CHANGED`、`GENERATION_AFTER_COMMANDS` 與 `APP_READY` 驅動同步。
- 手機介面採 bottom sheet，原生輸入、捲動及關閉按鈕均保留。
- 不實作 P2「從其他聊天套用」。
