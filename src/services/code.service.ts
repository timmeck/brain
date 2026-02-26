import type { CodeModuleRecord } from '../types/code.types.js';
import type { CodeModuleRepository } from '../db/repositories/code-module.repository.js';
import type { ProjectRepository } from '../db/repositories/project.repository.js';
import type { SynapseManager } from '../synapses/synapse-manager.js';
import { analyzeCode } from '../code/analyzer.js';
import { fingerprintCode } from '../code/fingerprint.js';
import { computeReusabilityScore } from '../code/scorer.js';
import { detectGranularity } from '../code/registry.js';
import { findExactMatches, findSemanticMatches } from '../code/matcher.js';
import { sha256 } from '../utils/hash.js';
import { getEventBus } from '../utils/events.js';
import { getLogger } from '../utils/logger.js';

export interface AnalyzeInput {
  project: string;
  name: string;
  filePath: string;
  language: string;
  source: string;
  description?: string;
}

export interface FindReusableInput {
  query?: string;
  language?: string;
  projectId?: number;
  limit?: number;
}

export class CodeService {
  private logger = getLogger();
  private eventBus = getEventBus();

  constructor(
    private codeModuleRepo: CodeModuleRepository,
    private projectRepo: ProjectRepository,
    private synapseManager: SynapseManager,
  ) {}

  analyzeAndRegister(input: AnalyzeInput): { moduleId: number; isNew: boolean; reusabilityScore: number } {
    // Ensure project exists
    let project = this.projectRepo.findByName(input.project);
    if (!project) {
      const id = this.projectRepo.create({ name: input.project, path: null, language: input.language, framework: null });
      project = this.projectRepo.getById(id)!;
    }

    // Analyze the code
    const analysis = analyzeCode(input.source, input.language);
    const fingerprint = fingerprintCode(input.source, input.language);
    const sourceHash = sha256(input.source);

    // Check if module already exists (by fingerprint)
    const existing = this.codeModuleRepo.findByFingerprint(fingerprint);
    if (existing) {
      this.codeModuleRepo.update(existing.id, {
        source_hash: sourceHash,
        updated_at: new Date().toISOString(),
      });

      this.synapseManager.strengthen(
        { type: 'code_module', id: existing.id },
        { type: 'project', id: project.id },
        'uses_module',
      );

      return { moduleId: existing.id, isNew: false, reusabilityScore: existing.reusability_score };
    }

    // Compute reusability score
    const reusabilityScore = computeReusabilityScore({
      source: input.source,
      filePath: input.filePath,
      exports: analysis.exports,
      internalDeps: analysis.internalDeps,
      hasTypeAnnotations: analysis.hasTypeAnnotations,
    });

    const granularity = detectGranularity(input.source, input.language);

    const moduleId = this.codeModuleRepo.create({
      project_id: project.id,
      name: input.name,
      file_path: input.filePath,
      language: input.language,
      fingerprint,
      description: input.description ?? null,
      source_hash: sourceHash,
      lines_of_code: analysis.linesOfCode,
      complexity: null,
      reusability_score: reusabilityScore,
    });

    // Create synapse: module ↔ project
    this.synapseManager.strengthen(
      { type: 'code_module', id: moduleId },
      { type: 'project', id: project.id },
      'uses_module',
    );

    this.eventBus.emit('module:registered', { moduleId, projectId: project.id });
    this.logger.info(`Code module registered (id=${moduleId}, name=${input.name}, granularity=${granularity}, score=${reusabilityScore.toFixed(2)})`);

    return { moduleId, isNew: true, reusabilityScore };
  }

  findReusable(input: FindReusableInput): CodeModuleRecord[] {
    if (input.query) {
      return this.codeModuleRepo.search(input.query);
    }
    if (input.language) {
      return this.codeModuleRepo.findByLanguage(input.language, input.limit);
    }
    if (input.projectId) {
      return this.codeModuleRepo.findByProject(input.projectId);
    }
    return [];
  }

  checkSimilarity(source: string, language: string): Array<{ moduleId: number; score: number; matchType: string }> {
    const fingerprint = fingerprintCode(source, language);
    const allModules = this.codeModuleRepo.findByLanguage(language);

    const exact = findExactMatches(fingerprint, allModules);
    if (exact.length > 0) return exact;

    return findSemanticMatches(source, allModules, 0.5);
  }

  listModules(projectId?: number, language?: string, limit?: number): CodeModuleRecord[] {
    if (projectId) {
      return this.codeModuleRepo.findByProject(projectId);
    }
    if (language) {
      return this.codeModuleRepo.findByLanguage(language, limit);
    }
    return this.codeModuleRepo.findAll(limit);
  }

  getById(id: number): CodeModuleRecord | undefined {
    return this.codeModuleRepo.getById(id);
  }
}
