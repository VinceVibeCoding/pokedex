import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardView } from "@/components/CardView";
import { isGradeTier } from "@/lib/grade";
import { lookupCard } from "@/serving/lookup";

// Server-rendered from the same cached lookup the API serves — one code path.
async function load(props: PageProps<"/card/[cardId]">) {
  const { cardId } = await props.params;
  const { grade } = await props.searchParams;
  const tier = isGradeTier(grade) ? grade : null; // bad/missing grade → card's default tier
  return lookupCard(decodeURIComponent(cardId), tier);
}

export async function generateMetadata(props: PageProps<"/card/[cardId]">): Promise<Metadata> {
  const lookup = await load(props);
  return { title: lookup ? `${lookup.card.name} · ${lookup.card.setName}` : "Card not found" };
}

export default async function CardPage(props: PageProps<"/card/[cardId]">) {
  const lookup = await load(props);
  if (!lookup) notFound();
  // key: a new card remounts the view so grade/ROI state resets cleanly
  return <CardView key={lookup.card.id} lookup={lookup} />;
}
