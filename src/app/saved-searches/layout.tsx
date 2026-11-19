import type { Metadata } from "next";
import { privatePageRobotsMetadata } from "@/lib/site-indexing";

export const metadata: Metadata = privatePageRobotsMetadata();

export default function SavedSearchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
