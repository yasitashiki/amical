import { describe, expect, it } from "vitest";
import {
  buildCustomPromptToggleShortcut,
  matchesCustomPromptToggleShortcut,
  resolveCustomPromptForSession,
} from "../../src/utils/custom-prompt";
import { MAC_KEYCODES, WINDOWS_KEYCODES } from "../../src/utils/keycodes";

describe("custom prompt shortcut helpers", () => {
  it("builds a distinct macOS shortcut by adding Cmd and Ctrl", () => {
    const toggleKeys = [MAC_KEYCODES.FN, MAC_KEYCODES.SPACE];

    expect(buildCustomPromptToggleShortcut(toggleKeys, "darwin")).toEqual([
      MAC_KEYCODES.SPACE,
      MAC_KEYCODES.CMD,
      MAC_KEYCODES.CTRL,
      MAC_KEYCODES.FN,
    ]);
  });

  it("matches the derived macOS shortcut exactly", () => {
    const toggleKeys = [MAC_KEYCODES.FN, MAC_KEYCODES.SPACE];

    expect(
      matchesCustomPromptToggleShortcut(
        [
          MAC_KEYCODES.SPACE,
          MAC_KEYCODES.FN,
          MAC_KEYCODES.CMD,
          MAC_KEYCODES.CTRL,
        ],
        toggleKeys,
        "darwin",
      ),
    ).toBe(true);

    expect(
      matchesCustomPromptToggleShortcut(
        [MAC_KEYCODES.FN, MAC_KEYCODES.SPACE],
        toggleKeys,
        "darwin",
      ),
    ).toBe(false);
  });

  it("builds the Windows variant by adding Win and Ctrl", () => {
    const toggleKeys = [WINDOWS_KEYCODES.ALT, WINDOWS_KEYCODES.SPACE];

    expect(buildCustomPromptToggleShortcut(toggleKeys, "win32")).toEqual([
      WINDOWS_KEYCODES.SPACE,
      WINDOWS_KEYCODES.WIN,
      WINDOWS_KEYCODES.CTRL,
      WINDOWS_KEYCODES.ALT,
    ]);
  });

  it("returns no distinct shortcut when the base shortcut already includes the modifiers", () => {
    const toggleKeys = [
      MAC_KEYCODES.CTRL,
      MAC_KEYCODES.CMD,
      MAC_KEYCODES.SPACE,
    ];

    expect(buildCustomPromptToggleShortcut(toggleKeys, "darwin")).toEqual([]);
    expect(
      matchesCustomPromptToggleShortcut(toggleKeys, toggleKeys, "darwin"),
    ).toBe(false);
  });
});

describe("resolveCustomPromptForSession", () => {
  it("returns the trimmed prompt only when the session flag is active", () => {
    const formatterConfig = {
      enabled: true,
      customSystemPrompt: "  Use polite Japanese.  ",
    };

    expect(resolveCustomPromptForSession(formatterConfig, true)).toBe(
      "Use polite Japanese.",
    );
    expect(resolveCustomPromptForSession(formatterConfig, false)).toBe(
      undefined,
    );
  });

  it("returns undefined for empty prompts", () => {
    expect(
      resolveCustomPromptForSession(
        {
          enabled: true,
          customSystemPrompt: "   ",
        },
        true,
      ),
    ).toBe(undefined);
  });
});
