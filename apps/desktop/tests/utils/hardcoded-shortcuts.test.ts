import { describe, expect, it } from "vitest";
import { matchesToggleRecordingNoClipboardShortcut } from "../../src/utils/hardcoded-shortcuts";
import { MAC_KEYCODES } from "../../src/utils/keycodes";

describe("matchesToggleRecordingNoClipboardShortcut", () => {
  it("matches an exact Ctrl+F9 keyDown", () => {
    expect(
      matchesToggleRecordingNoClipboardShortcut({
        activeKeys: [MAC_KEYCODES.CTRL, MAC_KEYCODES.F9],
        payload: {
          keyCode: MAC_KEYCODES.F9,
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        },
        eventType: "keyDown",
        platform: "darwin",
      }),
    ).toBe(true);
  });

  it("does not match when releasing Cmd after Cmd+Ctrl+F9", () => {
    expect(
      matchesToggleRecordingNoClipboardShortcut({
        activeKeys: [MAC_KEYCODES.CTRL, MAC_KEYCODES.F9],
        payload: {
          keyCode: MAC_KEYCODES.CMD,
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        },
        eventType: "keyUp",
        platform: "darwin",
      }),
    ).toBe(false);
  });

  it("does not match Cmd+Ctrl+F9 keyDown with extra modifiers", () => {
    expect(
      matchesToggleRecordingNoClipboardShortcut({
        activeKeys: [
          MAC_KEYCODES.CTRL,
          MAC_KEYCODES.CMD,
          MAC_KEYCODES.F9,
        ],
        payload: {
          keyCode: MAC_KEYCODES.F9,
          ctrlKey: true,
          metaKey: true,
          altKey: false,
          shiftKey: false,
        },
        eventType: "keyDown",
        platform: "darwin",
      }),
    ).toBe(false);
  });
});
