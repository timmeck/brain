import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IpcClient } from '../ipc/client.js';
import type { IpcRouter } from '../ipc/router.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = any;

type BrainCall = (method: string, params?: unknown) => Promise<unknown> | unknown;

function textResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

/** Register tools using IPC client (for stdio MCP transport) */
export function registerTools(server: McpServer, ipc: IpcClient): void {
  registerToolsWithCaller(server, (method, params) => ipc.request(method, params));
}

/** Register tools using router directly (for HTTP MCP transport inside daemon) */
export function registerToolsDirect(server: McpServer, router: IpcRouter): void {
  registerToolsWithCaller(server, (method, params) => router.handle(method, params));
}

function registerToolsWithCaller(server: McpServer, call: BrainCall): void {

  // === Error Brain Tools ===

  server.tool(
    'brain_report_error',
    'Report an error that occurred. Brain stores it, matches against known errors, returns solutions if available.',
    {
      error_output: z.string().describe('The raw error output from the terminal'),
      command: z.string().optional().describe('The command that caused the error'),
      task_context: z.string().optional().describe('What was the user trying to accomplish'),
      working_directory: z.string().optional().describe('Working directory when error occurred'),
      project: z.string().optional().describe('Project name'),
    },
    async (params) => {
      const result: AnyResult = await call('error.report', {
        project: params.project ?? 'default',
        errorOutput: params.error_output,
        filePath: params.working_directory,
        taskContext: params.task_context,
        workingDirectory: params.working_directory,
        command: params.command,
      });
      let response = `Error #${result.errorId} recorded (${result.isNew ? 'new' : 'seen before'}).`;
      if (result.matches?.length > 0) {
        const best = result.matches[0];
        response += `\nSimilar error found (#${best.errorId}, ${Math.round(best.score * 100)}% match).`;
      }
      if (result.crossProjectMatches?.length > 0) {
        const best = result.crossProjectMatches[0];
        response += `\nCross-project match found (#${best.errorId}, ${Math.round(best.score * 100)}% match from another project).`;
      }
      return textResult(response);
    },
  );

  server.tool(
    'brain_query_error',
    'Search for similar errors and their solutions in the Brain database.',
    {
      query: z.string().describe('Error message or description to search for'),
      project_only: z.boolean().optional().describe('Only search in current project'),
    },
    async (params) => {
      const results: AnyResult = await call('error.query', {
        search: params.query,
      });
      if (!results?.length) return textResult('No matching errors found.');
      const lines = results.map((e: AnyResult) =>
        `#${e.id} [${e.errorType}] ${e.message?.slice(0, 120)}${e.resolved ? ' (resolved)' : ''}`
      );
      return textResult(`Found ${results.length} errors:\n${lines.join('\n')}`);
    },
  );

  server.tool(
    'brain_report_solution',
    'Report a successful solution for an error. Brain will learn from this.',
    {
      error_id: z.number().describe('The error ID this solution fixes'),
      description: z.string().describe('What was done to fix the error'),
      commands: z.string().optional().describe('Commands used to fix'),
      code_change: z.string().optional().describe('Code changes or diff'),
    },
    async (params) => {
      const solutionId: AnyResult = await call('solution.report', {
        errorId: params.error_id,
        description: params.description,
        commands: params.commands,
        codeChange: params.code_change,
      });
      return textResult(`Solution #${solutionId} recorded for error #${params.error_id}. Brain will use this to help with similar errors in the future.`);
    },
  );

  server.tool(
    'brain_report_attempt',
    'Report a failed solution attempt. Brain learns what does NOT work.',
    {
      error_id: z.number().describe('The error ID'),
      solution_id: z.number().describe('The solution ID that was attempted'),
      description: z.string().optional().describe('What was tried'),
      output: z.string().optional().describe('Output of the failed attempt'),
    },
    async (params) => {
      await call('solution.rate', {
        errorId: params.error_id,
        solutionId: params.solution_id,
        success: false,
        output: params.output,
      });
      return textResult(`Failed attempt recorded for error #${params.error_id}. Brain will avoid suggesting this approach for similar errors.`);
    },
  );

  // === Code Brain Tools ===

  server.tool(
    'brain_find_reusable_code',
    'Search for reusable code modules from other projects. Use when starting new functionality.',
    {
      purpose: z.string().describe('What the code should do (e.g., "retry with backoff", "JWT authentication")'),
      language: z.string().optional().describe('Programming language'),
    },
    async (params) => {
      const results: AnyResult = await call('code.find', {
        query: params.purpose,
        language: params.language,
      });
      if (!results?.length) return textResult('No reusable code modules found.');
      const lines = results.map((m: AnyResult) =>
        `#${m.id} [${m.language}] ${m.name} — ${m.description ?? 'no description'} (reusability: ${m.reusabilityScore ?? '?'})`
      );
      return textResult(`Found ${results.length} modules:\n${lines.join('\n')}`);
    },
  );

  server.tool(
    'brain_register_code',
    'Register a code module as reusable. Brain will analyze it and make it available to other projects.',
    {
      source_code: z.string().describe('The source code'),
      file_path: z.string().describe('File path relative to project root'),
      project: z.string().optional().describe('Project name'),
      name: z.string().optional().describe('Module name (optional - Brain auto-detects)'),
      language: z.string().optional().describe('Programming language'),
      description: z.string().optional().describe('What this code does'),
    },
    async (params) => {
      const result: AnyResult = await call('code.analyze', {
        project: params.project ?? 'default',
        name: params.name ?? params.file_path.split('/').pop() ?? 'unknown',
        filePath: params.file_path,
        language: params.language ?? detectLanguage(params.file_path),
        source: params.source_code,
        description: params.description,
      });
      return textResult(`Module #${result.moduleId} registered (${result.isNew ? 'new' : 'updated'}). Reusability score: ${result.reusabilityScore}.`);
    },
  );

  server.tool(
    'brain_check_code_similarity',
    'Check if similar code already exists in other projects before writing new code.',
    {
      source_code: z.string().describe('The code to check'),
      language: z.string().optional().describe('Programming language'),
      file_path: z.string().optional().describe('File path for context'),
    },
    async (params) => {
      const results: AnyResult = await call('code.similarity', {
        source: params.source_code,
        language: params.language ?? detectLanguage(params.file_path ?? ''),
      });
      if (!results?.length) return textResult('No similar code found. This appears to be unique.');
      const lines = results.map((m: AnyResult) =>
        `Module #${m.moduleId}: ${Math.round(m.score * 100)}% match (${m.matchType})`
      );
      return textResult(`Found ${results.length} similar modules:\n${lines.join('\n')}`);
    },
  );

  // === Synapse Network Tools ===

  server.tool(
    'brain_explore',
    'Explore what Brain knows about a topic. Uses spreading activation through the synapse network.',
    {
      node_type: z.string().describe('Type: error, solution, code_module, project'),
      node_id: z.number().describe('ID of the node to explore from'),
      max_depth: z.number().optional().describe('How many hops to follow (default: 3)'),
    },
    async (params) => {
      const context: AnyResult = await call('synapse.context', {
        errorId: params.node_id,
      });
      const sections: string[] = [];
      if (context.solutions?.length) sections.push(`Solutions: ${context.solutions.length} found`);
      if (context.relatedErrors?.length) sections.push(`Related errors: ${context.relatedErrors.length}`);
      if (context.relevantModules?.length) sections.push(`Relevant modules: ${context.relevantModules.length}`);
      if (context.preventionRules?.length) sections.push(`Prevention rules: ${context.preventionRules.length}`);
      if (context.insights?.length) sections.push(`Insights: ${context.insights.length}`);
      return textResult(sections.length ? sections.join('\n') : 'No connections found for this node.');
    },
  );

  server.tool(
    'brain_connections',
    'Find how two things are connected in Brain (e.g., how an error relates to a code module).',
    {
      from_type: z.string().describe('Source type: error, solution, code_module, project'),
      from_id: z.number().describe('Source ID'),
      to_type: z.string().describe('Target type'),
      to_id: z.number().describe('Target ID'),
    },
    async (params) => {
      const path: AnyResult = await call('synapse.path', params);
      if (!path) return textResult('No connection found between these nodes.');
      return textResult(path);
    },
  );

  // === Research Brain Tools ===

  server.tool(
    'brain_insights',
    'Get research insights: trends, gaps, synergies, template candidates, and project suggestions.',
    {
      type: z.string().optional().describe('Filter by type: trend, pattern, gap, synergy, optimization, template_candidate, project_suggestion, warning'),
      priority: z.string().optional().describe('Minimum priority: low, medium, high, critical'),
    },
    async (params) => {
      const insights: AnyResult = await call('research.insights', {
        type: params.type,
        activeOnly: true,
        limit: 20,
      });
      if (!insights?.length) return textResult('No active insights.');
      const lines = insights.map((i: AnyResult) =>
        `[${i.type}] ${i.title}: ${i.description?.slice(0, 150)}`
      );
      return textResult(`${insights.length} insights:\n${lines.join('\n')}`);
    },
  );

  server.tool(
    'brain_rate_insight',
    'Rate an insight as useful or not useful. Helps Brain learn what insights matter.',
    {
      insight_id: z.number().describe('The insight ID to rate'),
      rating: z.number().describe('Rating: 1 (useful), 0 (neutral), -1 (not useful)'),
      comment: z.string().optional().describe('Optional feedback comment'),
    },
    async (params) => {
      const success: AnyResult = await call('insight.rate', {
        id: params.insight_id,
        rating: params.rating,
        comment: params.comment,
      });
      return textResult(success ? `Insight #${params.insight_id} rated.` : `Insight #${params.insight_id} not found.`);
    },
  );

  server.tool(
    'brain_suggest',
    'Ask Brain for suggestions: what to build next, what to improve, what patterns to extract.',
    {
      context: z.string().describe('Current context or question'),
    },
    async (params) => {
      const suggestions: AnyResult = await call('research.suggest', {
        context: params.context,
      });
      return textResult(suggestions);
    },
  );

  // === Status & Notifications ===

  server.tool(
    'brain_status',
    'Get current Brain status: errors, solutions, code modules, synapse network, insights.',
    {},
    async () => {
      const summary: AnyResult = await call('analytics.summary', {});
      const network: AnyResult = await call('synapse.stats', {});
      const lines = [
        `Errors: ${summary.errors?.total ?? 0} total, ${summary.errors?.unresolved ?? 0} unresolved`,
        `Solutions: ${summary.solutions?.total ?? 0}`,
        `Rules: ${summary.rules?.active ?? 0} active`,
        `Code modules: ${summary.modules?.total ?? 0}`,
        `Insights: ${summary.insights?.active ?? 0} active`,
        `Synapses: ${network.totalSynapses ?? 0} connections`,
      ];
      return textResult(lines.join('\n'));
    },
  );

  server.tool(
    'brain_notifications',
    'Get pending notifications (new solutions, recurring errors, research insights).',
    {},
    async () => {
      const notifications: AnyResult = await call('notification.list', {});
      if (!notifications?.length) return textResult('No pending notifications.');
      const lines = notifications.map((n: AnyResult) =>
        `[${n.type}] ${n.title}: ${n.message?.slice(0, 120)}`
      );
      return textResult(`${notifications.length} notifications:\n${lines.join('\n')}`);
    },
  );
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    rb: 'ruby', sh: 'shell', bash: 'shell',
  };
  return map[ext] ?? ext;
}
