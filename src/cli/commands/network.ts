import { Command } from 'commander';
import { withIpc } from '../ipc-helper.js';

export function networkCommand(): Command {
  return new Command('network')
    .description('Explore the synapse network')
    .option('--node <type:id>', 'Node to explore (e.g., error:42)')
    .option('-l, --limit <n>', 'Max synapses to show', '20')
    .action(async (opts) => {
      await withIpc(async (client) => {
        if (opts.node) {
          const [nodeType, nodeIdStr] = opts.node.split(':');
          const nodeId = parseInt(nodeIdStr, 10);

          if (!nodeType || isNaN(nodeId)) {
            console.error('Invalid node format. Use: --node error:42');
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const related: any = await client.request('synapse.related', {
            nodeType,
            nodeId,
            maxDepth: 2,
          });

          if (!related?.length) {
            console.log(`No connections found for ${nodeType}:${nodeId}`);
            return;
          }

          console.log(`Connections from ${nodeType}:${nodeId}:\n`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const r of related as any[]) {
            console.log(`  → ${r.nodeType}:${r.nodeId} (weight: ${(r.activation ?? r.weight ?? 0).toFixed(3)})`);
          }
        } else {
          // Show general network stats
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stats: any = await client.request('synapse.stats', {});
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const overview: any = await client.request('analytics.network', {
            limit: parseInt(opts.limit, 10),
          });

          console.log('Synapse Network Overview:\n');
          console.log(`  Total synapses: ${stats.totalSynapses ?? 0}`);
          console.log(`  Average weight: ${(stats.avgWeight ?? 0).toFixed(3)}`);
          console.log();

          if (overview?.strongestSynapses?.length) {
            console.log('Strongest connections:');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const s of overview.strongestSynapses as any[]) {
              console.log(`  ${s.source} → ${s.target} [${s.type}] weight: ${(s.weight ?? 0).toFixed(3)}`);
            }
          }
        }
      });
    });
}
