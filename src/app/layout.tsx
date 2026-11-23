import type { Metadata } from "next";
import { headers } from "next/headers";
import { PlatformProvider } from "@/components/platform";
import { isConfigured } from "@/lib/config";
import { getMapTileClientConfig } from "@/lib/server/map-tile-config";
import { isPocSwitcherServerEnabled } from "@/lib/server/poc-switcher";
import { siteRootRobotsMetadata } from "@/lib/site-indexing";
import "./globals.css";

function resolveMetadataBase(): URL {
  const fromSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromSiteUrl) {
    try {
      return new URL(fromSiteUrl);
    } catch {
      /* fall through */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return new URL(`https://${vercel}`);
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  icons: { icon: "/icon.svg" },
  title: {
    default: "LicitatieRO — POC / Simulare · Locuințe în București",
    template: "%s · LicitatieRO",
  },
  description:
    "Prototip de demonstrație. Ofertele, rezervările și plățile sunt simulate. Fără bani reali, fără escrow, fără transfer de proprietate prin platformă.",
  openGraph: {
    title: "LicitatieRO — POC / Simulare · Locuințe în București",
    description:
      "Prototip de demonstrație. Ofertele, rezervările și plățile sunt simulate. Fără bani reali, fără escrow, fără transfer de proprietate prin platformă.",
    type: "website",
    locale: "ro_RO",
    siteName: "LicitatieRO",
  },
  twitter: {
    card: "summary_large_image",
    title: "LicitatieRO — POC / Simulare · Locuințe în București",
    description:
      "Prototip de demonstrație. Licitații transparente pentru locuințe din București (POC / Simulare).",
  },
  ...siteRootRobotsMetadata(),
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const requestHost = headerList.get("host");
  const nonce = headerList.get("x-nonce") ?? undefined;
  const pocSwitcher = isPocSwitcherServerEnabled(requestHost);
  const mapTileConfig = getMapTileClientConfig();
  return (
    <html
      lang="ro"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      nonce={nonce}
    >
      <body>
        <PlatformProvider
          configured={isConfigured()}
          pocSwitcher={pocSwitcher}
          mapTileConfig={mapTileConfig}
        >
          {children}
        </PlatformProvider>
      </body>
    </html>
  );
}
