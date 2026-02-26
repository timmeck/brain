import chalk from 'chalk';

// Brand colors matching the dashboard
export const c = {
  // Primary palette
  blue: chalk.hex('#5b9cff'),
  purple: chalk.hex('#b47aff'),
  cyan: chalk.hex('#47e5ff'),
  green: chalk.hex('#3dffa0'),
  red: chalk.hex('#ff5577'),
  orange: chalk.hex('#ffb347'),
  dim: chalk.hex('#8b8fb0'),
  dimmer: chalk.hex('#4a4d6e'),

  // Semantic
  label: chalk.hex('#8b8fb0'),
  value: chalk.white.bold,
  heading: chalk.hex('#5b9cff').bold,
  success: chalk.hex('#3dffa0').bold,
  error: chalk.hex('#ff5577').bold,
  warn: chalk.hex('#ffb347').bold,
  info: chalk.hex('#47e5ff'),
};

export const icons = {
  brain: '🧠',
  check: '✓',
  cross: '✗',
  arrow: '→',
  dot: '●',
  circle: '○',
  bar: '█',
  barLight: '░',
  dash: '─',
  pipe: '│',
  corner: '└',
  tee: '├',
  star: '★',
  bolt: '⚡',
  search: '🔍',
  gear: '⚙',
  chart: '📊',
  module: '📦',
  synapse: '🔗',
  insight: '💡',
  warn: '⚠',
  error: '❌',
  ok: '✅',
  clock: '⏱',
};

export function header(title: string, icon?: string): string {
  const prefix = icon ? `${icon}  ` : '';
  const line = c.dimmer(icons.dash.repeat(40));
  return `\n${line}\n${prefix}${c.heading(title)}\n${line}`;
}

export function keyValue(key: string, value: string | number, indent = 2): string {
  const pad = ' '.repeat(indent);
  return `${pad}${c.label(key + ':')} ${c.value(String(value))}`;
}

export function statusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'resolved':
    case 'active':
    case 'running':
      return c.green(`[${status.toUpperCase()}]`);
    case 'open':
    case 'unresolved':
      return c.red(`[${status.toUpperCase()}]`);
    case 'warning':
      return c.warn(`[${status.toUpperCase()}]`);
    default:
      return c.dim(`[${status.toUpperCase()}]`);
  }
}

export function priorityBadge(priority: number | string): string {
  const p = typeof priority === 'string' ? priority.toLowerCase() : '';
  const n = typeof priority === 'number' ? priority : 0;
  if (p === 'critical' || n >= 9) return c.red.bold(`[CRITICAL]`);
  if (p === 'high' || n >= 7) return c.orange.bold(`[HIGH]`);
  if (p === 'medium' || n >= 4) return c.blue(`[MEDIUM]`);
  return c.dim(`[LOW]`);
}

export function progressBar(current: number, total: number, width = 20): string {
  const pct = Math.min(1, current / Math.max(1, total));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return c.cyan(icons.bar.repeat(filled)) + c.dimmer(icons.barLight.repeat(empty));
}

export function divider(width = 40): string {
  return c.dimmer(icons.dash.repeat(width));
}

export function table(rows: string[][], colWidths?: number[]): string {
  if (rows.length === 0) return '';
  const widths = colWidths ?? rows[0].map((_, i) =>
    Math.max(...rows.map(r => stripAnsi(r[i] ?? '').length))
  );
  return rows.map(row =>
    row.map((cell, i) => {
      const stripped = stripAnsi(cell);
      const pad = Math.max(0, (widths[i] ?? stripped.length) - stripped.length);
      return cell + ' '.repeat(pad);
    }).join('  ')
  ).join('\n');
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
