import type { SolutionRepository } from '../db/repositories/solution.repository.js';
import { wilsonScore } from './confidence-scorer.js';

/**
 * Update confidence scores for all solutions based on their attempt history.
 */
export function updateSolutionConfidences(solutionRepo: SolutionRepository): number {
  // We can't iterate all solutions without a getAll method,
  // so we update confidence when solutions are accessed/rated.
  // This function is a placeholder for batch updates during learning cycles.
  return 0;
}

/**
 * Compute relevance decay factor for a timestamp.
 */
export function relevanceDecay(timestamp: string, halfLifeDays: number): number {
  const ageDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Determine if a rule should be pruned based on its performance.
 */
export function shouldPruneRule(
  confidence: number,
  rejectionCount: number,
  totalUsage: number,
  pruneThreshold: number,
  maxRejectionRate: number,
): boolean {
  if (confidence < pruneThreshold) return true;
  if (totalUsage > 0 && rejectionCount / totalUsage > maxRejectionRate) return true;
  return false;
}
