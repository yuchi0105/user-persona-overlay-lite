declare module '*?raw' {
  const content: string;
  export default content;
}

type TavernPersona = {
  position: number;
  depth: number;
  role: number;
  name?: string;
  description?: string;
};

type TavernContext = {
  name2?: string;
  chatId?: string;
  chatMetadata?: Record<string, unknown>;
  powerUserSettings?: Record<string, unknown>;
  extensionPrompts?: Record<string, { value?: string }>;
  getCurrentChatId?: () => string;
  substituteParams?: (content: string) => string;
  saveMetadataDebounced?: () => void | Promise<void>;
  saveMetadata?: () => void | Promise<void>;
  callGenericPopup?: (content: string | Element, type: number) => Promise<unknown>;
  POPUP_TYPE?: { CONFIRM: number };
  POPUP_RESULT?: { AFFIRMATIVE: number };
  setExtensionPrompt: (
    promptId: string,
    content: string,
    position: -1 | 0 | 1 | 2,
    depth: number,
    scan?: boolean,
    role?: number,
  ) => void | Promise<void>;
};

declare const SillyTavern: TavernContext & { getContext?: () => TavernContext };
declare function getPersona(personaId: 'current' | string): TavernPersona;
declare function getCurrentPersonaName(): string | null;
declare function eventOn(eventType: string, listener: (...args: unknown[]) => void): { stop: () => void };
declare const tavern_events: Record<string, string>;

