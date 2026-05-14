"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";

interface GoodreadsBook {
  Title: string;
  Author: string;
  "My Rating": string;
  "Average Rating": string;
  "Exclusive Shelf": string;
  "Date Read": string;
}

interface ParsedBook {
  title: string;
  author: string;
  myRating: number;
  avgRating: number;
  shelf: string;
}

interface Recommendation {
  title: string;
  author: string;
  reason: string;
  matchScore: string;
  goodreadsUrl: string;
}

function parseBooks(raw: GoodreadsBook[]): ParsedBook[] {
  return raw
    .filter((row) => row["Exclusive Shelf"] === "read" && parseInt(row["My Rating"]) > 0)
    .map((row) => ({
      title: row["Title"] || "",
      author: row["Author"] || "",
      myRating: parseInt(row["My Rating"]) || 0,
      avgRating: parseFloat(row["Average Rating"]) || 0,
      shelf: row["Exclusive Shelf"] || "",
    }))
    .sort((a, b) => b.myRating - a.myRating);
}

export default function Home() {
  const [books, setBooks] = useState<ParsedBook[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file exported from Goodreads.");
      return;
    }
    setError("");
    setFileName(file.name);
    Papa.parse<GoodreadsBook>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = parseBooks(result.data);
        if (parsed.length === 0) {
          setError(
            "No rated books found. Make sure you exported from Goodreads and have rated books on your 'read' shelf."
          );
        } else {
          setBooks(parsed);
          setRecommendations([]);
        }
      },
      error: () =>
        setError("Failed to parse the CSV file. Please try re-exporting from Goodreads."),
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const getRecommendations = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get recommendations.");
    } finally {
      setLoading(false);
    }
  };

  const ratingStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

  const ratingColor = (rating: number) => {
    if (rating >= 5) return "text-emerald-600";
    if (rating >= 4) return "text-amber-600";
    return "text-orange-500";
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-stone-800">
          📚 Your Next Great Read
        </h1>
        <p className="text-stone-500 text-lg">
          Upload your book collection and get personalized recommendations.
        </p>
      </div>

      {/* Step 1: Upload */}
      <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
        <h2 className="text-xl font-semibold text-stone-700 flex items-center gap-2">
          <span className="bg-sky-300 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
            1
          </span>
          Upload your Goodreads export
        </h2>
        <p className="text-sm text-stone-500">
          Visit your{" "}
          <a
            href="https://www.goodreads.com/review/import"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sky-600 hover:text-sky-700 underline"
          >
            Goodreads import/export page
          </a>
          , click "Export Library", download the CSV, then upload it here.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-sky-300 bg-sky-50"
              : books.length > 0
              ? "border-emerald-400 bg-emerald-50"
              : "border-stone-300 hover:border-sky-200 hover:bg-sky-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {books.length > 0 ? (
            <div className="space-y-1">
              <p className="text-2xl">✅</p>
              <p className="font-medium text-emerald-700">{fileName}</p>
              <p className="text-sm text-emerald-600">{books.length} rated books loaded</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-3xl">📂</p>
              <p className="font-medium text-stone-600">
                Drop your CSV here or click to browse
              </p>
              <p className="text-xs text-stone-400">goodreads_library_export.csv</p>
            </div>
          )}
        </div>
      </section>

      {/* Book preview */}
      {books.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-stone-700">
            Your top-rated books ({books.filter((b) => b.myRating >= 4).length} rated 4–5 ★)
          </h2>
          <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
            {books.slice(0, 20).map((book, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-stone-800 truncate block">
                    {book.title}
                  </span>
                  <span className="text-stone-500">{book.author}</span>
                </div>
                <span className={`ml-3 font-mono text-xs ${ratingColor(book.myRating)}`}>
                  {ratingStars(book.myRating)}
                </span>
              </div>
            ))}
            {books.length > 20 && (
              <p className="text-xs text-stone-400 text-center pt-1">
                …and {books.length - 20} more books
              </p>
            )}
          </div>
        </section>
      )}

      {/* Step 2: Get Recommendations */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-stone-700 flex items-center gap-2">
          <span className="bg-sky-300 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
            2
          </span>
          Get your recommendations
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={getRecommendations}
          disabled={loading || books.length === 0}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-sky-400 hover:bg-sky-500 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors text-lg shadow-sm"
        >
          {loading ? "Finding books for you…" : "✨ Get Recommendations"}
        </button>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-stone-500 space-y-3">
          <div className="text-4xl animate-pulse">📖</div>
          <p className="font-medium">Finding your next great read…</p>
          <p className="text-sm">This takes about 10–20 seconds.</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-800">Your recommendations</h2>
          <div className="grid gap-4">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-stone-800">{rec.title}</h3>
                    <p className="text-stone-500 text-sm">by {rec.author}</p>
                  </div>
                  <span className="shrink-0 bg-sky-100 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {rec.matchScore}
                  </span>
                </div>
                <p className="text-stone-600 text-sm leading-relaxed">{rec.reason}</p>
                <a
                  href={rec.goodreadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 px-4 py-2 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View on Goodreads
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
