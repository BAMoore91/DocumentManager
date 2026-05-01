import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Manager",
  description: "Track certificates and documents with expiration alerts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
