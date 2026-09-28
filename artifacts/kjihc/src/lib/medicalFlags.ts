export type FlagSeverity = "critical" | "high" | "moderate"

export interface MedicalFlag {
  label: string
  severity: FlagSeverity
}

// keyword → { label, severity }
const RULES: Array<{ pattern: RegExp; label: string; severity: FlagSeverity }> = [
  // Critical — life-threatening / needs immediate action
  { pattern: /epi.?pen|epinephrine|adrenaline|auto.?injector/i, label: "EpiPen", severity: "critical" },
  { pattern: /anaphyla/i,                                         label: "Anaphylaxis risk", severity: "critical" },
  { pattern: /severe.{0,12}allerg|allerg.{0,12}severe/i,         label: "Severe allergy", severity: "critical" },
  { pattern: /peanut|tree.?nut|nut.?allerg/i,                    label: "Nut allergy", severity: "critical" },
  { pattern: /bee.{0,8}(sting|allerg)|wasp.{0,8}allerg/i,       label: "Insect sting allergy", severity: "critical" },
  { pattern: /seizure|epilep/i,                                   label: "Epilepsy / seizures", severity: "critical" },
  { pattern: /cardiac|heart.{0,12}(condition|defect|problem)/i,  label: "Heart condition", severity: "critical" },

  // High — needs awareness / may carry medication
  { pattern: /asthma/i,                                           label: "Asthma", severity: "high" },
  { pattern: /inhaler|salbutamol|ventolin|reliever/i,             label: "Inhaler required", severity: "high" },
  { pattern: /diabet/i,                                           label: "Diabetes", severity: "high" },
  { pattern: /insulin/i,                                          label: "Insulin dependent", severity: "high" },
  { pattern: /allerg/i,                                           label: "Allergy", severity: "high" },
  { pattern: /concussion/i,                                       label: "Concussion history", severity: "high" },

  // Moderate — worth knowing
  { pattern: /medication|medic[ai]ne/i,                           label: "On medication", severity: "moderate" },
  { pattern: /anxiety|panic/i,                                    label: "Anxiety", severity: "moderate" },
  { pattern: /adhd|autism|asd/i,                                  label: "ADHD / Autism", severity: "moderate" },
  { pattern: /broken|fracture|surgery/i,                          label: "Injury history", severity: "moderate" },
]

/**
 * Phrases that parents commonly enter to mean "nothing to note".
 * If a field matches this pattern it is treated as empty — no flag raised.
 */
const NEGATIVE_RESPONSE = /^\s*(nil|n\/a|n\.a\.?|na|no|none|nothing|normal|negative|not\s+applicable|no\s+known|none\s+known|no\s+issues?|no\s+(medical\s+)?(conditions?|allergies?|concerns?|notes?|medications?|history|information|problems?)|all\s+(clear|good|fine|ok))\s*$/i

function normaliseField(v: string | null | undefined): string {
  if (!v?.trim()) return ""
  return NEGATIVE_RESPONSE.test(v.trim()) ? "" : v.trim()
}

/**
 * Scan medical notes + medication text and return deduplicated flags in priority order.
 * Fields that are blank or contain a "negative" answer (nil, n/a, no, none, nothing…)
 * are treated as empty and do not raise a generic "Medical notes" flag.
 */
export function getMedicalFlags(
  notes: string | null | undefined,
  medication: string | null | undefined
): MedicalFlag[] {
  const text = [normaliseField(notes), normaliseField(medication)].filter(Boolean).join(" ")
  if (!text.trim()) return []

  const seen = new Set<string>()
  const flags: MedicalFlag[] = []

  for (const rule of RULES) {
    if (rule.pattern.test(text) && !seen.has(rule.label)) {
      seen.add(rule.label)
      flags.push({ label: rule.label, severity: rule.severity })
    }
  }

  // If notes/medication is non-empty but nothing matched, show a generic flag
  if (flags.length === 0) {
    flags.push({ label: "Medical notes", severity: "moderate" })
  }

  return flags
}

export function highestSeverity(flags: MedicalFlag[]): FlagSeverity | null {
  if (flags.some(f => f.severity === "critical")) return "critical"
  if (flags.some(f => f.severity === "high")) return "high"
  if (flags.some(f => f.severity === "moderate")) return "moderate"
  return null
}

export const SEVERITY_STYLES: Record<FlagSeverity, { bg: string; border: string; text: string; dot: string }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  high: {
    bg: "bg-orange-50",
    border: "border-orange-400",
    text: "text-orange-700",
    dot: "bg-orange-400",
  },
  moderate: {
    bg: "bg-yellow-50",
    border: "border-yellow-400",
    text: "text-yellow-700",
    dot: "bg-yellow-400",
  },
}
