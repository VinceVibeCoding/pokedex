// Search-by-photo: a vision call reads the name/set/number printed on a card,
// then the result is handed to the normal catalog search (searchCards) — same
// ranking and zero-padding rules as typed search, no separate matching logic.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { searchCards } from "./search";
import type { CardSearchResult } from "@/types/domain";

export const IMAGE_SEARCH_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_SEARCH_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
type AllowedImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const ReadingSchema = z.object({
  visible: z.boolean(),
  name: z.string().nullable(),
  setName: z.string().nullable(),
  number: z.string().nullable(),
  printedTotal: z.string().nullable(),
});

export type CardReading = z.infer<typeof ReadingSchema>;

export function isImageSearchConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Reads the printed name/set/number off a single trading card in a photo. */
export async function readCardFromImage(base64: string, mediaType: AllowedImageType): Promise<CardReading> {
  const response = await getClient().messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system:
      "You identify Pokémon Trading Card Game cards from photos. Read only what is " +
      "printed on the card — never guess a value you can't actually see. If no single " +
      "card is clearly visible, set visible to false and leave the other fields null.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text:
              "Identify this Pokémon card. name = the Pokémon/card name as printed " +
              "(e.g. \"Charizard\"). setName = the set name if legible on the card " +
              "(often small text near the number/symbol). number = the card number as " +
              "printed, without the total (e.g. \"034\" from \"034/128\"). printedTotal = " +
              "the total from that fraction (e.g. \"128\"). Leave any field null if not " +
              "legible.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ReadingSchema) },
  });

  return (
    response.parsed_output ?? { visible: false, name: null, setName: null, number: null, printedTotal: null }
  );
}

export interface ImageSearchOutcome {
  reading: CardReading;
  query: string | null;
  results: CardSearchResult[];
}

export async function searchByImage(base64: string, mediaType: AllowedImageType): Promise<ImageSearchOutcome> {
  const reading = await readCardFromImage(base64, mediaType);
  if (!reading.visible || !reading.name) {
    return { reading, query: null, results: [] };
  }
  const printed = reading.number && reading.printedTotal ? `${reading.number}/${reading.printedTotal}` : reading.number;
  const query = [reading.name, printed].filter(Boolean).join(" ");
  const results = await searchCards(query);
  return { reading, query, results };
}
