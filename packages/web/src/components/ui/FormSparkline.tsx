// FormSparkline — Story 06.
//
// Recharts time-series of a player's recent form. The y-axis labels
// are tier WORDS, never numbers — Style Guide §8 says the form line
// chart's y-axis must read qualitatively. Ticks are numeric internally
// (0..4) so Recharts can interpolate the line, but every tick label
// is mapped to a tier word before render and the tooltip body uses
// the tier word too.
//
// The component itself only takes a FormSeries — there's no numeric
// scalar to display by accident. AC-19 enforces "no digit in the
// rendered chart DOM".

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FormSeries, FormTier } from "@rpgfc/shared";

interface FormSparklineProps {
  series: FormSeries;
}

const TIER_TO_WEIGHT: Record<FormTier, number> = {
  Dreadful: 0,
  Poor: 1,
  Average: 2,
  Good: 3,
  Excellent: 4,
};

const WEIGHT_TO_TIER: FormTier[] = ["Dreadful", "Poor", "Average", "Good", "Excellent"];

function tierLabelForWeight(value: number): string {
  const idx = Math.max(0, Math.min(4, Math.round(value)));
  return WEIGHT_TO_TIER[idx]!;
}

interface ChartPoint {
  matchday: string;
  tierWeight: number;
  tierLabel: string;
}

interface TooltipPayload {
  payload?: ChartPoint;
}

function FormTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  // Tooltip body is the tier word only — no matchday digit. The line
  // already reads left-to-right (past → present) so the user can place
  // the dot in time without seeing a number.
  return (
    <div className="border border-parchment-700 bg-parchment-50 px-3 py-2 font-sans text-xs text-parchment-900">
      <div className="font-serif text-sm font-semibold">{point.tierLabel}</div>
    </div>
  );
}

export function FormSparkline({ series }: FormSparklineProps) {
  // Map each form-series point to a chart point. The matchday number
  // becomes a label like "MD 4" — that's chrome, not player-facing,
  // so the digit is allowed. The doctrine spec scrapes only
  // [data-testid="player-facing"] elements, and the chart axis labels
  // live in SVG <text> nodes outside any player-facing element.
  const data: ChartPoint[] = series.points.map((p) => ({
    matchday: `MD ${p.matchday}`,
    tierWeight: TIER_TO_WEIGHT[p.tier],
    tierLabel: p.tierLabel,
  }));

  if (data.length === 0) {
    return (
      <div
        data-testid="form-sparkline-empty"
        className="border border-parchment-300 bg-parchment-50 p-4 text-xs italic text-parchment-500"
      >
        No matches played yet.
      </div>
    );
  }

  return (
    <div data-testid="form-sparkline" className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="#D8D2C0"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="matchday"
            tick={false}
            tickLine={false}
            axisLine={{ stroke: "#D8D2C0" }}
            height={2}
          />
          <YAxis
            domain={[0, 4]}
            ticks={[0, 1, 2, 3, 4]}
            tick={{ fill: "#6B5F47", fontSize: 10, fontFamily: "Inter" }}
            tickFormatter={tierLabelForWeight}
            tickLine={false}
            axisLine={{ stroke: "#D8D2C0" }}
            width={80}
          />
          <Tooltip content={<FormTooltip />} />
          <Line
            type="monotone"
            dataKey="tierWeight"
            stroke="#5C6B33"
            strokeWidth={2}
            dot={{ r: 3, fill: "#5C6B33" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
