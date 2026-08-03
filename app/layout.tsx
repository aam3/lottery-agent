import type { Metadata } from "next";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/architects-daughter/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lottery Scratcher Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "'Outfit', sans-serif" }}>{children}</body>
    </html>
  );
}
