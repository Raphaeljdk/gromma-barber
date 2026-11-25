import "server-only";

export type ZApiCredentials = { instanceId: string; token: string; clientToken: string };

export function createZApiClient(credentials: ZApiCredentials) {
  for (const value of Object.values(credentials)) {
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("INVALID_ZAPI_CREDENTIALS");
  }
  const base = "https://api.z-api.io/instances/" + encodeURIComponent(credentials.instanceId) +
    "/token/" + encodeURIComponent(credentials.token);
  async function request(path: string, body?: object) {
    let response: Response;
    try {
      response = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: { "Client-Token": credentials.clientToken, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new Error("ZAPI_UNAVAILABLE");
    }
    if (!response.ok) throw new Error("ZAPI_HTTP_" + response.status);
    try { return await response.json(); } catch { throw new Error("ZAPI_INVALID_RESPONSE"); }
  }
  return {
    getQrCode: () => request("/qr-code/image"),
    getStatus: () => request("/status"),
    sendText: (phone: string, message: string) => {
      if (!/^\d{10,15}$/.test(phone) || !message.trim() || message.length > 4000) {
        throw new Error("INVALID_ZAPI_MESSAGE");
      }
      return request("/send-text", { phone, message });
    },
  };
}
