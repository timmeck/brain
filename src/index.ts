#!/usr/bin/env node

import { Command } from 'commander';
import { startCommand } from './cli/commands/start.js';
import { stopCommand } from './cli/commands/stop.js';
import { statusCommand } from './cli/commands/status.js';
import { queryCommand } from './cli/commands/query.js';
import { modulesCommand } from './cli/commands/modules.js';
import { insightsCommand } from './cli/commands/insights.js';
import { networkCommand } from './cli/commands/network.js';
import { exportCommand } from './cli/commands/export.js';
import { importCommand } from './cli/commands/import.js';
import { dashboardCommand } from './cli/commands/dashboard.js';
import { learnCommand } from './cli/commands/learn.js';
import { configCommand } from './cli/commands/config.js';
import { projectsCommand } from './cli/commands/projects.js';
import { doctorCommand } from './cli/commands/doctor.js';

const program = new Command();

program
  .name('brain')
  .description('Brain — Adaptive Error Memory & Code Intelligence System')
  .version('1.2.0');

program.addCommand(startCommand());
program.addCommand(stopCommand());
program.addCommand(statusCommand());
program.addCommand(queryCommand());
program.addCommand(modulesCommand());
program.addCommand(insightsCommand());
program.addCommand(networkCommand());
program.addCommand(exportCommand());
program.addCommand(importCommand());
program.addCommand(dashboardCommand());
program.addCommand(learnCommand());
program.addCommand(configCommand());
program.addCommand(projectsCommand());
program.addCommand(doctorCommand());

// Hidden command: run MCP server (called by Claude Code)
program
  .command('mcp-server')
  .description('Start MCP server (stdio transport, used by Claude Code)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp/server.js');
    await startMcpServer();
  });

// Hidden command: run daemon in foreground (called by start command)
program
  .command('daemon')
  .description('Run daemon in foreground')
  .option('-c, --config <path>', 'Config file path')
  .action(async (opts) => {
    const { BrainCore } = await import('./brain.js');
    const core = new BrainCore();
    core.start(opts.config);
  });

program.parse();
