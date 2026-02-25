import type { CodeModuleRecord } from '../types/code.types.js';
import { fingerprintCode } from './fingerprint.js';
import { tokenize } from '../matching/tokenizer.js';
import { cosineSimilarity, jaccardSimilarity } from '../matching/similarity.js';

export interface CodeMatchResult {
  moduleId: number;
  score: number;
  matchType: 'exact' | 'structural' | 'semantic';
}

export function findExactMatches(
  fingerprint: string,
  candidates: CodeModuleRecord[],
): CodeMatchResult[] {
  return candidates
    .filter(c => c.fingerprint === fingerprint)
    .map(c => ({ moduleId: c.id, score: 1.0, matchType: 'exact' as const }));
}

export function findStructuralMatches(
  source: string,
  language: string,
  candidates: CodeModuleRecord[],
  threshold: number = 0.75,
): CodeMatchResult[] {
  const fp = fingerprintCode(source, language);
  const results: CodeMatchResult[] = [];

  for (const candidate of candidates) {
    if (candidate.fingerprint === fp) {
      results.push({ moduleId: candidate.id, score: 1.0, matchType: 'structural' });
      continue;
    }

    const tokensA = tokenize(source);
    const tokensB = tokenize(candidate.name + ' ' + (candidate.description ?? ''));
    const sim = cosineSimilarity(tokensA, tokensB);
    if (sim >= threshold) {
      results.push({ moduleId: candidate.id, score: sim, matchType: 'structural' });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function findSemanticMatches(
  description: string,
  candidates: CodeModuleRecord[],
  threshold: number = 0.5,
): CodeMatchResult[] {
  const queryTokens = tokenize(description);

  return candidates
    .map(c => {
      const candidateTokens = tokenize(
        [c.name, c.description ?? '', c.file_path].join(' ')
      );
      const score = cosineSimilarity(queryTokens, candidateTokens);
      return { moduleId: c.id, score, matchType: 'semantic' as const };
    })
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
