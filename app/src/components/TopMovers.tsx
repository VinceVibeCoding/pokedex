// Movers as image-forward tiles: gainers and losers side by side, each tile shows the
// card art, grade, current price and the % move (good/critical tokens + arrow icon,
// never color alone).

import { CardTile } from "./CardTile";
import type { Mover } from "@/serving/movers";

export function TopMovers({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  if (gainers.length === 0 && losers.length === 0) return null;
  return (
    <>
      <MoverGrid title="Top gainers" movers={gainers} />
      <MoverGrid title="Top losers" movers={losers} />
    </>
  );
}

function MoverGrid({ title, movers }: { title: string; movers: Mover[] }) {
  if (movers.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {movers.map((m) => (
          <CardTile key={`${m.cardId}:${m.gradeTier}`} cardId={m.cardId} name={m.cardName} setName={m.setName} imageUrl={m.imageUrl} gradeTier={m.gradeTier} priceCents={m.priceCents} changePct={m.changePct} />
        ))}
      </div>
    </section>
  );
}
