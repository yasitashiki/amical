import { MAC_KEYCODES, WINDOWS_KEYCODES } from "./keycodes";

interface HardcodedShortcutPayload {
  keyCode: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export function matchesToggleRecordingNoClipboardShortcut(options: {
  activeKeys: number[];
  payload?: HardcodedShortcutPayload;
  eventType?: "keyDown" | "keyUp";
  platform: NodeJS.Platform;
}): boolean {
  const { activeKeys, payload, eventType, platform } = options;

  if (eventType !== "keyDown") {
    return false;
  }

  const f9KeyCode = platform === "win32" ? WINDOWS_KEYCODES.F9 : MAC_KEYCODES.F9;
  if (payload?.keyCode !== f9KeyCode || payload.ctrlKey !== true) {
    return false;
  }

  // Keep the hardcoded shortcut as an exact Ctrl+F9 match so it does not
  // re-fire while releasing extra modifiers from other shortcuts.
  if (payload.metaKey || payload.altKey || payload.shiftKey) {
    return false;
  }

  const controlKeyCodes =
    platform === "win32"
      ? [WINDOWS_KEYCODES.CTRL, WINDOWS_KEYCODES.RCTRL]
      : [MAC_KEYCODES.CTRL, MAC_KEYCODES.RCTRL];

  return (
    activeKeys.length === 2 &&
    activeKeys.includes(f9KeyCode) &&
    controlKeyCodes.some((keyCode) => activeKeys.includes(keyCode))
  );
}
