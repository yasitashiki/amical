import { describe, expect, it } from "vitest";
import { buildFormattingPrompt } from "../../src/pipeline/providers/formatting/formatter-prompt";

describe("buildFormattingPrompt with customSystemPrompt", () => {
  it("does not include Additional Instructions when customSystemPrompt is undefined", () => {
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
    });

    expect(systemPrompt).not.toContain("## Additional Instructions");
  });

  it("does not include Additional Instructions when customSystemPrompt is empty", () => {
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
      customSystemPrompt: "",
    });

    expect(systemPrompt).not.toContain("## Additional Instructions");
  });

  it("does not include Additional Instructions when customSystemPrompt is whitespace only", () => {
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
      customSystemPrompt: "   \n  ",
    });

    expect(systemPrompt).not.toContain("## Additional Instructions");
  });

  it("appends Additional Instructions section when customSystemPrompt is set", () => {
    const customPrompt = "Always summarize the input in 3 bullet points.";
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
      customSystemPrompt: customPrompt,
    });

    expect(systemPrompt).toContain("## Additional Instructions");
    expect(systemPrompt).toContain(customPrompt);
  });

  it("places Additional Instructions before Output Format section", () => {
    const customPrompt = "Use polite Japanese.";
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
      customSystemPrompt: customPrompt,
    });

    const additionalIdx = systemPrompt.indexOf("## Additional Instructions");
    const outputIdx = systemPrompt.indexOf("## Output Format");

    expect(additionalIdx).toBeGreaterThan(-1);
    expect(outputIdx).toBeGreaterThan(-1);
    expect(additionalIdx).toBeLessThan(outputIdx);
  });

  it("preserves existing prompt content when customSystemPrompt is set", () => {
    const { systemPrompt } = buildFormattingPrompt({
      appType: "email",
      customSystemPrompt: "Be concise.",
    });

    expect(systemPrompt).toContain("# Text Formatting Task");
    expect(systemPrompt).toContain("## CRITICAL RULES");
    expect(systemPrompt).toContain("## Examples");
    expect(systemPrompt).toContain("## Output Format");
    expect(systemPrompt).toContain("## Additional Instructions");
    expect(systemPrompt).toContain("Be concise.");
    expect(systemPrompt).toContain("professional tone");
  });

  it("trims leading and trailing whitespace from customSystemPrompt", () => {
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
      customSystemPrompt: "  Summarize everything.  ",
    });

    expect(systemPrompt).toContain("Summarize everything.");

    const additionalIdx = systemPrompt.indexOf("## Additional Instructions");
    const afterAdditional = systemPrompt.slice(additionalIdx);
    expect(afterAdditional).not.toContain("  Summarize everything.  ");
  });

  it("uses a custom transformation prompt when customPromptMode is replace", () => {
    const { systemPrompt, userPrompt } = buildFormattingPrompt({
      appType: "default",
      customSystemPrompt: "Summarize the text into action items.",
      customPromptMode: "replace",
    });

    expect(systemPrompt).toContain("# Custom Dictation Transformation Task");
    expect(systemPrompt).toContain("## Custom Instructions");
    expect(systemPrompt).toContain("Summarize the text into action items.");
    expect(systemPrompt).toContain("<formatted_text>");
    expect(systemPrompt).not.toContain("You are a dictation formatter.");
    expect(systemPrompt).not.toContain("NEVER paraphrase, summarize, or rephrase the input.");
    expect(userPrompt("hello")).toBe("<input>hello</input>");
  });

  it("falls back to the built-in formatter prompt when replace mode has no custom prompt", () => {
    const { systemPrompt } = buildFormattingPrompt({
      appType: "default",
      customPromptMode: "replace",
    });

    expect(systemPrompt).toContain("# Text Formatting Task");
    expect(systemPrompt).not.toContain("# Custom Dictation Transformation Task");
  });
});
