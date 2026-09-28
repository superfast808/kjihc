import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { MemberDetail, getGetParentChildrenQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CODE_OF_CONDUCT,
  CODE_OF_CONDUCT_TITLE,
  CONDUCT_SIGN_DECLARATION,
  isConductCurrent,
  conductSignedLabel,
} from "@/lib/codeOfConduct"

interface ExtendedMember extends MemberDetail {
  codeSignedAt?: string | null
}

async function signConduct(token: string, childId: number): Promise<ExtendedMember> {
  const r = await fetch(`/api/parent/children/${childId}/sign-conduct`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Failed to sign")
  return r.json()
}

function ConductText({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 text-sm font-semibold hover:bg-muted/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {CODE_OF_CONDUCT_TITLE}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 space-y-5 text-sm leading-relaxed">
          {CODE_OF_CONDUCT.map(section => (
            <div key={section.heading}>
              <h4 className="font-bold text-foreground mb-2">{section.heading}</h4>
              <ol className="list-decimal list-outside pl-5 space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="text-muted-foreground">{item}</li>
                ))}
              </ol>
            </div>
          ))}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              {CONDUCT_SIGN_DECLARATION}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ChildConductCard({ child, token }: { child: ExtendedMember; token: string }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const current = isConductCurrent(child.codeSignedAt)
  const signedLabel = conductSignedLabel(child.codeSignedAt)

  const handleSign = async () => {
    if (!confirmed) return
    setSigning(true)
    setError(null)
    try {
      await signConduct(token, child.id)
      qc.invalidateQueries({ queryKey: getGetParentChildrenQueryKey({ token }) })
    } catch {
      setError("Something went wrong — please try again.")
    } finally {
      setSigning(false)
    }
  }

  return (
    <Card className={cn("border-t-4", current ? "border-t-green-500" : "border-t-amber-500")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-primary">{child.playerName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {child.ageGroup}
              {child.addAgeGroup ? ` · also trains with ${child.addAgeGroup}` : ""}
            </p>
          </div>
          {current ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {signedLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {child.codeSignedAt ? "Renewal required" : "Signature required"}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <ConductText expanded={expanded} onToggle={() => setExpanded(e => !e)} />

        {!current && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {child.codeSignedAt
                ? "Your annual re-signature is due. Please read the Code of Conduct above and sign below."
                : "Please read the Code of Conduct above, then sign below to confirm your agreement."}
            </p>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-400 text-primary cursor-pointer"
                />
              </div>
              <span className="text-sm text-amber-800 leading-relaxed group-hover:text-amber-900">
                I, <strong>{child.playerParent || "the parent/guardian"}</strong>, confirm I have read
                and agree to the KJIHC Code of Conduct on behalf of myself and{" "}
                <strong>{child.playerName}</strong>.
              </span>
            </label>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button
              onClick={handleSign}
              disabled={!confirmed || signing}
              className="w-full gap-2"
            >
              {signing
                ? <><Loader2 className="h-4 w-4 animate-spin" />Signing…</>
                : <><PenLine className="h-4 w-4" />Sign Code of Conduct</>
              }
            </Button>
          </div>
        )}

        {current && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Your signature is valid for 12 months. You will receive an email reminder when renewal is due.
            </p>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-primary underline underline-offset-2"
            >
              {expanded ? "Hide" : "Read"} the Code of Conduct
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface Props {
  token: string
  children: MemberDetail[]
}

export default function ConductSection({ token, children }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold font-display">Code of Conduct</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We ask families to read and re-sign the Code of Conduct each season. Click each player below to review and sign.
        </p>
      </div>

      {(children as ExtendedMember[]).map(child => (
        <ChildConductCard key={child.id} child={child} token={token} />
      ))}
    </div>
  )
}
