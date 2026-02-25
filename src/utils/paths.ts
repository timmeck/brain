import path from 'node:path';
import os from 'node:os';

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function getDataDir(): string {
  const envDir = process.env['BRAIN_DATA_DIR'];
  if (envDir) return path.resolve(envDir);
  return path.join(os.homedir(), '.brain');
}

export function getPipeName(name: string = 'brain'): string {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\${name}`;
  }
  return path.join(os.tmpdir(), `${name}.sock`);
}
