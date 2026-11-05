"use client";
import { useState } from "react";

export function PublicBusinessCarousel({ images, tradeName }: {
  images: string[]; tradeName: string;
}) {
  const [active, setActive] = useState(0);
  const items = images.slice(0, 3);
  if (!items.length) return null;
  const show = Math.min(active, items.length - 1);
  return <section className="gromma-public-gallery" aria-label="Fotos da barbearia">
    <div className="gromma-public-gallery-photo">
      <img src={items[show]} alt={"Foto " + (show + 1) + " de " + items.length +
        " de " + tradeName} loading="lazy" />
    </div>
    {items.length > 1 && <div className="gromma-public-gallery-controls">
      <button type="button" onClick={() => setActive((show - 1 + items.length) % items.length)}
        aria-label="Imagem anterior">Anterior</button>
      <span aria-live="polite">{show + 1} / {items.length}</span>
      <button type="button" onClick={() => setActive((show + 1) % items.length)}
        aria-label="Próxima imagem">Próxima</button>
    </div>}
  </section>;
}
