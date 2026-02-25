import type Database from 'better-sqlite3';
import type { Statement } from 'better-sqlite3';
import type { CodeModuleRecord } from '../../types/code.types.js';

type CodeModuleCreate = Omit<CodeModuleRecord, 'id' | 'created_at' | 'updated_at'>;
type CodeModuleUpdate = Partial<Omit<CodeModuleRecord, 'id' | 'created_at'>>;

export class CodeModuleRepository {
  private stmts: Record<string, Statement>;

  constructor(private db: Database.Database) {
    this.stmts = {
      create: db.prepare(`
        INSERT INTO code_modules (project_id, name, file_path, language, fingerprint, description, source_hash, lines_of_code, complexity, reusability_score)
        VALUES (@project_id, @name, @file_path, @language, @fingerprint, @description, @source_hash, @lines_of_code, @complexity, @reusability_score)
      `),
      getById: db.prepare('SELECT * FROM code_modules WHERE id = ?'),
      delete: db.prepare('DELETE FROM code_modules WHERE id = ?'),
      findByFingerprint: db.prepare('SELECT * FROM code_modules WHERE fingerprint = ?'),
      findByProject: db.prepare('SELECT * FROM code_modules WHERE project_id = ? ORDER BY name ASC'),
      countAll: db.prepare('SELECT COUNT(*) as count FROM code_modules'),
      search: db.prepare(`
        SELECT cm.* FROM code_modules cm
        JOIN code_modules_fts fts ON cm.id = fts.rowid
        WHERE code_modules_fts MATCH ?
        ORDER BY rank
      `),
    };
  }

  create(data: CodeModuleCreate): number {
    const result = this.stmts.create.run(data);
    return result.lastInsertRowid as number;
  }

  getById(id: number): CodeModuleRecord | undefined {
    return this.stmts.getById.get(id) as CodeModuleRecord | undefined;
  }

  update(id: number, data: CodeModuleUpdate): boolean {
    const fields = Object.keys(data).filter((key) => (data as Record<string, unknown>)[key] !== undefined);
    if (fields.length === 0) return false;

    const setClauses = fields.map((field) => `${field} = @${field}`).join(', ');
    const stmt = this.db.prepare(
      `UPDATE code_modules SET ${setClauses}, updated_at = datetime('now') WHERE id = @id`
    );
    const result = stmt.run({ ...data, id });
    return result.changes > 0;
  }

  delete(id: number): boolean {
    const result = this.stmts.delete.run(id);
    return result.changes > 0;
  }

  findByFingerprint(fingerprint: string): CodeModuleRecord | undefined {
    return this.stmts.findByFingerprint.get(fingerprint) as CodeModuleRecord | undefined;
  }

  findByLanguage(language: string, limit?: number): CodeModuleRecord[] {
    const sql = limit
      ? 'SELECT * FROM code_modules WHERE language = ? ORDER BY name ASC LIMIT ?'
      : 'SELECT * FROM code_modules WHERE language = ? ORDER BY name ASC';
    const stmt = this.db.prepare(sql);
    return (limit ? stmt.all(language, limit) : stmt.all(language)) as CodeModuleRecord[];
  }

  findByProject(projectId: number): CodeModuleRecord[] {
    return this.stmts.findByProject.all(projectId) as CodeModuleRecord[];
  }

  search(query: string): CodeModuleRecord[] {
    return this.stmts.search.all(query) as CodeModuleRecord[];
  }

  countAll(): number {
    return (this.stmts.countAll.get() as { count: number }).count;
  }
}
