import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../../utils/paths.js';
import { withIpc } from '../ipc-helper.js';

export function statusCommand(): Command {
  return new Command('status')
    .description('Show Brain daemon status')
    .action(async () => {
      const pidPath = path.join(getDataDir(), 'brain.pid');

      if (!fs.existsSync(pidPath)) {
        console.log('Brain Daemon: NOT RUNNING');
        return;
      }

      const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
      let running = false;
      try {
        process.kill(pid, 0);
        running = true;
      } catch { /* not running */ }

      if (!running) {
        console.log('Brain Daemon: NOT RUNNING (stale PID file)');
        return;
      }

      console.log(`Brain Daemon: RUNNING (PID ${pid})`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await withIpc(async (client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summary: any = await client.request('analytics.summary', {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const network: any = await client.request('synapse.stats', {});

        const dbPath = path.join(getDataDir(), 'brain.db');
        let dbSize = '?';
        try {
          const stat = fs.statSync(dbPath);
          dbSize = `${(stat.size / 1024 / 1024).toFixed(1)} MB`;
        } catch { /* ignore */ }

        console.log(`Database: ${dbPath} (${dbSize})`);
        console.log();

        console.log('Error Brain:');
        console.log(`  Errors: ${summary.errors?.total ?? 0} total, ${summary.errors?.unresolved ?? 0} unresolved, ${summary.errors?.last7d ?? 0} last 7d`);
        console.log(`  Solutions: ${summary.solutions?.total ?? 0}`);
        console.log(`  Rules: ${summary.rules?.active ?? 0} active`);
        console.log(`  Anti-Patterns: ${summary.antipatterns?.total ?? 0}`);
        console.log();

        console.log('Code Brain:');
        console.log(`  Modules: ${summary.modules?.total ?? 0} registered`);
        console.log();

        console.log('Synapse Network:');
        console.log(`  Synapses: ${network.totalSynapses ?? 0}`);
        console.log(`  Avg weight: ${(network.avgWeight ?? 0).toFixed(2)}`);
        console.log();

        console.log('Research Brain:');
        console.log(`  Insights: ${summary.insights?.active ?? 0} active`);
      });
    });
}
