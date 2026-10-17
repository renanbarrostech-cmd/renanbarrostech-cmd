#!/usr/bin/env node
// Gera o README a partir do progresso.json, trocando SOMENTE o conteúdo entre
// <!-- AUTO:nome:START --> e <!-- AUTO:nome:END -->. Todo o resto é texto do Renan.
//
// Uso: node scripts/atualizar-readme.mjs [--api] [--sem-svg]
//   --api   busca também os repositórios e a atividade pública na API do GitHub
//           (usa GITHUB_TOKEN se existir; GH_API_FIXTURES=<pasta> lê repos.json/events.json locais)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAIZ, USUARIO, agoraSP, celula, emojiCommit, lerBloco, lerTexto, substituirBloco } from "./lib.mjs";

/** "2026-10-14T19:31:58-03:00" → "14/10/2026" (data fixa: o README só muda quando algo muda de verdade). */
const dataCurta = (iso) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
/** Remove o carimbo "16/10 às 18:14" para comparar blocos sem ele. */
const semCarimbo = (s) => s.replace(/\d{2}\/\d{2} às \d{2}:\d{2}/g, "");
import { gerarSvgs } from "./svgs.mjs";

const USAR_API = process.argv.includes("--api");
const SEM_SVG = process.argv.includes("--sem-svg");
const README = join(RAIZ, "README.md");
const PROGRESSO = join(RAIZ, "progresso.json");
const IGNORAR = new Set([USUARIO, "k3vinrich4rd"]); // o próprio perfil e o fork do perfil do Kevin

const p = existsSync(PROGRESSO) ? JSON.parse(readFileSync(PROGRESSO, "utf8")) : {};
const badge = (rotulo, msg, cor, extra = "") =>
  `![${rotulo}](https://img.shields.io/static/v1?label=${encodeURIComponent(rotulo)}&message=${encodeURIComponent(msg)}&color=${cor}&style=flat-square${extra})`;

// ------------------------------------------------------------- API do GitHub
async function buscar(caminho, arquivoFixture) {
  if (process.env.GH_API_FIXTURES) {
    const f = join(process.env.GH_API_FIXTURES, arquivoFixture);
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
  }
  const headers = { Accept: "application/vnd.github+json", "User-Agent": `${USUARIO}-readme` };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com${caminho}`, { headers });
  if (!r.ok) throw new Error(`GitHub API ${caminho}: HTTP ${r.status}`);
  return r.json();
}

// A API de eventos públicos não traz mais a lista de commits dos pushes, então os commits
// recentes vêm de /repos/{repo}/commits?author=... nos repositórios com push mais recente
// e no repositório do projeto principal (na branch configurada, ex.: develop do RKF Bank).
async function dadosApi() {
  if (!USAR_API) return null;
  try {
    const todos = await buscar(`/users/${USUARIO}/repos?per_page=100&type=owner&sort=pushed`, "repos.json");
    const repos = todos.filter((r) => !r.fork && !IGNORAR.has(r.name) && !r.private);
    const alvos = repos
      .slice()
      .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
      .slice(0, 5)
      .map((r) => ({ nome: r.full_name || `${USUARIO}/${r.name}`, branch: null }));
    const proj = (p.projeto?.repositorio || "").replace("https://github.com/", "");
    if (proj) alvos.unshift({ nome: proj, branch: p.projeto.branch || null });
    const listas = await Promise.all(
      alvos.map(async ({ nome, branch }) => {
        const q = `/repos/${nome}/commits?author=${USUARIO}&per_page=10${branch ? `&sha=${encodeURIComponent(branch)}` : ""}`;
        const fixture = `commits-${nome.replace("/", "__")}.json`;
        try {
          const lista = await buscar(q, fixture);
          return (Array.isArray(lista) ? lista : []).map((c) => ({
            repo: nome,
            hash: c.sha.slice(0, 7),
            sha: c.sha,
            assunto: c.commit.message.split("\n")[0],
            data: c.commit.author.date,
          }));
        } catch {
          return [];
        }
      }),
    );
    const vistos = new Set();
    const porRepo = {};
    const commits = listas
      .flat()
      .filter((c) => !/^Merge (pull request|branch|remote-tracking)/.test(c.assunto))
      .filter((c) => (vistos.has(c.sha) ? false : vistos.add(c.sha)))
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .filter((c) => (porRepo[c.repo] = (porRepo[c.repo] || 0) + 1) <= 4); // no máximo 4 por repositório
    return { repos, commits };
  } catch (err) {
    console.warn(`Aviso: API do GitHub indisponível (${err.message}). Usando só o progresso.json.`);
    return null;
  }
}

// ------------------------------------------------------------- blocos
const r = p.regua || { praticadas: 0, total: 0, itens: { praticadas: [], andamento: [], planejadas: [] } };
const ck = p.checklist || { secoes: [], feitos: 0, total: 0 };
const estudos = p.estudos || [];
// O estudo marcado com `foco: true` na nota vem primeiro.
const andamento = estudos.filter((e) => e.status === "andamento").sort((a, b) => (b.foco === true) - (a.foco === true));
const testes = p.projeto?.testes;

function blocoStatus() {
  const foco = andamento[0]?.assunto || "—";
  return [
    badge("Régua Pleno", `${r.praticadas}/${r.total}`, "8B5CF6"),
    badge("MVP RKF Bank", `${ck.feitos}/${ck.total}`, "06B6D4"),
    // Front (meu) e back (do Kevin) separados: o número não sugere testes que não escrevi.
    testes ? badge("Testes RKF Bank", `front ${testes.front} · back ${testes.backend}`, "22C55E") : "",
    badge("Foco agora", foco, "6D28D9"),
  ]
    .filter(Boolean)
    .join(" ");
}

function blocoRecrutador() {
  return `| Pergunta | Resposta rápida |
| --- | --- |
| Quem é? | Dev **Full Stack** em transição de carreira, focado em **Next.js + TypeScript**, rumo ao **Pleno** (**${r.praticadas}/${r.total}** competências já praticadas) |
| Melhor projeto? | **[RKF Bank](https://github.com/k3vinrich4rd/rkf_bank)**: banco digital em dupla; eu faço o **frontend** (${ck.feitos}/${ck.total} itens do MVP prontos) |
| Stack principal? | Next.js · React · TypeScript · Tailwind CSS · Node.js · Prisma · PostgreSQL · Better Auth |
| O que está estudando? | ${andamento.map((e) => e.assunto).join(" → ") || "—"} |
| Contato? | [LinkedIn](https://www.linkedin.com/in/renan-costa-barros) · <renanbarros.tech@gmail.com> |`;
}

function blocoAgora() {
  const pendentes = ck.secoes.flatMap((s) => s.tarefas.filter((t) => !t.feito)).slice(0, 3);
  const ultima = (p.historico || []).find((h) => /^feat|^fix/.test(h.mudanca)) || p.historico?.[0];
  const linhas = pendentes.map((t) => `- 🔨 ${t.texto}`);
  if (andamento[0]) linhas.push(`- 🎯 Foco de estudo: **${andamento[0].assunto}**${andamento[0].proximoPasso ? `: ${andamento[0].proximoPasso}` : ""}`);
  if (ultima) {
    const texto = ultima.mudanca.replace(/\s*\(`\w+`\)$/, "").replace(/^\w+(\([^)]*\))?:\s*/, "");
    linhas.push(`- ✅ Última entrega: ${texto[0].toUpperCase()}${texto.slice(1)} (${ultima.data})`);
  }
  return `<details open>\n<summary><b>🔥 Esta semana</b></summary>\n<br>\n\n${linhas.join("\n")}\n\n</details>`;
}

function blocoAtividade(api) {
  let lista = api?.commits?.slice(0, 8);
  if (!lista?.length) {
    const repo = (p.projeto?.repositorio || "").replace("https://github.com/", "");
    lista = (p.projeto?.commitsRecentes || []).slice(0, 8).map((c) => ({ ...c, repo, sha: c.hash }));
  }
  if (!lista.length) return "_Sem commits recentes._";
  const linhas = lista.map((c) => {
    const nome = c.repo.split("/")[1] || c.repo;
    const link = `https://github.com/${c.repo}`;
    return `| ${emojiCommit(c.assunto)} | [\`${celula(nome)}\`](${link}) | [\`${c.hash}\`](${link}/commit/${c.sha}) ${celula(c.assunto)} | ${dataCurta(c.data)} |`;
  });
  return `<details open>\n<summary><b>⚡ Meus últimos commits</b></summary>\n<br>\n\n|  | Repositório | Commit | Quando |\n| --- | --- | --- | --- |\n${linhas.join("\n")}\n\n<sub>✨ feat · 🐛 fix · 🧪 test · 📝 docs · 🔧 chore/build/ci · ♻️ refactor | 🤖 atualizado sozinho a cada 6 horas · ${agoraSP()}</sub>\n\n</details>`;
}

function blocoDiario() {
  const dias = (p.diario || []).filter((d) => d.feito.length || d.aprendi.length).slice(0, 5);
  const aprendizados = (p.historico || []).filter((h) => h.aprendizado).slice(0, 5);
  const partes = [];
  if (aprendizados.length) {
    partes.push(
      `| Quando | Onde | O que eu aprendi |\n| --- | --- | --- |\n${aprendizados.map((h) => `| ${h.data} | \`${celula(h.branch)}\` | ${celula(h.aprendizado)} |`).join("\n")}`,
    );
  }
  if (dias.length) {
    partes.push(dias.map((d) => `**${d.data}**\n${d.feito.map((f) => `- ✅ ${f}`).join("\n")}${d.aprendi.length ? `\n${d.aprendi.map((a) => `- 🧠 ${a}`).join("\n")}` : ""}`).join("\n\n"));
  }
  return `<details>\n<summary><b>📓 Diário de bordo: o que cada entrega me ensinou</b></summary>\n<br>\n\n${partes.join("\n\n") || "_Em breve._"}\n\n</details>`;
}

function blocoRegua() {
  const linha = (i, s) => `| ${celula(i.texto)} | ${s} | ${celula(i.evidencia)} |`;
  return `<img src="assets/progresso.svg" alt="Régua: ${r.praticadas} de ${r.total} competências praticadas; MVP do RKF Bank: ${ck.feitos} de ${ck.total}" width="100%">

<details>
<summary><b>✅ Competências e evidências</b></summary>
<br>

| Competência de Pleno | Status | Evidência |
| --- | :---: | --- |
${[...r.itens.praticadas.map((i) => linha(i, "✅")), ...r.itens.andamento.map((i) => linha(i, "🔄")), ...r.itens.planejadas.map((i) => linha(i, "⏳"))].join("\n")}

<sub>✅ praticado em projeto · 🔄 em andamento · ⏳ planejado · gerado do meu Obsidian em ${(p.geradoEm || "").slice(0, 10)}</sub>

</details>`;
}

function blocoEstudos() {
  const icone = { praticado: "✅", andamento: "🔄", planejado: "⏳" };
  const porArea = {};
  for (const e of estudos) (porArea[e.area] ||= []).push(e);
  const mapa = Object.entries(porArea)
    .map(([area, lista]) => `    ${area}\n${lista.map((e) => `      ${icone[e.status] || "•"} ${e.assunto.replace(/[()]/g, "")}`).join("\n")}`)
    .join("\n");
  const cont = (s) => estudos.filter((e) => e.status === s).length;
  const fila = estudos.filter((e) => e.status !== "praticado");
  return `<details>
<summary><b>📚 Mapa vivo dos meus estudos (sincronizado com o Obsidian)</b></summary>
<br>

**${cont("praticado")}** praticados em projeto · **${cont("andamento")}** em andamento · **${cont("planejado")}** planejados

\`\`\`mermaid
mindmap
  root((🧠 Estudos))
${mapa}
\`\`\`

| Estudando agora | Área | Próximo passo |
| --- | --- | --- |
${fila.map((e) => `| ${icone[e.status]} ${celula(e.assunto)} | ${celula(e.area)} | ${celula(e.proximoPasso || "—")} |`).join("\n")}

</details>`;
}

function blocoGantt() {
  if (!p.pdi?.gantt) return "_Roadmap em breve._";
  return `\`\`\`mermaid\n${p.pdi.gantt}\n\`\`\``;
}

function blocoChecklist() {
  const secoes = ck.secoes
    .map((s) => {
      const falta = s.tarefas.filter((t) => !t.feito).length;
      const itens = s.tarefas.map((t) => `- [${t.feito ? "x" : " "}] ${t.texto}`).join("\n");
      return `<details${falta ? " open" : ""}>\n<summary><b>${s.titulo}</b> ${falta ? `<sub>${falta} a fazer</sub>` : "<sub>✔️ concluído</sub>"}</summary>\n<br>\n\n${itens}\n\n</details>`;
    })
    .join("\n\n");
  return `**🚀 MVP do RKF Bank${p.checklist?.prazo ? ` (${String(p.checklist.prazo).split("-").reverse().join("/")})` : ""}**: ${ck.feitos} de ${ck.total} itens prontos\n\n${secoes}\n\n**🧹 Débitos técnicos do front mapeados:** ${p.debitos ?? 0}\n\n<sub>🤖 Sincronizado com o checklist do meu Obsidian em ${(p.geradoEm || "").slice(0, 10)}.</sub>`;
}

function blocoRepos(api) {
  let repos;
  if (api?.repos?.length) {
    // A descrição do GitHub costuma estar vazia: completa com a nota de portfólio do Obsidian.
    const doVault = Object.fromEntries((p.portfolio || []).map((x) => [x.repositorio.split("/").pop(), x.descricao]));
    repos = api.repos.map((x) => ({
      nome: x.name,
      url: x.html_url,
      descricao: x.description || doVault[x.name] || "",
      linguagem: x.language || "Sem linguagem",
      ano: x.created_at.slice(0, 4),
      ultimo: x.pushed_at.slice(0, 10),
    }));
  } else {
    repos = (p.portfolio || []).map((x) => ({
      nome: x.repositorio.split("/").pop(),
      url: x.repositorio,
      descricao: x.descricao,
      linguagem: x.stack.find((s) => ["TypeScript", "JavaScript", "HTML", "CSS"].includes(s)) || x.stack[0] || "Sem linguagem",
      ano: String(x.inicio).slice(0, 4),
      ultimo: x.ultimo,
    }));
  }
  if (!repos.length) return "_Sem repositórios públicos._";
  const contar = (campo) => repos.reduce((acc, x) => ((acc[x[campo]] = (acc[x[campo]] || 0) + 1), acc), {});
  const linguas = Object.entries(contar("linguagem")).sort((a, b) => b[1] - a[1]);
  const tabela = [...repos]
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo))
    .map((x) => `| [${celula(x.nome)}](${x.url}) | ${celula(x.descricao || "—")} | ${celula(x.linguagem)} | ${x.ultimo} |`)
    .join("\n");
  return `<details>
<summary><b>📊 Meus ${repos.length} repositórios públicos em números</b></summary>
<br>

\`\`\`mermaid
pie showData
    title Linguagem principal dos repositórios
${linguas.map(([l, n]) => `    "${l}" : ${n}`).join("\n")}
\`\`\`

| Repositório | O que é | Linguagem | Último commit |
| --- | --- | --- | --- |
${tabela}

<sub>🤖 ${api ? "Lido da API do GitHub" : "Lido das notas de portfólio do Obsidian"} em ${agoraSP()}.</sub>

</details>`;
}

// ------------------------------------------------------------- execução
const api = await dadosApi();
const blocos = {
  status: blocoStatus(),
  recrutador: blocoRecrutador(),
  agora: blocoAgora(),
  atividade: blocoAtividade(api),
  diario: blocoDiario(),
  regua: blocoRegua(),
  estudos: blocoEstudos(),
  gantt: blocoGantt(),
  checklist: blocoChecklist(),
  repos: blocoRepos(api),
};

let readme = lerTexto(README);
const antes = readme;
const faltando = [];
for (const [nome, conteudo] of Object.entries(blocos)) {
  const atual = lerBloco(readme, nome);
  // Só o horário mudou? Mantém o bloco como está, para não gerar commit sem mudança real.
  if (atual !== null && semCarimbo(atual) === semCarimbo(conteudo.trim())) continue;
  const { texto, achou } = substituirBloco(readme, nome, conteudo);
  if (!achou) faltando.push(nome);
  readme = texto;
}
if (faltando.length) console.warn(`Marcadores não encontrados (ignorados): ${faltando.join(", ")}`);
if (readme !== antes) writeFileSync(README, readme, "utf8");
const svgs = SEM_SVG ? [] : gerarSvgs(p, RAIZ);
console.log(`README ${readme !== antes ? "atualizado" : "sem mudanças"} · ${Object.keys(blocos).length - faltando.length} blocos · ${svgs.length} SVGs${api ? " · API ok" : ""}`);
