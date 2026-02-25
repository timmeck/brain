import { Command } from 'commander';
import { withIpc } from '../ipc-helper.js';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, basename, relative, extname } from 'path';

const DEFAULT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go',
  '.java', '.c', '.cpp', '.h', '.hpp', '.rb', '.sh',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.next',
  '__pycache__', 'vendor', 'coverage', '.cache', '.turbo',
  '.nuxt', '.output', 'target', 'out', 'venv', '.venv',
  'env', '.env', 'site-packages',
]);

const EXCLUDE_PATTERNS = [/\.min\./, /\.bundle\./, /\.d\.ts$/];

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  rb: 'ruby', sh: 'shell', bash: 'shell',
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).slice(1).toLowerCase();
  return LANG_MAP[ext] ?? ext;
}

function findSourceFiles(dir: string, extensions: Set<string>, maxSizeBytes: number): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (!extensions.has(ext)) continue;
      if (EXCLUDE_PATTERNS.some(p => p.test(entry.name))) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.size > maxSizeBytes) continue;
        files.push(fullPath);
      } catch {
        // skip unreadable files
      }
    }
  }

  walk(dir);
  return files.sort();
}

export function importCommand(): Command {
  return new Command('import')
    .description('Import source files from a project directory into Brain')
    .argument('<directory>', 'Project directory to scan')
    .option('-p, --project <name>', 'Project name (default: directory basename)')
    .option('-e, --extensions <list>', 'Comma-separated extensions (default: ts,tsx,js,jsx,py,rs,go,java,c,cpp,h,hpp,rb,sh)')
    .option('--dry-run', 'List files that would be imported without importing')
    .option('--max-size <kb>', 'Skip files larger than N KB', '100')
    .action(async (directory: string, opts) => {
      const dir = resolve(directory);
      const projectName = opts.project ?? basename(dir);
      const maxSizeKb = parseInt(opts.maxSize, 10) || 100;
      const maxSizeBytes = maxSizeKb * 1024;

      // Parse extensions
      let extensions = DEFAULT_EXTENSIONS;
      if (opts.extensions) {
        extensions = new Set(
          opts.extensions.split(',').map((e: string) => {
            const trimmed = e.trim();
            return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
          })
        );
      }

      // Verify directory exists
      try {
        const stat = statSync(dir);
        if (!stat.isDirectory()) {
          console.error(`Not a directory: ${dir}`);
          process.exit(1);
        }
      } catch {
        console.error(`Directory not found: ${dir}`);
        process.exit(1);
      }

      console.log(`Scanning ${dir} ...`);
      const files = findSourceFiles(dir, extensions, maxSizeBytes);

      if (files.length === 0) {
        console.log('No source files found.');
        return;
      }

      console.log(`Found ${files.length} source files.\n`);

      if (opts.dryRun) {
        for (const f of files) {
          const rel = relative(dir, f);
          const lang = detectLanguage(f);
          console.log(`  [${lang}] ${rel}`);
        }
        console.log(`\n${files.length} files would be imported as project "${projectName}".`);
        return;
      }

      // Import via IPC
      await withIpc(async (client) => {
        let imported = 0;
        let newCount = 0;
        let existingCount = 0;
        let failedCount = 0;
        let totalScore = 0;

        for (let i = 0; i < files.length; i++) {
          const filePath = files[i];
          const rel = relative(dir, filePath);
          const fileName = basename(filePath);
          const language = detectLanguage(filePath);

          let source: string;
          try {
            source = readFileSync(filePath, 'utf-8');
          } catch {
            failedCount++;
            process.stdout.write(`  [${i + 1}/${files.length}] ${rel} — read error\n`);
            continue;
          }

          // Skip empty files
          if (!source.trim()) continue;

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = await client.request('code.analyze', {
              project: projectName,
              name: fileName,
              filePath: rel,
              language,
              source,
            });

            const score = result.reusabilityScore ?? 0;
            const status = result.isNew ? 'new' : 'existing';
            totalScore += score;
            imported++;

            if (result.isNew) newCount++;
            else existingCount++;

            process.stdout.write(`  [${i + 1}/${files.length}] ${rel} → score: ${score.toFixed(2)} (${status})\n`);
          } catch (err) {
            failedCount++;
            const msg = err instanceof Error ? err.message : String(err);
            process.stdout.write(`  [${i + 1}/${files.length}] ${rel} — failed: ${msg.slice(0, 80)}\n`);
          }
        }

        const avgScore = imported > 0 ? (totalScore / imported).toFixed(2) : '0';
        console.log(`\n--- Import Summary ---`);
        console.log(`  Project:  ${projectName}`);
        console.log(`  Imported: ${imported} (${newCount} new, ${existingCount} existing)`);
        if (failedCount > 0) console.log(`  Failed:   ${failedCount}`);
        console.log(`  Avg reusability score: ${avgScore}`);
      });
    });
}
