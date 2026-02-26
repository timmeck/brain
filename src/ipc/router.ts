import { getLogger } from '../utils/logger.js';

const logger = getLogger();
import type { ErrorService } from '../services/error.service.js';
import type { SolutionService } from '../services/solution.service.js';
import type { TerminalService } from '../services/terminal.service.js';
import type { PreventionService } from '../services/prevention.service.js';
import type { CodeService } from '../services/code.service.js';
import type { SynapseService } from '../services/synapse.service.js';
import type { ResearchService } from '../services/research.service.js';
import type { NotificationService } from '../services/notification.service.js';
import type { AnalyticsService } from '../services/analytics.service.js';
import type { LearningEngine, LearningCycleResult } from '../learning/learning-engine.js';

export interface Services {
  error: ErrorService;
  solution: SolutionService;
  terminal: TerminalService;
  prevention: PreventionService;
  code: CodeService;
  synapse: SynapseService;
  research: ResearchService;
  notification: NotificationService;
  analytics: AnalyticsService;
  learning?: LearningEngine;
}

type MethodHandler = (params: unknown) => unknown;

export class IpcRouter {
  private methods: Map<string, MethodHandler>;

  constructor(private services: Services) {
    this.methods = this.buildMethodMap();
  }

  handle(method: string, params: unknown): unknown {
    const handler = this.methods.get(method);
    if (!handler) {
      throw new Error(`Unknown method: ${method}`);
    }

    logger.debug(`IPC: ${method}`, { params });
    const result = handler(params);
    logger.debug(`IPC: ${method} → done`);
    return result;
  }

  listMethods(): string[] {
    return [...this.methods.keys()];
  }

  private buildMethodMap(): Map<string, MethodHandler> {
    const s = this.services;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (params: unknown) => params as any;

    return new Map<string, MethodHandler>([
      // Terminal Lifecycle
      ['terminal.register',       (params) => s.terminal.register(p(params))],
      ['terminal.heartbeat',      (params) => s.terminal.heartbeat(p(params).uuid)],
      ['terminal.disconnect',     (params) => s.terminal.disconnect(p(params).uuid)],

      // Error Brain
      ['error.report',            (params) => s.error.report(p(params))],
      ['error.query',             (params) => s.error.query(p(params))],
      ['error.match',             (params) => s.error.matchSimilar(p(params).error_id ?? p(params).errorId)],
      ['error.resolve',           (params) => s.error.resolve(p(params).error_id ?? p(params).errorId, p(params).solution_id ?? p(params).solutionId)],
      ['error.get',               (params) => s.error.getById(p(params).id)],

      // Solutions
      ['solution.report',         (params) => s.solution.report(p(params))],
      ['solution.query',          (params) => s.solution.findForError(p(params).error_id ?? p(params).errorId)],
      ['solution.rate',           (params) => s.solution.rateOutcome(p(params))],
      ['solution.attempt',        (params) => s.solution.rateOutcome({ ...p(params), success: false })],

      // Projects
      ['project.list',            () => s.code.listProjects()],

      // Code Brain
      ['code.analyze',            (params) => s.code.analyzeAndRegister(p(params))],
      ['code.find',               (params) => s.code.findReusable(p(params))],
      ['code.similarity',         (params) => s.code.checkSimilarity(p(params).source, p(params).language)],
      ['code.modules',            (params) => s.code.listModules(p(params)?.projectId, p(params)?.language, p(params)?.limit)],
      ['code.get',                (params) => s.code.getById(p(params).id)],

      // Prevention
      ['prevention.check',        (params) => s.prevention.checkRules(p(params).errorType, p(params).message, p(params).projectId)],
      ['prevention.antipatterns',  (params) => s.prevention.checkAntipatterns(p(params).errorType ?? '', p(params).message ?? p(params).error_output ?? '', p(params).projectId)],

      // Synapses
      ['synapse.context',         (params) => s.synapse.getErrorContext(p(params).errorId ?? p(params).error_id ?? p(params).node_id)],
      ['synapse.path',            (params) => s.synapse.findPath(p(params).from_type ?? p(params).fromType, p(params).from_id ?? p(params).fromId, p(params).to_type ?? p(params).toType, p(params).to_id ?? p(params).toId)],
      ['synapse.related',         (params) => s.synapse.getRelated(p(params))],
      ['synapse.stats',           () => s.synapse.getNetworkStats()],

      // Research / Insights
      ['research.insights',       (params) => s.research.getInsights(p(params))],
      ['research.suggest',        (params) => s.research.getInsights({ limit: 10, activeOnly: true, ...p(params) })],
      ['research.trends',         (params) => s.research.getTrends(p(params)?.projectId, p(params)?.windowDays)],

      // Notifications
      ['notification.list',       (params) => s.notification.list(p(params)?.projectId)],
      ['notification.ack',        (params) => s.notification.acknowledge(p(params).id)],

      // Analytics
      ['analytics.summary',       (params) => s.analytics.getSummary(p(params)?.projectId)],
      ['analytics.network',       (params) => s.analytics.getNetworkOverview(p(params)?.limit)],

      // Learning
      ['learning.run',            () => {
        if (!s.learning) throw new Error('Learning engine not available');
        return s.learning.runCycle();
      }],
    ]);
  }
}
