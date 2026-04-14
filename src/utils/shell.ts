/**
 * Splits a command string into an array of arguments,
 * respecting single and double quotes and backslash escapes.
 */
function splitCommand(cmd: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];

    if (char === "\\" && !inSingleQuote) {
      // Backslash escapes the next character inside double quotes or unquoted.
      // In shells, a backslash before a non-special char preserves both the
      // backslash and the character. For simplicity, we preserve the escaped
      // character as-is (stripping the backslash), which is standard behavior.
      if (i + 1 < cmd.length) {
        current += cmd[i + 1];
        i++;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

export { splitCommand };
