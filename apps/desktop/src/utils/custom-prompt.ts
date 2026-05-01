import type { FormatterConfig } from "../types/formatter";
import { MAC_KEYCODES, WINDOWS_KEYCODES } from "./keycodes";

function normalizeUniqueKeys(keys: number[]): number[] {
  return [...new Set(keys)].sort((a, b) => a - b);
}

export function getCustomPromptModifierKeys(
  platform: NodeJS.Platform,
): number[] {
  if (platform === "darwin") {
    return [MAC_KEYCODES.CMD, MAC_KEYCODES.CTRL];
  }

  if (platform === "win32") {
    return [WINDOWS_KEYCODES.WIN, WINDOWS_KEYCODES.CTRL];
  }

  return [];
}

export function buildCustomPromptToggleShortcut(
  toggleKeys: number[],
  platform: NodeJS.Platform,
): number[] {
  const modifierKeys = getCustomPromptModifierKeys(platform);
  if (toggleKeys.length === 0 || modifierKeys.length === 0) {
    return [];
  }

  const normalizedToggleKeys = normalizeUniqueKeys(toggleKeys);
  const combinedKeys = normalizeUniqueKeys([
    ...normalizedToggleKeys,
    ...modifierKeys,
  ]);

  // If the base shortcut already contains all custom modifiers, there is no
  // distinct custom-prompt shortcut to detect.
  if (combinedKeys.length === normalizedToggleKeys.length) {
    return [];
  }

  return combinedKeys;
}

export function matchesCustomPromptToggleShortcut(
  activeKeys: number[],
  toggleKeys: number[],
  platform: NodeJS.Platform,
): boolean {
  const expectedKeys = buildCustomPromptToggleShortcut(toggleKeys, platform);
  if (expectedKeys.length === 0) {
    return false;
  }

  const normalizedActiveKeys = normalizeUniqueKeys(activeKeys);
  return (
    normalizedActiveKeys.length === expectedKeys.length &&
    expectedKeys.every((keyCode) => normalizedActiveKeys.includes(keyCode))
  );
}

export function resolveCustomPromptForSession(
  formatterConfig: FormatterConfig | null | undefined,
  customPromptActive: boolean,
): string | undefined {
  if (!customPromptActive) {
    return undefined;
  }

  const prompt = formatterConfig?.customSystemPrompt?.trim();
  return prompt ? prompt : undefined;
}
