import { CardSearch } from "@/components/CardSearch";

export default function CardNotFound() {
  return (
    <div className="mx-auto max-w-2xl pt-[8vh]">
      <h1 className="text-2xl font-semibold">We don&apos;t know that card</h1>
      <p className="mt-1 text-ink-2">Try searching by name instead.</p>
      <div className="mt-5">
        <CardSearch autoFocus />
      </div>
    </div>
  );
}
