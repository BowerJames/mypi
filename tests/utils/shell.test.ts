import { describe, expect, test } from "bun:test";
import { splitCommand } from "../../src/utils/shell.js";

describe("splitCommand", () => {
  test("splits simple command", () => {
    expect(splitCommand("pi")).toEqual(["pi"]);
  });

  test("splits command with flags", () => {
    expect(splitCommand("pi -p")).toEqual(["pi", "-p"]);
  });

  test("splits command with multiple flags", () => {
    expect(splitCommand("pi --print --verbose")).toEqual([
      "pi",
      "--print",
      "--verbose",
    ]);
  });

  test("handles single-quoted arguments", () => {
    expect(splitCommand("pi --arg 'hello world'")).toEqual([
      "pi",
      "--arg",
      "hello world",
    ]);
  });

  test("handles double-quoted arguments", () => {
    expect(splitCommand('pi --arg "hello world"')).toEqual([
      "pi",
      "--arg",
      "hello world",
    ]);
  });

  test("handles empty string", () => {
    expect(splitCommand("")).toEqual([]);
  });

  test("handles extra whitespace", () => {
    expect(splitCommand("  pi   -p  ")).toEqual(["pi", "-p"]);
  });

  test("handles mixed quotes", () => {
    expect(splitCommand("pi 'single' \"double\"")).toEqual([
      "pi",
      "single",
      "double",
    ]);
  });

  test("handles quotes with spaces inside words", () => {
    expect(splitCommand('cmd "arg with spaces" another')).toEqual([
      "cmd",
      "arg with spaces",
      "another",
    ]);
  });
});
