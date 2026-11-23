"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Compass } from "lucide-react";
import { usePlatform } from "@/components/platform";
import { tourUi, translate } from "@/lib/i18n";
import { useProductTour } from "@/components/tour/tour-context";

export function TourHeaderMenu() {
  const { language } = usePlatform();
  const { startTour, resumeTour, storage, entryLabel } = useProductTour();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const startOrResume = (tour: "buyer" | "owner") => {
    if (storage.resume?.tour === tour) resumeTour();
    else startTour(tour, 0);
    setOpen(false);
  };

  return (
    <div className="tour-header-menu" ref={rootRef}>
      <button
        type="button"
        className="button tour-header-button"
        data-testid="tour-start-header"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (storage.resume) resumeTour();
          else setOpen((prev) => !prev);
        }}
      >
        <Compass size={15} aria-hidden />
        {entryLabel}
        <ChevronDown size={12} aria-hidden />
      </button>
      {open ? (
        <div className="tour-header-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            data-testid="tour-start-buyer"
            onClick={() => startOrResume("buyer")}
          >
            {translate(language, ...tourUi.tourBuyerMenu)}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="tour-start-owner"
            onClick={() => startOrResume("owner")}
          >
            {translate(language, ...tourUi.tourOwnerMenu)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TourMobileNav({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const { language } = usePlatform();
  const { startTour, resumeTour, storage } = useProductTour();
  const [expanded, setExpanded] = useState(false);

  const run = (tour: "buyer" | "owner") => {
    if (storage.resume?.tour === tour) resumeTour();
    else startTour(tour, 0);
    onNavigate();
    setExpanded(false);
  };

  return (
  <>
      <button
        type="button"
        className="tour-mobile-nav-item"
        data-testid="tour-mobile-nav"
        aria-expanded={expanded}
        onClick={() => {
          if (storage.resume) {
            resumeTour();
            onNavigate();
            return;
          }
          setExpanded((v) => !v);
        }}
      >
        <Compass size={16} aria-hidden />
        {translate(language, ...tourUi.takeTour)}
      </button>
      {expanded ? (
        <div className="tour-mobile-nav-choices">
          <button type="button" onClick={() => run("buyer")}>
            {translate(language, ...tourUi.tourBuyerMenu)}
          </button>
          <button type="button" onClick={() => run("owner")}>
            {translate(language, ...tourUi.tourOwnerMenu)}
          </button>
        </div>
      ) : null}
    </>
  );
}
