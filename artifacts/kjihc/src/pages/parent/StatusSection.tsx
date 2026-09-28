import { useState, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MemberDetail } from "@workspace/api-client-react"
import { getGetParentChildrenQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertCircle, ShieldCheck, CreditCard, Camera, FileText, Handshake, Loader2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { isConductCurrent } from "@/lib/codeOfConduct"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

interface ExtendedMember extends MemberDetail {
  sihaRegistered?: number
  feesOverdue?: number
  feesBalance?: number | null
  codeSignedAt?: string | null
}

// ─── Child photo avatar + upload ─────────────────────────────────────────────

function ChildPhoto({ child, token }: { child: ExtendedMember; token: string | null }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: photoUrl } = useQuery({
    queryKey: ["parent-photo-url", child.id, token],
    queryFn: async () => {
      if (!child.playerPhoto || !token) return null
      const r = await fetch(
        `${BASE}/api/parent/me/children/${child.id}/photo-url?token=${encodeURIComponent(token)}`
      )
      if (!r.ok) return null
      const json = await r.json() as { url: string }
      return json.url
    },
    enabled: !!child.playerPhoto && !!token,
    staleTime: 50 * 60 * 1000,
    retry: false,
  })

  const handleFile = async (file: File) => {
    if (!token) return
    if (!PHOTO_TYPES.includes(file.type)) {
      toast({ title: "Use a jpeg, png, or webp photo", variant: "destructive" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo must be under 5 MB", variant: "destructive" })
      return
    }
    setUploading(true)
    try {
      // 1 — Request signed PUT URL
      const urlResp = await fetch(
        `${BASE}/api/parent/me/children/${child.id}/photo/request-url?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type }),
        }
      )
      if (!urlResp.ok) throw new Error("Could not get upload URL")
      const { uploadUrl, objectPath } = await urlResp.json() as { uploadUrl: string; objectPath: string }

      // 2 — PUT directly to GCS
      const putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!putResp.ok) throw new Error("Upload to storage failed")

      // 3 — Confirm
      const confirmResp = await fetch(
        `${BASE}/api/parent/me/children/${child.id}/photo/confirm?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath }),
        }
      )
      if (!confirmResp.ok) throw new Error("Failed to save photo")

      queryClient.invalidateQueries({ queryKey: getGetParentChildrenQueryKey({ token }) })
      queryClient.invalidateQueries({ queryKey: ["parent-photo-url", child.id] })
      toast({ title: "Photo updated!" })
    } catch (err) {
      toast({ title: "Photo upload failed", description: String(err), variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const initials = child.playerName
    .split(" ")
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("")

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer group"
      title={child.playerPhoto ? "Tap to change photo" : "Tap to add a photo"}
      onClick={() => !uploading && fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />

      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary/60 transition-colors">
        {child.playerPhoto && photoUrl ? (
          <img src={photoUrl} alt={child.playerName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg select-none">
            {initials}
          </div>
        )}
      </div>

      {/* Camera badge */}
      <div className={cn(
        "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow",
        uploading && "animate-pulse"
      )}>
        {uploading
          ? <Loader2 className="w-3 h-3 text-white animate-spin" />
          : <Camera className="w-3 h-3 text-white" />}
      </div>
    </div>
  )
}

// ─── Status row ───────────────────────────────────────────────────────────────

function StatusRow({
  icon: Icon, label, ok, okText, failText, warn = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  ok: boolean
  okText: string
  failText: string
  warn?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
        ok ? "bg-green-50" : warn ? "bg-amber-50" : "bg-red-50"
      )}>
        <Icon className={cn("h-4 w-4", ok ? "text-green-600" : warn ? "text-amber-600" : "text-red-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className={cn("text-xs mt-0.5", ok ? "text-green-600" : warn ? "text-amber-600" : "text-red-500")}>
          {ok ? okText : failText}
        </p>
      </div>
      <div className="flex-shrink-0">
        {ok ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : warn ? (
          <AlertCircle className="h-5 w-5 text-amber-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>
    </div>
  )
}

// ─── Stripe payment panel ─────────────────────────────────────────────────────

function FeesPaymentPanel({ child, token }: { child: ExtendedMember; token: string | null }) {
  const { toast } = useToast()
  const balance = child.feesBalance ?? 0
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [loading, setLoading] = useState(false)

  useEffect(() => { setAmount(balance.toFixed(2)) }, [balance])

  const amountPence = Math.round(parseFloat(amount || "0") * 100)
  const valid = !isNaN(amountPence) && amountPence >= 50

  const handlePay = async () => {
    if (!valid || !token) return
    setLoading(true)
    try {
      const origin = window.location.origin
      const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""
      const portalUrl = `${origin}${basePath}/parent?token=${encodeURIComponent(token)}`
      const r = await fetch(`${basePath}/api/parent/me/payment/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          childId: child.id,
          amountPence,
          successUrl: `${portalUrl}&paid=1&amountPence=${amountPence}`,
          cancelUrl: portalUrl,
        }),
      })
      const json = await r.json()
      if (!r.ok) { toast({ title: json.error ?? "Payment failed", variant: "destructive" }); return }
      window.location.href = json.checkoutUrl
    } catch {
      toast({ title: "Could not start payment", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-1 mb-3 rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-red-800">Outstanding balance</p>
        <span className="font-mono font-bold text-red-800 text-lg">£{balance.toFixed(2)}</span>
      </div>
      <p className="text-xs text-red-700">You can pay the full amount or a partial payment — enter how much you'd like to pay now.</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">£</span>
          <input
            type="number"
            min="0.50"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={handlePay}
          disabled={!valid || loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
            : <><ExternalLink className="h-4 w-4" /> Pay with card</>}
        </button>
      </div>
      {amountPence > 0 && amountPence < 50 && (
        <p className="text-xs text-red-600">Minimum payment is £0.50</p>
      )}
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  children: MemberDetail[]
  token: string | null
}

function PaymentSuccessBanner() {
  const [show, setShow] = useState(false)
  const [amountPounds, setAmountPounds] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("paid") === "1") {
      const pence = parseInt(params.get("amountPence") ?? "", 10)
      setAmountPounds(isNaN(pence) ? null : pence / 100)
      setShow(true)
      // Strip the params from the URL without reloading
      const clean = new URL(window.location.href)
      clean.searchParams.delete("paid")
      clean.searchParams.delete("amountPence")
      window.history.replaceState({}, "", clean.toString())
    }
  }, [])

  if (!show) return null

  return (
    <div className="rounded-xl border border-green-300 bg-green-50 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-green-800">
          Payment received{amountPounds != null ? ` — £${amountPounds.toFixed(2)}` : ""}
        </p>
        <p className="text-sm text-green-700 mt-0.5">
          Thank you! Your balance will be updated shortly and your treasurer has been notified.
        </p>
      </div>
      <button onClick={() => setShow(false)} className="text-green-600 hover:text-green-800 text-lg leading-none">&times;</button>
    </div>
  )
}

export default function StatusSection({ children, token }: Props) {
  return (
    <div className="space-y-6">
      <PaymentSuccessBanner />
      <h2 className="text-xl font-bold font-display">Player Status</h2>

      {(children as ExtendedMember[]).map(child => {
        const sihaOk    = (child.sihaRegistered ?? 0) === 1
        const feesOk    = (child.feesOverdue ?? 0) !== 1
        const photoOk   = child.agreePhoto === 1
        const gdprOk    = child.agreeGdpr === 1
        const feeAgrOk  = child.agreeFee === 1
        const conductOk = isConductCurrent((child as any).codeSignedAt)

        const issues = [!sihaOk, !feesOk, !photoOk, !gdprOk, !feeAgrOk, !conductOk].filter(Boolean).length
        const allGood = issues === 0

        return (
          <Card key={child.id} className={cn(
            "border-t-4",
            allGood ? "border-t-green-500" : issues >= 2 ? "border-t-red-500" : "border-t-amber-500"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <ChildPhoto child={child} token={token} />
                  <div>
                    <CardTitle className="text-lg text-primary">{child.playerName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {child.ageGroup}
                      {child.addAgeGroup ? ` · also trains with ${child.addAgeGroup}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Tap photo to update</p>
                  </div>
                </div>

                {/* Status badge */}
                <span className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mt-1",
                  allGood
                    ? "bg-green-100 text-green-700"
                    : issues >= 2
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  {allGood ? "All clear" : `${issues} item${issues > 1 ? "s" : ""} need attention`}
                </span>
              </div>
            </CardHeader>

            <CardContent className="divide-y divide-border pt-0">
              {/* Compliance */}
              <div className="pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-1">Compliance</p>
                <StatusRow icon={ShieldCheck} label="SIHA Registration" ok={sihaOk}
                  okText="Registered for this season"
                  failText="Not yet registered — your coach will be in touch"
                  warn={!sihaOk} />
                <div className="border-t border-border/50" />
                <StatusRow icon={CreditCard} label="Monthly Fees" ok={feesOk}
                  okText="Fees up to date"
                  failText="Fees overdue — please arrange payment" />
                {!feesOk && child.feesBalance != null && (
                  <FeesPaymentPanel child={child} token={token} />
                )}
              </div>

              {/* Consents */}
              <div className="pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-1">Consents &amp; Agreements</p>
                <StatusRow icon={Camera} label="Photography Consent" ok={photoOk}
                  okText="Consent given" failText="Not consented — update in My Players" warn />
                <div className="border-t border-border/50" />
                <StatusRow icon={FileText} label="GDPR / Data Consent" ok={gdprOk}
                  okText="Consent given" failText="Not consented — update in My Players" warn />
                <div className="border-t border-border/50" />
                <StatusRow icon={Handshake} label="Fee Agreement" ok={feeAgrOk}
                  okText="Agreed" failText="Not agreed — update in My Players" warn />
                <div className="border-t border-border/50" />
                <StatusRow icon={FileText} label="Code of Conduct" ok={conductOk}
                  okText={`Signed ${(child as any).codeSignedAt ? new Date((child as any).codeSignedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}`}
                  failText={(child as any).codeSignedAt && !conductOk
                    ? "Annual re-signature due — go to Conduct tab"
                    : "Signature required — go to Conduct tab"}
                  warn />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
