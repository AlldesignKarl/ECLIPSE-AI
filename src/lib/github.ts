import { cookies } from "next/headers";

export const GH_COOKIE = "eclipse_gh";
const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GH_COOKIE)?.value ?? null;
}

export async function requireToken(): Promise<string> {
  const token = await getToken();
  if (!token) throw new GitHubError("Conecta tu cuenta de GitHub primero.", 401);
  return token;
}

type GhInit = Omit<RequestInit, "body"> & { body?: unknown };

async function gh<T>(token: string, path: string, init: GhInit = {}): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "eclipse-ai",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let message = `GitHub respondió ${res.status}`;
    try {
      const parsed = JSON.parse(detail) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* respuesta no JSON */
    }
    throw new GitHubError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface RepoSummary {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
  description: string | null;
}

export function whoami(token: string) {
  return gh<GitHubUser>(token, "/user");
}

export async function listRepos(token: string): Promise<RepoSummary[]> {
  const raw = await gh<
    {
      full_name: string;
      name: string;
      owner: { login: string };
      private: boolean;
      default_branch: string;
      html_url: string;
      updated_at: string;
      description: string | null;
    }[]
  >(token, "/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator");

  return raw.map((r) => ({
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    default_branch: r.default_branch || "main",
    html_url: r.html_url,
    updated_at: r.updated_at,
    description: r.description,
  }));
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean,
  description?: string,
) {
  return gh<{ full_name: string; html_url: string; default_branch: string }>(token, "/user/repos", {
    method: "POST",
    body: {
      name,
      private: isPrivate,
      description: description?.slice(0, 300),
      auto_init: false,
    },
  });
}

interface RefResponse {
  object: { sha: string };
}

/**
 * Sube varios archivos en un único commit usando la Git Data API.
 * Funciona tanto en repos vacíos como en repos con historial.
 */
export async function commitFiles(opts: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: { path: string; content: string }[];
}): Promise<{ commit: string; url: string; branch: string }> {
  const { token, owner, repo, branch, message, files } = opts;
  if (files.length === 0) throw new GitHubError("No hay archivos que subir.", 400);

  // 1. ¿Existe ya la rama?
  let parentSha: string | null = null;
  let baseTree: string | undefined;
  try {
    const ref = await gh<RefResponse>(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    parentSha = ref.object.sha;
    const commit = await gh<{ tree: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/git/commits/${parentSha}`,
    );
    baseTree = commit.tree.sha;
  } catch (err) {
    // 404 = rama nueva o repositorio vacío: creamos el árbol desde cero.
    if (!(err instanceof GitHubError) || err.status !== 404) throw err;
  }

  // 2. Un blob por archivo (base64 soporta cualquier contenido).
  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: { content: Buffer.from(file.content, "utf8").toString("base64"), encoding: "base64" },
      });
      return { path: file.path.replace(/^\/+/, ""), sha: blob.sha };
    }),
  );

  // 3. Árbol.
  const tree = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: {
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
    },
  });

  // 4. Commit.
  const commit = await gh<{ sha: string; html_url: string }>(
    token,
    `/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      body: { message, tree: tree.sha, parents: parentSha ? [parentSha] : [] },
    },
  );

  // 5. Mover (o crear) la rama.
  if (parentSha) {
    await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: { sha: commit.sha, force: false },
    });
  } else {
    await gh(token, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: { ref: `refs/heads/${branch}`, sha: commit.sha },
    });
  }

  return { commit: commit.sha, url: commit.html_url, branch };
}

export const COOKIE_HEADER = (token: string) =>
  `${GH_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
