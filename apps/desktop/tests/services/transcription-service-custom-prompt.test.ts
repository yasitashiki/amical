import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_TYPES } from "../../src/constants/provider-types";
import { getModelSelectionKey } from "../../src/utils/model-selection";

const createRemoteFormattingProviderMock = vi.fn();

vi.mock("../../src/main/logger", () => ({
  logger: {
    transcription: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    main: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

vi.mock("../../src/pipeline/providers/transcription/whisper-provider", () => ({
  WhisperProvider: vi.fn().mockImplementation(function () {
    return {
      name: "whisper-local",
      preloadModel: vi.fn(),
      getBindingInfo: vi.fn(),
      transcribe: vi.fn(),
      flush: vi.fn(),
      reset: vi.fn(),
    };
  }),
}));

vi.mock(
  "../../src/pipeline/providers/transcription/amical-cloud-provider",
  () => ({
    AmicalCloudProvider: vi.fn().mockImplementation(function () {
      return {
        name: "amical-cloud",
        transcribe: vi.fn(),
        flush: vi.fn(),
        reset: vi.fn(),
      };
    }),
  }),
);

vi.mock(
  "../../src/pipeline/providers/formatting/remote-formatting-provider-registry",
  () => ({
    createRemoteFormattingProvider: createRemoteFormattingProviderMock,
  }),
);

vi.mock("../../src/db/transcriptions", () => ({
  createTranscription: vi.fn(),
  getTranscriptionById: vi.fn(),
  updateTranscription: vi.fn(),
}));

vi.mock("../../src/db/daily-stats", () => ({
  incrementDailyStats: vi.fn(),
}));

vi.mock("../../src/db/vocabulary", () => ({
  getVocabulary: vi.fn().mockResolvedValue([]),
}));

describe("TranscriptionService custom prompt formatting", () => {
  const providerInstanceId = "system-openrouter";
  const modelId = "gpt-4o-mini";
  const selectionValue = getModelSelectionKey(
    providerInstanceId,
    "language",
    modelId,
  );

  const baseFormatterConfig = {
    enabled: true,
    modelId: selectionValue,
    customSystemPrompt: "  Use polite Japanese.  ",
  };

  const remoteModel = {
    providerType: PROVIDER_TYPES.openRouter,
    providerInstanceId,
    provider: "OpenRouter",
    type: "language",
    id: modelId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the custom prompt to the formatter only for custom-prompt sessions", async () => {
    const { TranscriptionService } = await import(
      "../../src/services/transcription-service"
    );
    const formatMock = vi.fn().mockResolvedValue("formatted text");
    createRemoteFormattingProviderMock.mockResolvedValue({
      name: "mock-formatter",
      format: formatMock,
    });

    const settingsService = {
      getFormatterConfig: vi.fn().mockResolvedValue(baseFormatterConfig),
      getDefaultLanguageModel: vi.fn().mockResolvedValue(selectionValue),
    };
    const modelService = {
      getSyncedProviderModels: vi.fn().mockResolvedValue([remoteModel]),
    };

    const service = new TranscriptionService(
      modelService as any,
      null as any,
      settingsService as any,
      {} as any,
      null,
      null,
    );

    await (service as any).applyFormattingAndReplacements({
      text: "hello world",
      usedCloudProvider: false,
      replacements: new Map(),
      customPromptActive: true,
    });

    expect(formatMock).toHaveBeenCalledTimes(1);
    expect(formatMock.mock.calls[0][0].context.customSystemPrompt).toBe(
      "Use polite Japanese.",
    );
    expect(formatMock.mock.calls[0][0].context.customPromptMode).toBe(
      "replace",
    );
  });

  it("skips formatting entirely for normal sessions even when formatter is configured", async () => {
    const { TranscriptionService } = await import(
      "../../src/services/transcription-service"
    );
    const formatMock = vi.fn().mockResolvedValue("formatted text");
    createRemoteFormattingProviderMock.mockResolvedValue({
      name: "mock-formatter",
      format: formatMock,
    });

    const settingsService = {
      getFormatterConfig: vi.fn().mockResolvedValue(baseFormatterConfig),
      getDefaultLanguageModel: vi.fn().mockResolvedValue(selectionValue),
    };
    const modelService = {
      getSyncedProviderModels: vi.fn().mockResolvedValue([remoteModel]),
    };

    const service = new TranscriptionService(
      modelService as any,
      null as any,
      settingsService as any,
      {} as any,
      null,
      null,
    );

    const result = await (service as any).applyFormattingAndReplacements({
      text: "hello world",
      usedCloudProvider: false,
      replacements: new Map(),
      formattingAllowed: false,
      customPromptActive: false,
    });

    expect(formatMock).not.toHaveBeenCalled();
    expect(result.text).toBe("hello world");
    expect(result.formattingUsed).toBe(false);
  });
});
