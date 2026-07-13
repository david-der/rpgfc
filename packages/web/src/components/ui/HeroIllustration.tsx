// HeroIllustration — cinematic sketch-panel header for the narrative
// pages (match report, season-end ceremony). Sister component to
// PlayerCard: same sketch-on-parchment aesthetic, bigger crop, with
// room for an eyebrow + title overlaid on the parchment frame.
//
// Each caller points at its own art folder (/match-art, /ceremony-art,
// future /scout-art …). The image is loaded by key (webp or png, via
// useSketchArt) + falls back to the folder default when a
// caller-specific image isn't present yet — so dropping generated
// pieces in lights up the right contexts without code change.

import { useSketchArt } from "../../hooks/useSketchArt";

import type { ReactNode } from "react";

interface HeroIllustrationProps {
  /** Folder under /public to pull art from. E.g. "match-art". */
  folder: string;
  /** Stable key — file name pre-extension. E.g. the match id or season number. */
  artKey: string | number;
  /** Optional accent color — drives the 4px top stripe. Defaults to moss. */
  stripeColor?: string;
  /** Small-caps label above the big title. */
  eyebrow?: ReactNode;
  /** Serif display line. */
  title: ReactNode;
  /** Subtitle below the title (prose or secondary fact). */
  subtitle?: ReactNode;
  /** Optional content below subtitle — scoreline, stats, etc. */
  children?: ReactNode;
}

export function HeroIllustration({
  folder,
  artKey,
  stripeColor,
  eyebrow,
  title,
  subtitle,
  children,
}: HeroIllustrationProps) {
  const { src, onError } = useSketchArt(folder, artKey);
  const stripe = stripeColor ?? "#5C6B33"; // moss-500 default

  return (
    <section className="overflow-hidden border border-parchment-700 bg-parchment-50">
      {/* Accent stripe */}
      <div aria-hidden className="h-1.5" style={{ backgroundColor: stripe }} />

      {/* Illustration with inset nameplate */}
      <div className="relative bg-parchment-100">
        <img
          src={src}
          onError={onError}
          alt=""
          role="presentation"
          className="block aspect-[16/7] w-full object-cover"
          style={{
            filter: "sepia(0.12) contrast(1.05) saturate(0.85)",
            mixBlendMode: "multiply",
          }}
        />
        {/* Just the eyebrow + title overlay the art — the subtitle moves
            below to stay legible regardless of the sketch composition. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{
            background:
              "linear-gradient(to top, rgba(250,247,240,0.98) 40%, rgba(250,247,240,0.75) 75%, rgba(250,247,240,0))",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
          {eyebrow && (
            <div className="font-mono text-xs uppercase tracking-wide text-parchment-700">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-1 font-serif text-4xl leading-tight text-parchment-900">{title}</h1>
        </div>
      </div>

      {subtitle && (
        <div className="border-t border-parchment-300 bg-parchment-50 px-6 py-4">
          <p className="max-w-prose font-serif text-base leading-relaxed text-parchment-700">
            {subtitle}
          </p>
        </div>
      )}

      {children && <div className="border-t border-parchment-300 px-6 py-4">{children}</div>}
    </section>
  );
}
