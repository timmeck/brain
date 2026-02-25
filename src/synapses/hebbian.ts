import type { SynapseRecord, NodeType, SynapseType } from '../types/synapse.types.js';
import type { SynapseRepository } from '../db/repositories/synapse.repository.js';

export interface HebbianConfig {
  initialWeight: number;
  learningRate: number;
  pruneThreshold: number;
}

export interface NodeRef {
  type: NodeType;
  id: number;
}

export function strengthen(
  repo: SynapseRepository,
  source: NodeRef,
  target: NodeRef,
  synapseType: SynapseType,
  config: HebbianConfig,
  context?: Record<string, unknown>,
): SynapseRecord {
  const existing = repo.findBySourceTarget(
    source.type, source.id, target.type, target.id, synapseType,
  );

  if (existing) {
    // Hebbian: weight grows logarithmically, saturates at 1.0
    const newWeight = Math.min(
      1.0,
      existing.weight + (1.0 - existing.weight) * config.learningRate,
    );
    repo.update(existing.id, {
      weight: newWeight,
      activation_count: existing.activation_count + 1,
      last_activated_at: new Date().toISOString(),
    });
    return { ...existing, weight: newWeight, activation_count: existing.activation_count + 1 };
  }

  const id = repo.create({
    source_type: source.type,
    source_id: source.id,
    target_type: target.type,
    target_id: target.id,
    synapse_type: synapseType,
    weight: config.initialWeight,
    metadata: context ? JSON.stringify(context) : null,
  });

  return repo.getById(id)!;
}

export function weaken(
  repo: SynapseRepository,
  synapseId: number,
  config: HebbianConfig,
  factor: number = 0.5,
): void {
  const synapse = repo.getById(synapseId);
  if (!synapse) return;

  const newWeight = synapse.weight * factor;
  if (newWeight < config.pruneThreshold) {
    repo.delete(synapseId);
  } else {
    repo.update(synapseId, { weight: newWeight });
  }
}
