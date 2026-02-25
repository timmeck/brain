import type { ErrorRepository } from '../db/repositories/error.repository.js';
import type { SolutionRepository } from '../db/repositories/solution.repository.js';
import type { CodeModuleRepository } from '../db/repositories/code-module.repository.js';
import type { RuleRepository } from '../db/repositories/rule.repository.js';
import type { AntipatternRepository } from '../db/repositories/antipattern.repository.js';
import type { InsightRepository } from '../db/repositories/insight.repository.js';
import type { SynapseManager } from '../synapses/synapse-manager.js';
import type { NetworkStats } from '../types/synapse.types.js';

export interface ProjectSummary {
  errors: { total: number; unresolved: number; last7d: number };
  solutions: { total: number };
  rules: { active: number };
  antipatterns: { total: number };
  modules: { total: number };
  insights: { active: number };
}

export interface NetworkOverview {
  stats: NetworkStats;
  strongestSynapses: Array<{
    id: number;
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

export class AnalyticsService {
  constructor(
    private errorRepo: ErrorRepository,
    private solutionRepo: SolutionRepository,
    private codeModuleRepo: CodeModuleRepository,
    private ruleRepo: RuleRepository,
    private antipatternRepo: AntipatternRepository,
    private insightRepo: InsightRepository,
    private synapseManager: SynapseManager,
  ) {}

  getSummary(projectId?: number): ProjectSummary {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const unresolvedErrors = this.errorRepo.findUnresolved(projectId);
    const allErrors = projectId ? this.errorRepo.findByProject(projectId) : [];
    const last7dCount = this.errorRepo.countSince(sevenDaysAgo, projectId);

    const rules = this.ruleRepo.findActive(projectId);
    const antipatterns = projectId
      ? this.antipatternRepo.findByProject(projectId)
      : this.antipatternRepo.findGlobal();

    const moduleCount = projectId
      ? this.codeModuleRepo.findByProject(projectId).length
      : this.codeModuleRepo.countAll();
    const insights = this.insightRepo.findActive(projectId);

    return {
      errors: {
        total: allErrors.length,
        unresolved: unresolvedErrors.length,
        last7d: last7dCount,
      },
      solutions: { total: 0 }, // solutions are global, not per-project
      rules: { active: rules.length },
      antipatterns: { total: antipatterns.length },
      modules: { total: moduleCount },
      insights: { active: insights.length },
    };
  }

  getNetworkOverview(limit: number = 10): NetworkOverview {
    const stats = this.synapseManager.getNetworkStats();
    const strongest = this.synapseManager.getStrongestSynapses(limit);

    return {
      stats,
      strongestSynapses: strongest.map(s => ({
        id: s.id,
        source: `${s.source_type}:${s.source_id}`,
        target: `${s.target_type}:${s.target_id}`,
        type: s.synapse_type,
        weight: s.weight,
      })),
    };
  }
}
