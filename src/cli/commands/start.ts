import { Command } from 'commander';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../../utils/paths.js';
import { c, icons } from '../colors.js';
import { checkForUpdate } from '../update-check.js';

export function startCommand(): Command {
  return new Command('start')
    .description('Start the Brain daemon')
    .option('-f, --foreground', 'Run in foreground (no detach)')
    .option('-c, --config <path>', 'Config file path')
    .action((opts) => {
      const pidPath = path.join(getDataDir(), 'brain.pid');

      // Check if already running
      if (fs.existsSync(pidPath)) {
        const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
        try {
          process.kill(pid, 0); // Check if process exists
          console.log(`${icons.brain}  Brain daemon is ${c.green('already running')} ${c.dim(`(PID: ${pid})`)}`);
          return;
        } catch {
          // PID file stale, remove it
          fs.unlinkSync(pidPath);
        }
      }

      if (opts.foreground) {
        // Run in foreground — import dynamically to avoid loading everything at CLI parse time
        import('../../brain.js').then(({ BrainCore }) => {
          const core = new BrainCore();
          core.start(opts.config);
        });
        return;
      }

      // Spawn detached daemon
      const args = ['daemon'];
      if (opts.config) args.push('-c', opts.config);

      const entryPoint = path.resolve(import.meta.dirname, '../../index.js');
      const child = spawn(process.execPath, [entryPoint, ...args], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      console.log(`${icons.brain}  ${c.info('Brain daemon starting')} ${c.dim(`(PID: ${child.pid})`)}`);

      // Wait briefly for PID file to appear
      setTimeout(async () => {
        if (fs.existsSync(pidPath)) {
          console.log(`${icons.ok}  ${c.success('Brain daemon started successfully.')}`);
        } else {
          console.log(`${icons.clock}  ${c.warn('Brain daemon may still be starting.')} Check: ${c.cyan('brain status')}`);
        }
        await checkForUpdate();
      }, 1000);
    });
}
