import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface ParsedBook {
  title: string;
  author: string;
  myRating: number;
  avgRating: number;
}

async function getGoodreadsUrl(title: string, author: string): Promise<string> {
  try {
    const searchParams = new URLSearchParams({
      title: title.trim(),
      author: author.trim(),
    });

    const searchRes = await fetch(`https://openlibrary.org/search.json?${searchParams}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!searchRes.ok) {
      // Fallback to formatted search URL with quotes for exact matching
      return `https://www.goodreads.com/search?q=${encodeURIComponent('"' + title + '" ' + author)}`;
    }

    const searchData = (await searchRes.json()) as {
      docs?: Array<{ key?: string }>;
    };
    const firstResult = searchData.docs?.[0];
    if (!firstResult?.key) {
      return `https://www.goodreads.com/search?q=${encodeURIComponent('"' + title + '" ' + author)}`;
    }

    const workKey = firstResult.key.replace("/works/", "");
    const detailsRes = await fetch(`https://openlibrary.org/works/${workKey}.json`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!detailsRes.ok) {
      return `https://www.goodreads.com/search?q=${encodeURIComponent('"' + title + '" ' + author)}`;
    }

    const workData = (await detailsRes.json()) as {
      identifiers?: { goodreads?: string[] };
    };
    const goodreadsId = workData.identifiers?.goodreads?.[0];

    if (goodreadsId) {
      return `https://www.goodreads.com/book/show/${goodreadsId}`;
    }

    // No direct ID found, use optimized search
    return `https://www.goodreads.com/search?q=${encodeURIComponent('"' + title + '" ' + author)}`;
  } catch {
    return `https://www.goodreads.com/search?q=${encodeURIComponent('"' + title + '" ' + author)}`;
  }
}

export async function POST(req: NextRequest) {
  const { books } = await req.json() as { books: ParsedBook[] };

  if (!books?.length) {
    return NextResponse.json({ error: "No books provided." }, { status: 400 });
  }

  const apiKey = "";

  const client = new Anthropic({ apiKey });

  // Build a concise summary of the user's reading profile
  const topBooks = books
    .filter((b) => b.myRating >= 4)
    .slice(0, 40)
    .map((b) => `"${b.title}" by ${b.author} (${b.myRating}★)`)
    .join("\n");

  const lowerBooks = books
    .filter((b) => b.myRating <= 2)
    .slice(0, 15)
    .map((b) => `"${b.title}" by ${b.author} (${b.myRating}★)`)
    .join("\n");

  const prompt = `You are a passionate book recommender with encyclopedic knowledge of literature. A reader has shared their Goodreads ratings. Analyze their taste and recommend 10 books they haven't read yet.

HIGHLY RATED (4-5★):
${topBooks || "None"}

${lowerBooks ? `LOWER RATED (1-2★):\n${lowerBooks}` : ""}

Total books read and rated: ${books.length}

Based on their taste, recommend exactly 10 books. Return ONLY a JSON array with this structure, no other text:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reason": "2-3 sentences explaining why this matches their taste based on specific books they loved",
    "matchScore": "Strong match" | "Great match" | "Excellent match"
  }
]

Rules:
- Do NOT recommend any book they've already rated
- Prioritize books similar to their 5★ picks
- Vary genres/authors across the 10 picks
- Give specific, personal reasons referencing books they actually rated highly
- Only recommend well-regarded books that are widely available`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse recommendations. Please try again." },
        { status: 500 }
      );
    }

    const recommendations = JSON.parse(jsonMatch[0]);

    // Add direct Goodreads URLs by looking up each book on OpenLibrary
    const recommendationsWithUrls = await Promise.all(
      recommendations.map(async (rec: { title: string; author: string; reason: string; matchScore: string }) => ({
        ...rec,
        goodreadsUrl: await getGoodreadsUrl(rec.title, rec.author),
      }))
    );

    return NextResponse.json({ recommendations: recommendationsWithUrls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("401") || message.includes("api_key") || message.includes("authentication")) {
      return NextResponse.json(
        { error: "Invalid API key. Check your key at console.anthropic.com." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
