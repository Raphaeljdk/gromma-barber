import "server-only";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function generateGroqReply(messages: ChatMessage[]) {
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  if (process.env.GROMMA_GROQ_ENABLED !== "true" || !key) throw new Error("GROQ_DISABLED");
  if (!messages.length || messages.length > 20 || messages.some(m => !["system","user","assistant"].includes(m.role) || typeof m.content !== "string") || messages.reduce((n,m)=>n+m.content.length,0)>12000) throw new Error("INVALID_CHAT_CONTEXT");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_completion_tokens: 512, stream: false }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  }).catch(() => { throw new Error("GROQ_UNAVAILABLE"); });
  if (response.status === 429) throw new Error("GROQ_RATE_LIMIT");
  if (!response.ok) throw new Error("GROQ_HTTP_" + response.status);
  const result = await response.json();
  const usage = result.usage;
  const reply = result.choices?.[0]?.message?.content;
  if (typeof result.id !== "string" || typeof reply !== "string" || !reply.trim() ||
      !Number.isSafeInteger(usage?.prompt_tokens) || usage.prompt_tokens < 0 ||
      !Number.isSafeInteger(usage?.completion_tokens) || usage.completion_tokens < 0) throw new Error("GROQ_INVALID_RESPONSE");
  return { provider: "groq" as const, providerResponseId: result.id, model: result.model || model,
    text: reply, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}
// Internal adapter only: authenticated tenant routing, credit reservation and
// reconciliation, privacy controls and human handoff must be wired before use.
// No automatic paid fallback or tool execution is enabled.
