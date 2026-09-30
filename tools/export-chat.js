// Convert a Claude Code session (.jsonl) to Markdown + a self-contained HTML chat page.
// Usage: node tools/export-chat.js [session.jsonl] [--out=chat_history]
// Default input: newest .jsonl in ~/.claude/projects/<this project>/ that has real chat text.
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const outDir = (args.find(a => a.startsWith('--out=')) || '--out=chat_history').slice(6);
let file = args.find(a => !a.startsWith('--'));

if (!file) {
  const dir = path.join(os.homedir(), '.claude', 'projects');
  const cands = [];
  for (const d of fs.readdirSync(dir)) {
    if (!/bathrone|sole-?blessed/i.test(d)) continue;
    for (const f of fs.readdirSync(path.join(dir, d))) {
      if (f.endsWith('.jsonl')) { const p = path.join(dir, d, f); cands.push({ p, m: fs.statSync(p).mtimeMs }); }
    }
  }
  cands.sort((a, b) => b.m - a.m);
  for (const c of cands) { if (parse(c.p).length > 2) { file = c.p; break; } }
  if (!file) { console.error('no session found'); process.exit(1); }
}

// Strip harness-injected blocks so only what the person actually typed/read remains.
function clean(t) {
  return t
    .replace(/<(system-reminder|ide_[a-z_]+|local-command-[a-z]+|command-[a-z]+|pasted_content[^>]*)>[\s\S]*?<\/\1>/g, '')
    .replace(/<(command-name|command-message|command-args)>[\s\S]*?<\/\1>/g, '')
    .trim();
}

// Hide local machine details (user name, temp/transcript paths) before sharing.
function redact(t) {
  return t
    .replace(/\[Image: source: [^\]]*\]/g, '')
    // Transcript / temp paths from compaction summaries: drop the whole path.
    .replace(/(?:[A-Za-z]:\\Users\\[^\\\s`'"]+|~|\/(?:Users|home)\/[^\/\s`'"]+)[\\\/]\.claude[^\s`'"]*/g, '[transcript path removed]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s`'"]+/g, '~')
    .replace(/\/(?:Users|home)\/[^\/\s`'"]+/g, '~')
    .trim();
}

function parse(p) {
  const out = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if ((o.type !== 'user' && o.type !== 'assistant') || o.isSidechain || !o.message) continue;
    const c = o.message.content;
    const parts = typeof c === 'string' ? [c] : (c || []).filter(b => b.type === 'text').map(b => b.text);
    const text = redact(clean(parts.join('\n\n')));
    const images = (Array.isArray(c) ? c : [])
      .filter(b => b.type === 'image' && b.source && b.source.type === 'base64')
      .map(b => ({ type: b.source.media_type, data: b.source.data }));
    if (!text && !images.length) continue;
    out.push({ role: o.type, time: o.timestamp || '', text, images });
  }
  return out;
}

const msgs = parse(file);
fs.mkdirSync(outDir, { recursive: true });

const fmt = t => (t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '');
const md = ['# Sole Blessed — conversation', '', `${msgs.length} messages · ${fmt(msgs[0]?.time)} → ${fmt(msgs[msgs.length - 1]?.time)}`, ''];
let imgN = 0;
for (const m of msgs) {
  for (const im of m.images) {
    im.file = `image-${++imgN}.${im.type.split('/')[1].replace('jpeg', 'jpg')}`;
    fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'images', im.file), Buffer.from(im.data, 'base64'));
  }
  const pics = m.images.map(im => `![${im.file}](images/${im.file})`).join('\n\n');
  md.push(`## ${m.role === 'user' ? '🧑 User' : '🤖 Assistant'}${m.time ? ' · ' + fmt(m.time) : ''}`, '', [m.text, pics].filter(Boolean).join('\n\n'), '');
}
fs.writeFileSync(path.join(outDir, 'conversation.md'), md.join('\n'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Tiny markdown: fenced code, inline code, bold, links, line breaks.
function render(t) {
  const blocks = [];
  t = t.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, c) => { blocks.push(`<pre><code>${esc(c)}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
  t = esc(t)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sole Blessed — conversation</title>
<style>
:root{--bg:#f5f3ee;--fg:#1d1b16;--user:#2d5a8c;--userfg:#fff;--bot:#fff;--line:#ddd8cc;--code:#efece4}
@media(prefers-color-scheme:dark){:root{--bg:#15140f;--fg:#ece8dc;--user:#3b6ea5;--bot:#23211a;--line:#37342a;--code:#1c1a14}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;z-index:2}
header h1{font-size:16px;margin:0 0 6px}
input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bot);color:var(--fg);font:inherit}
main{max-width:820px;margin:0 auto;padding:12px 16px 60px}
.m{margin:14px 0;display:flex;flex-direction:column}
.m.user{align-items:flex-end}
.b{max-width:92%;padding:10px 14px;border-radius:14px;background:var(--bot);border:1px solid var(--line);overflow-wrap:anywhere}
.user .b{background:var(--user);color:var(--userfg);border-color:var(--user)}
.t{font-size:11px;opacity:.6;margin:0 6px 3px}
code{background:var(--code);padding:1px 4px;border-radius:4px;font-size:13px}
pre{background:var(--code);padding:10px;border-radius:8px;overflow-x:auto;margin:8px 0}
pre code{padding:0;background:none}
a{color:inherit}
img{display:block;max-width:100%;max-height:70vh;border-radius:8px;margin:8px 0;cursor:zoom-in}
.hide{display:none}
</style></head><body>
<header><h1>Sole Blessed — conversation <small>(${msgs.length} messages)</small></h1>
<input id="q" type="search" placeholder="Search…"></header>
<main id="list">
${msgs.map(m => `<div class="m ${m.role}"><div class="t">${m.role === 'user' ? 'User' : 'Assistant'} · ${fmt(m.time)}</div><div class="b">${render(m.text)}${m.images.map(im => `<img src="data:${im.type};base64,${im.data}" alt="">`).join('')}</div></div>`).join('\n')}
</main>
<script>
document.addEventListener('click',function(e){if(e.target.tagName=='IMG')e.target.style.maxHeight=e.target.style.maxHeight?'':'none'});
var q=document.getElementById('q'),items=[].slice.call(document.querySelectorAll('.m'));
q.addEventListener('input',function(){var v=q.value.toLowerCase();items.forEach(function(e){e.classList.toggle('hide',v&&e.textContent.toLowerCase().indexOf(v)<0)})});
</script></body></html>`;
fs.writeFileSync(path.join(outDir, 'conversation.html'), html);

console.log(`${path.basename(file)}: ${msgs.length} messages -> ${outDir}/conversation.md, ${outDir}/conversation.html`);
