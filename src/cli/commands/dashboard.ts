import { Command } from 'commander';
import { withIpc } from '../ipc-helper.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export function dashboardCommand(): Command {
  return new Command('dashboard')
    .description('Generate and open the Brain dashboard with live data')
    .option('-o, --output <path>', 'Output HTML file path')
    .option('--no-open', 'Generate without opening in browser')
    .action(async (opts) => {
      await withIpc(async (client) => {
        console.log('Fetching data from Brain...');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summary: any = await client.request('analytics.summary', {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const network: any = await client.request('synapse.stats', {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insights: any = await client.request('research.insights', {
          activeOnly: true,
          limit: 500,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modules: any = await client.request('code.modules', {});

        // Collect language stats
        const langStats: Record<string, number> = {};
        const projectSet = new Set<string>();
        if (Array.isArray(modules)) {
          for (const m of modules) {
            langStats[m.language] = (langStats[m.language] || 0) + 1;
            if (m.projectId) projectSet.add(String(m.projectId));
          }
        }

        // Categorize insights
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insightList = Array.isArray(insights) ? insights : [];
        const templates = insightList.filter((i: { type: string }) => i.type === 'template_candidate' || i.title?.includes('Template'));
        const suggestions = insightList.filter((i: { type: string }) => i.type === 'suggestion' || i.type === 'project_suggestion');
        const trends = insightList.filter((i: { type: string }) => i.type === 'trend' || i.type === 'pattern');
        const gaps = insightList.filter((i: { type: string }) => i.type === 'gap');
        const warnings = insightList.filter((i: { type: string }) => i.type === 'warning');
        const synergies = insightList.filter((i: { type: string }) => i.type === 'synergy' || i.type === 'optimization');

        const data = {
          stats: {
            modules: summary.modules?.total ?? 0,
            synapses: network.totalSynapses ?? 0,
            errors: summary.errors?.total ?? 0,
            solutions: summary.solutions?.total ?? 0,
            rules: summary.rules?.active ?? 0,
            insights: insightList.length,
          },
          langStats,
          insights: { templates, suggestions, trends, gaps, warnings, synergies },
        };

        const html = generateHtml(data);
        const outPath = opts.output
          ? resolve(opts.output)
          : resolve(import.meta.dirname, '../../../dashboard.html');

        writeFileSync(outPath, html, 'utf-8');
        console.log(`Dashboard written to ${outPath}`);
        console.log(`  Modules: ${data.stats.modules}`);
        console.log(`  Synapses: ${data.stats.synapses}`);
        console.log(`  Insights: ${data.stats.insights}`);

        if (opts.open !== false) {
          const { exec } = await import('child_process');
          exec(`start "" "${outPath}"`);
        }
      });
    });
}

interface InsightItem {
  type: string;
  title: string;
  description?: string;
  priority?: string;
}

interface DashboardData {
  stats: {
    modules: number;
    synapses: number;
    errors: number;
    solutions: number;
    rules: number;
    insights: number;
  };
  langStats: Record<string, number>;
  insights: {
    templates: InsightItem[];
    suggestions: InsightItem[];
    trends: InsightItem[];
    gaps: InsightItem[];
    warnings: InsightItem[];
    synergies: InsightItem[];
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHtml(data: DashboardData): string {
  const { stats, langStats, insights } = data;

  // Build language chart bars
  const sortedLangs = Object.entries(langStats).sort((a, b) => b[1] - a[1]);
  const maxLang = sortedLangs[0]?.[1] || 1;
  const langBars = sortedLangs.slice(0, 12).map(([lang, count]) => {
    const pct = Math.round((count / maxLang) * 100);
    return `<div class="lang-row"><span class="lang-name">${esc(lang)}</span><div class="lang-bar-bg"><div class="lang-bar" style="width:${pct}%"></div></div><span class="lang-count">${count}</span></div>`;
  }).join('\n');

  // Build insight cards
  function insightCards(items: InsightItem[], color: string): string {
    if (!items.length) return '<p class="empty">Keine Insights in dieser Kategorie.</p>';
    return items.slice(0, 30).map(i => {
      const prio = i.priority ? `<span class="prio prio-${String(i.priority).toLowerCase()}">${esc(String(i.priority))}</span>` : '';
      return `<div class="insight-card ${color}"><div class="insight-header">${prio}<strong>${esc(i.title)}</strong></div><p>${esc((i.description || '').slice(0, 200))}</p></div>`;
    }).join('\n');
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brain — Dashboard</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#07070d;--bg2:#0d0d18;--bg3:#131325;--bg4:#1a1a35;
    --text:#e0e0f0;--text2:#8888aa;--text3:#555577;
    --blue:#4488ff;--red:#ff4466;--green:#44ff88;
    --purple:#aa66ff;--orange:#ffaa44;--cyan:#44ddff;
    --radius:12px;--radius-sm:8px;
  }
  html{scroll-behavior:smooth}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}
  .container{max-width:1400px;margin:0 auto;padding:0 24px}
  section{margin-bottom:48px}

  /* Header */
  header{padding:40px 0 20px;text-align:center}
  .logo{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px}
  .logo-icon{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,var(--purple),var(--blue));display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 0 40px rgba(170,102,255,.3)}
  .logo h1{font-size:2.2rem;font-weight:800;background:linear-gradient(135deg,#fff,var(--blue),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .tagline{color:var(--text2);font-size:1rem}
  .generated{color:var(--text3);font-size:.75rem;margin-top:8px}

  /* Nav */
  nav{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;padding:16px 0;margin-bottom:32px}
  nav a{color:var(--text2);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:.85rem;transition:all .2s;border:1px solid transparent}
  nav a:hover{color:var(--text);background:var(--bg3);border-color:var(--bg4)}
  nav a.research{background:var(--bg3);color:var(--cyan);border-color:var(--cyan);font-weight:600;animation:research-pulse 2s ease-in-out infinite alternate}
  @keyframes research-pulse{0%{box-shadow:0 0 8px rgba(68,221,255,.2)}100%{box-shadow:0 0 20px rgba(68,221,255,.4)}}

  /* Stats */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
  .stat-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:var(--radius);padding:24px 20px;text-align:center;position:relative;overflow:hidden;transition:transform .2s}
  .stat-card:hover{transform:translateY(-2px)}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
  .stat-card.blue::before{background:var(--blue)}.stat-card.purple::before{background:var(--purple)}
  .stat-card.red::before{background:var(--red)}.stat-card.green::before{background:var(--green)}
  .stat-card.orange::before{background:var(--orange)}.stat-card.cyan::before{background:var(--cyan)}
  .stat-number{font-size:2.2rem;font-weight:800;letter-spacing:-1px}
  .stat-card.blue .stat-number{color:var(--blue)}.stat-card.purple .stat-number{color:var(--purple)}
  .stat-card.red .stat-number{color:var(--red)}.stat-card.green .stat-number{color:var(--green)}
  .stat-card.orange .stat-number{color:var(--orange)}.stat-card.cyan .stat-number{color:var(--cyan)}
  .stat-label{color:var(--text2);font-size:.85rem;margin-top:4px}

  /* Section titles */
  .section-title{font-size:1.4rem;font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:10px}
  .section-title .icon{font-size:1.2rem;width:34px;height:34px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center}

  /* Language chart */
  .lang-chart{max-width:600px}
  .lang-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .lang-name{width:90px;text-align:right;font-size:.85rem;color:var(--text2);font-weight:500}
  .lang-bar-bg{flex:1;height:24px;background:var(--bg3);border-radius:4px;overflow:hidden}
  .lang-bar{height:100%;background:linear-gradient(90deg,var(--blue),var(--purple));border-radius:4px;transition:width .5s ease}
  .lang-count{width:50px;font-size:.85rem;color:var(--text2);font-weight:600}

  /* Insight tabs */
  .tab-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
  .tab-btn{padding:8px 18px;border-radius:20px;border:1px solid var(--bg4);background:var(--bg2);color:var(--text2);cursor:pointer;font-size:.85rem;transition:all .2s}
  .tab-btn:hover{border-color:var(--text3);color:var(--text)}
  .tab-btn.active{border-color:var(--cyan);color:var(--cyan);background:var(--bg3)}
  .tab-btn .count{background:var(--bg4);padding:1px 7px;border-radius:10px;font-size:.75rem;margin-left:6px}
  .tab-panel{display:none}.tab-panel.active{display:block}
  .insight-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px}
  .insight-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:var(--radius-sm);padding:16px;border-left:3px solid var(--text3);transition:transform .15s}
  .insight-card:hover{transform:translateX(4px)}
  .insight-card.cyan{border-left-color:var(--cyan)}.insight-card.orange{border-left-color:var(--orange)}
  .insight-card.green{border-left-color:var(--green)}.insight-card.red{border-left-color:var(--red)}
  .insight-card.purple{border-left-color:var(--purple)}.insight-card.blue{border-left-color:var(--blue)}
  .insight-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
  .insight-card p{color:var(--text2);font-size:.85rem}
  .prio{font-size:.7rem;padding:2px 8px;border-radius:10px;text-transform:uppercase;font-weight:600}
  .prio-critical{background:rgba(255,68,102,.2);color:var(--red)}
  .prio-high{background:rgba(255,170,68,.2);color:var(--orange)}
  .prio-medium{background:rgba(68,136,255,.2);color:var(--blue)}
  .prio-low{background:rgba(136,136,170,.2);color:var(--text2)}
  .empty{color:var(--text3);font-style:italic;padding:20px}

  /* Responsive */
  @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}.insight-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="logo">
      <div class="logo-icon">&#129504;</div>
      <h1>Brain</h1>
    </div>
    <p class="tagline">Adaptive Code Intelligence Dashboard</p>
    <p class="generated">Generiert: ${new Date().toLocaleString('de-DE')}</p>
  </header>

  <nav>
    <a href="#stats">Stats</a>
    <a href="#languages">Sprachen</a>
    <a href="#research" class="research">&#128300; Forscher</a>
  </nav>

  <section id="stats">
    <div class="section-title"><div class="icon" style="background:rgba(68,136,255,.15)">&#128202;</div> Status</div>
    <div class="stats-grid">
      <div class="stat-card blue"><div class="stat-number">${stats.modules.toLocaleString()}</div><div class="stat-label">Code Module</div></div>
      <div class="stat-card purple"><div class="stat-number">${stats.synapses.toLocaleString()}</div><div class="stat-label">Synapsen</div></div>
      <div class="stat-card cyan"><div class="stat-number">${stats.insights}</div><div class="stat-label">Insights</div></div>
      <div class="stat-card red"><div class="stat-number">${stats.errors}</div><div class="stat-label">Fehler</div></div>
      <div class="stat-card green"><div class="stat-number">${stats.solutions}</div><div class="stat-label">Lösungen</div></div>
      <div class="stat-card orange"><div class="stat-number">${stats.rules}</div><div class="stat-label">Regeln</div></div>
    </div>
  </section>

  <section id="languages">
    <div class="section-title"><div class="icon" style="background:rgba(170,102,255,.15)">&#128187;</div> Sprachen</div>
    <div class="lang-chart">${langBars}</div>
  </section>

  <section id="research">
    <div class="section-title"><div class="icon" style="background:rgba(68,221,255,.15)">&#128300;</div> Forscher — Research Insights</div>
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="templates">&#127912; Templates <span class="count">${insights.templates.length}</span></button>
      <button class="tab-btn" data-tab="suggestions">&#128161; Vorschläge <span class="count">${insights.suggestions.length}</span></button>
      <button class="tab-btn" data-tab="trends">&#128200; Trends <span class="count">${insights.trends.length}</span></button>
      <button class="tab-btn" data-tab="gaps">&#9888;&#65039; Lücken <span class="count">${insights.gaps.length}</span></button>
      <button class="tab-btn" data-tab="synergies">&#9889; Synergien <span class="count">${insights.synergies.length}</span></button>
      <button class="tab-btn" data-tab="warnings">&#128680; Warnungen <span class="count">${insights.warnings.length}</span></button>
    </div>
    <div class="tab-panel active" id="tab-templates"><div class="insight-grid">${insightCards(insights.templates, 'cyan')}</div></div>
    <div class="tab-panel" id="tab-suggestions"><div class="insight-grid">${insightCards(insights.suggestions, 'orange')}</div></div>
    <div class="tab-panel" id="tab-trends"><div class="insight-grid">${insightCards(insights.trends, 'green')}</div></div>
    <div class="tab-panel" id="tab-gaps"><div class="insight-grid">${insightCards(insights.gaps, 'red')}</div></div>
    <div class="tab-panel" id="tab-synergies"><div class="insight-grid">${insightCards(insights.synergies, 'purple')}</div></div>
    <div class="tab-panel" id="tab-warnings"><div class="insight-grid">${insightCards(insights.warnings, 'red')}</div></div>
  </section>

  <footer style="text-align:center;padding:32px 0;color:var(--text3);font-size:.8rem">
    Brain v1.0 — Aktualisieren: <code style="background:var(--bg3);padding:2px 8px;border-radius:4px">brain dashboard</code>
  </footer>
</div>

<script>
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});
// Animate numbers
document.querySelectorAll('.stat-number').forEach(el => {
  const target = parseInt(el.textContent.replace(/\\D/g,''), 10);
  if (isNaN(target) || target === 0) return;
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString();
    if (current >= target) clearInterval(interval);
  }, 25);
});
</script>
</body>
</html>`;
}
