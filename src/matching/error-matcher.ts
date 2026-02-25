import type { ErrorRecord } from '../types/error.types.js';
import { tokenize } from './tokenizer.js';
import { cosineSimilarity, jaccardSimilarity, levenshteinDistance } from './similarity.js';

export interface SignalScore {
  signal: string;
  score: number;
  weighted: number;
}

export interface MatchResult {
  errorId: number;
  score: number;
  signals: SignalScore[];
  isStrong: boolean;
}

interface MatchSignal {
  name: string;
  weight: number;
  compute: (a: ErrorRecord, b: ErrorRecord) => number;
}

const SIGNALS: MatchSignal[] = [
  { name: 'fingerprint', weight: 0.30, compute: fingerprintMatch },
  { name: 'message_similarity', weight: 0.20, compute: messageSimilarity },
  { name: 'type_match', weight: 0.15, compute: typeMatch },
  { name: 'stack_similarity', weight: 0.15, compute: stackSimilarity },
  { name: 'file_similarity', weight: 0.10, compute: fileSimilarity },
  { name: 'context_similarity', weight: 0.10, compute: contextSimilarity },
];

const MATCH_THRESHOLD = 0.70;
const STRONG_MATCH_THRESHOLD = 0.90;

export function matchError(
  incoming: ErrorRecord,
  candidates: ErrorRecord[],
): MatchResult[] {
  return candidates
    .map(candidate => {
      const signals = SIGNALS.map(signal => {
        const score = signal.compute(incoming, candidate);
        return {
          signal: signal.name,
          score,
          weighted: score * signal.weight,
        };
      });

      const totalScore = signals.reduce((sum, s) => sum + s.weighted, 0);

      return {
        errorId: candidate.id,
        score: totalScore,
        signals,
        isStrong: totalScore >= STRONG_MATCH_THRESHOLD,
      };
    })
    .filter(result => result.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

function fingerprintMatch(a: ErrorRecord, b: ErrorRecord): number {
  return a.fingerprint === b.fingerprint ? 1.0 : 0.0;
}

function messageSimilarity(a: ErrorRecord, b: ErrorRecord): number {
  const tokensA = tokenize(a.message);
  const tokensB = tokenize(b.message);
  return cosineSimilarity(tokensA, tokensB);
}

function typeMatch(a: ErrorRecord, b: ErrorRecord): number {
  return a.type === b.type ? 1.0 : 0.0;
}

function stackSimilarity(a: ErrorRecord, b: ErrorRecord): number {
  const rawA = a.raw_output ?? '';
  const rawB = b.raw_output ?? '';

  const frameRe = /at (?:(.+?) )?\(/g;
  const extractFuncs = (raw: string) => {
    const funcs: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(frameRe.source, 'g');
    while ((m = re.exec(raw)) !== null) {
      if (m[1]) funcs.push(m[1]);
    }
    return funcs;
  };

  const funcsA = extractFuncs(rawA);
  const funcsB = extractFuncs(rawB);

  if (funcsA.length === 0 && funcsB.length === 0) return 0.5;
  return jaccardSimilarity(funcsA, funcsB);
}

function fileSimilarity(a: ErrorRecord, b: ErrorRecord): number {
  const pathA = a.file_path ?? '';
  const pathB = b.file_path ?? '';
  if (!pathA || !pathB) return 0.0;
  if (pathA === pathB) return 1.0;
  return levenshteinDistance(pathA, pathB);
}

function contextSimilarity(a: ErrorRecord, b: ErrorRecord): number {
  const ctxA = a.context ?? '';
  const ctxB = b.context ?? '';
  if (!ctxA || !ctxB) return 0.0;
  const tokensA = tokenize(ctxA);
  const tokensB = tokenize(ctxB);
  return cosineSimilarity(tokensA, tokensB);
}
