import http from 'node:http';
import { getLogger } from '../utils/logger.js';
import type { IpcRouter } from '../ipc/router.js';

export interface ApiServerOptions {
  port: number;
  router: IpcRouter;
  apiKey?: string;
}

interface RouteDefinition {
  method: string;
  pattern: RegExp;
  ipcMethod: string;
  extractParams: (match: RegExpMatchArray, query: URLSearchParams, body?: unknown) => unknown;
}

export class ApiServer {
  private server: http.Server | null = null;
  private logger = getLogger();
  private routes: RouteDefinition[];

  constructor(private options: ApiServerOptions) {
    this.routes = this.buildRoutes();
  }

  start(): void {
    const { port, apiKey } = this.options;

    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (apiKey) {
        const provided = (req.headers['x-api-key'] as string) ??
          req.headers.authorization?.replace('Bearer ', '');
        if (provided !== apiKey) {
          this.json(res, 401, { error: 'Unauthorized', message: 'Invalid or missing API key' });
          return;
        }
      }

      this.handleRequest(req, res).catch((err) => {
        this.logger.error('API error:', err);
        this.json(res, 500, {
          error: 'Internal Server Error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    });

    this.server.listen(port, () => {
      this.logger.info(`REST API server started on http://localhost:${port}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
    this.logger.info('REST API server stopped');
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = url.pathname;
    const method = req.method ?? 'GET';
    const query = url.searchParams;

    // Health check
    if (pathname === '/api/v1/health') {
      this.json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    // List all available methods
    if (pathname === '/api/v1/methods' && method === 'GET') {
      const methods = this.options.router.listMethods();
      this.json(res, 200, {
        methods,
        rpcEndpoint: '/api/v1/rpc',
        usage: 'POST /api/v1/rpc with body { "method": "<method>", "params": {...} }',
      });
      return;
    }

    // Generic RPC endpoint — the universal gateway
    if (pathname === '/api/v1/rpc' && method === 'POST') {
      const body = await this.readBody(req);
      if (!body) {
        this.json(res, 400, { error: 'Bad Request', message: 'Empty request body' });
        return;
      }

      const parsed = JSON.parse(body);

      // Batch RPC support
      if (Array.isArray(parsed)) {
        const results = parsed.map((call: { method: string; params?: unknown; id?: string | number }) => {
          try {
            const result = this.options.router.handle(call.method, call.params ?? {});
            return { id: call.id, result };
          } catch (err) {
            return { id: call.id, error: err instanceof Error ? err.message : String(err) };
          }
        });
        this.json(res, 200, results);
        return;
      }

      if (!parsed.method) {
        this.json(res, 400, { error: 'Bad Request', message: 'Missing "method" field' });
        return;
      }

      try {
        const result = this.options.router.handle(parsed.method, parsed.params ?? {});
        this.json(res, 200, { result });
      } catch (err) {
        this.json(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // RESTful routes
    let body: unknown = undefined;
    if (method === 'POST' || method === 'PUT') {
      try {
        const raw = await this.readBody(req);
        body = raw ? JSON.parse(raw) : {};
      } catch {
        this.json(res, 400, { error: 'Bad Request', message: 'Invalid JSON body' });
        return;
      }
    }

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;

      try {
        const params = route.extractParams(match, query, body);
        const result = this.options.router.handle(route.ipcMethod, params);
        this.json(res, method === 'POST' ? 201 : 200, { result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.startsWith('Unknown method') ? 404 : 400;
        this.json(res, status, { error: msg });
      }
      return;
    }

    this.json(res, 404, { error: 'Not Found', message: `No route for ${method} ${pathname}` });
  }

  private buildRoutes(): RouteDefinition[] {
    return [
      // ─── Errors ────────────────────────────────────────────
      { method: 'POST', pattern: /^\/api\/v1\/errors$/, ipcMethod: 'error.report',
        extractParams: (_m, _q, body) => body },
      { method: 'GET', pattern: /^\/api\/v1\/errors$/, ipcMethod: 'error.query',
        extractParams: (_m, q) => ({
          search: q.get('search') ?? '',
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/errors\/(\d+)$/, ipcMethod: 'error.get',
        extractParams: (m) => ({ id: Number(m[1]) }) },
      { method: 'GET', pattern: /^\/api\/v1\/errors\/(\d+)\/match$/, ipcMethod: 'error.match',
        extractParams: (m) => ({ errorId: Number(m[1]) }) },
      { method: 'GET', pattern: /^\/api\/v1\/errors\/(\d+)\/chain$/, ipcMethod: 'error.chain',
        extractParams: (m) => ({ errorId: Number(m[1]) }) },
      { method: 'POST', pattern: /^\/api\/v1\/errors\/(\d+)\/resolve$/, ipcMethod: 'error.resolve',
        extractParams: (m, _q, body) => ({ errorId: Number(m[1]), ...(body as object) }) },

      // ─── Solutions ─────────────────────────────────────────
      { method: 'POST', pattern: /^\/api\/v1\/solutions$/, ipcMethod: 'solution.report',
        extractParams: (_m, _q, body) => body },
      { method: 'GET', pattern: /^\/api\/v1\/solutions$/, ipcMethod: 'solution.query',
        extractParams: (_m, q) => ({
          errorId: q.get('errorId') ? Number(q.get('errorId')) : undefined,
        }) },
      { method: 'POST', pattern: /^\/api\/v1\/solutions\/rate$/, ipcMethod: 'solution.rate',
        extractParams: (_m, _q, body) => body },
      { method: 'GET', pattern: /^\/api\/v1\/solutions\/efficiency$/, ipcMethod: 'solution.efficiency',
        extractParams: () => ({}) },

      // ─── Projects ──────────────────────────────────────────
      { method: 'GET', pattern: /^\/api\/v1\/projects$/, ipcMethod: 'project.list',
        extractParams: () => ({}) },

      // ─── Code ──────────────────────────────────────────────
      { method: 'POST', pattern: /^\/api\/v1\/code\/analyze$/, ipcMethod: 'code.analyze',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/code\/find$/, ipcMethod: 'code.find',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/code\/similarity$/, ipcMethod: 'code.similarity',
        extractParams: (_m, _q, body) => body },
      { method: 'GET', pattern: /^\/api\/v1\/code\/modules$/, ipcMethod: 'code.modules',
        extractParams: (_m, q) => ({
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
          language: q.get('language') ?? undefined,
          limit: q.get('limit') ? Number(q.get('limit')) : undefined,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/code\/(\d+)$/, ipcMethod: 'code.get',
        extractParams: (m) => ({ id: Number(m[1]) }) },

      // ─── Prevention ────────────────────────────────────────
      { method: 'POST', pattern: /^\/api\/v1\/prevention\/check$/, ipcMethod: 'prevention.check',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/prevention\/antipatterns$/, ipcMethod: 'prevention.antipatterns',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/prevention\/code$/, ipcMethod: 'prevention.checkCode',
        extractParams: (_m, _q, body) => body },

      // ─── Synapses ─────────────────────────────────────────
      { method: 'GET', pattern: /^\/api\/v1\/synapses\/context\/(\d+)$/, ipcMethod: 'synapse.context',
        extractParams: (m) => ({ errorId: Number(m[1]) }) },
      { method: 'POST', pattern: /^\/api\/v1\/synapses\/path$/, ipcMethod: 'synapse.path',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/synapses\/related$/, ipcMethod: 'synapse.related',
        extractParams: (_m, _q, body) => body },
      { method: 'GET', pattern: /^\/api\/v1\/synapses\/stats$/, ipcMethod: 'synapse.stats',
        extractParams: () => ({}) },

      // ─── Research ──────────────────────────────────────────
      { method: 'GET', pattern: /^\/api\/v1\/research\/insights$/, ipcMethod: 'research.insights',
        extractParams: (_m, q) => ({
          type: q.get('type') ?? undefined,
          limit: q.get('limit') ? Number(q.get('limit')) : 20,
          activeOnly: q.get('activeOnly') !== 'false',
        }) },
      { method: 'POST', pattern: /^\/api\/v1\/research\/insights\/(\d+)\/rate$/, ipcMethod: 'insight.rate',
        extractParams: (m, _q, body) => ({ id: Number(m[1]), ...(body as object) }) },
      { method: 'GET', pattern: /^\/api\/v1\/research\/suggest$/, ipcMethod: 'research.suggest',
        extractParams: (_m, q) => ({
          context: q.get('context') ?? '',
          limit: 10,
          activeOnly: true,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/research\/trends$/, ipcMethod: 'research.trends',
        extractParams: (_m, q) => ({
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
          windowDays: q.get('windowDays') ? Number(q.get('windowDays')) : undefined,
        }) },

      // ─── Notifications ────────────────────────────────────
      { method: 'GET', pattern: /^\/api\/v1\/notifications$/, ipcMethod: 'notification.list',
        extractParams: (_m, q) => ({
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
        }) },
      { method: 'POST', pattern: /^\/api\/v1\/notifications\/(\d+)\/ack$/, ipcMethod: 'notification.ack',
        extractParams: (m) => ({ id: Number(m[1]) }) },

      // ─── Analytics ─────────────────────────────────────────
      { method: 'GET', pattern: /^\/api\/v1\/analytics\/summary$/, ipcMethod: 'analytics.summary',
        extractParams: (_m, q) => ({
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/analytics\/network$/, ipcMethod: 'analytics.network',
        extractParams: (_m, q) => ({
          limit: q.get('limit') ? Number(q.get('limit')) : undefined,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/analytics\/health$/, ipcMethod: 'analytics.health',
        extractParams: (_m, q) => ({
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/analytics\/timeline$/, ipcMethod: 'analytics.timeline',
        extractParams: (_m, q) => ({
          projectId: q.get('projectId') ? Number(q.get('projectId')) : undefined,
          days: q.get('days') ? Number(q.get('days')) : undefined,
        }) },
      { method: 'GET', pattern: /^\/api\/v1\/analytics\/explain\/(\d+)$/, ipcMethod: 'analytics.explain',
        extractParams: (m) => ({ errorId: Number(m[1]) }) },

      // ─── Git ───────────────────────────────────────────────
      { method: 'GET', pattern: /^\/api\/v1\/git\/context$/, ipcMethod: 'git.context',
        extractParams: (_m, q) => ({ cwd: q.get('cwd') ?? undefined }) },
      { method: 'POST', pattern: /^\/api\/v1\/git\/link-error$/, ipcMethod: 'git.linkError',
        extractParams: (_m, _q, body) => body },
      { method: 'GET', pattern: /^\/api\/v1\/git\/errors\/(\d+)\/commits$/, ipcMethod: 'git.errorCommits',
        extractParams: (m) => ({ errorId: Number(m[1]) }) },
      { method: 'GET', pattern: /^\/api\/v1\/git\/commits\/([a-f0-9]+)\/errors$/, ipcMethod: 'git.commitErrors',
        extractParams: (m) => ({ commitHash: m[1] }) },
      { method: 'GET', pattern: /^\/api\/v1\/git\/diff$/, ipcMethod: 'git.diff',
        extractParams: (_m, q) => ({ cwd: q.get('cwd') ?? undefined }) },

      // ─── Terminal ──────────────────────────────────────────
      { method: 'POST', pattern: /^\/api\/v1\/terminal\/register$/, ipcMethod: 'terminal.register',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/terminal\/heartbeat$/, ipcMethod: 'terminal.heartbeat',
        extractParams: (_m, _q, body) => body },
      { method: 'POST', pattern: /^\/api\/v1\/terminal\/disconnect$/, ipcMethod: 'terminal.disconnect',
        extractParams: (_m, _q, body) => body },

      // ─── Learning ──────────────────────────────────────────
      { method: 'POST', pattern: /^\/api\/v1\/learning\/run$/, ipcMethod: 'learning.run',
        extractParams: () => ({}) },
    ];
  }

  private json(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }
}
