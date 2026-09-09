import type { GeneratedFile } from "./types";

const FENCE = /^```([^\n`]*)\n([\s\S]*?)\n?^```[ \t]*$/gm;

const LANGUAGES = new Set([
  "ts", "tsx", "js", "jsx", "json", "html", "css", "scss", "py", "python",
  "sh", "bash", "yaml", "yml", "toml", "md", "markdown", "sql", "go", "rust",
  "rs", "java", "kotlin", "kt", "c", "cpp", "cs", "php", "ruby", "rb", "swift",
  "dockerfile", "text", "plaintext", "env", "xml", "vue", "svelte",
]);

const PATH_LIKE = /^[\w.@-]+(?:\/[\w.@ -]+)*\.[\w]+$|^[\w.-]*Dockerfile$|^Makefile$|^\.[\w.-]+$/;

function extensionFor(lang: string): string {
  const map: Record<string, string> = {
    typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js", jsx: "jsx",
    python: "py", py: "py", bash: "sh", sh: "sh", json: "json", html: "html",
    css: "css", yaml: "yml", yml: "yml", markdown: "md", md: "md", sql: "sql",
    go: "go", rust: "rs", rs: "rs", java: "java", php: "php", ruby: "rb", rb: "rb",
  };
  return map[lang.toLowerCase()] ?? "txt";
}

/**
 * Saca los archivos de una respuesta en modo código.
 * Acepta ```lang ruta/archivo.ext y también una línea con la ruta justo antes
 * del bloque (`**src/app.ts**`, `// src/app.ts`, `Archivo: src/app.ts`).
 */
export function extractFiles(markdown: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const used = new Map<string, number>();
  FENCE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FENCE.exec(markdown)) !== null) {
    const info = match[1].trim();
    const content = match[2];
    if (!content.trim()) continue;

    const tokens = info.split(/\s+/).filter(Boolean);
    let lang = "";
    let path = "";

    for (const token of tokens) {
      const clean = token.replace(/^[("']|[)"',:]$/g, "");
      if (!lang && LANGUAGES.has(clean.toLowerCase()) && !clean.includes("/")) {
        lang = clean.toLowerCase();
        continue;
      }
      if (!path && (PATH_LIKE.test(clean) || clean.includes("/"))) path = clean;
    }

    if (!path) path = pathFromPrecedingLine(markdown, match.index);

    if (!path) {
      const index = files.length + 1;
      path = `archivo-${index}.${extensionFor(lang || "text")}`;
    }

    path = path.replace(/^\.\//, "").replace(/^\/+/, "");

    // Si el modelo repite una ruta, nos quedamos con la última versión.
    if (used.has(path)) {
      files[used.get(path)!].content = content;
    } else {
      used.set(path, files.length);
      files.push({ path, content });
    }
  }

  return files;
}

function pathFromPrecedingLine(markdown: string, fenceIndex: number): string {
  const before = markdown.slice(0, fenceIndex).trimEnd();
  const line = before.slice(before.lastIndexOf("\n") + 1).trim();
  const candidate = line
    .replace(/^#+\s*/, "")
    .replace(/^(?:archivo|fichero|file|ruta|path)\s*:\s*/i, "")
    .replace(/^[/#*`\-\s]*|[*`:\s]*$/g, "")
    .trim();
  return PATH_LIKE.test(candidate) || (candidate.includes("/") && candidate.includes("."))
    ? candidate
    : "";
}

/** Nombre de proyecto a partir de la petición del usuario. */
export function projectName(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-");
  return slug || "proyecto-eclipse";
}

export function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", json: "json",
    html: "html", css: "css", scss: "scss", py: "python", sh: "bash",
    yml: "yaml", yaml: "yaml", md: "markdown", sql: "sql", go: "go",
    rs: "rust", java: "java", php: "php", rb: "ruby", toml: "toml",
  };
  return map[ext] ?? "plaintext";
}
