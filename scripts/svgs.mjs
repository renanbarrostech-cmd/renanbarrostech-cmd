// SVGs animados do perfil (banner, botões, barras de progresso, trajetória e divisor).
// Funcionam nos temas claro e escuro do GitHub via `prefers-color-scheme` dentro do próprio SVG.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { xml } from "./lib.mjs";

const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";

/** Paleta: claro por padrão, escuro quando o GitHub está no tema escuro. */
const TEMA = `
  :root{--bg:#ffffff;--card:#f6f8fa;--borda:#d0d7de;--texto:#1f2328;--suave:#57606a;--a1:#6d28d9;--a2:#0891b2;--a3:#7c3aed}
  @media (prefers-color-scheme:dark){:root{--bg:#0d1117;--card:#161b22;--borda:#30363d;--texto:#e6edf3;--suave:#8b949e;--a1:#8b5cf6;--a2:#06b6d4;--a3:#a78bfa}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}
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

// ------------------------------------------------------------- banner com os números
export function banner(p) {
  const r = p.regua || { praticadas: 0, total: 0 };
  const estudosPraticados = (p.estudos || []).filter((e) => e.status === "praticado").length;
  const numeros = [
    [String(p.portfolio?.length ?? 0), "repositórios públicos"],
    [String(p.projeto?.commitsDoAutor ?? "—"), "commits no RKF Bank"],
    [`${r.praticadas}/${r.total}`, "régua Pleno"],
    [String(estudosPraticados), "assuntos praticados"],
  ];
  const cards = numeros
    .map(
      ([n, rotulo], i) => `
  <g class="card" style="animation-delay:${0.25 + i * 0.15}s" transform="translate(${40 + i * 200},178)">
    <rect width="180" height="78" rx="12" fill="var(--card)" stroke="var(--borda)"/>
    <text x="90" y="38" text-anchor="middle" class="num">${xml(n)}</text>
    <text x="90" y="60" text-anchor="middle" class="rot">${xml(rotulo)}</text>
  </g>`,
    )
    .join("");
  return svg(
    860,
    290,
    `Renan Barros, desenvolvedor Full Stack. ${numeros.map(([n, t]) => `${n} ${t}`).join(", ")}`,
    `
  .nome{font-size:44px;font-weight:800;fill:url(#g)}
  .sub{font-size:17px;fill:var(--suave)}
  .tag{font-size:13px;fill:var(--a1);font-weight:600}
  .num{font-size:28px;font-weight:800;fill:var(--texto)}
  .rot{font-size:12.5px;fill:var(--suave)}
  .card{opacity:0;animation:sobe .7s ease-out forwards}
  .brilho{animation:brilho 6s linear infinite}
  .cursor{animation:pisca 1s steps(1) infinite}
  @keyframes sobe{from{opacity:0;transform:translateY(10px)}to{opacity:1}}
  @keyframes brilho{from{transform:translateX(-300px)}to{transform:translateX(1160px)}}
  @keyframes pisca{50%{opacity:0}}`,
    `
<rect width="860" height="290" rx="18" fill="var(--bg)" stroke="var(--borda)"/>
<rect class="brilho" x="0" y="0" width="160" height="4" rx="2" fill="url(#g)"/>
<text x="40" y="58" class="tag mono">~/renan $ whoami<tspan class="cursor">▌</tspan></text>
<text x="40" y="112" class="nome">Renan Barros</text>
<text x="40" y="146" class="sub">Desenvolvedor Full Stack · Next.js · TypeScript · Node.js · Junior → Pleno</text>
${cards}`,
  );
}

// ------------------------------------------------------------- botões de navegação
export function botao(icone, texto, { largura, destaque = false } = {}) {
  const w = largura || Math.max(120, 48 + [...texto].length * 8.4);
  return svg(
    Math.round(w),
    40,
    texto,
    `
  .b{fill:var(--card);stroke:var(--borda)}
  .d{fill:url(#g)}
  .tx{font-size:14px;font-weight:600;fill:${destaque ? "#ffffff" : "var(--texto)"}}
  .anel{fill:none;stroke:url(#g);stroke-width:1.5;opacity:.0;animation:pulsa 3s ease-in-out infinite}
  @keyframes pulsa{50%{opacity:.9}}`,
    `
<rect x="1" y="1" width="${Math.round(w) - 2}" height="38" rx="10" class="${destaque ? "d" : "b"}"/>
<rect x="1" y="1" width="${Math.round(w) - 2}" height="38" rx="10" class="anel"/>
<text x="${Math.round(w) / 2}" y="25" text-anchor="middle" class="tx">${xml(icone)} ${xml(texto)}</text>`,
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
    `<rect width="860" height="240" rx="16" fill="var(--bg)" stroke="var(--borda)"/>
  <text x="32" y="30" class="tit">📈 Onde estou agora</text>${corpo}`,
  );
}

// ------------------------------------------------------------- linha do tempo da trajetória
export const TRAJETORIA = [
  ["2023", "Primeiro emprego", "jovem aprendiz numa transportadora"],
  ["2024", "Graduação em GTI", "Estácio · e mais duas promoções"],
  ["2025", "Full Stack Club", "React, Node e projetos do zero ao deploy"],
  ["03/2026", "Formação DevClub", "140 h · certificado MEC"],
  ["09/2026", "RKF Bank", "frontend Next.js em dupla"],
  ["agora", "Rumo ao Pleno", "testes, CI e performance"],
];

export function trajetoria() {
  const [ini, fim] = [115, 745]; // margem para os rótulos das pontas não serem cortados
  const passo = (fim - ini) / (TRAJETORIA.length - 1);
  const pontos = TRAJETORIA.map(([ano, titulo, desc], i) => {
    const x = ini + i * passo;
    const cima = i % 2 === 0;
    return `
  <g class="marco" style="animation-delay:${0.3 + i * 0.35}s">
    <circle cx="${x}" cy="130" r="9" fill="var(--bg)" stroke="url(#g)" stroke-width="3"/>
    <circle cx="${x}" cy="130" r="4" fill="var(--a1)"/>
    <text x="${x}" y="${cima ? 92 : 172}" text-anchor="middle" class="ano">${xml(ano)}</text>
    <text x="${x}" y="${cima ? 70 : 194}" text-anchor="middle" class="tit">${xml(titulo)}</text>
    <text x="${x}" y="${cima ? 52 : 212}" text-anchor="middle" class="desc">${xml(desc)}</text>
  </g>`;
  }).join("");
  return svg(
    860,
    240,
    `Trajetória: ${TRAJETORIA.map(([a, t]) => `${a} ${t}`).join(", ")}`,
    `
  .ano{font-size:13px;font-weight:700;fill:var(--a1)}
  .tit{font-size:14px;font-weight:700;fill:var(--texto)}
  .desc{font-size:11px;fill:var(--suave)}
  .linha{stroke-dasharray:640;stroke-dashoffset:640;animation:risca 2.4s ease-out forwards}
  .marco{opacity:0;animation:aparece .6s ease-out forwards}
  @keyframes risca{to{stroke-dashoffset:0}}
  @keyframes aparece{to{opacity:1}}`,
    `<rect width="860" height="240" rx="16" fill="var(--bg)" stroke="var(--borda)"/>
  <line x1="115" y1="130" x2="745" y2="130" stroke="var(--borda)" stroke-width="4" stroke-linecap="round"/>
  <line x1="115" y1="130" x2="745" y2="130" stroke="url(#g)" stroke-width="4" stroke-linecap="round" class="linha"/>${pontos}`,
  );
}

// ------------------------------------------------------------- divisor
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

export const BOTOES = {
  trilhas: ["🎮", "Trilhas"],
  "ao-vivo": ["📡", "Ao vivo"],
  trajetoria: ["🧭", "Trajetória"],
  "rkf-bank": ["🏦", "RKF Bank"],
  projetos: ["🗂️", "Projetos"],
  pleno: ["📈", "Junior → Pleno"],
  roadmap: ["🎯", "Roadmap"],
  stack: ["🛠️", "Stack"],
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

/** Gera todos os SVGs em assets/ e devolve a lista de caminhos relativos. */
export function gerarSvgs(progresso, raiz) {
  const assets = join(raiz, "assets");
  mkdirSync(join(assets, "botoes"), { recursive: true });
  const escritos = [];
  const grava = (rel, conteudo) => {
    writeFileSync(join(assets, rel), conteudo, "utf8");
    escritos.push(`assets/${rel}`);
  };
  grava("banner.svg", banner(progresso));
  grava("progresso.svg", barras(progresso));
  grava("trajetoria.svg", trajetoria());
  grava("divisor.svg", divisor());
  for (const [nome, [icone, texto, destaque]] of Object.entries(BOTOES)) grava(`botoes/${nome}.svg`, botao(icone, texto, { destaque }));
  return escritos;
}
