export const DATA_VERSION = 1;

export const PROMPT_POSITIONS = Object.freeze({
  NONE: -1,
  IN_PROMPT: 0,
  IN_CHAT: 1,
  BEFORE_PROMPT: 2,
} as const);

export const PROMPT_ROLES = Object.freeze({
  SYSTEM: 0,
  USER: 1,
  ASSISTANT: 2,
} as const);

export const PERSONA_POSITIONS = Object.freeze({
  IN_PROMPT: 0,
  AFTER_CHAR: 1,
  TOP_AN: 2,
  BOTTOM_AN: 3,
  AT_DEPTH: 4,
  NONE: 9,
} as const);

export type PromptPosition = (typeof PROMPT_POSITIONS)[keyof typeof PROMPT_POSITIONS];
export type PromptRole = (typeof PROMPT_ROLES)[keyof typeof PROMPT_ROLES];

export type OverlayData = {
  version: 1;
  enabled: boolean;
  followPersona: true;
  nickname: string;
  content: string;
  position: PromptPosition;
  depth: number;
  role: PromptRole;
};

export type PersonaSettings = {
  position: number;
  depth: number;
  role: number;
};

export type InjectionConfig = {
  position: PromptPosition;
  depth: number;
  role: PromptRole;
};

export type InjectionPlan = InjectionConfig & {
  followed: boolean;
  source: 'helper' | 'power-user' | 'fallback';
  fallbackReason: string;
};

export type LibraryItem = {
  id: string;
  name: string;
  nickname: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type AppliedTemplate = {
  id: string;
  name: string;
  content: string;
};

export const DEFAULT_DATA: OverlayData = Object.freeze({
  version: DATA_VERSION,
  enabled: false,
  followPersona: true,
  nickname: '',
  content: '',
  position: PROMPT_POSITIONS.IN_PROMPT,
  depth: 2,
  role: PROMPT_ROLES.SYSTEM,
});

export function normalizeDepth(value: unknown): number {
  const number = Number.parseInt(String(value), 10);
  return Number.isNaN(number) ? DEFAULT_DATA.depth : Math.min(Math.max(number, 0), 999);
}

export function normalizeRole(value: unknown): PromptRole {
  const number = Number(value);
  return number === PROMPT_ROLES.USER || number === PROMPT_ROLES.ASSISTANT
    ? number
    : PROMPT_ROLES.SYSTEM;
}

export function normalizePosition(value: unknown): PromptPosition {
  const number = Number(value);
  return number === PROMPT_POSITIONS.IN_CHAT || number === PROMPT_POSITIONS.BEFORE_PROMPT
    ? number
    : PROMPT_POSITIONS.IN_PROMPT;
}

export function normalizeOverlay(raw: unknown): OverlayData {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DATA };
  }
  const value = raw as Record<string, unknown>;
  return {
    version: DATA_VERSION,
    enabled: Boolean(value.enabled),
    followPersona: true,
    nickname: typeof value.nickname === 'string' ? value.nickname : '',
    content: typeof value.content === 'string' ? value.content : '',
    position: normalizePosition(value.position),
    depth: normalizeDepth(value.depth),
    role: normalizeRole(value.role),
  };
}

export function buildInjectionText(data: OverlayData): string {
  if (!data.enabled || !data.content.trim()) {
    return '';
  }
  const name = data.nickname.trim() || 'the user';
  return `[Supplemental persona for ${name}]\n${data.content.trim()}`;
}

export function normalizePersonaSettings(raw: unknown): PersonaSettings | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const position = Number(value.position);
  const depth = Number.parseInt(String(value.depth), 10);
  const role = Number(value.role);
  if (!Number.isFinite(position) || Number.isNaN(depth) || !Number.isFinite(role)) {
    return null;
  }
  return { position, depth: normalizeDepth(depth), role: normalizeRole(role) };
}

export function personaSettingsEqual(left: PersonaSettings | null, right: PersonaSettings | null): boolean {
  return Boolean(
    left
      && right
      && left.position === right.position
      && left.depth === right.depth
      && left.role === right.role,
  );
}

export function mapPersonaSettings(settings: PersonaSettings | null): InjectionConfig | null {
  if (!settings) {
    return null;
  }
  if (settings.position === PERSONA_POSITIONS.IN_PROMPT) {
    return {
      position: PROMPT_POSITIONS.IN_PROMPT,
      depth: normalizeDepth(settings.depth),
      role: normalizeRole(settings.role),
    };
  }
  if (settings.position === PERSONA_POSITIONS.AT_DEPTH) {
    return {
      position: PROMPT_POSITIONS.IN_CHAT,
      depth: normalizeDepth(settings.depth),
      role: normalizeRole(settings.role),
    };
  }
  return null;
}

export function resolveInjectionPlan(
  data: OverlayData,
  nativeConfig: InjectionConfig | null,
  source: 'helper' | 'power-user' = 'power-user',
): InjectionPlan {
  if (nativeConfig) {
    return { ...nativeConfig, followed: true, source, fallbackReason: '' };
  }
  return {
    position: data.position,
    depth: data.depth,
    role: data.role,
    followed: false,
    source: 'fallback',
    fallbackReason:
      '目前的原生 Persona 位置無法精確鏡像，已使用此聊天保存的 fallback 配置。',
  };
}

export function normalizeLibrary(raw: unknown, now = Date.now()): LibraryItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.content === 'string',
    )
    .map(item => ({
      id: String(item.id),
      name: typeof item.name === 'string' ? item.name : '',
      nickname: typeof item.nickname === 'string' ? item.nickname : '',
      content: String(item.content),
      createdAt: Number(item.createdAt) || now,
      updatedAt: Number(item.updatedAt) || now,
    }));
}

export function normalizeUndoStack(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeAppliedTemplates(raw: unknown): AppliedTemplate[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.content === 'string',
    )
    .map(item => ({
      id: String(item.id),
      name: typeof item.name === 'string' ? item.name : '',
      content: String(item.content),
    }));
}

export function appendTemplateContent(currentContent: string, templateContent: string): string | null {
  const snapshot = templateContent.trim();
  if (!snapshot) {
    return null;
  }
  const current = currentContent.trim();
  return current ? `${current}\n\n${snapshot}` : snapshot;
}

export function removeAppliedSnapshot(content: string, snapshot: string): string | null {
  if (!snapshot) {
    return null;
  }
  if (content === snapshot) {
    return '';
  }
  if (content.startsWith(`${snapshot}\n\n`)) {
    return content.slice(snapshot.length + 2);
  }
  if (content.endsWith(`\n\n${snapshot}`)) {
    return content.slice(0, content.length - snapshot.length - 2);
  }
  const needle = `\n\n${snapshot}\n\n`;
  const index = content.indexOf(needle);
  if (index !== -1) {
    return `${content.slice(0, index)}\n\n${content.slice(index + needle.length)}`;
  }
  return null;
}
