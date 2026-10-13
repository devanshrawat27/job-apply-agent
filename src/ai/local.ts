export type LocalAIStatus = { configured: boolean; available: boolean; model: string; message: string };

function config() {
  return { baseUrl: (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""), model: process.env.OLLAMA_MODEL || "llama3.2" };
}

export async function getLocalAIStatus(): Promise<LocalAIStatus> {
  const { baseUrl, model } = config();
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return { configured: true, available: false, model, message: `Ollama returned HTTP ${response.status}.` };
    const payload = await response.json() as { models?: Array<{ name?: string }> };
    const installed = payload.models?.some((item) => item.name?.split(":")[0] === model.split(":")[0]) ?? false;
    return { configured: true, available: installed, model, message: installed ? "Local model is ready." : `Ollama is running, but model ${model} is not installed.` };
  } catch {
    return { configured: false, available: false, model, message: "Ollama is not running. Deterministic local mode remains available." };
  }
}

export async function generateLocalText(prompt: string) {
  const { baseUrl, model } = config();
  const response = await fetch(`${baseUrl}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, stream: false }), signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
  const payload = await response.json() as { response?: string };
  if (!payload.response) throw new Error("Ollama returned no text.");
  return payload.response;
}
