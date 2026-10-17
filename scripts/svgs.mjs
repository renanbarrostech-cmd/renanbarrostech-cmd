// SVGs animados do perfil: banner, números, pulso, "sobre mim" numa IDE, terminal, fluxo do cadastro,
// barras de progresso, trajetória, chamada final, divisor e botões.
// Funcionam nos temas claro e escuro do GitHub via `prefers-color-scheme` dentro do próprio SVG
// e respeitam `prefers-reduced-motion`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { xml } from "./lib.mjs";

const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";

/** Paleta: claro por padrão, escuro quando o GitHub está no tema escuro. */
const TEMA = `
  :root{--bg:#ffffff;--card:#f6f8fa;--borda:#d0d7de;--texto:#1f2328;--suave:#57606a;--a1:#6d28d9;--a2:#0891b2;--a3:#7c3aed;
    --ok:#1a7f37;--str:#0a7ea4;--kw:#8250df;--num:#bc4c00;--l0:#ebedf0;--l1:#ddd6fe;--l2:#a78bfa;--l3:#7c3aed;--l4:#5b21b6}
  @media (prefers-color-scheme:dark){:root{--bg:#0d1117;--card:#161b22;--borda:#30363d;--texto:#e6edf3;--suave:#8b949e;--a1:#8b5cf6;--a2:#06b6d4;--a3:#a78bfa;
    --ok:#3fb950;--str:#7dd3fc;--kw:#c4b5fd;--num:#fdba74;--l0:#161b22;--l1:#2e2160;--l2:#4c3ba6;--l3:#7c5cf0;--l4:#a78bfa}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;opacity:1!important}}
  text{font-family:${FONTE}}
  .mono{font-family:${MONO}}`;

/**
 * `var(--x)` só funciona em CSS, não em atributos de apresentação (fill="var(--x)").
 * Move fill/stroke/stop-color com var() para o atributo style, juntando com o style existente.
 */
function varsParaStyle(marcacao) {
  return marcacao.replace(/<([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, (tag, nome, attrs, auto) => {
    const decl = [];
    let estilo = "";
    const resto = attrs.replace(/\s+([\w:-]+)="([^"]*)"/g, (m, k, v) => {
      if (k === "style") {
        estilo = v;
        return "";
      }
      if (/^(fill|stroke|stop-color)$/.test(k) && v.includes("var(")) {
        decl.push(`${k}:${v}`);
        return "";
      }
      return m;
    });
    if (!decl.length) return tag;
    const style = [...decl, estilo].filter(Boolean).join(";");
    return `<${nome}${resto} style="${style}"${auto ? "/" : ""}>`;
  });
}

const svg = (w, h, titulo, estilo, corpo) =>
  varsParaStyle(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t">
<title id="t">${xml(titulo)}</title>
<style>${TEMA}${estilo}</style>
<defs>
  <linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--a1)"/><stop offset="1" stop-color="var(--a2)"/></linearGradient>
</defs>
${corpo}
</svg>
`);

const fundo = (w, h) => `<rect width="${w}" height="${h}" rx="16" fill="var(--bg)" stroke="var(--borda)"/>`;

// ------------------------------------------------------------- banner
export function banner() {
  const frases = [
    "Desenvolvedor Full Stack · Junior → Pleno",
    "Next.js · React · TypeScript · Node.js · PostgreSQL",
    "Da planilha ao banco digital: transformo rotina em produto",
  ];
  const linhas = frases
    .map((f, i) => `<text x="40" y="160" class="frase" style="animation-delay:${i * 4}s">${xml(f)}</text>`)
    .join("\n");
  const pontos = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => `<circle cx="${640 + i * 30}" cy="${50 + j * 30}" r="2" class="ponto" style="animation-delay:${(i + j) * 0.15}s"/>`).join(""),
  ).join("");
  return svg(
    860,
    220,
    "Renan Barros, desenvolvedor Full Stack. Next.js, React, TypeScript, Node.js e PostgreSQL.",
    `
  .nome{font-size:50px;font-weight:800;fill:url(#g)}
  .tag{font-size:13px;fill:var(--a1);font-weight:600}
  .frase{font-size:18px;fill:var(--suave);opacity:0;animation:troca 12s linear infinite}
  .cursor{animation:pisca 1s steps(1) infinite}
  .brilho{animation:brilho 6s linear infinite}
  .ponto{fill:var(--a3);opacity:.15;animation:acende 3s ease-in-out infinite}
  .chave{font-size:64px;font-weight:800;fill:url(#g);opacity:.9}
  @keyframes troca{0%{opacity:0}3%,30%{opacity:1}33.3%,100%{opacity:0}}
  @keyframes pisca{50%{opacity:0}}
  @keyframes brilho{from{transform:translateX(-300px)}to{transform:translateX(1160px)}}
  @keyframes acende{50%{opacity:.8}}`,
    `${fundo(860, 220)}
<rect class="brilho" x="0" y="0" width="160" height="4" rx="2" fill="url(#g)"/>
${pontos}
<text x="700" y="140" text-anchor="middle" class="chave mono">&lt;/&gt;</text>
<text x="40" y="58" class="tag mono">~/renan $ whoami<tspan class="cursor">▌</tspan></text>
<text x="40" y="118" class="nome">Renan Barros</text>
${linhas}
<text x="40" y="196" class="tag">Osasco, SP · Brasil</text>`,
  );
}

// ------------------------------------------------------------- Renan em números
export function numeros(n) {
  const cards = [
    [n.repos, "repositórios", "públicos"],
    [n.contribuicoes, "contribuições", "no último ano"],
    [n.commitsRkf, "commits", "no RKF Bank"],
    [n.regua, "régua Pleno", "competências"],
    [n.praticados, "assuntos", "praticados"],
    [n.horas, "horas de formação", "certificadas"],
  ];
  const w = 124;
  const corpo = cards
    .map(
      ([v, a, b], i) => `
  <g class="card" style="animation-delay:${0.2 + i * 0.12}s" transform="translate(${24 + i * (w + 11)},56)">
    <rect width="${w}" height="104" rx="12" fill="var(--card)" stroke="var(--borda)"/>
    <text x="${w / 2}" y="46" text-anchor="middle" class="num">${xml(v ?? "—")}</text>
    <text x="${w / 2}" y="72" text-anchor="middle" class="rot">${xml(a)}</text>
    <text x="${w / 2}" y="88" text-anchor="middle" class="sub">${xml(b)}</text>
  </g>`,
    )
    .join("");
  return svg(
    860,
    184,
    `Renan em números: ${cards.map(([v, a, b]) => `${v ?? "—"} ${a} ${b}`).join(", ")}`,
    `
  .tit{font-size:16px;font-weight:700;fill:var(--texto)}
  .num{font-size:28px;font-weight:800;fill:url(#g)}
  .rot{font-size:12.5px;font-weight:600;fill:var(--texto)}
  .sub{font-size:11px;fill:var(--suave)}
  .card{opacity:0;animation:sobe .7s ease-out forwards}
  @keyframes sobe{from{opacity:0;transform:translateY(8px)}to{opacity:1}}`,
    `${fundo(860, 184)}
  <text x="24" y="36" class="tit">📊 Renan em números</text>${corpo}`,
  );
}

// ------------------------------------------------------------- pulso das últimas semanas
/** dias: [{ data: "AAAA-MM-DD", n }] ordenados; resumo: { seguidos, d7, d30, ultimo, total } */
export function pulso(dias, resumo) {
  const semanas = 22;
  const ultimos = dias.slice(-(semanas * 7));
  // alinha a primeira coluna no domingo
  const primeiro = new Date(`${ultimos[0].data}T12:00:00Z`).getUTCDay();
  const nivel = (n) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 6 ? 2 : n <= 14 ? 3 : 4);
  const cel = ultimos
    .map((d, i) => {
      const k = i + primeiro;
      const col = Math.floor(k / 7);
      const lin = k % 7;
      return `<rect x="${24 + col * 15}" y="${58 + lin * 15}" width="12" height="12" rx="3" class="c l${nivel(d.n)}" style="animation-delay:${(col * 0.04).toFixed(2)}s"><title>${d.data}: ${d.n}</title></rect>`;
    })
    .join("");
  const stats = [
    [`${resumo.seguidos}`, resumo.seguidos === 1 ? "dia seguido" : "dias seguidos", "🔥"],
    [`${resumo.d7}`, "contribuições em 7 dias", "⚡"],
    [`${resumo.d30}`, "contribuições em 30 dias", "📈"],
    [resumo.ultimo ? resumo.ultimo.split("-").reverse().slice(0, 2).join("/") : "—", "último dia com commit", "🕒"],
  ];
  const cards = stats
    .map(
      ([v, r, ic], i) => `
  <g transform="translate(${400 + (i % 2) * 222},${52 + Math.floor(i / 2) * 60})" class="card" style="animation-delay:${0.3 + i * 0.15}s">
    <rect width="210" height="50" rx="10" fill="var(--card)" stroke="var(--borda)"/>
    <text x="14" y="32" class="ic">${ic}</text>
    <text x="44" y="24" class="v">${xml(v)}</text>
    <text x="44" y="40" class="r">${xml(r)}</text>
  </g>`,
    )
    .join("");
  return svg(
    860,
    190,
    `Pulso: ${stats.map(([v, r]) => `${v} ${r}`).join(", ")}`,
    `
  .tit{font-size:16px;font-weight:700;fill:var(--texto)}
  .vivo{fill:#ef4444;animation:pulsa 1.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  .c{opacity:0;animation:aparece .4s ease-out forwards}
  .l0{fill:var(--l0)}.l1{fill:var(--l1)}.l2{fill:var(--l2)}.l3{fill:var(--l3)}.l4{fill:var(--l4)}
  .card{opacity:0;animation:aparece .6s ease-out forwards}
  .v{font-size:17px;font-weight:800;fill:var(--texto)}
  .r{font-size:11px;fill:var(--suave)}
  .ic{font-size:18px}
  .leg{font-size:11px;fill:var(--suave)}
  @keyframes aparece{to{opacity:1}}
  @keyframes pulsa{50%{opacity:.3;transform:scale(.7)}}`,
    `${fundo(860, 190)}
  <circle cx="30" cy="31" r="5" class="vivo"/>
  <text x="44" y="36" class="tit">Pulso das últimas ${semanas} semanas</text>
  <text x="836" y="36" text-anchor="end" class="leg">${resumo.total} contribuições no último ano</text>
  ${cel}${cards}`,
  );
}

// ------------------------------------------------------------- sobre mim (arquivo renan.ts numa IDE)
const SOBRE = [
  [["kw", "const "], ["", "renan "], ["p", "= {"]],
  [["", "  nome"], ["p", ": "], ["str", '"Renan Barros"'], ["p", ","]],
  [["", "  cidade"], ["p", ": "], ["str", '"Osasco, SP"'], ["p", ","]],
  [["", "  papel"], ["p", ": "], ["str", '"Dev Full Stack · Junior → Pleno"'], ["p", ","]],
  [["", "  stack"], ["p", ": ["], ["str", '"Next.js"'], ["p", ", "], ["str", '"React"'], ["p", ", "], ["str", '"TypeScript"'], ["p", ", "], ["str", '"Node.js"'], ["p", ", "], ["str", '"PostgreSQL"'], ["p", "],"]],
  [["", "  aprendendo"], ["p", ": ["], ["str", '"testes no front"'], ["p", ", "], ["str", '"CI/CD"'], ["p", ", "], ["str", '"performance"'], ["p", ", "], ["str", '"inglês"'], ["p", "],"]],
  [["", "  veioDe"], ["p", ": "], ["str", '"planilhas, notas fiscais e faturamento"'], ["p", ","]],
  [["p", "} "], ["kw", "as const"], ["p", ";"]],
  [],
  [["kw", "export function "], ["fn", "proximoPasso"], ["p", "() {"]],
  [["kw", "  return "], ["str", '"Entregar o MVP do RKF Bank e chegar ao Pleno."'], ["p", ";"]],
  [["p", "}"]],
];

export function sobreMim() {
  const linhas = SOBRE.map((segs, i) => {
    const y = 76 + i * 21;
    const spans = segs.map(([c, t]) => `<tspan class="${c || "id"}">${xml(t)}</tspan>`).join("");
    return `<g class="ln" style="animation-delay:${(0.4 + i * 0.32).toFixed(2)}s"><text x="40" y="${y}" class="mono nl">${i + 1}</text><text x="74" y="${y}" class="mono" xml:space="preserve">${spans}</text></g>`;
  }).join("\n");
  const fim = 76 + SOBRE.length * 21;
  return svg(
    860,
    fim + 20,
    "Arquivo renan.ts: nome Renan Barros, Osasco SP, Dev Full Stack Junior para Pleno, stack Next.js, React, TypeScript, Node.js e PostgreSQL",
    `
  .barra{fill:var(--card)}
  .aba{font-size:12px;fill:var(--texto)}
  .nl{font-size:12px;fill:var(--suave)}
  .mono{font-size:13.5px}
  .id{fill:var(--texto)}.p{fill:var(--suave)}.kw{fill:var(--kw)}.str{fill:var(--str)}.fn{fill:var(--a2)}
  .ln{opacity:0;animation:digita .3s ease-out forwards}
  .cursor{fill:var(--a1);animation:pisca 1s steps(1) infinite}
  @keyframes digita{to{opacity:1}}
  @keyframes pisca{50%{opacity:0}}`,
    `${fundo(860, fim + 20)}
  <path d="M1 17 a16 16 0 0 1 16 -16 h826 a16 16 0 0 1 16 16 v23 h-858 z" class="barra"/>
  <circle cx="22" cy="21" r="6" fill="#ff5f57"/><circle cx="42" cy="21" r="6" fill="#febc2e"/><circle cx="62" cy="21" r="6" fill="#28c840"/>
  <rect x="86" y="8" width="104" height="32" rx="6" fill="var(--bg)" stroke="var(--borda)"/>
  <text x="100" y="29" class="aba mono">renan.ts</text>
  ${linhas}
  <rect x="74" y="${fim - 14}" width="8" height="16" class="cursor"/>`,
  );
}

// ------------------------------------------------------------- terminal com o git log real
export function terminal(commits, total) {
  const lista = (commits || []).slice(0, 7);
  const linhas = lista
    .map((c, i) => {
      const y = 96 + i * 22;
      return `<g class="ln" style="animation-delay:${(1.6 + i * 0.35).toFixed(2)}s"><text x="28" y="${y}" class="mono"><tspan class="h">${xml(c.hash)}</tspan> <tspan class="m">${xml(c.assunto.length > 86 ? `${c.assunto.slice(0, 85)}…` : c.assunto)}</tspan></text></g>`;
    })
    .join("\n");
  const yFim = 96 + lista.length * 22 + 12;
  return svg(
    860,
    yFim + 30,
    `Terminal: últimos commits do Renan no RKF Bank. ${total} commits no total.`,
    `
  .barra{fill:var(--card)}
  .mono{font-size:13px}
  .pr{fill:var(--ok)}.cmd{fill:var(--texto)}.h{fill:var(--num)}.m{fill:var(--texto)}.fim{fill:var(--ok);font-weight:700}
  .tit{font-size:12px;fill:var(--suave)}
  .digitando{clip-path:inset(0 100% 0 0);animation:digita 1.2s steps(40) .2s forwards}
  .ln{opacity:0;animation:mostra .2s ease-out forwards}
  @keyframes digita{to{clip-path:inset(0 0 0 0)}}
  @keyframes mostra{to{opacity:1}}`,
    `${fundo(860, yFim + 30)}
  <path d="M1 17 a16 16 0 0 1 16 -16 h826 a16 16 0 0 1 16 16 v19 h-858 z" class="barra"/>
  <circle cx="22" cy="19" r="6" fill="#ff5f57"/><circle cx="42" cy="19" r="6" fill="#febc2e"/><circle cx="62" cy="19" r="6" fill="#28c840"/>
  <text x="430" y="23" text-anchor="middle" class="tit mono">bash — rkf_bank/frontend</text>
  <text x="28" y="66" class="mono digitando"><tspan class="pr">renan@rkf</tspan><tspan class="cmd"> $ git log --oneline --author=renan</tspan></text>
  ${linhas}
  <g class="ln" style="animation-delay:${(1.8 + lista.length * 0.35).toFixed(2)}s"><text x="28" y="${yFim}" class="mono fim">✔ ${total} commits meus no RKF Bank (landing, cadastro, conta, logs e docs)</text></g>`,
  );
}

// ------------------------------------------------------------- fluxo do cadastro (requisição animada)
export function fluxo() {
  const caixas = [
    ["Tela de cadastro", "React"],
    ["useCadastroForm", "hook"],
    ["lib/api", "cliente HTTP"],
    ["Proxy /api", "Next.js"],
    ["Spring Boot", "backend"],
    ["MySQL", "banco"],
  ];
  const w = 118;
  const gap = 20;
  const x0 = 24;
  const cx = (i) => x0 + i * (w + gap) + w / 2;
  const boxes = caixas
    .map(
      ([t, s], i) => `
  <g transform="translate(${x0 + i * (w + gap)},96)">
    <rect width="${w}" height="56" rx="10" fill="var(--card)" stroke="var(--borda)"/>
    <text x="${w / 2}" y="25" text-anchor="middle" class="bt">${xml(t)}</text>
    <text x="${w / 2}" y="42" text-anchor="middle" class="bs">${xml(s)}</text>
  </g>`,
    )
    .join("");
  const setas = caixas
    .slice(0, -1)
    .map((_, i) => `<line x1="${x0 + i * (w + gap) + w}" y1="124" x2="${x0 + (i + 1) * (w + gap)}" y2="124" class="seta"/>`)
    .join("");
  const ida = `M${cx(0)},176 L${cx(5)},176`; // trilha própria, embaixo das caixas
  const xs = cx(4);
  return svg(
    860,
    258,
    "Fluxo do cadastro: tela, hook, cliente HTTP, proxy do Next, Spring Boot, ViaCEP e MySQL, voltando com 201 Created",
    `
  .tit{font-size:16px;font-weight:700;fill:var(--texto)}
  .bt{font-size:12.5px;font-weight:700;fill:var(--texto)}
  .bs{font-size:11px;fill:var(--suave)}
  .seta{stroke:var(--borda);stroke-width:2}
  .trilha{stroke:var(--borda);stroke-width:2;stroke-dasharray:2 6;stroke-linecap:round}
  .desce{stroke:var(--borda);stroke-width:1.5;stroke-dasharray:2 4}
  .pacote{fill:var(--a1)}
  .volta{fill:var(--ok)}
  .resp{font-size:13px;font-weight:700;fill:var(--ok);opacity:0;animation:resp 6s linear infinite}
  .via{font-size:11px;fill:var(--suave)}
  @keyframes resp{0%,70%{opacity:0}78%,95%{opacity:1}100%{opacity:0}}`,
    `${fundo(860, 258)}
  <text x="24" y="36" class="tit">🔁 O que acontece quando alguém se cadastra no RKF Bank</text>
  <g transform="translate(${xs - 59},44)">
    <rect width="118" height="32" rx="8" fill="var(--bg)" stroke="var(--borda)" stroke-dasharray="4 3"/>
    <text x="59" y="21" text-anchor="middle" class="bt">📮 ViaCEP</text>
  </g>
  <line x1="${xs}" y1="76" x2="${xs}" y2="96" class="seta" stroke-dasharray="3 3"/>
  ${setas}${boxes}
  <line x1="${cx(0)}" y1="176" x2="${cx(5)}" y2="176" class="trilha"/>
  ${caixas.map((_, i) => `<line x1="${cx(i)}" y1="152" x2="${cx(i)}" y2="176" class="desce"/>`).join("")}
  <circle r="7" class="pacote"><animateMotion dur="6s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.5;1" calcMode="linear" path="${ida}"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.51;1" dur="6s" repeatCount="indefinite"/></circle>
  <circle r="7" class="volta"><animateMotion dur="6s" repeatCount="indefinite" keyPoints="1;1;0" keyTimes="0;0.5;1" calcMode="linear" path="${ida}"/><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.5;0.51;1" dur="6s" repeatCount="indefinite"/></circle>
  <text x="${cx(0)}" y="206" text-anchor="middle" class="resp">✔ 201 Created</text>
  <text x="24" y="238" class="via">Ida: POST /api/clientes com CPF, contato e CEP · O backend busca o endereço no ViaCEP e grava no MySQL · Volta: 201 + cliente</text>`,
  );
}

// ------------------------------------------------------------- barras de progresso
export function barras(p) {
  const r = p.regua || { praticadas: 0, total: 1 };
  const c = p.checklist || { feitos: 0, total: 1 };
  const est = p.estudos || [];
  const linhas = [
    ["Régua Junior → Pleno", r.praticadas, r.total],
    ["MVP do RKF Bank (frontend)", c.feitos, c.total],
    ["Assuntos de estudo praticados", est.filter((e) => e.status === "praticado").length, est.length || 1],
  ];
  const corpo = linhas
    .map(([rotulo, v, t], i) => {
      const pct = t ? v / t : 0;
      const y = 60 + i * 62;
      return `
  <text x="32" y="${y}" class="rot">${xml(rotulo)}</text>
  <text x="828" y="${y}" text-anchor="end" class="val">${v}/${t} · ${Math.round(pct * 100)}%</text>
  <rect x="32" y="${y + 12}" width="796" height="14" rx="7" fill="var(--card)" stroke="var(--borda)"/>
  <rect x="32" y="${y + 12}" width="${Math.max(14, 796 * pct).toFixed(1)}" height="14" rx="7" fill="url(#g)" class="enche" style="animation-delay:${0.2 + i * 0.25}s"/>`;
    })
    .join("");
  return svg(
    860,
    240,
    linhas.map(([a, v, t]) => `${a}: ${v} de ${t}`).join("; "),
    `
  .tit{font-size:16px;font-weight:700;fill:var(--texto)}
  .rot{font-size:14px;fill:var(--texto)}
  .val{font-size:13px;fill:var(--suave)}
  .enche{transform-box:fill-box;transform-origin:left;transform:scaleX(0);animation:enche 1.4s cubic-bezier(.2,.8,.2,1) forwards}
  @keyframes enche{to{transform:scaleX(1)}}`,
    `${fundo(860, 240)}
  <text x="32" y="30" class="tit">📈 Rumo ao Pleno: onde estou agora</text>${corpo}`,
  );
}

// ------------------------------------------------------------- trajetória em cenas
export const TRAJETORIA = [
  ["💼", "2023", "Primeiro emprego", "jovem aprendiz numa transportadora"],
  ["📚", "2024", "Graduação em GTI", "Estácio · e mais duas promoções"],
  ["🧩", "2025", "Full Stack Club", "React, Node e projetos do zero ao deploy"],
  ["🎓", "03/2026", "Formação DevClub", "140 h · certificado MEC"],
  ["🏦", "09/2026", "RKF Bank", "frontend Next.js em dupla"],
  ["🚀", "agora", "Rumo ao Pleno", "testes, CI e performance"],
];

export function trajetoria() {
  const [ini, fim] = [115, 745]; // margem para os rótulos das pontas não serem cortados
  const passo = (fim - ini) / (TRAJETORIA.length - 1);
  const pontos = TRAJETORIA.map(([ic, ano, titulo, desc], i) => {
    const x = ini + i * passo;
    const cima = i % 2 === 0;
    return `
  <g class="marco" style="animation-delay:${0.3 + i * 0.35}s">
    <circle cx="${x}" cy="140" r="19" fill="var(--bg)" stroke="url(#g)" stroke-width="3"/>
    <text x="${x}" y="147" text-anchor="middle" class="ic">${ic}</text>
    <text x="${x}" y="${cima ? 100 : 186}" text-anchor="middle" class="ano">${xml(ano)}</text>
    <text x="${x}" y="${cima ? 78 : 208}" text-anchor="middle" class="tit">${xml(titulo)}</text>
    <text x="${x}" y="${cima ? 60 : 226}" text-anchor="middle" class="desc">${xml(desc)}</text>
  </g>`;
  }).join("");
  return svg(
    860,
    260,
    `Trajetória: ${TRAJETORIA.map(([, a, t]) => `${a} ${t}`).join(", ")}`,
    `
  .ano{font-size:13px;font-weight:700;fill:var(--a1)}
  .tit{font-size:14px;font-weight:700;fill:var(--texto)}
  .desc{font-size:11px;fill:var(--suave)}
  .ic{font-size:17px}
  .cab{font-size:16px;font-weight:700;fill:var(--texto)}
  .linha{stroke-dasharray:640;stroke-dashoffset:640;animation:risca 2.4s ease-out forwards}
  .marco{opacity:0;animation:aparece .6s ease-out forwards}
  @keyframes risca{to{stroke-dashoffset:0}}
  @keyframes aparece{to{opacity:1}}`,
    `${fundo(860, 260)}
  <text x="24" y="32" class="cab">🧭 Da planilha ao banco digital</text>
  <line x1="${ini}" y1="140" x2="${fim}" y2="140" stroke="var(--borda)" stroke-width="4" stroke-linecap="round"/>
  <line x1="${ini}" y1="140" x2="${fim}" y2="140" stroke="url(#g)" stroke-width="4" stroke-linecap="round" class="linha"/>${pontos}`,
  );
}

// ------------------------------------------------------------- chamada final
export function chamada() {
  return svg(
    860,
    150,
    "Vamos trocar uma ideia? Next.js, frontend de produto e transição de carreira.",
    `
  .t{font-size:30px;font-weight:800;fill:url(#g)}
  .s{font-size:15px;fill:var(--suave)}
  .borda{fill:none;stroke:url(#g);stroke-width:2;stroke-dasharray:10 8;animation:anda 12s linear infinite}
  .faisca{fill:var(--a1);animation:gira 6s linear infinite;transform-box:fill-box;transform-origin:center}
  @keyframes anda{to{stroke-dashoffset:-360}}
  @keyframes gira{to{transform:rotate(360deg)}}`,
    `<rect width="860" height="150" rx="16" fill="var(--bg)"/>
  <rect x="2" y="2" width="856" height="146" rx="15" class="borda"/>
  <text x="430" y="68" text-anchor="middle" class="t">Vamos trocar uma ideia?</text>
  <text x="430" y="102" text-anchor="middle" class="s">Next.js, frontend de produto e transição de carreira: é só chamar.</text>
  <text x="120" y="80" text-anchor="middle" font-size="26" class="faisca">✦</text>
  <text x="740" y="80" text-anchor="middle" font-size="26" class="faisca">✦</text>`,
  );
}

// ------------------------------------------------------------- divisor e botões
export function divisor() {
  return svg(
    860,
    24,
    "divisor",
    `.p{animation:corre 4s linear infinite}@keyframes corre{from{transform:translateX(-120px)}to{transform:translateX(860px)}}`,
    `<rect x="0" y="11" width="860" height="2" rx="1" fill="var(--borda)"/>
  <rect class="p" x="0" y="10" width="120" height="4" rx="2" fill="url(#g)"/>`,
  );
}

export function botao(icone, texto, { largura, destaque = false } = {}) {
  const w = Math.round(largura || Math.max(120, 48 + [...texto].length * 8.4));
  return svg(
    w,
    40,
    texto,
    `
  .b{fill:var(--card);stroke:var(--borda)}
  .d{fill:url(#g)}
  .tx{font-size:14px;font-weight:600;fill:${destaque ? "#ffffff" : "var(--texto)"}}
  .anel{fill:none;stroke:url(#g);stroke-width:1.5;opacity:0;animation:pulsa 3s ease-in-out infinite}
  @keyframes pulsa{50%{opacity:.9}}`,
    `
<rect x="1" y="1" width="${w - 2}" height="38" rx="10" class="${destaque ? "d" : "b"}"/>
<rect x="1" y="1" width="${w - 2}" height="38" rx="10" class="anel"/>
<text x="${w / 2}" y="25" text-anchor="middle" class="tx">${xml(icone)} ${xml(texto)}</text>`,
  );
}

export const BOTOES = {
  trilhas: ["🎮", "Trilhas"],
  "ao-vivo": ["📡", "Ao vivo"],
  trajetoria: ["🧭", "Trajetória"],
  "rkf-bank": ["🏦", "Projeto atual"],
  projetos: ["🗂️", "Projetos"],
  pleno: ["📈", "Junior → Pleno"],
  roadmap: ["🎯", "Roadmap"],
  stack: ["🛠️", "Stack"],
  atuacao: ["💼", "Atuação"],
  perguntas: ["💬", "Perguntas"],
  formacao: ["🎓", "Formação"],
  "trilha-recrutador": ["🧑‍💼", "Sou recrutador(a) e tenho 1 minuto"],
  "trilha-dev": ["👩‍💻", "Sou dev e quero ver código"],
  "trilha-estudante": ["🌱", "Também estou mudando de carreira"],
  linkedin: ["💼", "Conversar no LinkedIn", true],
  email: ["✉️", "Enviar e-mail"],
  "ver-codigo": ["📂", "Ver código"],
  "ler-readme": ["📖", "Ler o README"],
};

/**
 * Gera os SVGs em assets/ e devolve a lista de caminhos relativos.
 * `extras.numeros` e `extras.pulso` só existem quando os dados do GitHub foram lidos (--api);
 * sem eles, os arquivos anteriores ficam como estão.
 */
export function gerarSvgs(progresso, raiz, extras = {}) {
  const assets = join(raiz, "assets");
  mkdirSync(join(assets, "botoes"), { recursive: true });
  const escritos = [];
  const grava = (rel, conteudo) => {
    writeFileSync(join(assets, rel), conteudo, "utf8");
    escritos.push(`assets/${rel}`);
  };
  grava("banner.svg", banner());
  grava("progresso.svg", barras(progresso));
  grava("trajetoria.svg", trajetoria());
  grava("sobre-mim.svg", sobreMim());
  grava("fluxo-cadastro.svg", fluxo());
  grava("chamada.svg", chamada());
  grava("divisor.svg", divisor());
  if (progresso.projeto?.commitsRecentes?.length) {
    grava("terminal.svg", terminal(progresso.projeto.commitsRecentes, progresso.projeto.commitsDoAutor));
  }
  if (extras.numeros) grava("numeros.svg", numeros(extras.numeros));
  if (extras.pulso) grava("pulso.svg", pulso(extras.pulso.dias, extras.pulso.resumo));
  for (const [nome, [icone, texto, destaque]] of Object.entries(BOTOES)) grava(`botoes/${nome}.svg`, botao(icone, texto, { destaque }));
  return escritos;
}
