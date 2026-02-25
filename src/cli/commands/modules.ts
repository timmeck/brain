import { Command } from 'commander';
import { withIpc } from '../ipc-helper.js';

export function modulesCommand(): Command {
  return new Command('modules')
    .description('List registered code modules')
    .option('--language <lang>', 'Filter by language')
    .action(async (opts) => {
      await withIpc(async (client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modules: any = await client.request('code.modules', {
          language: opts.language,
        });

        if (!modules?.length) {
          console.log('No code modules registered.');
          return;
        }

        console.log(`${modules.length} code modules:\n`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const mod of modules as any[]) {
          console.log(`  #${mod.id} [${mod.language}] ${mod.name}`);
          if (mod.description) console.log(`    ${mod.description.slice(0, 120)}`);
          console.log(`    File: ${mod.filePath}  Reusability: ${mod.reusabilityScore ?? '?'}`);
          console.log();
        }
      });
    });
}
