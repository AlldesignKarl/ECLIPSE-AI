import type { Source } from "./types";

/**
 * Clasificación de fuentes. La idea es simple: cuando la IA busca en la web,
 * queremos que lo que se muestre arriba (y lo que más pese en la respuesta)
 * venga de universidades, revistas científicas y organismos oficiales.
 */

interface Rule {
  test: (domain: string) => boolean;
  trust: number;
  label: string;
}

const JOURNALS = [
  "nature.com",
  "science.org",
  "sciencemag.org",
  "cell.com",
  "thelancet.com",
  "nejm.org",
  "bmj.com",
  "jamanetwork.com",
  "pnas.org",
  "sciencedirect.com",
  "springer.com",
  "link.springer.com",
  "wiley.com",
  "onlinelibrary.wiley.com",
  "tandfonline.com",
  "sagepub.com",
  "acs.org",
  "aps.org",
  "iop.org",
  "ieee.org",
  "acm.org",
  "plos.org",
  "journals.plos.org",
  "frontiersin.org",
  "mdpi.com",
  "elifesciences.org",
  "royalsocietypublishing.org",
  "annualreviews.org",
];

const PREPRINTS = [
  "arxiv.org",
  "biorxiv.org",
  "medrxiv.org",
  "chemrxiv.org",
  "ssrn.com",
  "osf.io",
  "zenodo.org",
  "doi.org",
  "semanticscholar.org",
  "scholar.google.com",
  "core.ac.uk",
  "jstor.org",
  "dialnet.unirioja.es",
];

const INSTITUTIONS = [
  "nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "cdc.gov",
  "who.int",
  "nasa.gov",
  "esa.int",
  "noaa.gov",
  "usgs.gov",
  "europa.eu",
  "oecd.org",
  "worldbank.org",
  "imf.org",
  "un.org",
  "ema.europa.eu",
  "efsa.europa.eu",
  "aemps.es",
  "isciii.es",
  "csic.es",
  "ine.es",
  "boe.es",
  "cnn.gob",
];

const REFERENCE = [
  "britannica.com",
  "wikipedia.org",
  "stanford.edu",
  "plato.stanford.edu",
  "developer.mozilla.org",
  "docs.python.org",
  "w3.org",
  "rfc-editor.org",
  "iso.org",
  "rae.es",
];

/** Dominios que casi nunca aportan una fuente verificable. */
const LOW_TRUST = [
  "pinterest.com",
  "quora.com",
  "answers.yahoo.com",
  "brainly.com",
  "brainly.lat",
  "taringa.net",
  "rincondelvago.com",
  "buzzfeed.com",
  "medium.com",
  "blogspot.com",
  "wordpress.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "instagram.com",
];

const RULES: Rule[] = [
  {
    test: (d) =>
      d.endsWith(".edu") ||
      d.endsWith(".ac.uk") ||
      /\.ac\.[a-z]{2}$/.test(d) ||
      /\.edu\.[a-z]{2}$/.test(d) ||
      d.endsWith(".uni-heidelberg.de") ||
      /(^|\.)(unizar|ucm|uab|upc|upm|us|ugr|uv|ehu|uniovi|usal|uc3m|uam)\.es$/.test(d),
    trust: 96,
    label: "Universidad",
  },
  { test: (d) => JOURNALS.some((j) => d === j || d.endsWith("." + j)), trust: 94, label: "Revista científica" },
  { test: (d) => PREPRINTS.some((j) => d === j || d.endsWith("." + j)), trust: 88, label: "Repositorio académico" },
  {
    test: (d) =>
      INSTITUTIONS.some((j) => d === j || d.endsWith("." + j)) ||
      d.endsWith(".gov") ||
      d.endsWith(".gob.es") ||
      /\.gov\.[a-z]{2}$/.test(d) ||
      d.endsWith(".int"),
    trust: 90,
    label: "Organismo oficial",
  },
  { test: (d) => REFERENCE.some((j) => d === j || d.endsWith("." + j)), trust: 74, label: "Referencia" },
  { test: (d) => LOW_TRUST.some((j) => d === j || d.endsWith("." + j)), trust: 28, label: "Sin verificar" },
  { test: (d) => d.endsWith(".org"), trust: 62, label: "Organización" },
];

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function classify(url: string, title = ""): Source {
  const domain = domainOf(url);
  const rule = RULES.find((r) => r.test(domain));
  return {
    url,
    title: title || domain || url,
    domain,
    trust: rule?.trust ?? 52,
    label: rule?.label ?? "Web",
  };
}

/** Ordena por fiabilidad y elimina duplicados por URL. */
export function rankSources(raw: { url: string; title?: string }[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const item of raw) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(classify(item.url, item.title));
  }
  return out.sort((a, b) => b.trust - a.trust);
}

/** Dominios que sugerimos al modelo cuando el usuario pide rigor máximo. */
export const ACADEMIC_HINT = [
  ...new Set([...JOURNALS, ...PREPRINTS, ...INSTITUTIONS]),
].slice(0, 40);
