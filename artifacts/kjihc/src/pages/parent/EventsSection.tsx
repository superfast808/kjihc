import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { MemberDetail } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CalendarDays, MapPin, Clock, Check, X, Minus, ChevronDown, ChevronUp, CreditCard, Landmark, CheckCircle2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""

interface EventResult {
  id: number
  title: string
  eventType: string
  eventDate: string
  startTime: string | null
  endTime: string | null
  location: string | null
  notes: string | null
  ageGroups: string | null
  rsvpCounts: { yes: number; no: number; maybe: number }
  myRsvp: "yes" | "no" | "maybe" | null
  costPence: number | null
}

async function fetchEvents(token: string, ageGroup: string, memberId: number): Promise<EventResult[]> {
  const params = new URLSearchParams({ upcoming: "true", ageGroup, memberId: String(memberId) })
  const r = await fetch(`/api/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Failed to load events")
  return r.json()
}

async function fetchRsvpList(token: string, eventId: number): Promise<{ playerName: string; status: string }[]> {
  const r = await fetch(`/api/events/${eventId}/rsvp`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Failed to load RSVPs")
  const d = await r.json()
  return d.responses ?? []
}

function WhosComing({ token, eventId }: { token: string; eventId: number }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ["parent-event-rsvps", token, eventId],
    queryFn: () => fetchRsvpList(token, eventId),
    enabled: open,
    staleTime: 30_000,
  })
  const badge: Record<string, { label: string; cls: string }> = {
    yes:   { label: "Going",     cls: "bg-green-100 text-green-700" },
    maybe: { label: "Maybe",     cls: "bg-amber-100 text-amber-700" },
    no:    { label: "Not going", cls: "bg-red-100 text-red-700" },
  }
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? "Hide responses" : "See who's coming"}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-2.5 space-y-1.5">
          {isLoading ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : !data || data.length === 0 ? (
            <p className="text-xs text-muted-foreground">No responses yet.</p>
          ) : (
            data.map(r => (
              <div key={`${r.playerName}-${r.status}`} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground truncate">{r.playerName}</span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", badge[r.status]?.cls ?? "bg-muted text-muted-foreground")}>
                  {badge[r.status]?.label ?? r.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

async function postRsvp(token: string, eventId: number, memberId: number, status: "yes" | "no" | "maybe") {
  const r = await fetch(`/api/events/${eventId}/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ memberId, status }),
  })
  if (!r.ok) throw new Error("RSVP failed")
  return r.json()
}

function groupEvents(events: EventResult[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7  = new Date(today); in7.setDate(today.getDate() + 7)
  const in30 = new Date(today); in30.setDate(today.getDate() + 30)

  const groups: { label: string; events: EventResult[] }[] = [
    { label: "This week",    events: [] },
    { label: "Coming up",    events: [] },
    { label: "Further ahead", events: [] },
  ]

  for (const e of events) {
    const d = new Date(e.eventDate + "T00:00:00")
    if (d < in7)       groups[0].events.push(e)
    else if (d < in30) groups[1].events.push(e)
    else               groups[2].events.push(e)
  }

  return groups.filter(g => g.events.length > 0)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  })
}

function formatTime(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "pm" : "am"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`
}

function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

// ─── Event payment panel ──────────────────────────────────────────────────────

const HANDLING_FEE_PENCE = 10

interface PaymentRow {
  memberId: number
  method: "bank" | "stripe"
  amountPence: number
  createdAt: string
}

function EventPayment({ token, eventId, memberId, costPence }: {
  token: string; eventId: number; memberId: number; costPence: number
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [payingCard, setPayingCard] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["parent-event-payments", token, eventId],
    queryFn: async (): Promise<PaymentRow[]> => {
      const r = await fetch(`${BASE}/api/events/${eventId}/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error("Failed to load payment status")
      const d = await r.json()
      return d.payments ?? []
    },
    staleTime: 15_000,
  })

  const paid = data?.find(p => p.memberId === memberId)

  const markPaid = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}/payments/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId }),
      })
      if (!r.ok) throw new Error("Failed")
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-event-payments", token, eventId] })
      toast({ title: "Thanks — marked as paid by bank" })
    },
    onError: () => toast({ title: "Couldn't mark as paid", variant: "destructive" }),
  })

  const payByCard = async () => {
    setPayingCard(true)
    try {
      const origin = window.location.origin
      const url = new URL(window.location.href)
      const cancelUrl = `${origin}${url.pathname}${url.search}`
      const successUrl = `${cancelUrl}${url.search ? "&" : "?"}eventPaid=1`
      const r = await fetch(`${BASE}/api/events/${eventId}/payments/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId, successUrl, cancelUrl }),
      })
      const json = await r.json()
      if (!r.ok) { toast({ title: json.error ?? "Payment failed", variant: "destructive" }); return }
      window.location.href = json.checkoutUrl
    } catch {
      toast({ title: "Could not start payment", variant: "destructive" })
    } finally {
      setPayingCard(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking payment…
      </div>
    )
  }

  if (paid) {
    return (
      <div className="mt-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Paid ✓ ({paid.method === "bank" ? "bank" : "card"})
        </span>
      </div>
    )
  }

  const cardTotalPence = costPence + HANDLING_FEE_PENCE

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        disabled={markPaid.isPending}
        onClick={() => markPaid.mutate()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        {markPaid.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}
        I've paid by bank
      </button>
      <button
        disabled={payingCard}
        onClick={payByCard}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {payingCard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
        Pay by card {formatPence(cardTotalPence)} (incl. 10p handling)
      </button>
    </div>
  )
}

// ─── Event payment success banner ─────────────────────────────────────────────

function EventPaymentSuccessBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("eventPaid") === "1") {
      setShow(true)
      const clean = new URL(window.location.href)
      clean.searchParams.delete("eventPaid")
      window.history.replaceState({}, "", clean.toString())
    }
  }, [])

  if (!show) return null

  return (
    <div className="rounded-xl border border-green-300 bg-green-50 p-4 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-green-800">Payment received</p>
        <p className="text-sm text-green-700 mt-0.5">
          Thank you! It can take a few seconds for the status to update.
        </p>
      </div>
      <button onClick={() => setShow(false)} className="text-green-600 hover:text-green-800 text-lg leading-none">&times;</button>
    </div>
  )
}

interface RsvpButtonsProps {
  current: "yes" | "no" | "maybe" | null
  onRsvp: (status: "yes" | "no" | "maybe") => void
  isPending: boolean
}

function RsvpButtons({ current, onRsvp, isPending }: RsvpButtonsProps) {
  const opts: { status: "yes" | "no" | "maybe"; label: string; icon: React.ReactNode; activeClass: string }[] = [
    { status: "yes",   label: "Going",    icon: <Check className="h-3.5 w-3.5" />, activeClass: "bg-green-600 text-white hover:bg-green-700 border-green-600" },
    { status: "maybe", label: "Maybe",    icon: <Minus className="h-3.5 w-3.5" />, activeClass: "bg-amber-500 text-white hover:bg-amber-600 border-amber-500" },
    { status: "no",    label: "Not going", icon: <X className="h-3.5 w-3.5" />,    activeClass: "bg-red-500 text-white hover:bg-red-600 border-red-500" },
  ]

  return (
    <div className="flex gap-1.5 flex-wrap">
      {opts.map(opt => (
        <button
          key={opt.status}
          disabled={isPending}
          onClick={() => onRsvp(opt.status)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
            current === opt.status
              ? opt.activeClass
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface Props {
  token: string
  children: MemberDetail[]
}

export default function EventsSection({ token, children }: Props) {
  const qc = useQueryClient()
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id)
  const child = children.find(c => c.id === selectedChildId) ?? children[0]

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["parent-events", token, child?.id],
    queryFn: () => fetchEvents(token, child!.ageGroup!, child!.id),
    enabled: !!child,
    staleTime: 60_000,
  })

  const rsvpMutation = useMutation({
    mutationFn: ({ eventId, status }: { eventId: number; status: "yes" | "no" | "maybe" }) =>
      postRsvp(token, eventId, child!.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parent-events", token, child?.id] }),
  })

  const grouped = groupEvents(events)

  // On return from Stripe (eventPaid=1) webhooks may lag a few seconds —
  // refetch event payment statuses so the Paid badge appears.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("eventPaid") === "1") {
      qc.invalidateQueries({ queryKey: ["parent-event-payments"] })
      const t = setTimeout(() => qc.invalidateQueries({ queryKey: ["parent-event-payments"] }), 4000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [qc])

  return (
    <div className="space-y-6">
      <EventPaymentSuccessBanner />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-display">Upcoming Sessions</h2>
        {children.length > 1 && (
          <div className="flex gap-1.5">
            {children.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors",
                  selectedChildId === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {c.playerName.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card><CardContent className="py-8 text-center text-sm text-destructive">Failed to load events.</CardContent></Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-40" />
            <p className="font-medium">No upcoming sessions</p>
            <p className="text-sm">Check back soon.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(group => (
          <div key={group.label}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.events.map(event => {
                const isPending = rsvpMutation.isPending && (rsvpMutation.variables as any)?.eventId === event.id
                return (
                  <Card key={event.id} className={cn(
                    "transition-all",
                    event.myRsvp === "yes" ? "border-l-4 border-l-green-500" :
                    event.myRsvp === "maybe" ? "border-l-4 border-l-amber-500" :
                    event.myRsvp === "no" ? "border-l-4 border-l-red-400 opacity-70" : ""
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className={cn(
                              "text-xs font-semibold",
                              event.eventType === "game" ? "border-secondary text-secondary" : "border-primary/40 text-primary"
                            )}>
                              {event.eventType === "game" ? "Game" : "Training"}
                            </Badge>
                            <span className="text-sm font-semibold text-foreground">{event.title}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(event.eventDate)}
                            </span>
                            {(event.startTime || event.endTime) && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(event.startTime)}{event.endTime ? `–${formatTime(event.endTime)}` : ""}
                              </span>
                            )}
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                          {event.notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">{event.notes}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 hidden sm:block">
                          <p className="text-xs text-muted-foreground">Going</p>
                          <p className="text-lg font-bold text-green-600">{event.rsvpCounts.yes}</p>
                        </div>
                      </div>
                      <RsvpButtons
                        current={event.myRsvp}
                        onRsvp={(status) => rsvpMutation.mutate({ eventId: event.id, status })}
                        isPending={isPending}
                      />
                      {event.costPence != null && event.costPence > 0 && child && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              Cost
                            </span>
                            <span className="font-mono font-bold text-foreground">{formatPence(event.costPence)}</span>
                          </div>
                          <EventPayment
                            token={token}
                            eventId={event.id}
                            memberId={child.id}
                            costPence={event.costPence}
                          />
                        </div>
                      )}
                      <WhosComing token={token} eventId={event.id} />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
