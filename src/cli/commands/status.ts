import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../../utils/paths.js';
import { withIpc } from '../ipc-helper.js';
import { c, icons, header, keyValue, divider } from '../colors.js';
import { checkForUpdate, getCurrentVersion } from '../update-check.js';

export function statusCommand(): Command {
  return new Command('status')
    .description('Show Brain daemon status')
    .action(async () => {
      const pidPath = path.join(getDataDir(), 'brain.pid');

      if (!fs.existsSync(pidPath)) {
        console.log(`${icons.brain}  Brain Daemon: ${c.red.bold('NOT RUNNING')}`);
        return;
      }

      const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
      let running = false;
      try {
        process.kill(pid, 0);
        running = true;
      } catch { /* not running */ }

      if (!running) {
        console.log(`${icons.brain}  Brain Daemon: ${c.red.bold('NOT RUNNING')} ${c.dim('(stale PID file)')}`);
        return;
      }

      console.log(header(`Brain Status v${getCurrentVersion()}`, icons.brain));
      console.log(`  ${c.green(`${icons.dot} RUNNING`)} ${c.dim(`(PID ${pid})`)}`);

       
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

        console.log(keyValue('Database', `${dbPath} (${dbSize})`));
        console.log();

        console.log(`  ${icons.error}  ${c.purple.bold('Error Brain')}`);
        console.log(`     ${c.label('Errors:')}     ${c.value(summary.errors?.total ?? 0)} total, ${c.red(summary.errors?.unresolved ?? 0)} unresolved, ${c.dim(`${summary.errors?.last7d ?? 0} last 7d`)}`);
        console.log(`     ${c.label('Solutions:')}  ${c.value(summary.solutions?.total ?? 0)}`);
        console.log(`     ${c.label('Rules:')}      ${c.green(summary.rules?.active ?? 0)} active`);
        console.log(`     ${c.label('Anti-Pat.:')} ${c.value(summary.antipatterns?.total ?? 0)}`);
        console.log();

        console.log(`  ${icons.module}  ${c.blue.bold('Code Brain')}`);
        console.log(`     ${c.label('Modules:')}    ${c.value(summary.modules?.total ?? 0)} registered`);
        console.log();

        console.log(`  ${icons.synapse}  ${c.cyan.bold('Synapse Network')}`);
        console.log(`     ${c.label('Synapses:')}   ${c.value(network.totalSynapses ?? 0)}`);
        console.log(`     ${c.label('Avg weight:')} ${c.value((network.avgWeight ?? 0).toFixed(2))}`);
        console.log();

        console.log(`  ${icons.insight}  ${c.orange.bold('Research Brain')}`);
        console.log(`     ${c.label('Insights:')}   ${c.value(summary.insights?.active ?? 0)} active`);

        await checkForUpdate();
        console.log(`\n${divider()}`);
      });
    });
}
