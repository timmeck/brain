import type { SynapsesConfig } from '../types/config.types.js';
import type { NodeType, SynapseType, SynapseRecord, NetworkStats } from '../types/synapse.types.js';
import type { SynapseRepository } from '../db/repositories/synapse.repository.js';
import { strengthen, weaken, type NodeRef } from './hebbian.js';
import { decayAll } from './decay.js';
import { spreadingActivation, type ActivationResult } from './activation.js';
import { findPath, type SynapsePath } from './pathfinder.js';
import { getLogger } from '../utils/logger.js';

export class SynapseManager {
  private logger = getLogger();

  constructor(
    private repo: SynapseRepository,
    private config: SynapsesConfig,
  ) {}

  strengthen(
    source: NodeRef,
    target: NodeRef,
    synapseType: SynapseType,
    context?: Record<string, unknown>,
  ): SynapseRecord {
    this.logger.debug(`Strengthening synapse ${source.type}:${source.id} --${synapseType}--> ${target.type}:${target.id}`);
    return strengthen(this.repo, source, target, synapseType, {
      initialWeight: this.config.initialWeight,
      learningRate: this.config.learningRate,
      pruneThreshold: this.config.pruneThreshold,
    }, context);
  }

  weaken(synapseId: number, factor: number = 0.5): void {
    this.logger.debug(`Weakening synapse ${synapseId} by factor ${factor}`);
    weaken(this.repo, synapseId, {
      initialWeight: this.config.initialWeight,
      learningRate: this.config.learningRate,
      pruneThreshold: this.config.pruneThreshold,
    }, factor);
  }

  find(
    source: NodeRef,
    target: NodeRef,
    synapseType: SynapseType,
  ): SynapseRecord | undefined {
    return this.repo.findBySourceTarget(
      source.type, source.id, target.type, target.id, synapseType,
    );
  }

  activate(
    startNode: NodeRef,
    maxDepth?: number,
    minWeight?: number,
  ): ActivationResult[] {
    return spreadingActivation(
      this.repo,
      startNode,
      maxDepth ?? this.config.maxDepth,
      minWeight ?? this.config.minActivationWeight,
    );
  }

  findPath(from: NodeRef, to: NodeRef, maxDepth?: number): SynapsePath | null {
    return findPath(this.repo, from, to, maxDepth ?? this.config.maxDepth + 2);
  }

  runDecay(): { decayed: number; pruned: number } {
    this.logger.info('Running synapse decay cycle');
    const result = decayAll(this.repo, {
      decayHalfLifeDays: this.config.decayHalfLifeDays,
      decayAfterDays: this.config.decayAfterDays,
      pruneThreshold: this.config.pruneThreshold,
    });
    this.logger.info(`Decay complete: ${result.decayed} decayed, ${result.pruned} pruned`);
    return result;
  }

  getErrorContext(errorId: number): {
    solutions: ActivationResult[];
    relatedErrors: ActivationResult[];
    relevantModules: ActivationResult[];
    preventionRules: ActivationResult[];
    insights: ActivationResult[];
  } {
    const all = this.activate({ type: 'error', id: errorId });
    return {
      solutions: all.filter(a => a.node.type === 'solution'),
      relatedErrors: all.filter(a => a.node.type === 'error'),
      relevantModules: all.filter(a => a.node.type === 'code_module'),
      preventionRules: all.filter(a => a.node.type === 'rule'),
      insights: all.filter(a => a.node.type === 'insight'),
    };
  }

  getStrongestSynapses(limit: number = 20): SynapseRecord[] {
    return this.repo.topByWeight(limit);
  }

  getDiverseSynapses(perType: number = 25): SynapseRecord[] {
    return this.repo.topDiverse(perType);
  }

  getNetworkStats(): NetworkStats {
    return {
      totalNodes: this.repo.countNodes(),
      totalSynapses: this.repo.totalCount(),
      avgWeight: this.repo.avgWeight(),
      nodesByType: {} as Record<NodeType, number>,
      synapsesByType: this.repo.countByType() as Record<SynapseType, number>,
    };
  }
}
