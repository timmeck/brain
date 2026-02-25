import type { SynapseRepository } from '../db/repositories/synapse.repository.js';

export interface DecayConfig {
  decayHalfLifeDays: number;
  decayAfterDays: number;
  pruneThreshold: number;
}

export function timeDecayFactor(lastActivatedAt: string, halfLifeDays: number): number {
  const now = Date.now();
  const activated = new Date(lastActivatedAt).getTime();
  const ageDays = (now - activated) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function decayAll(repo: SynapseRepository, config: DecayConfig): { decayed: number; pruned: number } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.decayAfterDays);

  const stale = repo.findInactiveSince(cutoff.toISOString());
  let pruned = 0;
  let decayed = 0;

  for (const synapse of stale) {
    const factor = timeDecayFactor(synapse.last_activated_at, config.decayHalfLifeDays);
    const newWeight = synapse.weight * factor;

    if (newWeight < config.pruneThreshold) {
      repo.delete(synapse.id);
      pruned++;
    } else {
      repo.update(synapse.id, { weight: newWeight });
      decayed++;
    }
  }

  return { decayed, pruned };
}
