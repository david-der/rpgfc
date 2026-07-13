// ClubCrest — code-native SVG crest: flat shield in the club's two
// colors with a monogram of the club name. No image generation, no
// radius, 1px ink border — Style Guide compliant chrome that makes
// club rows read as football instead of spreadsheet.
//
// Monogram: initials of the first two significant words ("Real
// Oviedo" → RO, "AC Barcelona" → AB, "Internacional Curitiba" → IC).

interface ClubCrestProps {
  clubName: string;
  primaryColor: string;
  secondaryColor?: string;
  /** Pixel height of the shield. Width follows at 5:6. */
  size?: number;
}

export function crestMonogram(clubName: string): string {
  const words = clubName.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function ClubCrest({ clubName, primaryColor, secondaryColor, size = 24 }: ClubCrestProps) {
  const width = (size * 5) / 6;
  const band = secondaryColor ?? "#FAF7F0";
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 20 24"
      role="img"
      aria-label={`${clubName} crest`}
      className="flex-none"
    >
      {/* Shield: flat-topped, tapering to a point. */}
      <path d="M1 1h18v13l-9 9-9-9V1z" fill={primaryColor} stroke="#3D3220" strokeWidth="1" />
      {/* Secondary chevron band. */}
      <path d="M1 8l9 4 9-4v4l-9 4-9-4V8z" fill={band} opacity="0.9" />
      <text
        x="10"
        y="7.4"
        textAnchor="middle"
        fontSize="6"
        fontFamily="'Inter', sans-serif"
        fontWeight="700"
        fill="#FAF7F0"
      >
        {crestMonogram(clubName)}
      </text>
    </svg>
  );
}
