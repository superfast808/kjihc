import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const API_BASE = `${import.meta.env.BASE_URL}api`

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
]

const ANSWER_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "prefer_not", label: "Prefer not to say" },
]

const QUESTIONS: { field: string; label: string }[] = [
  { field: "minorityEthnic", label: "Is the player from a minority ethnic background?" },
  { field: "disabledChild", label: "Is there a disabled child in your family?" },
  { field: "threeOrMoreChildren", label: "Does your family have 3 or more children?" },
  { field: "childUnderOne", label: "Does your family have a child under 1?" },
  { field: "motherUnder25", label: "Is the player's mother aged under 25?" },
  { field: "youngCarer", label: "Is the player a young carer?" },
  { field: "careExperienced", label: "Is anyone in your family care experienced?" },
]

function OptionRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-4 py-2 rounded-full border text-sm transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted border-input"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function EqualOpsSurvey() {
  const [gender, setGender] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const complete = gender !== null && QUESTIONS.every((q) => answers[q.field])

  const handleSubmit = async () => {
    if (!complete || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/equal-ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender, ...answers }),
      })
      if (!res.ok) throw new Error("Request failed")
      setDone(true)
    } catch {
      setError("Sorry, something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardHeader>
            <CardTitle>Thank you!</CardTitle>
            <CardDescription>
              Your anonymous response has been recorded. This information helps
              KJIHC apply for grants and funding to support the club.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>KJIHC Equal Opportunities Survey</CardTitle>
            <CardDescription>
              This survey is completely anonymous — we do not record your name,
              email, or anything that could identify you. Answers are only ever
              used as combined totals to support grant and funding applications
              for the club. Please complete it once per player.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <p className="font-medium">Player's gender</p>
              <OptionRow options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </div>
            {QUESTIONS.map((q) => (
              <div key={q.field} className="space-y-3">
                <p className="font-medium">{q.label}</p>
                <OptionRow
                  options={ANSWER_OPTIONS}
                  value={answers[q.field] ?? null}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.field]: v }))}
                />
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" disabled={!complete || submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit anonymously"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
