import type { Metadata } from "next";
import { headers } from "next/headers";
import { PlatformProvider } from "@/components/platform";
import { isConfigured } from "@/lib/config";
import { getMapTileClientConfig } from "@/lib/server/map-tile-config";
import { isStagingDemoBannerEnabled } from "@/lib/server/demo-banner";
import { isPocSwitcherServerEnabled } from "@/lib/server/poc-switcher";
import { siteRootRobotsMetadata } from "@/lib/site-indexing";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: {
    default: "LicitatieRO — POC / Simulare · Locuințe în București",
    template: "%s · LicitatieRO",
  },
  description:
    "Prototip de demonstrație. Ofertele, rezervările și plățile sunt simulate. Fără bani reali, fără escrow, fără transfer de proprietate prin platformă.",
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
  const stagingDemoBanner = isStagingDemoBannerEnabled();
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
          stagingDemoBanner={stagingDemoBanner}
          mapTileConfig={mapTileConfig}
        >
          {children}
        </PlatformProvider>
      </body>
    </html>
  );
}
