import { Command } from 'commander';
import { withIpc } from '../ipc-helper.js';

export function queryCommand(): Command {
  return new Command('query')
    .description('Search for errors and solutions')
    .argument('<search>', 'Error message or description to search for')
    .option('-l, --limit <n>', 'Maximum results', '10')
    .action(async (search: string, opts) => {
      await withIpc(async (client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any = await client.request('error.query', {
          search,
          limit: parseInt(opts.limit, 10),
        });

        if (!results?.length) {
          console.log('No matching errors found.');
          return;
        }

        console.log(`Found ${results.length} errors:\n`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const err of results as any[]) {
          const status = err.resolved ? 'RESOLVED' : 'OPEN';
          console.log(`  #${err.id} [${status}] ${err.errorType ?? 'unknown'}`);
          console.log(`    ${(err.message ?? '').slice(0, 120)}`);

          // Get solutions for this error
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const solutions: any = await client.request('solution.query', { error_id: err.id });
          if (solutions?.length > 0) {
            console.log(`    Solutions: ${solutions.length}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const sol of solutions.slice(0, 3) as any[]) {
              console.log(`      - #${sol.id}: ${(sol.description ?? '').slice(0, 100)}`);
            }
          }
          console.log();
        }
      });
    });
}
