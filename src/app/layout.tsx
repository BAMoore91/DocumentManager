import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaProvider } from "@/components/pwa-provider";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DocManager — Safety, training, and document compliance for jobsites",
    template: "%s · DocManager",
  },
  description:
    "DocManager is a safety-compliance platform for construction and field-services teams. Track expiring certifications, run JHAs and toolbox talks, log OSHA 300 incidents, manage SDS libraries, and keep every jobsite audit-ready in one place.",
  applicationName: "DocManager",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "safety compliance software",
    "OSHA 300 log",
    "construction safety management",
    "JHA software",
    "job hazard analysis",
    "toolbox talks app",
    "SDS library",
    "safety data sheets",
    "certification tracking",
    "training matrix",
    "incident reporting",
    "permit to work",
    "pre-task plan",
    "safety audit software",
    "EHS software",
    "subcontractor compliance",
    "document expiration tracking",
    "field workforce compliance",
  ],
  authors: [{ name: "DocManager" }],
  creator: "DocManager",
  publisher: "DocManager",
  category: "Safety & Compliance Software",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    siteName: "DocManager",
    locale: "en_US",
    title: "DocManager — Safety, training, and document compliance for jobsites",
    description:
      "Track expiring certifications, run JHAs and toolbox talks, log OSHA 300 incidents, and keep every jobsite audit-ready.",
    url: "/",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "DocManager logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "DocManager — Safety, training, and document compliance for jobsites",
    description:
      "Track expiring certifications, run JHAs and toolbox talks, log OSHA 300 incidents, and keep every jobsite audit-ready.",
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
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
