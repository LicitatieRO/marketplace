"use client";
import Link from "next/link";
import { usePlatform } from "@/components/platform";
type Block = { headingRo: string; headingEn: string; bodyRo: string; bodyEn: string; anchorId?: string };
export function LegalDocument({
  titleRo,
  titleEn,
  blocks,
}: {
  titleRo: string;
  titleEn: string;
  blocks: Block[];
}) {
  const { t } = usePlatform();
  return (
    <main id="main" className="page-width" style={{ padding: "48px 20px 80px" }}>
      <p className="eyebrow">POC / {t("Simulare", "Simulation")}</p>
      <h1>{t(titleRo, titleEn)}</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        {t(
          "Document informativ pentru prototipul de demonstrație. Nu înlocuiește consultanța juridică.",
          "Informational document for the demonstration prototype. It does not replace legal advice.",
        )}
      </p>
      {blocks.map((block) => (
        <section key={block.headingEn} style={{ marginBottom: 28 }}>
          <h2 id={block.anchorId}>{t(block.headingRo, block.headingEn)}</h2>
          <p>{t(block.bodyRo, block.bodyEn)}</p>
        </section>
      ))}
      <nav className="muted small" aria-label={t("Politici legale", "Legal policies")}>
        <Link href="/legal/terms">{t("Termeni (POC)", "Terms (POC)")}</Link>
        {" · "}
        <Link href="/legal/privacy">{t("Confidențialitate", "Privacy")}</Link>
        {" · "}
        <Link href="/legal/cookies">{t("Cookie-uri", "Cookies")}</Link>
        {" · "}
        <Link href="/legal/data-deletion">
          {t("Ștergere date", "Data deletion")}
        </Link>
      </nav>
    </main>
  );
}
