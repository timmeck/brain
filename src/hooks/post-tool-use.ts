#!/usr/bin/env node

// PostToolUse hook for Bash tool — auto-detects errors and reports to Brain
// Configured in .claude/settings.json:
// { "hooks": { "PostToolUse": [{ "matcher": { "tool_name": "Bash" }, "command": "node <brain-dist>/hooks/post-tool-use.js" }] } }

import { IpcClient } from '../ipc/client.js';
import { getPipeName } from '../utils/paths.js';

interface HookInput {
  tool_name: string;
  tool_input: { command?: string };
  tool_output: string;
  exit_code?: number;
}

const ERROR_PATTERNS = [
  /Error:/i,
  /error\[E\d+\]/,
  /Traceback \(most recent call last\)/,
  /FATAL|PANIC/i,
  /npm ERR!/,
  /SyntaxError|TypeError|ReferenceError|RangeError/,
  /ENOENT|EACCES|ECONNREFUSED|ETIMEDOUT/,
  /ModuleNotFoundError|ImportError/,
  /failed to compile/i,
  /BUILD FAILED/i,
  /Cannot find module/,
  /command not found/,
  /Permission denied/,
];

function isError(input: HookInput): boolean {
  if (input.exit_code !== undefined && input.exit_code !== 0) return true;
  return ERROR_PATTERNS.some(p => p.test(input.tool_output));
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function main(): Promise<void> {
  const raw = await readStdin();
  if (!raw.trim()) return;

  let input: HookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  if (!isError(input)) return;

  const client = new IpcClient(getPipeName(), 3000);
  try {
    await client.connect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.request('error.report', {
      project: 'auto-detected',
      errorOutput: input.tool_output,
    });

    if (result.matches?.length > 0) {
      const best = result.matches[0];
      process.stderr.write(`Brain: Similar error found (#${best.errorId}, ${Math.round(best.score * 100)}% match)\n`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const antipatterns: any = await client.request('prevention.antipatterns', {
      errorType: '',
      message: input.tool_output,
    });
    if (antipatterns?.length > 0 && antipatterns[0].matched) {
      process.stderr.write(`Brain WARNING: Known anti-pattern: ${antipatterns[0].description}\n`);
    }
  } catch {
    // Hook must never block workflow
  } finally {
    client.disconnect();
  }
}

main();
