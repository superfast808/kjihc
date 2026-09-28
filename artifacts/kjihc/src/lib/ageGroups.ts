/** Canonical age-group values as stored in the DB */
export const AGE_GROUPS = [
  { value: "LTP",       label: "Learn to Play (LTP)" },
  { value: "u10",       label: "Under 10" },
  { value: "u12",       label: "Under 12" },
  { value: "u14",       label: "Under 14" },
  { value: "u16",       label: "Under 16" },
  { value: "u19",       label: "Under 19" },
  { value: "lightning", label: "Lightning (Girls)" },
] as const;

const labelMap: Record<string, string> = Object.fromEntries(
  AGE_GROUPS.map(({ value, label }) => [value.toLowerCase(), label])
);

/** Return a human-readable label for any DB age-group value */
export function ageGroupLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return labelMap[value.toLowerCase()] ?? value;
}
