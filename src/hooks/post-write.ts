#!/usr/bin/env node

// PostToolUse hook for Write/Edit tool — auto-analyzes code for reusability
// Configured in .claude/settings.json:
// { "hooks": { "PostToolUse": [{ "matcher": { "tool_name": "Write" }, "command": "node <brain-dist>/hooks/post-write.js" }] } }

import { IpcClient } from '../ipc/client.js';
import { getPipeName } from '../utils/paths.js';

interface HookInput {
  tool_name: string;
  tool_input: { file_path?: string; content?: string };
  tool_output: string;
}

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go',
  '.java', '.c', '.cpp', '.h', '.hpp', '.rb', '.sh',
]);

const IGNORE_PATHS = [
  'node_modules', 'dist', '.git', '__pycache__',
  'vendor', 'build', '.next', 'coverage',
];

function isSourceFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!SOURCE_EXTENSIONS.has(ext)) return false;
  return !IGNORE_PATHS.some(p => filePath.includes(p));
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    rb: 'ruby', sh: 'shell',
  };
  return map[ext] ?? ext;
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

  const filePath = input.tool_input?.file_path;
  if (!filePath || !isSourceFile(filePath)) return;

  const client = new IpcClient(getPipeName(), 3000);
  try {
    await client.connect();

    // Check for similar existing code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const similarities: any = await client.request('code.similarity', {
      source: input.tool_input.content ?? '',
      language: detectLanguage(filePath),
    });

    if (similarities?.length > 0) {
      const best = similarities[0];
      if (best.score > 0.8) {
        process.stderr.write(`Brain: Very similar code exists (module #${best.moduleId}, ${Math.round(best.score * 100)}% match). Consider reusing.\n`);
      }
    }
  } catch {
    // Hook must never block workflow
  } finally {
    client.disconnect();
  }
}

main();
