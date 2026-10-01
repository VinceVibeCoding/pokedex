import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/UnsubscribeButton";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = verifyUnsubscribeToken(token) !== null;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Email alerts</h1>
      {valid ? (
        <>
          <p className="text-ink-2">Stop all saved-screen alert emails from Card Index? Your saved screens stay; only the emails stop.</p>
          <UnsubscribeButton token={token!} />
        </>
      ) : (
        <p className="text-ink-2">This unsubscribe link isn&apos;t valid. Sign in and turn alerts off from your profile (click your avatar → Manage account → Email alerts).</p>
      )}
    </div>
  );
}
