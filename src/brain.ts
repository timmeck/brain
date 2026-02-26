import path from 'node:path';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { loadConfig } from './config.js';
import type { BrainConfig } from './types/config.types.js';
import { createLogger, getLogger } from './utils/logger.js';
import { getEventBus } from './utils/events.js';
import { createConnection } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';

// Repositories
import { ProjectRepository } from './db/repositories/project.repository.js';
import { ErrorRepository } from './db/repositories/error.repository.js';
import { SolutionRepository } from './db/repositories/solution.repository.js';
import { RuleRepository } from './db/repositories/rule.repository.js';
import { AntipatternRepository } from './db/repositories/antipattern.repository.js';
import { TerminalRepository } from './db/repositories/terminal.repository.js';
import { CodeModuleRepository } from './db/repositories/code-module.repository.js';
import { SynapseRepository } from './db/repositories/synapse.repository.js';
import { NotificationRepository } from './db/repositories/notification.repository.js';
import { InsightRepository } from './db/repositories/insight.repository.js';

// Services
import { ErrorService } from './services/error.service.js';
import { SolutionService } from './services/solution.service.js';
import { TerminalService } from './services/terminal.service.js';
import { PreventionService } from './services/prevention.service.js';
import { CodeService } from './services/code.service.js';
import { SynapseService } from './services/synapse.service.js';
import { ResearchService } from './services/research.service.js';
import { NotificationService } from './services/notification.service.js';
import { AnalyticsService } from './services/analytics.service.js';

// Synapses
import { SynapseManager } from './synapses/synapse-manager.js';

// Engines
import { LearningEngine } from './learning/learning-engine.js';
import { ResearchEngine } from './research/research-engine.js';

// IPC
import { IpcRouter, type Services } from './ipc/router.js';
import { IpcServer } from './ipc/server.js';

export class BrainCore {
  private db: Database.Database | null = null;
  private ipcServer: IpcServer | null = null;
  private learningEngine: LearningEngine | null = null;
  private researchEngine: ResearchEngine | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private config: BrainConfig | null = null;

  start(configPath?: string): void {
    // 1. Config
    this.config = loadConfig(configPath);
    const config = this.config;

    // 2. Ensure data dir
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

    // 3. Logger
    createLogger({
      level: config.log.level,
      file: config.log.file,
      maxSize: config.log.maxSize,
      maxFiles: config.log.maxFiles,
    });
    const logger = getLogger();

    // 4. Database
    this.db = createConnection(config.dbPath);
    runMigrations(this.db);
    logger.info(`Database initialized: ${config.dbPath}`);

    // 5. Repositories
    const projectRepo = new ProjectRepository(this.db);
    const errorRepo = new ErrorRepository(this.db);
    const solutionRepo = new SolutionRepository(this.db);
    const ruleRepo = new RuleRepository(this.db);
    const antipatternRepo = new AntipatternRepository(this.db);
    const terminalRepo = new TerminalRepository(this.db);
    const codeModuleRepo = new CodeModuleRepository(this.db);
    const synapseRepo = new SynapseRepository(this.db);
    const notificationRepo = new NotificationRepository(this.db);
    const insightRepo = new InsightRepository(this.db);

    // 6. Synapse Manager
    const synapseManager = new SynapseManager(synapseRepo, config.synapses);

    // 7. Services
    const services: Services = {
      error: new ErrorService(errorRepo, projectRepo, synapseManager),
      solution: new SolutionService(solutionRepo, synapseManager),
      terminal: new TerminalService(terminalRepo, config.terminal.staleTimeout),
      prevention: new PreventionService(ruleRepo, antipatternRepo, synapseManager),
      code: new CodeService(codeModuleRepo, projectRepo, synapseManager),
      synapse: new SynapseService(synapseManager),
      research: new ResearchService(insightRepo, errorRepo, synapseManager),
      notification: new NotificationService(notificationRepo),
      analytics: new AnalyticsService(
        errorRepo, solutionRepo, codeModuleRepo,
        ruleRepo, antipatternRepo, insightRepo,
        synapseManager,
      ),
    };

    // 8. Learning Engine
    this.learningEngine = new LearningEngine(
      config.learning, errorRepo, solutionRepo,
      ruleRepo, antipatternRepo, synapseManager,
    );
    this.learningEngine.start();
    logger.info(`Learning engine started (interval: ${config.learning.intervalMs}ms)`);

    // 9. Research Engine
    this.researchEngine = new ResearchEngine(
      config.research, errorRepo, solutionRepo, projectRepo,
      codeModuleRepo, synapseRepo, insightRepo, synapseManager,
    );
    this.researchEngine.start();
    logger.info(`Research engine started (interval: ${config.research.intervalMs}ms)`);

    // Expose learning engine to IPC
    services.learning = this.learningEngine;

    // 10. IPC Server
    const router = new IpcRouter(services);
    this.ipcServer = new IpcServer(router, config.ipc.pipeName);
    this.ipcServer.start();

    // 11. Terminal cleanup timer
    this.cleanupTimer = setInterval(() => {
      services.terminal.cleanup();
    }, 60_000);

    // 12. Event listeners (synapse wiring)
    this.setupEventListeners(services, synapseManager);

    // 13. PID file
    const pidPath = path.join(path.dirname(config.dbPath), 'brain.pid');
    fs.writeFileSync(pidPath, String(process.pid));

    // 14. Graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    logger.info(`Brain daemon started (PID: ${process.pid})`);
  }

  stop(): void {
    const logger = getLogger();
    logger.info('Shutting down...');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.researchEngine?.stop();
    this.learningEngine?.stop();
    this.ipcServer?.stop();
    this.db?.close();

    // Remove PID file
    if (this.config) {
      const pidPath = path.join(path.dirname(this.config.dbPath), 'brain.pid');
      try { fs.unlinkSync(pidPath); } catch { /* ignore */ }
    }

    logger.info('Brain daemon stopped');
    process.exit(0);
  }

  private setupEventListeners(services: Services, synapseManager: SynapseManager): void {
    const bus = getEventBus();

    // Error → Project synapse
    bus.on('error:reported', ({ errorId, projectId }) => {
      synapseManager.strengthen(
        { type: 'error', id: errorId },
        { type: 'project', id: projectId },
        'co_occurs',
      );
    });

    // Solution applied → strengthen or weaken
    bus.on('solution:applied', ({ errorId, solutionId, success }) => {
      if (success) {
        synapseManager.strengthen(
          { type: 'solution', id: solutionId },
          { type: 'error', id: errorId },
          'solves',
        );
      } else {
        const synapse = synapseManager.find(
          { type: 'solution', id: solutionId },
          { type: 'error', id: errorId },
          'solves',
        );
        if (synapse) synapseManager.weaken(synapse.id, 0.7);
      }
    });

    // Module registered → link to project
    bus.on('module:registered', ({ moduleId, projectId }) => {
      synapseManager.strengthen(
        { type: 'code_module', id: moduleId },
        { type: 'project', id: projectId },
        'co_occurs',
      );
    });

    // Rule learned → log
    bus.on('rule:learned', ({ ruleId, pattern }) => {
      getLogger().info(`New rule #${ruleId} learned: ${pattern}`);
    });

    // Insight created → log
    bus.on('insight:created', ({ insightId, type }) => {
      getLogger().info(`New insight #${insightId} (${type})`);
    });
  }
}
