import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolyVoice",
  description: "AI Translation Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* 1. We removed 'next/font/google' to fix the build error.
         2. We added 'font-sans' to use Tailwind's default modern font stack.
         3. We added 'antialiased' for smoother text.
      */}
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}