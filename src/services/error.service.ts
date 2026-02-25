import type { ErrorRecord } from '../types/error.types.js';
import type { ErrorRepository } from '../db/repositories/error.repository.js';
import type { ProjectRepository } from '../db/repositories/project.repository.js';
import type { SynapseManager } from '../synapses/synapse-manager.js';
import { parseError } from '../parsing/error-parser.js';
import { generateFingerprint } from '../matching/fingerprint.js';
import { matchError, type MatchResult } from '../matching/error-matcher.js';
import { getEventBus } from '../utils/events.js';
import { getLogger } from '../utils/logger.js';

export interface ReportErrorInput {
  project: string;
  errorOutput: string;
  filePath?: string;
  terminalId?: number;
}

export interface ErrorQueryInput {
  projectId?: number;
  resolved?: boolean;
  search?: string;
  limit?: number;
}

export class ErrorService {
  private logger = getLogger();
  private eventBus = getEventBus();

  constructor(
    private errorRepo: ErrorRepository,
    private projectRepo: ProjectRepository,
    private synapseManager: SynapseManager,
  ) {}

  report(input: ReportErrorInput): { errorId: number; isNew: boolean; matches: MatchResult[] } {
    // 1. Ensure project exists
    let project = this.projectRepo.findByName(input.project);
    if (!project) {
      const id = this.projectRepo.create({ name: input.project, path: null, language: null, framework: null });
      project = this.projectRepo.getById(id)!;
    }

    // 2. Parse the error
    const parsed = parseError(input.errorOutput);
    if (!parsed) {
      this.logger.warn('Could not parse error output');
      const errorId = this.errorRepo.create({
        project_id: project.id,
        terminal_id: input.terminalId ?? null,
        fingerprint: '',
        type: 'UnknownError',
        message: input.errorOutput.split('\n')[0] ?? input.errorOutput,
        raw_output: input.errorOutput,
        context: null,
        file_path: input.filePath ?? null,
        line_number: null,
        column_number: null,
      });
      return { errorId, isNew: true, matches: [] };
    }

    // 3. Generate fingerprint
    const fingerprint = generateFingerprint(parsed.errorType, parsed.message, parsed.frames);

    // 4. Check for existing error with same fingerprint
    const existing = this.errorRepo.findByFingerprint(fingerprint);
    if (existing.length > 0) {
      const err = existing[0]!;
      this.errorRepo.incrementOccurrence(err.id);
      this.logger.info(`Known error (id=${err.id}), occurrence incremented`);

      // Strengthen synapse
      this.synapseManager.strengthen(
        { type: 'error', id: err.id },
        { type: 'project', id: project.id },
        'co_occurs',
      );

      return { errorId: err.id, isNew: false, matches: [] };
    }

    // 5. Create new error record
    const errorId = this.errorRepo.create({
      project_id: project.id,
      terminal_id: input.terminalId ?? null,
      fingerprint,
      type: parsed.errorType,
      message: parsed.message,
      raw_output: input.errorOutput,
      context: null,
      file_path: parsed.sourceFile ?? input.filePath ?? null,
      line_number: parsed.sourceLine ?? null,
      column_number: null,
    });

    // 6. Create synapse: error ↔ project
    this.synapseManager.strengthen(
      { type: 'error', id: errorId },
      { type: 'project', id: project.id },
      'co_occurs',
    );

    // 7. Find similar errors
    const candidates = this.errorRepo.findByProject(project.id)
      .filter(e => e.id !== errorId);
    const newError = this.errorRepo.getById(errorId)!;
    const matches = matchError(newError, candidates);

    // 8. Create similarity synapses for strong matches
    for (const match of matches.filter(m => m.isStrong)) {
      this.synapseManager.strengthen(
        { type: 'error', id: errorId },
        { type: 'error', id: match.errorId },
        'similar_to',
      );
    }

    this.eventBus.emit('error:reported', { errorId, projectId: project.id, fingerprint });
    this.logger.info(`New error reported (id=${errorId}, type=${parsed.errorType})`);

    return { errorId, isNew: true, matches };
  }

  query(input: ErrorQueryInput): ErrorRecord[] {
    if (input.search) {
      return this.errorRepo.search(input.search);
    }
    if (input.resolved === false) {
      return this.errorRepo.findUnresolved(input.projectId);
    }
    if (input.projectId) {
      return this.errorRepo.findByProject(input.projectId);
    }
    return [];
  }

  matchSimilar(errorId: number): MatchResult[] {
    const error = this.errorRepo.getById(errorId);
    if (!error) return [];

    const candidates = this.errorRepo.findByProject(error.project_id)
      .filter(e => e.id !== errorId);
    return matchError(error, candidates);
  }

  resolve(errorId: number, solutionId?: number): void {
    this.errorRepo.update(errorId, {
      resolved: 1,
      resolved_at: new Date().toISOString(),
    });

    if (solutionId) {
      this.eventBus.emit('error:resolved', { errorId, solutionId });
    }
  }

  getById(id: number): ErrorRecord | undefined {
    return this.errorRepo.getById(id);
  }

  countSince(since: string, projectId?: number): number {
    return this.errorRepo.countSince(since, projectId);
  }
}
