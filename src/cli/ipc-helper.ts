import { IpcClient } from '../ipc/client.js';
import { getPipeName } from '../utils/paths.js';

export async function withIpc<T>(fn: (client: IpcClient) => Promise<T>): Promise<T> {
  const client = new IpcClient(getPipeName(), 5000);
  try {
    await client.connect();
    return await fn(client);
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      console.error('Brain daemon is not running. Start it with: brain start');
    } else if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      console.error('Brain daemon is not responding. Try: brain stop && brain start');
    } else {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  } finally {
    client.disconnect();
  }
}
