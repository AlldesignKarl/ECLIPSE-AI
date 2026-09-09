/** Eventos que el servidor envía al navegador durante una respuesta. */
export type StreamEvent =
  | { t: "status"; v: string }
  | { t: "thinking"; v: string }
  | { t: "text"; v: string }
  | { t: "sources"; v: unknown }
  | { t: "artifact"; v: unknown }
  | { t: "meta"; v: Record<string, unknown> }
  | { t: "error"; v: string }
  | { t: "done"; v: Record<string, unknown> };

const encoder = new TextEncoder();

export function sseChunk(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** Lee un cuerpo SSE en el cliente y va entregando eventos ya parseados. */
export async function readSSE(
  res: Response,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("La respuesta no incluye contenido.");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!raw.startsWith("data:")) continue;
      const json = raw.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as StreamEvent);
      } catch {
        // Fragmento corrupto: lo ignoramos en lugar de romper el flujo.
      }
    }
  }
}
