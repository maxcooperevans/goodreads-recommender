import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Book Recommender - Personalized Book Recommendations from Your Goodreads Library",
  description: "Upload your Goodreads library and get AI-powered personalized book recommendations. Discover your next great read based on books you love.",
  keywords: "book recommendations, Goodreads, AI recommendations, book discovery, personalized recommendations",
  openGraph: {
    title: "AI Book Recommender",
    description: "Discover personalized book recommendations based on your Goodreads library",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-sky-100 text-stone-900">{children}</body>
    </html>
  );
}
