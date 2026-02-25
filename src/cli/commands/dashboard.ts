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
        const templates = insightList.filter((i: InsightItem) => i.type === 'template_candidate' || i.title?.includes('Template'));
        const suggestions = insightList.filter((i: InsightItem) => i.type === 'suggestion' || i.type === 'project_suggestion');
        const trends = insightList.filter((i: InsightItem) => i.type === 'trend' || i.type === 'pattern');
        const gaps = insightList.filter((i: InsightItem) => i.type === 'gap');
        const warnings = insightList.filter((i: InsightItem) => i.type === 'warning');
        const synergies = insightList.filter((i: InsightItem) => i.type === 'synergy' || i.type === 'optimization');

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
    return `<div class="lang-row"><span class="lang-name">${esc(lang)}</span><div class="lang-bar-bg"><div class="lang-bar" data-width="${pct}"></div></div><span class="lang-count">${count}</span></div>`;
  }).join('\n');

  // Build insight cards
  function insightCards(items: InsightItem[], color: string): string {
    if (!items.length) return '<p class="empty">Keine Insights in dieser Kategorie.</p>';
    return items.slice(0, 30).map(i => {
      const prio = i.priority ? `<span class="prio prio-${String(i.priority).toLowerCase()}">${esc(String(i.priority))}</span>` : '';
      return `<div class="insight-card ${color}"><div class="insight-header">${prio}<strong>${esc(i.title)}</strong></div><p>${esc((i.description || '').slice(0, 200))}</p></div>`;
    }).join('\n');
  }

  const totalKnowledge = stats.modules + stats.synapses + stats.errors + stats.solutions;
  const activityLevel = Math.min(100, Math.round((stats.insights / Math.max(1, totalKnowledge)) * 1000));

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brain — Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#04060e;--bg2:rgba(10,12,24,.7);--bg3:rgba(20,24,50,.6);--bg4:rgba(30,35,70,.5);
    --glass:rgba(15,18,40,.55);--glass-border:rgba(100,120,255,.12);--glass-hover:rgba(100,120,255,.2);
    --text:#e8eaf6;--text2:#8b8fb0;--text3:#4a4d6e;
    --blue:#5b9cff;--red:#ff5577;--green:#3dffa0;
    --purple:#b47aff;--orange:#ffb347;--cyan:#47e5ff;
    --accent:linear-gradient(135deg,#b47aff,#5b9cff,#47e5ff);
    --radius:16px;--radius-sm:10px;
  }
  html{scroll-behavior:smooth}
  body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;overflow-x:hidden}

  /* Neural canvas background */
  #neural-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}

  /* Ambient glow orbs */
  .orb{position:fixed;border-radius:50%;filter:blur(120px);opacity:.12;pointer-events:none;z-index:0}
  .orb-1{width:600px;height:600px;background:var(--purple);top:-200px;left:-100px;animation:orb-float 20s ease-in-out infinite}
  .orb-2{width:500px;height:500px;background:var(--blue);bottom:-150px;right:-100px;animation:orb-float 25s ease-in-out infinite reverse}
  .orb-3{width:400px;height:400px;background:var(--cyan);top:40%;left:50%;animation:orb-float 18s ease-in-out infinite 5s}
  @keyframes orb-float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(60px,-40px) scale(1.1)}66%{transform:translate(-40px,60px) scale(.9)}}

  .container{max-width:1400px;margin:0 auto;padding:0 28px;position:relative;z-index:1}

  /* Reveal animations */
  .reveal{opacity:0;transform:translateY(30px);transition:opacity .6s ease,transform .6s ease}
  .reveal.visible{opacity:1;transform:translateY(0)}
  .reveal-delay-1{transition-delay:.1s}.reveal-delay-2{transition-delay:.2s}
  .reveal-delay-3{transition-delay:.3s}.reveal-delay-4{transition-delay:.4s}
  .reveal-delay-5{transition-delay:.5s}

  section{margin-bottom:56px}

  /* Header */
  header{padding:60px 0 24px;text-align:center;position:relative}
  .logo{display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:12px}
  .logo-icon{
    width:68px;height:68px;border-radius:18px;
    background:linear-gradient(135deg,var(--purple),var(--blue),var(--cyan));
    display:flex;align-items:center;justify-content:center;font-size:32px;
    box-shadow:0 0 60px rgba(170,102,255,.35),0 0 120px rgba(90,150,255,.15);
    animation:icon-breathe 4s ease-in-out infinite;
    position:relative;
  }
  .logo-icon::after{
    content:'';position:absolute;inset:-3px;border-radius:20px;
    background:linear-gradient(135deg,var(--purple),var(--cyan));
    opacity:.4;filter:blur(8px);z-index:-1;animation:icon-breathe 4s ease-in-out infinite reverse;
  }
  @keyframes icon-breathe{0%,100%{box-shadow:0 0 60px rgba(170,102,255,.35),0 0 120px rgba(90,150,255,.15)}50%{box-shadow:0 0 80px rgba(170,102,255,.5),0 0 160px rgba(90,150,255,.25)}}
  .logo h1{font-size:2.8rem;font-weight:900;letter-spacing:-1px;background:linear-gradient(135deg,#fff 0%,var(--blue) 50%,var(--purple) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .tagline{color:var(--text2);font-size:1.05rem;font-weight:300;letter-spacing:.5px}

  /* Activity indicator */
  .activity{display:inline-flex;align-items:center;gap:10px;margin-top:16px;padding:8px 20px;border-radius:30px;background:var(--glass);border:1px solid var(--glass-border);backdrop-filter:blur(20px)}
  .activity-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green);animation:pulse-dot 2s ease-in-out infinite}
  @keyframes pulse-dot{0%,100%{opacity:1;box-shadow:0 0 12px var(--green)}50%{opacity:.5;box-shadow:0 0 20px var(--green)}}
  .activity-text{font-size:.8rem;color:var(--text2);font-weight:500}
  .activity-bar{width:80px;height:4px;border-radius:2px;background:var(--bg4);overflow:hidden}
  .activity-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--green),var(--cyan));transition:width 1.5s ease}

  /* Nav */
  nav{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:20px 0;margin-bottom:40px}
  nav a{
    color:var(--text2);text-decoration:none;padding:8px 18px;border-radius:24px;font-size:.85rem;font-weight:500;
    transition:all .3s ease;border:1px solid transparent;backdrop-filter:blur(10px);
  }
  nav a:hover{color:var(--text);background:var(--glass);border-color:var(--glass-border);transform:translateY(-1px)}
  nav a.research{
    background:var(--glass);color:var(--cyan);border-color:rgba(71,229,255,.25);font-weight:600;
    box-shadow:0 0 20px rgba(71,229,255,.1);animation:nav-glow 3s ease-in-out infinite alternate;
  }
  @keyframes nav-glow{0%{box-shadow:0 0 20px rgba(71,229,255,.1)}100%{box-shadow:0 0 35px rgba(71,229,255,.2)}}

  /* Stats */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px}
  .stat-card{
    background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius);
    padding:28px 22px;text-align:center;position:relative;overflow:hidden;
    transition:all .35s ease;backdrop-filter:blur(20px);
  }
  .stat-card:hover{transform:translateY(-4px);border-color:var(--glass-hover);box-shadow:0 20px 60px rgba(0,0,0,.3)}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
  .stat-card::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.03),transparent 70%);pointer-events:none}
  .stat-card.blue::before{background:linear-gradient(90deg,transparent,var(--blue),transparent)}
  .stat-card.purple::before{background:linear-gradient(90deg,transparent,var(--purple),transparent)}
  .stat-card.red::before{background:linear-gradient(90deg,transparent,var(--red),transparent)}
  .stat-card.green::before{background:linear-gradient(90deg,transparent,var(--green),transparent)}
  .stat-card.orange::before{background:linear-gradient(90deg,transparent,var(--orange),transparent)}
  .stat-card.cyan::before{background:linear-gradient(90deg,transparent,var(--cyan),transparent)}
  .stat-number{font-size:2.6rem;font-weight:900;letter-spacing:-2px}
  .stat-card.blue .stat-number{color:var(--blue)}.stat-card.purple .stat-number{color:var(--purple)}
  .stat-card.red .stat-number{color:var(--red)}.stat-card.green .stat-number{color:var(--green)}
  .stat-card.orange .stat-number{color:var(--orange)}.stat-card.cyan .stat-number{color:var(--cyan)}
  .stat-label{color:var(--text2);font-size:.82rem;margin-top:6px;font-weight:500;letter-spacing:.3px;text-transform:uppercase}

  /* Section titles */
  .section-title{font-size:1.5rem;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:12px}
  .section-title .icon{font-size:1.2rem;width:38px;height:38px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px)}

  /* Language chart */
  .lang-chart{max-width:650px}
  .lang-row{display:flex;align-items:center;gap:14px;margin-bottom:10px}
  .lang-name{width:100px;text-align:right;font-size:.85rem;color:var(--text2);font-weight:500}
  .lang-bar-bg{flex:1;height:28px;background:var(--bg3);border-radius:6px;overflow:hidden;border:1px solid var(--glass-border)}
  .lang-bar{height:100%;background:var(--accent);border-radius:6px;width:0;transition:width 1.2s cubic-bezier(.22,1,.36,1)}
  .lang-count{width:50px;font-size:.85rem;color:var(--text2);font-weight:600}

  /* Insight tabs */
  .tab-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
  .tab-btn{
    padding:10px 20px;border-radius:24px;border:1px solid var(--glass-border);
    background:var(--glass);color:var(--text2);cursor:pointer;font-size:.85rem;font-weight:500;
    transition:all .3s ease;backdrop-filter:blur(10px);font-family:inherit;
  }
  .tab-btn:hover{border-color:var(--glass-hover);color:var(--text);transform:translateY(-1px)}
  .tab-btn.active{border-color:rgba(71,229,255,.35);color:var(--cyan);background:rgba(71,229,255,.08);box-shadow:0 0 20px rgba(71,229,255,.1)}
  .tab-btn .count{background:var(--bg4);padding:2px 8px;border-radius:12px;font-size:.72rem;margin-left:6px;font-weight:600}
  .tab-panel{display:none}.tab-panel.active{display:block}
  .insight-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px}
  .insight-card{
    background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius-sm);
    padding:18px;border-left:3px solid var(--text3);transition:all .25s ease;backdrop-filter:blur(20px);
  }
  .insight-card:hover{transform:translateX(6px);border-color:var(--glass-hover);box-shadow:0 8px 30px rgba(0,0,0,.2)}
  .insight-card.cyan{border-left-color:var(--cyan)}.insight-card.orange{border-left-color:var(--orange)}
  .insight-card.green{border-left-color:var(--green)}.insight-card.red{border-left-color:var(--red)}
  .insight-card.purple{border-left-color:var(--purple)}.insight-card.blue{border-left-color:var(--blue)}
  .insight-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
  .insight-card p{color:var(--text2);font-size:.85rem;line-height:1.5}
  .prio{font-size:.68rem;padding:3px 10px;border-radius:12px;text-transform:uppercase;font-weight:700;letter-spacing:.5px}
  .prio-critical{background:rgba(255,85,119,.15);color:var(--red);border:1px solid rgba(255,85,119,.25)}
  .prio-high{background:rgba(255,179,71,.15);color:var(--orange);border:1px solid rgba(255,179,71,.25)}
  .prio-medium{background:rgba(91,156,255,.15);color:var(--blue);border:1px solid rgba(91,156,255,.25)}
  .prio-low{background:rgba(139,143,176,.1);color:var(--text2);border:1px solid rgba(139,143,176,.2)}
  .empty{color:var(--text3);font-style:italic;padding:24px}

  /* Footer */
  footer{text-align:center;padding:40px 0;border-top:1px solid var(--glass-border)}
  footer p{color:var(--text3);font-size:.8rem}
  footer code{background:var(--glass);padding:3px 10px;border-radius:6px;font-size:.78rem;border:1px solid var(--glass-border)}

  /* Responsive */
  @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}.insight-grid{grid-template-columns:1fr}.logo h1{font-size:2rem}}
</style>
</head>
<body>

<canvas id="neural-bg"></canvas>
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>

<div class="container">
  <header class="reveal">
    <div class="logo">
      <div class="logo-icon">&#129504;</div>
      <h1>Brain</h1>
    </div>
    <p class="tagline">Adaptive Code Intelligence</p>
    <div class="activity">
      <span class="activity-dot"></span>
      <span class="activity-text">Neural Activity</span>
      <div class="activity-bar"><div class="activity-fill" style="width:0%" data-target="${activityLevel}"></div></div>
      <span class="activity-text" style="color:var(--cyan);font-weight:700">${activityLevel}%</span>
    </div>
  </header>

  <nav class="reveal reveal-delay-1">
    <a href="#stats">Stats</a>
    <a href="#languages">Languages</a>
    <a href="#research" class="research">&#128300; Research</a>
  </nav>

  <section id="stats" class="reveal reveal-delay-2">
    <div class="section-title"><div class="icon" style="background:rgba(91,156,255,.1)">&#128202;</div> Neural Status</div>
    <div class="stats-grid">
      <div class="stat-card blue"><div class="stat-number">${stats.modules.toLocaleString()}</div><div class="stat-label">Modules</div></div>
      <div class="stat-card purple"><div class="stat-number">${stats.synapses.toLocaleString()}</div><div class="stat-label">Synapses</div></div>
      <div class="stat-card cyan"><div class="stat-number">${stats.insights}</div><div class="stat-label">Insights</div></div>
      <div class="stat-card red"><div class="stat-number">${stats.errors}</div><div class="stat-label">Errors</div></div>
      <div class="stat-card green"><div class="stat-number">${stats.solutions}</div><div class="stat-label">Solutions</div></div>
      <div class="stat-card orange"><div class="stat-number">${stats.rules}</div><div class="stat-label">Rules</div></div>
    </div>
  </section>

  <section id="languages" class="reveal reveal-delay-3">
    <div class="section-title"><div class="icon" style="background:rgba(180,122,255,.1)">&#128187;</div> Languages</div>
    <div class="lang-chart">${langBars}</div>
  </section>

  <section id="research" class="reveal reveal-delay-4">
    <div class="section-title"><div class="icon" style="background:rgba(71,229,255,.1)">&#128300;</div> Research Insights</div>
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="templates">&#127912; Templates <span class="count">${insights.templates.length}</span></button>
      <button class="tab-btn" data-tab="suggestions">&#128161; Suggestions <span class="count">${insights.suggestions.length}</span></button>
      <button class="tab-btn" data-tab="trends">&#128200; Trends <span class="count">${insights.trends.length}</span></button>
      <button class="tab-btn" data-tab="gaps">&#9888;&#65039; Gaps <span class="count">${insights.gaps.length}</span></button>
      <button class="tab-btn" data-tab="synergies">&#9889; Synergies <span class="count">${insights.synergies.length}</span></button>
      <button class="tab-btn" data-tab="warnings">&#128680; Warnings <span class="count">${insights.warnings.length}</span></button>
    </div>
    <div class="tab-panel active" id="tab-templates"><div class="insight-grid">${insightCards(insights.templates, 'cyan')}</div></div>
    <div class="tab-panel" id="tab-suggestions"><div class="insight-grid">${insightCards(insights.suggestions, 'orange')}</div></div>
    <div class="tab-panel" id="tab-trends"><div class="insight-grid">${insightCards(insights.trends, 'green')}</div></div>
    <div class="tab-panel" id="tab-gaps"><div class="insight-grid">${insightCards(insights.gaps, 'red')}</div></div>
    <div class="tab-panel" id="tab-synergies"><div class="insight-grid">${insightCards(insights.synergies, 'purple')}</div></div>
    <div class="tab-panel" id="tab-warnings"><div class="insight-grid">${insightCards(insights.warnings, 'red')}</div></div>
  </section>

  <footer class="reveal reveal-delay-5">
    <p>Brain v1.0 &mdash; <code>brain dashboard</code></p>
  </footer>
</div>

<script>
// --- Neural Network Canvas ---
(function(){
  const canvas = document.getElementById('neural-bg');
  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], mouse = {x:-1000,y:-1000};

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  const NODE_COUNT = Math.min(80, Math.floor(window.innerWidth / 18));
  const CONNECT_DIST = 180;
  const MOUSE_DIST = 200;

  for(let i = 0; i < NODE_COUNT; i++){
    nodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for(let i = 0; i < nodes.length; i++){
      for(let j = i + 1; j < nodes.length; j++){
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < CONNECT_DIST){
          const alpha = (1 - dist / CONNECT_DIST) * 0.15;
          ctx.strokeStyle = 'rgba(91,156,255,' + alpha + ')';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // Mouse interaction
      const mdx = nodes[i].x - mouse.x;
      const mdy = nodes[i].y - mouse.y;
      const mDist = Math.sqrt(mdx*mdx + mdy*mdy);
      if(mDist < MOUSE_DIST){
        const alpha = (1 - mDist / MOUSE_DIST) * 0.4;
        ctx.strokeStyle = 'rgba(180,122,255,' + alpha + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    const time = Date.now() * 0.001;
    for(const n of nodes){
      const glow = 0.4 + Math.sin(time * 1.5 + n.pulse) * 0.3;
      ctx.fillStyle = 'rgba(91,156,255,' + glow + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();

      n.x += n.vx;
      n.y += n.vy;
      if(n.x < 0 || n.x > W) n.vx *= -1;
      if(n.y < 0 || n.y > H) n.vy *= -1;
    }

    requestAnimationFrame(draw);
  }
  draw();
})();

// --- Reveal on scroll ---
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
}, {threshold: 0.1});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// --- Tab switching ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// --- Animate stat numbers ---
const numObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(!e.isIntersecting) return;
    const el = e.target;
    if(el.dataset.animated) return;
    el.dataset.animated = '1';
    const target = parseInt(el.textContent.replace(/\\D/g,''), 10);
    if(isNaN(target) || target === 0) return;
    const duration = 1200;
    const start = performance.now();
    function tick(now){
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * ease).toLocaleString();
      if(t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}, {threshold: 0.5});
document.querySelectorAll('.stat-number').forEach(el => numObserver.observe(el));

// --- Animate language bars ---
setTimeout(() => {
  document.querySelectorAll('.lang-bar').forEach(bar => {
    bar.style.width = bar.dataset.width + '%';
  });
}, 300);

// --- Activity bar ---
setTimeout(() => {
  document.querySelectorAll('.activity-fill').forEach(el => {
    el.style.width = el.dataset.target + '%';
  });
}, 500);
</script>
</body>
</html>`;
}
