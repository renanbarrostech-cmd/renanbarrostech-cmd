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

// O calendário de contribuições vem da página pública do perfil (funciona sem token).
async function buscarCalendario() {
  let html;
  if (process.env.GH_API_FIXTURES) {
    const f = join(process.env.GH_API_FIXTURES, "contributions.html");
    if (!existsSync(f)) return null;
    html = readFileSync(f, "utf8");
  } else {
    const r = await fetch(`https://github.com/users/${USUARIO}/contributions`, { headers: { "User-Agent": `${USUARIO}-readme` } });
    if (!r.ok) throw new Error(`contribuições: HTTP ${r.status}`);
    html = await r.text();
  }
  const datas = Object.fromEntries([...html.matchAll(/data-date="([\d-]+)"\s+id="([^"]+)"/g)].map((m) => [m[2], m[1]]));
  const porDia = {};
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const data = datas[m[1]];
    if (data) porDia[data] = Number(/^\s*(\d+)/.exec(m[2])?.[1] || 0);
  }
  const dias = Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, n]) => ({ data, n }));
  if (dias.length < 30) throw new Error("calendário de contribuições vazio");
  const total = Number((/([\d,.]+)\s+contributions?\s+in the last year/.exec(html)?.[1] || "").replace(/[,.]/g, "")) || dias.reduce((s, d) => s + d.n, 0);
  return { dias, total };
}

/** Dias seguidos (contando a partir de hoje, ou de ontem se hoje ainda não teve commit), 7 e 30 dias, último dia ativo. */
function resumirCalendario({ dias, total }) {
  const ate = (k) => dias.slice(-k).reduce((s, d) => s + d.n, 0);
  let i = dias.length - 1;
  if (dias[i]?.n === 0) i--;
  let seguidos = 0;
  while (i >= 0 && dias[i].n > 0) {
    seguidos++;
    i--;
  }
  const ultimo = [...dias].reverse().find((d) => d.n > 0)?.data || null;
  return { seguidos, d7: ate(7), d30: ate(30), ultimo, total };
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
    let calendario = null;
    try {
      calendario = await buscarCalendario();
    } catch (err) {
      console.warn(`Aviso: pulso não atualizado (${err.message}). Fica o SVG anterior.`);
    }
    return { repos, commits, calendario };
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

// Uma dica por dia, tirada do que eu uso nos meus projetos. Muda sozinha à meia-noite (horário de Brasília).
const DICAS = [
  ["\"use client\" só onde precisa", "No App Router todo componente nasce Server Component. Marque como client só o que tem estado, efeito ou evento: o resto vai pronto do servidor e o bundle fica menor."],
  ["z.infer", "Um schema do Zod vira tipo TypeScript com `z.infer<typeof schema>`: validação e tipo saem da mesma fonte, sem duplicar nada."],
  ["zodResolver", "React Hook Form + `zodResolver(schema)` valida o formulário no cliente com o mesmo schema que o servidor usa."],
  ["Proxy de API no Next", "No RKF Bank o navegador chama `/api/...` no próprio Next, que repassa para o backend: sem CORS e sem expor o endereço da API."],
  ["Log sem dado pessoal", "Mascare CPF, e-mail e telefone dentro do logger, antes de escrever. Quem loga não precisa lembrar: a LGPD vira padrão."],
  ["Máscara não é validação", "Formatar o CPF no input ajuda quem digita, mas a regra (dígitos verificadores, unicidade) precisa ser validada no servidor."],
  ["as const", "`as const` deixa o objeto imutável e os tipos literais: ótimo para rotas, configurações e listas de opções."],
  ["satisfies", "`const x = {...} satisfies Tipo` checa o formato sem perder os tipos literais, diferente de anotar `: Tipo`."],
  ["key estável em listas", "Use o id do item como `key`, nunca o índice: se a lista reordenar, o React não confunde o estado dos componentes."],
  ["useEffect não deriva estado", "Se um valor pode ser calculado a partir de props ou estado, calcule durante o render. `useEffect` é para sincronizar com algo de fora."],
  ["next/font", "`next/font` baixa a fonte no build e serve do seu domínio: sem pedido extra ao Google e sem pulo de layout."],
  ["next/image", "Defina largura e altura (ou `fill`) no `next/image`: o navegador reserva o espaço e o CLS não sobe."],
  ["select no Prisma", "Busque só os campos que a tela usa com `select`: menos dados trafegando e nada sensível vazando por engano."],
  ["Migração aplicada não se edita", "Mudou o banco? Crie uma migração nova. Editar uma que já rodou deixa os ambientes diferentes entre si."],
  ["Sessão em cookie httpOnly", "Com Better Auth a sessão fica num cookie httpOnly: o JavaScript da página não lê o token, o que reduz o estrago de um XSS."],
  [".env fora do Git", "Commitou um segredo? Apagar o arquivo não basta: ele fica no histórico. Troque a chave e coloque `.env` no `.gitignore`."],
  ["Commits semânticos", "`feat:`, `fix:`, `docs:`, `chore:`… O histórico vira um changelog e o revisor entende o PR antes de abrir o diff."],
  ["Contrato da API no mesmo PR", "Mudou uma rota? Atualize o contrato no mesmo PR: é a regra combinada entre front e back no RKF Bank."],
  ["Tool calling", "Na Treinos API a IA não inventa dados: ela chama funções tipadas (ler dados do usuário, criar plano) e responde com o resultado."],
  ["Fallback sem custo", "No BellaFlow, sem o n8n configurado o chat responde por regras de palavra-chave: a demonstração funciona mesmo sem IA paga."],
];

function blocoDica() {
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = Math.floor(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 864e5);
  const i = dia % DICAS.length;
  const [titulo, texto] = DICAS[i];
  return `> 💡 **Dica do dia: \`${titulo}\`**  \n> ${texto}  \n> <sub>Muda todo dia sozinha · ${i + 1}/${DICAS.length}</sub>`;
}

/** Barras 3D em STL (o GitHub renderiza o bloco ```stl como modelo 3D que dá para girar). */
function stlBarras(valores) {
  const faces = [];
  const caixa = (x0, y0, z0, x1, y1, z1) => {
    const v = (x, y, z) => `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`;
    const quad = (n, a, b, c, d) => {
      faces.push(`  facet normal ${n}\n    outer loop\n      vertex ${a}\n      vertex ${b}\n      vertex ${c}\n    endloop\n  endfacet`);
      faces.push(`  facet normal ${n}\n    outer loop\n      vertex ${a}\n      vertex ${c}\n      vertex ${d}\n    endloop\n  endfacet`);
    };
    quad("0 0 -1", v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), v(x1, y0, z0));
    quad("0 0 1", v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1));
    quad("0 -1 0", v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1));
    quad("0 1 0", v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0));
    quad("-1 0 0", v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0));
    quad("1 0 0", v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1));
  };
  const max = Math.max(...valores, 1);
  caixa(-4, -4, -1, valores.length * 12, 12, 0); // base
  valores.forEach((n, i) => caixa(i * 12, 0, 0, i * 12 + 8, 8, Math.max(0.6, (n / max) * 32)));
  return `solid repositorios_por_mes\n${faces.join("\n")}\nendsolid repositorios_por_mes`;
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
      mes: x.created_at.slice(0, 7),
      ultimo: x.pushed_at.slice(0, 10),
    }));
  } else {
    repos = (p.portfolio || []).map((x) => ({
      nome: x.repositorio.split("/").pop(),
      url: x.repositorio,
      descricao: x.descricao,
      linguagem: x.stack.find((s) => ["TypeScript", "JavaScript", "HTML", "CSS"].includes(s)) || x.stack[0] || "Sem linguagem",
      mes: String(x.inicio).slice(0, 7),
      ultimo: x.ultimo,
    }));
  }
  if (!repos.length) return "_Sem repositórios públicos._";
  const contar = (campo) => repos.reduce((acc, x) => ((acc[x[campo]] = (acc[x[campo]] || 0) + 1), acc), {});
  const linguas = Object.entries(contar("linguagem")).sort((a, b) => b[1] - a[1]);
  // Repositórios criados por mês, do primeiro mês até o atual (meses sem repositório entram com 0).
  const porMes = contar("mes");
  const meses = [];
  const [ai, mi] = Object.keys(porMes).sort()[0].split("-").map(Number);
  const agora = new Date();
  for (let a = ai, m = mi; a < agora.getFullYear() || (a === agora.getFullYear() && m <= agora.getMonth() + 1); m === 12 ? (a++, (m = 1)) : m++) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
  }
  const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const rotulos = meses.map((k) => `"${NOMES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}"`);
  const valores = meses.map((k) => porMes[k] || 0);
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

\`\`\`mermaid
xychart-beta
    title "Repositórios criados por mês"
    x-axis [${rotulos.join(", ")}]
    y-axis "Repositórios" 0 --> ${Math.max(...valores) + 2}
    bar [${valores.join(", ")}]
    line [${valores.join(", ")}]
\`\`\`

**🧊 Os mesmos números em 3D** (gire com o mouse, dê zoom com a roda). Da esquerda para a direita: ${meses.map((k) => `${NOMES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`).join(", ")}.

\`\`\`stl
${stlBarras(valores)}
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
  dica: blocoDica(),
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
// Números e pulso dependem dos dados do GitHub: só são regerados quando a leitura deu certo.
const HORAS_CERTIFICADAS = 146; // Formação Full Stack DevClub (140 h) + Imersão Arquitetura com IA (6 h)
const extras = {};
if (api?.calendario) {
  extras.pulso = { dias: api.calendario.dias, resumo: resumirCalendario(api.calendario) };
  extras.numeros = {
    repos: String(api.repos.length),
    contribuicoes: String(api.calendario.total),
    commitsRkf: String(p.projeto?.commitsDoAutor ?? "—"),
    regua: `${r.praticadas}/${r.total}`,
    praticados: String(estudos.filter((e) => e.status === "praticado").length),
    horas: `${HORAS_CERTIFICADAS} h`,
  };
}
const svgs = SEM_SVG ? [] : gerarSvgs(p, RAIZ, extras);
console.log(`README ${readme !== antes ? "atualizado" : "sem mudanças"} · ${Object.keys(blocos).length - faltando.length} blocos · ${svgs.length} SVGs${api ? " · API ok" : ""}`);
