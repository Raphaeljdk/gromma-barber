"use client";
import { useEffect, useState } from "react";

type Photo = { pathname: string; uploadedAt: string };
export function CustomerPhotos({ tenantCode, customerId }: { tenantCode: string; customerId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/erp/${encodeURIComponent(tenantCode)}/clientes/fotos`;
  async function refresh() {
    try {
      const res = await fetch(`${endpoint}?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Não foi possível carregar as fotos.");
      const data = await res.json() as { photos: Photo[] };
      setPhotos(data.photos);
    } catch { setError("Não foi possível carregar as fotos."); }
  }
  useEffect(() => { void refresh(); }, [customerId, endpoint]);
  async function upload(form: FormData) {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha no envio."); }
    finally { setBusy(false); }
  }
  return <div className="erp-customer-photos">
    <strong>Fotos do prontuário</strong>
    <form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); await upload(form); e.currentTarget.reset(); }}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required aria-label="Foto do cliente" />
      <button className="btn secondary" type="submit" disabled={busy}>{busy ? "Enviando..." : "Adicionar foto"}</button>
    </form>
    <small>JPG, PNG ou WebP, até 5 MB. Fotos privadas e vinculadas a este cliente.</small>
    {error && <p role="alert">{error}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 10, marginTop: 12 }}>
      {photos.map(photo => <a key={photo.pathname} href={`${endpoint}?customerId=${encodeURIComponent(customerId)}&pathname=${encodeURIComponent(photo.pathname)}`} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${endpoint}?customerId=${encodeURIComponent(customerId)}&pathname=${encodeURIComponent(photo.pathname)}`} alt="Foto do prontuário" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
      </a>)}
    </div>
  </div>;
}
