/**
 * Wilson Score Interval for low-sample-size confidence.
 * Prevents unrealistic 100% from single success/failure.
 */
export function wilsonScore(successes: number, total: number, z: number = 1.96): number {
  if (total === 0) return 0;

  const p = successes / total;
  const z2 = z * z;
  const n = total;

  const numerator = p + z2 / (2 * n);
  const denominator = 1 + z2 / n;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n) / denominator;

  // Lower bound of Wilson interval = conservative estimate
  return Math.max(0, numerator / denominator - margin);
}

/**
 * Time-decayed confidence: recent successes count more.
 */
export function timeDecayedConfidence(
  successes: number,
  total: number,
  lastUsedAt: string,
  halfLifeDays: number,
): number {
  const base = wilsonScore(successes, total);
  const ageDays = (Date.now() - new Date(lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
  const decay = Math.pow(0.5, ageDays / halfLifeDays);
  return base * decay;
}

/**
 * Combined confidence from success rate + usage frequency + recency.
 */
export function computeConfidence(
  successCount: number,
  failCount: number,
  lastUsedAt: string,
  halfLifeDays: number = 30,
): number {
  const total = successCount + failCount;
  if (total === 0) return 0;
  return timeDecayedConfidence(successCount, total, lastUsedAt, halfLifeDays);
}

export interface AdaptiveThresholds {
  minOccurrences: number;
  minSuccessRate: number;
  minConfidence: number;
  pruneThreshold: number;
}

/**
 * Compute adaptive thresholds based on data volume.
 * Users with lots of data need stricter thresholds; users with little data need looser ones.
 */
export function computeAdaptiveThresholds(
  totalErrors: number,
  totalSolutions: number,
  baseConfig: { minOccurrences: number; minSuccessRate: number; minConfidence: number; pruneThreshold: number },
): AdaptiveThresholds {
  // Scale factor: 1.0 at 50 errors, increases with more data
  const errorScale = Math.min(2.0, Math.max(0.5, totalErrors / 50));
  const solutionScale = Math.min(2.0, Math.max(0.5, totalSolutions / 20));
  const dataScale = (errorScale + solutionScale) / 2;

  return {
    // More data → require more occurrences before learning
    minOccurrences: Math.max(2, Math.round(baseConfig.minOccurrences * dataScale)),
    // More data → can afford higher success rate requirement
    minSuccessRate: Math.min(0.95, baseConfig.minSuccessRate * (0.85 + dataScale * 0.15)),
    // More data → higher confidence threshold
    minConfidence: Math.min(0.90, baseConfig.minConfidence * (0.85 + dataScale * 0.15)),
    // More data → stricter pruning
    pruneThreshold: Math.max(0.10, baseConfig.pruneThreshold * (1.1 - dataScale * 0.1)),
  };
}
