import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DESIGN_CASES } from "./golden/design/cases.ts";
import { type GoldenCase, runGoldenCase } from "./golden/runner.ts";

const tools = join(import.meta.dir, "../tools");
const stageDir = "inception/ddd-domain-modeling/";
const model = `${stageDir}ddd-domain-model-yaml.md`;
const description = `${stageDir}ddd-domain-model.md`;

function modelCase(): GoldenCase {
  const original = DESIGN_CASES.find((entry) => entry.name === "clean-complete");
  if (!original) throw new Error("clean model fixture missing");
  return {
    ...original,
    files: {
      [model]: original.files[model],
      [description]: original.files[description],
    },
    output: model,
    expect: { pass: true, rules: [] },
  };
}

describe("registered model artifacts", () => {
  test("validates fenced YAML at the filenames resolved by AI-DLC", () => {
    const result = runGoldenCase(tools, modelCase());
    expect(result.problems).toEqual([]);
  });

  test("the surviving review document detects a missing data artifact", () => {
    const entry = modelCase();
    delete entry.files[model];
    entry.output = description;
    entry.expect = {
      pass: false,
      rules: ["model-completeness.schema"],
      files: { "model-completeness.schema": model },
    };
    expect(runGoldenCase(tools, entry).problems).toEqual([]);
  });

  test("the data artifact detects a missing review document", () => {
    const entry = modelCase();
    delete entry.files[description];
    entry.expect = { pass: false, rules: ["model-completeness.f-absent"] };
    expect(runGoldenCase(tools, entry).problems).toEqual([]);
  });

  test.each(["# YAMLなし\n", "```yaml\n[\n```\n", "```yaml\na: 1\n```\n```yaml\nb: 2\n```\n"])(
    "rejects malformed or ambiguous model data: %s",
    (content) => {
      const entry = modelCase();
      entry.files[model] = content;
      entry.expect = { pass: false, rules: ["model-completeness.schema"] };
      expect(runGoldenCase(tools, entry).problems).toEqual([]);
    },
  );
});
