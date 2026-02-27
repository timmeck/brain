# Brain

[![npm version](https://img.shields.io/npm/v/@timmeck/brain)](https://www.npmjs.com/package/@timmeck/brain)
[![npm downloads](https://img.shields.io/npm/dm/@timmeck/brain)](https://www.npmjs.com/package/@timmeck/brain)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/timmeck/brain)](https://github.com/timmeck/brain)
[![Smithery](https://smithery.ai/badge/@timmeck/brain)](https://smithery.ai/server/@timmeck/brain)

**Adaptive Error Memory & Code Intelligence MCP Server for Claude Code**

<!-- TODO: Replace with actual recording once setup wizard is recorded -->
<!-- ![Demo](assets/demo.gif) -->

## Quick Start

```bash
npm install -g @timmeck/brain
brain setup
```

That's it. One command configures MCP, hooks, and starts the daemon. Brain is now learning from every error you encounter.

## What Brain Does

### Before Brain: Every session starts from zero

```
You: Fix this TypeError
Claude: *investigates from scratch, tries 3 approaches, 15 minutes later finds the fix*

Next day, same error in another project:
Claude: *investigates from scratch again*
```

### After Brain: Errors get solved faster every time

```
You: Fix this TypeError
Claude: *Brain found 3 similar errors. Solution with 94% confidence:
         "Add null check before accessing .length — this pattern occurs
          in array-processing modules across 4 of your projects."*
Fixed in 30 seconds.
```

### Before Brain: Duplicate code everywhere

```
You: Write a retry wrapper with exponential backoff
Claude: *writes a new implementation*

Meanwhile, you already have 3 retry wrappers across different projects.
```

### After Brain: Code is never rewritten

```
You: Write a retry wrapper
Claude: *Brain found a reusable module: src/utils/retry.ts (project: api-server)
         Reusability score: 0.92, used in 4 projects, 12 imports*
```

### Before Brain: Errors keep recurring

```
Week 1: ECONNRESET on API call → fix with retry
Week 2: Same ECONNRESET → debug from scratch
Week 3: Same pattern in different service → no idea it's related
```

### After Brain: Patterns emerge, prevention kicks in

```
Brain: "⚠ Warning: This code matches antipattern #7 — missing connection
        timeout on HTTP client. This has caused ECONNRESET in 3 projects.
        Suggested fix: add timeout: 5000 to request config."
```

## Features

- **Error Memory** — Track errors, match against known solutions with hybrid search (TF-IDF + vector + synapse boost)
- **Code Intelligence** — Register and discover reusable code modules across all projects
- **Hebbian Synapse Network** — Weighted graph where connections strengthen with use ("neurons that fire together wire together")
- **Auto Error Detection** — PostToolUse hook catches errors in real-time, no manual reporting needed
- **Cross-Project Learning** — Solutions from project A help solve errors in project B
- **Proactive Prevention** — Warns before errors occur when code matches known antipatterns
- **Semantic Search** — Local all-MiniLM-L6-v2 embeddings (23MB, no cloud required) for vector similarity
- **Learning Engine** — Extracts patterns, generates rules, detects antipatterns with adaptive thresholds
- **Research Engine** — Automated trend analysis, gap detection, cross-project synergy mapping
- **Git Integration** — Links errors to commits, tracks which changes introduced or fixed bugs
- **Universal Access** — MCP (stdio + HTTP/SSE), REST API, works with Claude Code, Cursor, Windsurf, Cline

## Architecture

```
+------------------+     +------------------+     +------------------+
|   Claude Code    |     |  Cursor/Windsurf |     |  Browser/CI/CD   |
|   (MCP stdio)    |     |  (MCP HTTP/SSE)  |     |  (REST API)      |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+--------+---------+     +--------+---------+     +--------+---------+
|   MCP Server     |     |   MCP HTTP/SSE   |     |    REST API      |
|   (stdio)        |     |   (port 7778)    |     |   (port 7777)    |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         +----------+-------------+------------------------+
                    |
                    v
         +----------+-----------+
         |      BrainCore       |
         |  (Daemon / Services) |
         +----------+-----------+
                    |
    +-------+-------+--------+--------+
    |       |       |        |        |
    v       v       v        v        v
+---+--+ +--+---+ +-+-----+ +-+----+ +-+--------+
|Error | |Code  | |Synapse| |Git   | |Embedding |
|Memory| |Brain | |Network| |Intel | |Engine    |
+---+--+ +--+---+ +-+-----+ +-+----+ +-+--------+
    |       |       |        |        |
    v       v       v        v        v
+---+--+ +--+---+ +-+-----+ +-+----+ +-+--------+
|Learn | |Module| |Hebbian| |Commit| |Vector    |
|Engine| |Score | |Learn  | |Track | |Search    |
+------+ +------+ +-------+ +------+ +----------+
                    |
                    v
         +----------+-----------+
         |     SQLite (DB)      |
         |  better-sqlite3      |
         +----------------------+

Cross-brain peering via IPC named pipes (\\.\pipe\brain-*, /tmp/brain-*)
```

### Core Components

| Component | Purpose |
|-----------|---------|
| **Error Memory** | Stores errors with fingerprints, matches new errors against known ones using hybrid search |
| **Solution Tracker** | Records solutions with success/fail counts, computes Wilson Score confidence |
| **Code Module Registry** | Indexes code across projects — find reusable modules by language, tags, similarity |
| **Synapse Network** | Weighted graph connecting all entities. Hebbian rule: "neurons that fire together wire together" |
| **Learning Engine** | Extracts patterns from error/solution history, generates preventive rules with adaptive thresholds |
| **Research Engine** | Analyzes trends, detects knowledge gaps, finds cross-project synergies |
| **Git Intelligence** | Links errors to commits, tracks which changes introduced or fixed bugs |
| **Embedding Engine** | Local all-MiniLM-L6-v2 model generates 384-dim vectors for semantic search |
| **REST API** | HTTP API exposing all 40+ Brain methods as RESTful endpoints |
| **MCP HTTP Server** | SSE transport enabling non-Claude MCP clients (Cursor, Windsurf, etc.) |

## MCP Tools

These tools are available to Claude Code (and other MCP clients) when Brain is configured:

| Tool | Description |
|------|-------------|
| `brain_report_error` | Report an error; stores and matches against known errors (hybrid search) |
| `brain_query_error` | Search for similar errors and solutions |
| `brain_report_solution` | Report a working solution; Brain learns from it |
| `brain_report_attempt` | Report a failed attempt; Brain learns what doesn't work |
| `brain_find_reusable_code` | Search for reusable code modules |
| `brain_register_code` | Register a code module as reusable |
| `brain_check_code_similarity` | Check if similar code exists before writing new code |
| `brain_explore` | Explore knowledge via spreading activation |
| `brain_connections` | Find how two concepts are connected |
| `brain_insights` | Get research insights (trends, gaps, synergies) |
| `brain_rate_insight` | Rate an insight as useful or not useful |
| `brain_suggest` | Get suggestions on what to build or improve |
| `brain_status` | Current Brain stats |
| `brain_notifications` | Get pending notifications |
| `brain_ecosystem_status` | Get status of all brains in the ecosystem |
| `brain_query_peer` | Query another brain in the ecosystem (method + params) |
| `brain_error_trading_context` | Correlate an error with trading outcomes from Trading Brain |

## CLI Commands

```
brain setup              One-command setup: MCP + hooks + daemon
brain start              Start the Brain daemon
brain stop               Stop the daemon
brain status             Show stats (errors, solutions, modules, synapses, insights)
brain doctor             Health check: daemon, DB, MCP, hooks
brain projects           List all imported projects with module counts
brain query <text>       Search for errors and solutions
brain modules            List registered code modules
brain insights           Show research insights
brain network            Explore the synapse network
brain learn              Trigger a learning cycle manually
brain explain <id>       Full error report: solutions, chains, rules, insights
brain config             View and manage Brain configuration
brain export             Export Brain data as JSON
brain import <dir>       Import a project directory into Brain
brain dashboard          Generate interactive HTML dashboard (--live for SSE)
brain peers              Show status of peer brains in the ecosystem
```

## REST API

Brain includes a full REST API on port 7777 (default).

### Generic RPC Endpoint

```bash
# Call any Brain method
curl -X POST http://localhost:7777/api/v1/rpc \
  -H "Content-Type: application/json" \
  -d '{"method": "analytics.summary", "params": {}}'

# Batch multiple calls
curl -X POST http://localhost:7777/api/v1/rpc \
  -H "Content-Type: application/json" \
  -d '[
    {"id": 1, "method": "analytics.summary", "params": {}},
    {"id": 2, "method": "synapse.stats", "params": {}}
  ]'
```

### RESTful Endpoints

```bash
# Errors
GET    /api/v1/errors                    # Query errors
POST   /api/v1/errors                    # Report error
GET    /api/v1/errors/:id                # Get error by ID
GET    /api/v1/errors/:id/match          # Find similar errors (hybrid search)
GET    /api/v1/errors/:id/chain          # Get error chain

# Solutions
POST   /api/v1/solutions                 # Report solution
GET    /api/v1/solutions?errorId=N       # Find solutions for error
GET    /api/v1/solutions/efficiency       # Efficiency analysis

# Code
POST   /api/v1/code/analyze              # Analyze and register code
POST   /api/v1/code/find                 # Find reusable code
POST   /api/v1/code/similarity           # Check code similarity
GET    /api/v1/code/modules              # List modules

# Analytics
GET    /api/v1/analytics/summary         # Brain summary
GET    /api/v1/analytics/health          # Health score
GET    /api/v1/analytics/timeline        # Error timeline
GET    /api/v1/analytics/explain/:id     # Full error explanation

# Git
GET    /api/v1/git/context               # Current git info
POST   /api/v1/git/link-error            # Link error to commit

# Meta
GET    /api/v1/health                    # API health check
GET    /api/v1/methods                   # List all 40+ available methods
```

### Authentication

```bash
BRAIN_API_KEY=your-secret-key brain start
curl -H "X-API-Key: your-secret-key" http://localhost:7777/api/v1/analytics/summary
```

## Setup with Cursor / Windsurf / Cline / Continue

Brain supports MCP over HTTP with SSE transport:

```json
{
  "brain": {
    "url": "http://localhost:7778/sse"
  }
}
```

Make sure the Brain daemon is running (`brain start`).

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `BRAIN_DATA_DIR` | `~/.brain` | Data directory |
| `BRAIN_LOG_LEVEL` | `info` | Log level |
| `BRAIN_API_PORT` | `7777` | REST API port |
| `BRAIN_API_KEY` | — | API authentication key |
| `BRAIN_MCP_HTTP_PORT` | `7778` | MCP HTTP/SSE port |
| `BRAIN_API_ENABLED` | `true` | Enable REST API |
| `BRAIN_MCP_HTTP_ENABLED` | `true` | Enable MCP HTTP |
| `BRAIN_EMBEDDINGS_ENABLED` | `true` | Enable local embeddings |
| `BRAIN_EMBEDDINGS_MODEL` | `Xenova/all-MiniLM-L6-v2` | Embedding model |

## How It Learns

1. **Error Reported** — Claude encounters an error (hook catches it automatically or via `brain_report_error`)
2. **Context Enriched** — Brain captures task context, working directory, command, git branch, and diff
3. **Hybrid Matched** — Error is compared against known errors using TF-IDF signals, vector embeddings, and synapse proximity
4. **Solution Found** — When the error is fixed, `brain_report_solution` records the fix
5. **Synapses Form** — Brain creates weighted connections: error ↔ solution, error ↔ code module, module ↔ dependency
6. **Confidence Updates** — Wilson Score Interval computes conservative confidence from success/fail history
7. **Patterns Emerge** — Learning engine extracts recurring patterns with adaptive thresholds
8. **Research Runs** — Background analysis finds trends, gaps, and cross-project synergies
9. **Embeddings Computed** — Background sweep generates vector embeddings for semantic search
10. **Next Time** — When a similar error appears, Brain instantly suggests the proven solution — even from other projects

## Brain Ecosystem

Brain is part of the **Brain Ecosystem** — a family of standalone MCP servers that give Claude Code persistent, self-learning memory.

| Brain | Purpose | Ports |
|-------|---------|-------|
| **Brain** | Error memory & code intelligence | **7777** / 7778 |
| [Trading Brain](https://github.com/timmeck/trading-brain) | Adaptive trading intelligence | 7779 / 7780 |
| [Marketing Brain](https://github.com/timmeck/marketing-brain) | Content strategy & engagement | 7781 / 7782 |
| [Brain Core](https://github.com/timmeck/brain-core) v1.5.0 | Shared infrastructure (IPC, MCP, REST, CLI, math, synapses) | — |
| [Brain Hub](https://timmeck.github.io/brain-hub/) | Ecosystem landing page | — |

Each brain is **fully standalone** — [Brain Core](https://www.npmjs.com/package/@timmeck/brain-core) provides shared infrastructure (IPC, MCP, REST API, CLI, math, synapse algorithms) used by all brains, eliminating ~2,800 lines of duplicated code.

### Cross-Brain Communication

Brains discover and query each other at runtime via IPC named pipes. Use `brain peers` to see online peers, or the `brain_query_peer` / `brain_ecosystem_status` MCP tools to access peer data from Claude Code. Brains also push event notifications to each other — when Brain reports an error, Trading Brain and Marketing Brain are notified automatically.

## Tech Stack

- **TypeScript** — Full type safety, ES2022 target, ESM modules
- **better-sqlite3** — Fast, embedded, synchronous database
- **MCP SDK** — Model Context Protocol integration (stdio + HTTP/SSE transports)
- **@huggingface/transformers** — Local ONNX-based sentence embeddings (all-MiniLM-L6-v2)
- **Commander** — CLI framework
- **Chalk** — Colored terminal output
- **Winston** — Structured logging
- **Vitest** — Testing (189 tests)

## License

[MIT](LICENSE)
