import { Command } from 'commander';
import { withIpc } from '../ipc-helper.js';

export function insightsCommand(): Command {
  return new Command('insights')
    .description('Show research insights')
    .option('--type <type>', 'Filter by type: trend, pattern, gap, synergy, optimization, template_candidate, project_suggestion, warning')
    .option('-l, --limit <n>', 'Maximum results', '20')
    .action(async (opts) => {
      await withIpc(async (client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insights: any = await client.request('research.insights', {
          type: opts.type,
          activeOnly: true,
          limit: parseInt(opts.limit, 10),
        });

        if (!insights?.length) {
          console.log('No active insights.');
          return;
        }

        console.log(`${insights.length} insights:\n`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const ins of insights as any[]) {
          const priority = ins.priority >= 8 ? 'HIGH' : ins.priority >= 5 ? 'MEDIUM' : 'LOW';
          console.log(`  [${ins.type}] [${priority}] ${ins.title}`);
          if (ins.description) console.log(`    ${ins.description.slice(0, 150)}`);
          console.log();
        }
      });
    });
}
