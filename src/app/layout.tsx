import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaProvider } from "@/components/pwa-provider";

export const metadata: Metadata = {
  title: "Document Manager",
  description: "Track certificates and documents with expiration alerts",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DocManager",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
