# Brain

**Adaptive Error Memory & Code Intelligence System for Claude Code**

Brain is an MCP server that gives Claude Code a persistent memory. It remembers every error you've encountered, every solution that worked (or didn't), and every code module across all your projects. Over time, it learns — strengthening connections between related concepts through a Hebbian synapse network, surfacing patterns, and proactively suggesting solutions before you even ask.

## Why Brain?

Without Brain, Claude Code starts fresh every session. With Brain:

- **Errors are solved faster** — Brain matches new errors against its database and suggests proven solutions with confidence scores
- **Code is never rewritten** — Before writing new code, Brain checks if similar modules already exist across your projects
- **Patterns emerge automatically** — The research engine analyzes your codebase to find trends, gaps, and synergies
- **Knowledge compounds** — Every fix, every module, every session makes Brain smarter
- **Errors are caught automatically** — Hooks detect errors in real-time and report them to Brain without manual intervention

## Features

- **Error Memory** — Track errors, match against known solutions, learn from successes and failures
- **Code Intelligence** — Register and discover reusable code modules across projects
- **Hebbian Synapse Network** — Weighted graph connecting errors, solutions, code modules, and concepts. Connections strengthen with use (like biological synapses)
- **Spreading Activation** — Explore related knowledge by activating nodes in the synapse network
- **Research Engine** — Automated analysis producing actionable insights: trends, gaps, synergies, template candidates
- **Learning Engine** — Pattern extraction, rule generation, confidence decay, antipattern detection
- **Auto Error Detection** — PostToolUse hook automatically captures errors from Bash commands and reports them to Brain
- **Interactive Dashboard** — HTML dashboard with live stats, language distribution chart, and categorized insights
- **Project Management** — Import entire codebases, track modules per project, view stats across all projects
- **Health Diagnostics** — Built-in doctor command checks daemon, database, MCP config, and hooks
- **Auto Update Check** — Notifies you when a new version is available on npm
- **Full CLI** — 16 commands to query, explore, manage, and diagnose Brain from the terminal
- **MCP Integration** — 13 tools exposed to Claude Code via Model Context Protocol

## Quick Start

### Installation

```bash
npm install -g @timmeck/brain
```

Or from source:

```bash
git clone https://github.com/timmeck/brain.git
cd brain
npm install
npm run build
```

### Setup with Claude Code

Add Brain's MCP server and auto-detect hook to your Claude Code configuration (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "brain": {
      "command": "brain",
      "args": ["mcp-server"]
    }
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": {
          "tool_name": "Bash"
        },
        "command": "node C:\\Users\\<YOU>\\AppData\\Roaming\\npm\\node_modules\\@timmeck\\brain\\dist\\hooks\\post-tool-use.js"
      }
    ]
  }
}
```

> **Note:** Replace `<YOU>` with your Windows username. On macOS/Linux, the path is the global npm prefix (run `npm prefix -g` to find it).

### Start the Daemon

```bash
brain start
brain status
brain doctor    # verify everything is configured correctly
```

The daemon runs background tasks: learning cycles, research analysis, synapse maintenance, and confidence decay.

### Import Your Projects

```bash
brain import ./my-project
brain projects              # see all imported projects
```

Brain scans for source files (TypeScript, JavaScript, Python, Rust, Go, Shell, HTML, CSS, JSON, YAML, TOML, Markdown, SQL, and more) and registers code modules with reusability scores.

## Architecture

```
+------------------+     +------------------+     +------------------+
|   Claude Code    |     |     CLI          |     |    Dashboard     |
|   (MCP Client)   |     |   (Commander)    |     |    (HTML)        |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+--------+---------+     +--------+---------+     +--------+---------+
|   MCP Server     |     |   IPC Client     |     |   IPC Client     |
|   (stdio)        |     |                  |     |                  |
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
    +---------------+----------------+
    |               |                |
    v               v                v
+---+----+   +------+------+   +----+--------+
| Error  |   |  Synapse    |   |  Research   |
| Memory |   |  Network    |   |  Engine     |
+---+----+   +------+------+   +----+--------+
    |               |                |
    v               v                v
+---+----+   +------+------+   +----+--------+
| Learn  |   |  Hebbian    |   |  Insights   |
| Engine |   |  Learning   |   |  Generator  |
+--------+   +-------------+   +-------------+
                    |
                    v
         +----------+-----------+
         |     SQLite (DB)      |
         |  better-sqlite3      |
         +----------------------+
```

### Core Components

| Component | Purpose |
|-----------|---------|
| **Error Memory** | Stores errors with fingerprints, matches new errors against known ones |
| **Solution Tracker** | Records solutions with success/fail counts, computes Wilson Score confidence |
| **Code Module Registry** | Indexes code across projects — find reusable modules by language, tags, similarity |
| **Synapse Network** | Weighted graph connecting all entities. Hebbian rule: "neurons that fire together wire together" |
| **Learning Engine** | Extracts patterns from error/solution history, generates preventive rules |
| **Research Engine** | Analyzes trends, detects knowledge gaps, finds cross-project synergies |

## CLI Commands

```
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
brain config             View and manage Brain configuration
brain export             Export Brain data as JSON
brain import <dir>       Import a project directory into Brain
brain dashboard          Generate interactive HTML dashboard
```

## MCP Tools

These tools are available to Claude Code when Brain is configured as an MCP server:

| Tool | Description |
|------|-------------|
| `brain_report_error` | Report an error; stores and matches against known errors |
| `brain_query_error` | Search for similar errors and solutions |
| `brain_report_solution` | Report a working solution; Brain learns from it |
| `brain_report_attempt` | Report a failed attempt; Brain learns what doesn't work |
| `brain_find_reusable_code` | Search for reusable code modules |
| `brain_register_code` | Register a code module as reusable |
| `brain_check_code_similarity` | Check if similar code exists before writing new code |
| `brain_explore` | Explore knowledge via spreading activation |
| `brain_connections` | Find how two concepts are connected |
| `brain_insights` | Get research insights (trends, gaps, synergies) |
| `brain_suggest` | Get suggestions on what to build or improve |
| `brain_status` | Current Brain stats |
| `brain_notifications` | Get pending notifications |

## Auto Error Detection

When the PostToolUse hook is configured, Brain automatically:

1. **Captures errors** — Detects errors from Bash command output (exit codes, error patterns like `TypeError`, `ENOENT`, `npm ERR!`, `BUILD FAILED`, etc.)
2. **Reports to Brain** — Sends the error to the daemon for storage and matching
3. **Suggests solutions** — If Brain has seen a similar error before, it outputs a hint via stderr
4. **Checks antipatterns** — Warns if the error matches a known antipattern

This happens silently in the background — no manual intervention needed.

## How It Learns

1. **Error Reported** — Claude encounters an error and reports it via `brain_report_error` (or the hook catches it automatically)
2. **Solution Found** — When the error is fixed, `brain_report_solution` records the fix
3. **Synapses Form** — Brain creates weighted connections: error ↔ solution, error ↔ code module
4. **Confidence Updates** — Wilson Score Interval computes conservative confidence from success/fail history
5. **Patterns Emerge** — Learning engine extracts recurring patterns and generates preventive rules
6. **Research Runs** — Background analysis finds trends, gaps, and cross-project synergies
7. **Next Time** — When a similar error appears, Brain instantly suggests the proven solution

## Tech Stack

- **TypeScript** — Full type safety
- **better-sqlite3** — Fast, embedded database
- **MCP SDK** — Model Context Protocol integration
- **Commander** — CLI framework
- **Chalk** — Colored terminal output
- **Winston** — Structured logging
- **Vitest** — Testing

## License

[MIT](LICENSE)
