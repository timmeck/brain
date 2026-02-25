export interface IpcConfig {
  pipeName: string;
  timeout: number;
}

export interface LearningConfig {
  intervalMs: number;
  minOccurrences: number;
  minSuccessRate: number;
  minConfidence: number;
  pruneThreshold: number;
  maxRejectionRate: number;
  decayHalfLifeDays: number;
}

export interface TerminalConfig {
  staleTimeout: number;
  maxConnected: number;
}

export interface MatchingConfig {
  fingerprintFields: string[];
  similarityThreshold: number;
  maxResults: number;
}

export interface CodeConfig {
  supportedLanguages: string[];
  maxModuleSize: number;
  similarityThreshold: number;
}

export interface SynapsesConfig {
  initialWeight: number;
  learningRate: number;
  decayHalfLifeDays: number;
  pruneThreshold: number;
  decayAfterDays: number;
  maxDepth: number;
  minActivationWeight: number;
}

export interface ResearchConfig {
  intervalMs: number;
  initialDelayMs: number;
  minDataPoints: number;
  trendWindowDays: number;
  gapMinOccurrences: number;
  synergyMinWeight: number;
  templateMinAdaptations: number;
  insightExpiryDays: number;
}

export interface LogConfig {
  level: string;
  file: string;
  maxSize: number;
  maxFiles: number;
}

export interface RetentionConfig {
  errorDays: number;
  solutionDays: number;
  insightDays: number;
}

export interface BrainConfig {
  dataDir: string;
  dbPath: string;
  ipc: IpcConfig;
  learning: LearningConfig;
  terminal: TerminalConfig;
  matching: MatchingConfig;
  code: CodeConfig;
  synapses: SynapsesConfig;
  research: ResearchConfig;
  log: LogConfig;
  retention: RetentionConfig;
}
