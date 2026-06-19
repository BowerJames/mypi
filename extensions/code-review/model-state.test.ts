import { describe, expect, it } from "vitest";
import {
	buildCodeReviewPromptSuffix,
	CODE_REVIEW_MODEL_CUSTOM_TYPE,
	getCodeReviewModel,
	resolveCodeReviewModel,
} from "./model-state.js";

function makeEntry(type: string, customType?: string, data?: Record<string, unknown>) {
	return { type, ...(customType ? { customType } : {}), ...(data ? { data } : {}) };
}

function makeSessionManager(entries: ReturnType<typeof makeEntry>[]) {
	return { getEntries: () => entries };
}

describe("getCodeReviewModel", () => {
	it("returns undefined when there are no entries", () => {
		const result = getCodeReviewModel(makeSessionManager([]));
		expect(result).toBeUndefined();
	});

	it("returns undefined when no code-review-model entry exists", () => {
		const entries = [
			makeEntry("message"),
			makeEntry("custom", "mode", { mode: "plan" }),
			makeEntry("message"),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("returns the model from a single code-review-model entry", () => {
		const entries = [
			makeEntry("message"),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "claude-sonnet-4-20250514" }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBe("claude-sonnet-4-20250514");
	});

	it("returns the last code-review-model entry when multiple exist", () => {
		const entries = [
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "model-a" }),
			makeEntry("message"),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "model-b" }),
			makeEntry("message"),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "model-c" }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBe("model-c");
	});

	it("returns undefined when the last code-review-model entry has model: null", () => {
		const entries = [
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "claude-sonnet-4-20250514" }),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: null }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("returns undefined when the last code-review-model entry has model: empty string", () => {
		const entries = [
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "gpt-4o" }),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "" }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("skips earlier code-review-model entries when the last one is cleared", () => {
		const entries = [
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "model-a" }),
			makeEntry("message"),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "model-b" }),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: null }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("finds code-review-model among other custom entries", () => {
		const entries = [
			makeEntry("custom", "mode", { mode: "plan" }),
			makeEntry("message"),
			makeEntry("custom", "other-extension", { foo: "bar" }),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: "gemini-2.5-pro" }),
			makeEntry("custom", "mode", { mode: "develop" }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBe("gemini-2.5-pro");
	});

	it("ignores non-string model values", () => {
		const entries = [
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: 42 }),
			makeEntry("custom", CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: { id: "x" } }),
		];
		const result = getCodeReviewModel(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});
});

describe("buildCodeReviewPromptSuffix", () => {
	it("starts with double newline for clean appending", () => {
		const result = buildCodeReviewPromptSuffix("claude-sonnet-4-20250514");
		expect(result.startsWith("\n\n##")).toBe(true);
	});

	it("contains the Code Review heading", () => {
		const result = buildCodeReviewPromptSuffix("claude-sonnet-4-20250514");
		expect(result).toContain("## Code Review");
	});

	it("substitutes the model into --model", () => {
		const model = "zai/glm-5.2";
		const result = buildCodeReviewPromptSuffix(model);
		expect(result).toContain(`--model ${model}`);
	});

	it("includes the read-only tools restriction", () => {
		const result = buildCodeReviewPromptSuffix("claude-sonnet-4-20250514");
	});

	it("references the code-review prompt template and invocation", () => {
		const result = buildCodeReviewPromptSuffix("claude-sonnet-4-20250514");
		expect(result).toContain("--prompt-template code-review");
		expect(result).toContain(
			"/code-review <issue_number> <branch_to_review> <target_branch_of_pr>",
		);
	});

	it("uses mypi run -p to launch the review", () => {
		const result = buildCodeReviewPromptSuffix("claude-sonnet-4-20250514");
		expect(result).toContain("mypi run -p");
	});

	it("mentions the bash timeout guidance", () => {
		const result = buildCodeReviewPromptSuffix("claude-sonnet-4-20250514");
		expect(result).toContain("set the bash timeout to 1000 seconds");
	});

	it("falls back to the literal placeholder when model is undefined", () => {
		const result = buildCodeReviewPromptSuffix(undefined);
		expect(result).toContain("--model $codeReviewModel");
	});
});

describe("resolveCodeReviewModel", () => {
	it("returns the configured model when set", () => {
		const result = resolveCodeReviewModel("claude-sonnet-4-20250514", {
			provider: "openai",
			id: "gpt-4o",
		});
		expect(result).toBe("claude-sonnet-4-20250514");
	});

	it("ignores the active model when configured is set", () => {
		const result = resolveCodeReviewModel("configured-model", undefined);
		expect(result).toBe("configured-model");
	});

	it("falls back to provider/id when no configured model is set", () => {
		const result = resolveCodeReviewModel(null, { provider: "anthropic", id: "claude-3" });
		expect(result).toBe("anthropic/claude-3");
	});

	it("falls back to provider/id when configured is empty string", () => {
		const result = resolveCodeReviewModel("", { provider: "anthropic", id: "claude-3" });
		expect(result).toBe("anthropic/claude-3");
	});

	it("returns undefined when neither configured nor active model is available", () => {
		const result = resolveCodeReviewModel(null, undefined);
		expect(result).toBeUndefined();
	});

	it("returns undefined when configured is empty and no active model", () => {
		const result = resolveCodeReviewModel("", undefined);
		expect(result).toBeUndefined();
	});
});
