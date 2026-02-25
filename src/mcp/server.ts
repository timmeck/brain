import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { IpcClient } from '../ipc/client.js';
import { getPipeName } from '../utils/paths.js';
import { registerTools } from './tools.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'brain',
    version: '1.0.0',
  });

  const ipc = new IpcClient(getPipeName());

  try {
    await ipc.connect();
  } catch (err) {
    process.stderr.write(`Brain: Could not connect to daemon (${err instanceof Error ? err.message : err}). Is brain daemon running?\n`);
    process.exit(1);
  }

  registerTools(server, ipc);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', () => {
    ipc.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    ipc.disconnect();
    process.exit(0);
  });
}
