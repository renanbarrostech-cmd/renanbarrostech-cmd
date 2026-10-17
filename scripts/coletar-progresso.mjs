#!/usr/bin/env node
// Lê o vault do Obsidian e o projeto principal e grava progresso.json.
// Roda só na máquina do Renan: o GitHub Actions não enxerga o vault.
//
// Uso: node scripts/coletar-progresso.mjs [--vault <pasta>] [--projeto <pasta>] [--saida <arquivo>]
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  RAIZ,
  blocoMermaid,
  itensLista,
  lerConfig,
  lerFrontmatter,
  lerTexto,
  limparObsidian,
  linhasTabela,
  listarMd,
  secoes,
  tarefas,
} from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const cfg = lerConfig();
const VAULT = arg("vault") || cfg.vault;
const PROJETO = arg("projeto") || cfg.projeto;
const SAIDA = arg("saida") || join(RAIZ, "progresso.json");
const NOTA_PROJETO = cfg.notaProjeto || "02 Projetos/RKF Bank";
const AUTOR = cfg.autorEmail || "renanbarros.tech@gmail.com";

if (!VAULT || !existsSync(VAULT)) {
  console.error(`Vault não encontrado: ${VAULT ?? "(defina 'vault' em automacao/config.json)"}`);
  process.exit(1);
}

const nota = (rel) => {
  const p = join(VAULT, rel);
  return existsSync(p) ? lerFrontmatter(lerTexto(p)) : null;
};

// ------------------------------------------------------------- privacidade
// O progresso.json e o README são públicos. Detalhes privados ficam no vault dentro de %%comentários%%
// (que limparObsidian remove). Como rede de segurança, `termosPrivados` (só no config.json local, fora do Git)
// lista nomes que nunca podem sair: o texto que contiver um deles é trocado ou descartado.
const PRIVADOS = (cfg.termosPrivados || []).map((s) => s.toLowerCase()).filter(Boolean);
const avisos = new Set();
const temPrivado = (s) => {
  const t = String(s || "").toLowerCase();
  const achado = PRIVADOS.find((p) => t.includes(p));
  if (achado) avisos.add(achado);
  return Boolean(achado);
};
const ehTodo = (s) => /^\s*TODO\b/i.test(String(s || ""));
/** Texto pronto para ficar público: sem sintaxe do Obsidian, sem TODO e sem termos privados (null = descartar). */
const publico = (s) => {
  const t = limparObsidian(s);
  return !t || ehTodo(t) || temPrivado(t) ? null : t;
};

/** "Competência — evidência" → { texto, evidencia } */
const separarEvidencia = (t) => {
  const [texto, ...resto] = limparObsidian(t).split(/\s+—\s+/);
  const ev = resto.join(" — ").trim();
  return { texto: texto.trim(), evidencia: ehTodo(ev) ? "" : temPrivado(ev) ? "projeto privado" : ev };
};

// ------------------------------------------------------------- régua
function lerRegua() {
  const n = nota("01 Carreira/Régua Junior para Pleno.md");
  if (!n) return null;
  const s = secoes(n.corpo);
  const itens = {
    praticadas: tarefas(s["praticadas"] || "").map((t) => separarEvidencia(t.texto)),
    andamento: tarefas(s["em andamento"] || "").map((t) => separarEvidencia(t.texto)),
    planejadas: tarefas(s["planejadas"] || "").map((t) => separarEvidencia(t.texto)),
  };
  const contadas = itens.praticadas.length + itens.andamento.length + itens.planejadas.length;
  return {
    praticadas: itens.praticadas.length,
    total: contadas,
    frontmatter: { praticadas: n.dados.praticadas, total: n.dados.total },
    itens,
  };
}

// ------------------------------------------------------------- checklist do projeto
function lerChecklist() {
  const n = nota(`${NOTA_PROJETO}/Checklist.md`);
  if (!n) return null;
  const s = secoes(n.corpo);
  const lista = Object.entries(s)
    .filter(([k]) => k !== "_inicio")
    .map(([titulo, corpo]) => ({
      titulo: titulo[0].toUpperCase() + titulo.slice(1),
      tarefas: tarefas(corpo)
        .map((t) => ({ ...t, texto: publico(t.texto) }))
        .filter((t) => t.texto),
    }))
    .filter((x) => x.tarefas.length);
  const todas = lista.flatMap((x) => x.tarefas);
  return { prazo: n.dados.prazo ?? null, secoes: lista, feitos: todas.filter((t) => t.feito).length, total: todas.length };
}

// ------------------------------------------------------------- histórico, débitos, nota principal
function lerHistorico() {
  const n = nota(`${NOTA_PROJETO}/Histórico.md`);
  if (!n) return [];
  return linhasTabela(n.corpo)
    .map(([data, branch, mudanca, aprendizado]) => ({
      data,
      branch: (branch || "").replace(/`/g, ""),
      mudanca: publico(mudanca),
      aprendizado: publico(aprendizado) || "",
    }))
    .filter((h) => h.mudanca)
    .sort((a, b) => b.data.localeCompare(a.data));
}

function contarDebitos() {
  const n = nota(`${NOTA_PROJETO}/Débitos técnicos.md`);
  return n ? linhasTabela(n.corpo).length : 0;
}

// ------------------------------------------------------------- estudos
function lerEstudos() {
  return listarMd(join(VAULT, "03 Estudos"))
    .map((p) => {
      const { dados, corpo } = lerFrontmatter(lerTexto(p));
      const prox = tarefas(secoes(corpo)["próximos passos"] || "").filter((t) => !t.feito);
      // A evidência da nota de estudo não é exportada: pode citar projetos privados e o README não a usa.
      return {
        assunto: basename(p, ".md"),
        area: dados.area || basename(join(p, "..")),
        status: dados.status || "planejado",
        foco: dados.foco === true,
        proximos: prox.length,
        proximoPasso: prox.map((t) => publico(t.texto)).find(Boolean) || "",
      };
    })
    .sort((a, b) => a.area.localeCompare(b.area) || a.assunto.localeCompare(b.assunto));
}

// ------------------------------------------------------------- diário (últimos 7)
function lerDiario() {
  const pasta = join(VAULT, "05 Diário");
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, 7)
    .map((f) => {
      const s = secoes(lerFrontmatter(lerTexto(join(pasta, f))).corpo);
      const limpa = (t) => itensLista(t).concat(tarefas(t).map((x) => x.texto)).map(publico).filter(Boolean);
      return { data: f.slice(0, 10), feito: limpa(s["feito"] || ""), aprendi: limpa(s["aprendi"] || ""), amanha: limpa(s["amanhã"] || "") };
    });
}

// ------------------------------------------------------------- PDI e portfólio
function lerPdi() {
  const n = nota("01 Carreira/PDI 2026.md") || nota(`01 Carreira/PDI ${new Date().getFullYear()}.md`);
  return n ? { objetivo: n.dados.objetivo || "", gantt: blocoMermaid(n.corpo, "gantt") } : null;
}

function lerPortfolio() {
  return listarMd(join(VAULT, "02 Projetos", "Portfólio")).map((p) => {
    const { dados, corpo } = lerFrontmatter(lerTexto(p));
    const descricao = publico(corpo.split("\n").find((l) => l.trim() && !l.startsWith("#")) || "") || "";
    return {
      titulo: basename(p, ".md"),
      repositorio: dados.repositorio || "",
      stack: Array.isArray(dados.stack) ? dados.stack : [],
      commits: dados.commits || 0,
      inicio: dados.inicio || "",
      ultimo: dados.ultimo_commit || "",
      destaque: dados.destaque === true,
      descricao,
    };
  });
}

// ------------------------------------------------------------- projeto principal (git + testes)
function git(...a) {
  try {
    return execFileSync("git", ["-C", PROJETO, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function contarTestes(pasta) {
  const r = { front: 0, backend: 0, arquivos: 0 };
  const ignorar = new Set(["node_modules", ".git", ".next", "target", "dist", "build", "coverage"]);
  const visitar = (d) => {
    for (const nome of readdirSync(d)) {
      if (ignorar.has(nome)) continue;
      const p = join(d, nome);
      const st = statSync(p);
      if (st.isDirectory()) visitar(p);
      else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(nome)) {
        r.arquivos++;
        r.front += (lerTexto(p).match(/\b(?:it|test)(?:\.each\([^)]*\))?\s*\(/g) || []).length;
      } else if (/Tests?\.java$/.test(nome)) {
        r.arquivos++;
        r.backend += (lerTexto(p).match(/@(?:Test|ParameterizedTest)\b/g) || []).length;
      }
    }
  };
  visitar(pasta);
  return { ...r, total: r.front + r.backend };
}

function lerProjeto() {
  const n = nota(`${NOTA_PROJETO}/${basename(NOTA_PROJETO)}.md`);
  const base = {
    nome: basename(NOTA_PROJETO),
    repositorio: n?.dados.repositorio || "",
    branch: cfg.branchProjeto || "develop",
    prazo: n?.dados.prazo_mvp || null,
    papel: n?.dados.papel || "",
  };
  if (!PROJETO || !existsSync(PROJETO)) return { ...base, encontrado: false };
  const commits = git("log", "--all", `--author=${AUTOR}`, "--no-merges", "--format=%h|%cI|%s", "-n", "30")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [hash, data, ...assunto] = l.split("|");
      return { hash, data, assunto: assunto.join("|") };
    });
  return {
    ...base,
    encontrado: true,
    testes: contarTestes(PROJETO),
    commitsDoAutor: Number(git("rev-list", "--all", "--count", `--author=${AUTOR}`, "--no-merges")) || commits.length,
    commitsRecentes: commits.slice(0, 10),
  };
}

const progresso = {
  geradoEm: new Date().toISOString(),
  regua: lerRegua(),
  projeto: lerProjeto(),
  checklist: lerChecklist(),
  historico: lerHistorico(),
  debitos: contarDebitos(),
  estudos: lerEstudos(),
  diario: lerDiario(),
  pdi: lerPdi(),
  portfolio: lerPortfolio(),
};

writeFileSync(SAIDA, `${JSON.stringify(progresso, null, 2)}\n`, "utf8");
const r = progresso.regua;
const c = progresso.checklist;
console.log(
  `progresso.json: régua ${r?.praticadas}/${r?.total} · checklist ${c?.feitos}/${c?.total} · ${progresso.estudos.length} estudos · ` +
    `${progresso.diario.length} dias de diário · testes ${progresso.projeto.testes?.total ?? "?"}`,
);
if (avisos.size) console.warn(`Privacidade: ${avisos.size} termo(s) privado(s) encontrados e removidos do que é público.`);
if (r && (r.frontmatter.praticadas !== r.praticadas || r.frontmatter.total !== r.total)) {
  console.warn(`Aviso: o frontmatter da régua diz ${r.frontmatter.praticadas}/${r.frontmatter.total}, mas as listas têm ${r.praticadas}/${r.total}.`);
}
