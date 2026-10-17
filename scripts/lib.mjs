// Funções comuns aos scripts do perfil. Node puro, sem dependências.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const USUARIO = "renanbarrostech-cmd";

/** Lê automacao/config.json (ou o caminho em PERFIL_CONFIG). Retorna {} se não existir. */
export function lerConfig() {
  const caminho = process.env.PERFIL_CONFIG || join(RAIZ, "automacao", "config.json");
  if (!existsSync(caminho)) return {};
  return JSON.parse(readFileSync(caminho, "utf8").replace(/^﻿/, ""));
}

/** Lê um arquivo de texto normalizando BOM e quebras de linha do Windows. */
export function lerTexto(caminho) {
  return readFileSync(caminho, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

/** Converte um valor YAML simples (string, número, booleano, lista inline). */
function valorYaml(bruto) {
  const v = bruto.trim();
  if (v === "") return "";
  if (/^\[.*\]$/.test(v)) {
    return v
      .slice(1, -1)
      .split(",")
      .map((s) => valorYaml(s))
      .filter((s) => s !== "");
  }
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === "true" || v === "false") return v === "true";
  return v;
}

/** Separa o frontmatter (`---` no topo) do corpo da nota. Suporta o subconjunto de YAML usado no vault. */
export function lerFrontmatter(texto) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(texto);
  if (!m) return { dados: {}, corpo: texto };
  const dados = {};
  let chaveLista = null;
  for (const linha of m[1].split("\n")) {
    const item = /^\s+-\s+(.*)$/.exec(linha);
    if (item && chaveLista) {
      dados[chaveLista].push(valorYaml(item[1]));
      continue;
    }
    const kv = /^([\w.-]+):\s*(.*)$/.exec(linha);
    if (!kv) continue;
    if (kv[2].trim() === "") {
      dados[kv[1]] = [];
      chaveLista = kv[1];
    } else {
      dados[kv[1]] = valorYaml(kv[2]);
      chaveLista = null;
    }
  }
  return { dados, corpo: texto.slice(m[0].length) };
}

/** Divide o corpo em seções pelos títulos `##`. Chave = título sem emoji e espaços extras. */
export function secoes(corpo) {
  const out = {};
  let atual = "_inicio";
  out[atual] = [];
  for (const linha of corpo.split("\n")) {
    const t = /^##\s+(.+?)\s*$/.exec(linha);
    if (t) {
      atual = normalizarTitulo(t[1]);
      out[atual] = [];
      continue;
    }
    out[atual].push(linha);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n").trim()]));
}

/** "✅ Praticadas" → "praticadas"; "⏭️ Amanhã" → "amanhã". */
export function normalizarTitulo(t) {
  return t
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .trim()
    .toLowerCase();
}

/** Lista as tarefas `- [ ]` / `- [x]` de um trecho. */
export function tarefas(texto) {
  const out = [];
  for (const linha of texto.split("\n")) {
    const m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(linha);
    if (m) out.push({ feito: m[1].toLowerCase() === "x", texto: m[2].trim() });
  }
  return out;
}

/** Itens de lista simples (`- texto`), sem tarefas. */
export function itensLista(texto) {
  return texto
    .split("\n")
    .map((l) => /^\s*[-*]\s+(?!\[[ xX]\])(.*)$/.exec(l)?.[1]?.trim())
    .filter((s) => s && s !== "");
}

/** Linhas de uma tabela Markdown (sem cabeçalho e separador) como arrays de células. */
export function linhasTabela(texto) {
  const linhas = texto.split("\n").filter((l) => /^\s*\|.*\|\s*$/.test(l));
  return linhas
    .filter((l) => !/^\s*\|\s*:?-{2,}/.test(l))
    .slice(1)
    .map((l) =>
      l
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim()),
    );
}

/** Remove a sintaxe própria do Obsidian para o texto funcionar no GitHub. */
export function limparObsidian(texto) {
  return String(texto)
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]|#]+)(?:#[^\]]*)?\]\]/g, "$1")
    .replace(/==([^=]+)==/g, "**$1**")
    .replace(/(^|\s)#\p{L}[\p{L}\d_/-]*/gu, "$1")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

/** Primeiro bloco ```mermaid``` de um texto. */
export function blocoMermaid(texto, tipo) {
  const re = /```mermaid\n([\s\S]*?)```/g;
  for (let m; (m = re.exec(texto)); ) {
    if (!tipo || m[1].trimStart().startsWith(tipo)) return m[1].trimEnd();
  }
  return null;
}

/** Lista arquivos .md recursivamente. */
export function listarMd(pasta) {
  if (!existsSync(pasta)) return [];
  const out = [];
  for (const nome of readdirSync(pasta)) {
    const p = join(pasta, nome);
    if (statSync(p).isDirectory()) out.push(...listarMd(p));
    else if (nome.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Troca só o conteúdo entre <!-- AUTO:nome:START --> e <!-- AUTO:nome:END -->. Não mexe em mais nada. */
export function substituirBloco(readme, nome, conteudo) {
  const ini = `<!-- AUTO:${nome}:START -->`;
  const fim = `<!-- AUTO:${nome}:END -->`;
  const a = readme.indexOf(ini);
  const b = readme.indexOf(fim);
  if (a === -1 || b === -1 || b < a) return { texto: readme, achou: false };
  const novo = `${readme.slice(0, a + ini.length)}\n${conteudo.trim()}\n${readme.slice(b)}`;
  return { texto: novo, achou: true };
}

/** Conteúdo atual entre os marcadores de um bloco (sem espaços nas pontas), ou null se não existir. */
export function lerBloco(readme, nome) {
  const ini = `<!-- AUTO:${nome}:START -->`;
  const a = readme.indexOf(ini);
  const b = readme.indexOf(`<!-- AUTO:${nome}:END -->`);
  return a === -1 || b < a ? null : readme.slice(a + ini.length, b).trim();
}

/** Escapa `|` dentro de células de tabela. */
export const celula = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Escapa texto para dentro de SVG/XML. */
export const xml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Data/hora em São Paulo, no formato "16/10 às 18:14". */
export function agoraSP(data = new Date()) {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(data);
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}

/** "há 3 h", "ontem", "há 5 dias" ou a data, a partir de um ISO. */
export function relativo(iso, agora = new Date()) {
  const d = new Date(iso);
  const h = (agora - d) / 36e5;
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${Math.floor(h)} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 15) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Emoji pelo prefixo do commit semântico. */
export function emojiCommit(msg) {
  const t = /^(\w+)/.exec(msg)?.[1]?.toLowerCase();
  return (
    { feat: "✨", fix: "🐛", test: "🧪", docs: "📝", chore: "🔧", build: "🔧", ci: "🔧", refactor: "♻️", style: "🎨", perf: "⚡" }[t] ||
    "📌"
  );
}
