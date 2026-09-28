import { useState, useMemo, useEffect } from "react"
import { useLocation } from "wouter"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { AGE_GROUPS, ageGroupLabel } from "@/lib/ageGroups"
import {
  Plus, Calendar, Clock, MapPin, Users, ChevronDown, ChevronRight,
  Pencil, Trash2, Loader2, CheckCircle2, XCircle, HelpCircle,
  Trophy, Dumbbell, PartyPopper, ExternalLink, ChevronUp,
  ClipboardList, UserCheck, Sparkles, RefreshCw, Check, X, CreditCard,
} from "lucide-react"
import { useListEvents, useGetEventRsvp, getListEventsQueryKey, getGetEventRsvpQueryKey } from "@workspace/api-client-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "training" | "game" | "social"

const EVENT_TYPES: { value: EventType; label: string; icon: React.ComponentType<any>; color: string; bg: string }[] = [
  { value: "training", label: "Training",  icon: Dumbbell,     color: "text-blue-700",   bg: "bg-blue-100 border-blue-300"  },
  { value: "game",     label: "Game",      icon: Trophy,       color: "text-amber-700",  bg: "bg-amber-100 border-amber-300" },
  { value: "social",   label: "Social",    icon: PartyPopper,  color: "text-purple-700", bg: "bg-purple-100 border-purple-300" },
]

function eventTypeInfo(type: string) {
  return EVENT_TYPES.find(t => t.value === type) ?? EVENT_TYPES[0]
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "pm" : "am"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2,"0")}${suffix}`
}

function arriveTime(startTime: string, offsetMins: number): string {
  const [h, m] = startTime.split(":").map(Number)
  const total = h * 60 + m - offsetMins
  const ah = Math.floor(((total % 1440) + 1440) % 1440 / 60)
  const am = ((total % 1440) + 1440) % 1440 % 60
  const suffix = ah >= 12 ? "pm" : "am"
  const hour = ah % 12 || 12
  return `${hour}:${String(am).padStart(2,"0")}${suffix}`
}

function groupByWeek(events: any[]): { label: string; events: any[] }[] {
  const today = new Date(); today.setHours(0,0,0,0)
  const groups: Record<string, any[]> = {}
  for (const e of events) {
    const d = new Date(e.eventDate + "T00:00:00")
    const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
    let key: string
    if (diff < 0) key = "Past"
    else if (diff === 0) key = "Today"
    else if (diff === 1) key = "Tomorrow"
    else if (diff < 7) key = "This week"
    else if (diff < 14) key = "Next week"
    else {
      key = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  const order = ["Today", "Tomorrow", "This week", "Next week"]
  const sorted = Object.entries(groups).sort(([a], [b]) => {
    const ai = order.indexOf(a), bi = order.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })
  return sorted.map(([label, evts]) => ({ label, events: evts }))
}

// ─── Date & Time picker primitives ───────────────────────────────────────────

function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + "T00:00:00") : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2.5 rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
        >
          <Calendar size={14} className="text-muted-foreground shrink-0" />
          {value
            ? <span className="font-medium">{formatDateShort(value)}</span>
            : <span className="text-muted-foreground">Pick a date…</span>
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              // en-CA gives YYYY-MM-DD
              onChange(d.toLocaleDateString("en-CA"))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINS  = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]

function TimePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(":") : ["", ""]

  const setHour = (hh: string) => {
    if (!hh) { onChange(""); return }
    onChange(`${hh}:${m || "00"}`)
  }
  const setMin = (mm: string) => {
    if (!mm) { onChange(""); return }
    onChange(`${h || "00"}:${mm}`)
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={h}
        onChange={e => setHour(e.target.value)}
        className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <option value="">HH</option>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-muted-foreground font-bold select-none">:</span>
      <select
        value={m}
        onChange={e => setMin(e.target.value)}
        className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <option value="">MM</option>
        {MINS.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  )
}

// ─── Staff-as-parent: children hook ──────────────────────────────────────────

interface StaffChild {
  id: number
  playerName: string
  ageGroup: string | null
  addAgeGroup: string | null
}

function useMyChildren() {
  return useQuery<StaffChild[]>({
    queryKey: ["staff-me-children"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/staff/me/children`, { credentials: "include" })
      if (!r.ok) return []
      return r.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Staff RSVP panel ─────────────────────────────────────────────────────────

const RSVP_OPTS = [
  { status: "yes",   label: "Going",     Icon: CheckCircle2, cls: "text-green-700 border-green-300 bg-green-50 hover:bg-green-100" },
  { status: "maybe", label: "Maybe",     Icon: HelpCircle,   cls: "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100" },
  { status: "no",    label: "Not going", Icon: XCircle,      cls: "text-red-600   border-red-300   bg-red-50   hover:bg-red-100"   },
]

function StaffRsvpPanel({ event, children }: { event: any; children: StaffChild[] }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const eligible = useMemo(() => {
    if (!event.ageGroups) return children
    const allowed = event.ageGroups.split(",").map((g: string) => g.trim()).filter(Boolean)
    if (!allowed.length) return children
    return children.filter(c => {
      const groups = [c.ageGroup, ...(c.addAgeGroup ? c.addAgeGroup.split(",").map((g: string) => g.trim()) : [])]
      return groups.some(g => g && allowed.includes(g))
    })
  }, [children, event.ageGroups])

  // Derive current RSVP status per child from the shared event RSVP query
  // (already fetched by RsvpSummary — this is a free cache hit)
  const { data: rsvpData } = useGetEventRsvp(event.id)
  const serverStatus = useMemo<Record<number, string | null>>(() => {
    if (!rsvpData) return {}
    const childIds = new Set(children.map(c => c.id))
    const map: Record<number, string | null> = {}
    for (const r of (rsvpData as any).responses ?? []) {
      if (childIds.has(r.memberId)) map[r.memberId] = r.status
    }
    return map
  }, [rsvpData, children])

  const [pending, setPending] = useState<Record<number, string>>({})
  // Local optimistic overrides layered on top of server state
  const [localOverrides, setLocalOverrides] = useState<Record<number, string | null>>({})
  const rsvpStatus = { ...serverStatus, ...localOverrides }

  // ── Event payments for the staff member's own eligible children ──
  const hasCost = (event.costPence ?? 0) > 0

  const { data: paymentsData } = useQuery<{
    costPence: number
    payments: { memberId: number; playerName?: string; method: "bank" | "stripe"; amountPence: number; createdAt: string }[]
  }>({
    queryKey: ["staff-event-payments", event.id],
    queryFn: () => fetch(`${BASE}/api/events/${event.id}/payments`, { credentials: "include" }).then(r => r.json()),
    enabled: hasCost && eligible.length > 0,
  })

  const paidByMember = useMemo<Record<number, { method: "bank" | "stripe" }>>(() => {
    const map: Record<number, { method: "bank" | "stripe" }> = {}
    for (const p of paymentsData?.payments ?? []) map[p.memberId] = { method: p.method }
    return map
  }, [paymentsData])

  const [payingBank, setPayingBank] = useState<Record<number, boolean>>({})
  const [payingCard, setPayingCard] = useState<Record<number, boolean>>({})

  const markPaid = useMutation({
    mutationFn: async (memberId: number) => {
      const r = await fetch(`${BASE}/api/events/${event.id}/payments/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId }),
      })
      if (!r.ok) throw new Error()
      return memberId
    },
    onMutate: (memberId) => { setPayingBank(prev => ({ ...prev, [memberId]: true })) },
    onSuccess: async (memberId) => {
      await queryClient.invalidateQueries({ queryKey: ["staff-event-payments", event.id] })
      setPayingBank(prev => { const n = { ...prev }; delete n[memberId]; return n })
      toast({ title: "Thank you! Marked as paid." })
    },
    onError: (_, memberId) => {
      setPayingBank(prev => { const n = { ...prev }; delete n[memberId]; return n })
      toast({ title: "Couldn't mark as paid", variant: "destructive" })
    },
  })

  const payByCard = async (memberId: number) => {
    setPayingCard(prev => ({ ...prev, [memberId]: true }))
    try {
      const cancelUrl = window.location.origin + window.location.pathname
      const successUrl = `${cancelUrl}?eventPaid=1`
      const r = await fetch(`${BASE}/api/events/${event.id}/payments/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId, successUrl, cancelUrl }),
      })
      const json = await r.json()
      if (!r.ok || !json.checkoutUrl) {
        toast({ title: json?.error ?? "Payment failed", variant: "destructive" })
        return
      }
      window.location.href = json.checkoutUrl
    } catch {
      toast({ title: "Could not start payment", variant: "destructive" })
    } finally {
      setPayingCard(prev => { const n = { ...prev }; delete n[memberId]; return n })
    }
  }

  const mutate = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: number; status: string }) => {
      const r = await fetch(`${BASE}/api/events/${event.id}/staff-rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId, status }),
      })
      if (!r.ok) throw new Error()
      return { memberId, status }
    },
    onSuccess: ({ memberId, status }) => {
      setLocalOverrides(prev => ({ ...prev, [memberId]: status }))
      setPending(prev => { const n = { ...prev }; delete n[memberId]; return n })
      queryClient.invalidateQueries({ queryKey: getGetEventRsvpQueryKey(event.id) })
    },
    onError: (_, { memberId }) => {
      setLocalOverrides(prev => { const n = { ...prev }; delete n[memberId]; return n })
      setPending(prev => { const n = { ...prev }; delete n[memberId]; return n })
      toast({ title: "Couldn't save your RSVP", variant: "destructive" })
    },
  })

  if (!eligible.length) return null

  return (
    <div className="pt-3 border-t mt-3 space-y-2.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">My RSVP</p>
      {eligible.map(child => {
        const paid = paidByMember[child.id]
        return (
          <div key={child.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium truncate">{child.playerName}</span>
              <div className="flex gap-1.5 shrink-0">
                {RSVP_OPTS.map(({ status, label, Icon, cls }) => {
                  const isCurrent = rsvpStatus[child.id] === status
                  const isLoading = pending[child.id] === status
                  return (
                    <button
                      key={status}
                      disabled={!!pending[child.id]}
                      onClick={() => {
                        setPending(prev => ({ ...prev, [child.id]: status }))
                        mutate.mutate({ memberId: child.id, status })
                      }}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all disabled:opacity-60 ${
                        isCurrent ? cls : "border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            {hasCost && (
              <div className="flex items-center justify-end gap-1.5">
                {paid ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium text-green-700 border-green-300 bg-green-50">
                    <CheckCircle2 size={11} />
                    Paid ✓ ({paid.method === "bank" ? "bank" : "card"})
                  </span>
                ) : (
                  <>
                    <button
                      disabled={!!payingBank[child.id]}
                      onClick={() => markPaid.mutate(child.id)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all disabled:opacity-60 border-border text-muted-foreground hover:border-muted-foreground/50"
                    >
                      {payingBank[child.id] ? <Loader2 size={11} className="animate-spin" /> : null}
                      I've paid by bank
                    </button>
                    <button
                      disabled={!!payingCard[child.id]}
                      onClick={() => payByCard(child.id)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all disabled:opacity-60 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                    >
                      {payingCard[child.id] ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
                      Pay by card
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Compliance flag pills ─────────────────────────────────────────────────────

function ComplianceFlags({ feesOverdue, sihaRegistered }: { feesOverdue?: number | null; sihaRegistered?: number | null }) {
  const flags = []
  if (feesOverdue === 1)       flags.push(<span key="fees" className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white leading-none" title="Fees overdue">💸 Fees</span>)
  if ((sihaRegistered ?? 0) !== 1) flags.push(<span key="siha" className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white leading-none" title="Not SIHA registered">⚠️ SIHA</span>)
  if (!flags.length) return null
  return <span className="inline-flex gap-1 ml-1 align-middle">{flags}</span>
}

// ─── RSVP Summary ─────────────────────────────────────────────────────────────

function RsvpSummary({ eventId }: { eventId: number }) {
  const { data, isLoading } = useGetEventRsvp(eventId)
  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading RSVPs…</div>
  if (!data) return null
  const { counts, responses } = data as any

  const going    = (responses as any[]).filter((r: any) => r.status === "yes")
  const notGoing = (responses as any[]).filter((r: any) => r.status === "no")
  const maybe    = (responses as any[]).filter((r: any) => r.status === "maybe")

  const flaggedCount = (responses as any[]).filter((r: any) => r.feesOverdue === 1 || (r.sihaRegistered ?? 0) !== 1).length

  return (
    <div className="space-y-3 pt-3 border-t mt-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-green-700 font-semibold"><CheckCircle2 size={14} /> {counts.yes} Going</span>
        <span className="flex items-center gap-1.5 text-red-600 font-semibold"><XCircle size={14} /> {counts.no} Not going</span>
        <span className="flex items-center gap-1.5 text-amber-600 font-semibold"><HelpCircle size={14} /> {counts.maybe} Maybe</span>
        {flaggedCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-700 font-semibold bg-red-50 border border-red-200 rounded-full px-2 py-0.5 text-xs">
            ⚠️ {flaggedCount} compliance issue{flaggedCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {responses.length > 0 && (
        <div className="space-y-2">
          {going.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {going.map((r: any) => (
                <span key={r.memberId} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium bg-green-50 border-green-300 text-green-700">
                  {r.playerName}
                  <ComplianceFlags feesOverdue={r.feesOverdue} sihaRegistered={r.sihaRegistered} />
                </span>
              ))}
            </div>
          )}
          {maybe.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {maybe.map((r: any) => (
                <span key={r.memberId} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium bg-amber-50 border-amber-300 text-amber-700">
                  {r.playerName}
                  <ComplianceFlags feesOverdue={r.feesOverdue} sihaRegistered={r.sihaRegistered} />
                </span>
              ))}
            </div>
          )}
          {notGoing.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {notGoing.map((r: any) => (
                <span key={r.memberId} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium bg-red-50 border-red-300 text-red-600">
                  {r.playerName}
                  <ComplianceFlags feesOverdue={r.feesOverdue} sihaRegistered={r.sihaRegistered} />
                  {r.reason ? <> &mdash; <span className="font-normal">{r.reason}</span></> : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {responses.length === 0 && <p className="text-xs text-muted-foreground">No responses yet.</p>}
    </div>
  )
}

// ─── Attendance summary (past events) ────────────────────────────────────────

function AttendanceSummary({ eventId }: { eventId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["event-attendance", eventId],
    queryFn: () => fetch(`${BASE}/api/events/${eventId}/attendance`, { credentials: "include" }).then(r => r.json()),
  })

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading register…</div>
  if (!data) return null

  const { present, absent, presentCount, total } = data as {
    present: { memberId: number; playerName: string }[]
    absent:  { memberId: number; playerName: string; missReason: string }[]
    presentCount: number; total: number
  }

  if (total === 0) return <p className="text-xs text-muted-foreground pt-2">No register recorded for this event.</p>

  return (
    <div className="space-y-3 pt-3 border-t mt-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {presentCount} / {total} attended
      </p>
      {present.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {present.map(p => (
            <span key={p.memberId} className="text-xs px-2 py-0.5 rounded-full border font-medium bg-green-50 border-green-300 text-green-700">
              {p.playerName}
            </span>
          ))}
        </div>
      )}
      {absent.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {absent.map(p => (
            <span key={p.memberId} className="text-xs px-2 py-0.5 rounded-full border font-medium bg-red-50 border-red-300 text-red-600">
              {p.playerName}{p.missReason ? <> — <span className="font-normal">{p.missReason}</span></> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Payments summary (events with a cost) ───────────────────────────────────

function PaymentsSummary({ eventId }: { eventId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["event-payments", eventId],
    queryFn: () => fetch(`${BASE}/api/events/${eventId}/payments`, { credentials: "include" }).then(r => r.json()),
  })

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading payments…</div>
  if (!data) return null

  const { payments } = data as {
    costPence: number
    payments: { memberId: number; playerName: string; method: "bank" | "stripe"; amountPence: number; createdAt: string }[]
  }

  return (
    <div className="space-y-3 pt-3 border-t mt-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {payments.length} paid
      </p>
      {payments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {payments.map(p => (
            <span key={p.memberId} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium bg-emerald-50 border-emerald-300 text-emerald-700">
              {p.playerName}
              <span className="font-normal text-emerald-600">
                {p.method === "bank" ? "Bank" : "Card"} · {formatDateShort(p.createdAt.slice(0, 10))}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No payments yet.</p>
      )}
    </div>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onEdit, onDelete, myChildren = [] }: {
  event: any; onEdit: (e: any) => void; onDelete: (id: number) => void; myChildren?: StaffChild[]
}) {
  const [, navigate] = useLocation()
  const [showRsvp, setShowRsvp] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const typeInfo = eventTypeInfo(event.eventType)
  const Icon = typeInfo.icon
  const counts = event.rsvpCounts ?? { yes: 0, no: 0, maybe: 0 }
  const isPast = event.eventDate < new Date().toISOString().slice(0, 10)

  const ageGroupLabels = event.ageGroups
    ? event.ageGroups.split(",").map((g: string) => ageGroupLabel(g.trim())).filter(Boolean)
    : []

  const mapUrl = event.locationLat && event.locationLng
    ? `https://www.openstreetmap.org/?mlat=${event.locationLat}&mlon=${event.locationLng}&zoom=15#map=15/${event.locationLat}/${event.locationLng}`
    : null

  return (
    <Card className={`p-5 transition-all ${isPast ? "opacity-70" : "hover:shadow-md"}`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${typeInfo.bg}`}>
          <Icon size={18} className={typeInfo.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <span className={`text-xs font-bold uppercase tracking-wide ${typeInfo.color}`}>{typeInfo.label}</span>
              <h3 className="font-bold text-base leading-tight">{event.title}</h3>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {!isPast && (
                <button
                  onClick={() => navigate(`/staff/signin?eventId=${event.id}`)}
                  title="Take register"
                  className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ClipboardList size={14} />
                </button>
              )}
              <button onClick={() => onEdit(event)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(event.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1.5">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {formatDate(event.eventDate)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {formatTime(event.startTime)}
              {event.endTime && ` – ${formatTime(event.endTime)}`}
              {" · "}
              <span className="text-primary font-medium">
                Arrive {arriveTime(event.startTime, event.meetOffsetMins)}
              </span>
            </span>
            {event.locationName && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {event.locationName}
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    <ExternalLink size={11} />
                  </a>
                )}
              </span>
            )}
          </div>

          {ageGroupLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ageGroupLabels.map((label: string) => (
                <Badge key={label} variant="outline" className="text-xs">{label}</Badge>
              ))}
              {event.isRosterRestricted === 1 && (
                <Badge variant="secondary" className="text-xs gap-1"><Users size={10} /> Selected roster</Badge>
              )}
            </div>
          )}

          {event.costPence > 0 && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs font-semibold text-emerald-700 border-emerald-300 bg-emerald-50">
                {formatPence(event.costPence)} per player
              </Badge>
            </div>
          )}

          {event.notes && (
            <p className="text-sm text-muted-foreground mt-2 italic line-clamp-2">{event.notes}</p>
          )}

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            <button
              onClick={() => setShowRsvp(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRsvp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              RSVPs · {counts.yes} going, {counts.no} not, {counts.maybe} maybe
            </button>

            {isPast && (
              <button
                onClick={() => setShowAttendance(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAttendance ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <UserCheck size={13} />
                Attendance register
              </button>
            )}

            {event.costPence > 0 && (
              <button
                onClick={() => setShowPayments(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPayments ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <CreditCard size={13} />
                Payments
              </button>
            )}
          </div>

          {showRsvp && (
            <>
              <RsvpSummary eventId={event.id} />
              {myChildren.length > 0 && <StaffRsvpPanel event={event} children={myChildren} />}
            </>
          )}

          {isPast && showAttendance && <AttendanceSummary eventId={event.id} />}

          {event.costPence > 0 && showPayments && <PaymentsSummary eventId={event.id} />}
        </div>
      </div>
    </Card>
  )
}

// ─── Create/Edit Dialog ───────────────────────────────────────────────────────

const MEET_OFFSETS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hr",   value: 60 },
  { label: "90 min", value: 90 },
  { label: "2 hrs",  value: 120 },
]

const EMPTY_FORM = {
  title: "",
  eventType: "training" as EventType,
  eventDate: "",
  startTime: "",
  endTime: "",
  locationName: "",
  locationLat: "",
  locationLng: "",
  meetOffsetMins: 60,
  ageGroups: [] as string[],
  notes: "",
  isRosterRestricted: false,
  cost: "",
}

// Section header used inside the dialog
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 mt-6 mb-2 first:mt-0">
      {children}
    </p>
  )
}

function EventFormDialog({ initial, onClose }: {
  initial: typeof EMPTY_FORM & { id?: number } | null
  onClose: (saved?: boolean) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  const [form, setForm] = useState<typeof EMPTY_FORM>(initial ?? EMPTY_FORM)
  const [showMapPin, setShowMapPin] = useState(
    !!(initial?.locationLat || initial?.locationLng)
  )

  // Roster state
  const [rosterMemberIds, setRosterMemberIds] = useState<Set<number>>(new Set())
  const [rosterMembers, setRosterMembers]     = useState<any[]>([])

  const loadRosterCandidates = async (ageGroups: string[]) => {
    try {
      const res = await fetch(`${BASE}/api/members`, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const all = await res.json()
      setRosterMembers(ageGroups.length === 0 ? all : all.filter((m: any) =>
        ageGroups.includes(m.ageGroup) ||
        (m.addAgeGroup && m.addAgeGroup.split(",").some((g: string) => ageGroups.includes(g.trim())))
      ))
    } catch (err) {
      console.error("Failed to load roster candidates:", err)
    }
  }

  useEffect(() => {
    if (initial?.id && initial.isRosterRestricted) {
      fetch(`${BASE}/api/events/${initial.id}/roster`, { credentials: "include" })
        .then(r => r.json())
        .then((rows: any[]) => setRosterMemberIds(new Set(rows.map((r: any) => r.memberId))))
        .catch(() => {})
      loadRosterCandidates(form.ageGroups)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleAgeGroup = (val: string) => {
    setForm(f => {
      const next = f.ageGroups.includes(val)
        ? f.ageGroups.filter(g => g !== val)
        : [...f.ageGroups, val]
      if (f.isRosterRestricted) loadRosterCandidates(next)
      return { ...f, ageGroups: next }
    })
  }

  const handleRosterToggle = (checked: boolean) => {
    setForm(f => ({ ...f, isRosterRestricted: checked }))
    if (checked) loadRosterCandidates(form.ageGroups)
  }

  const handleSave = async () => {
    if (!form.title || !form.eventDate || !form.startTime) {
      toast({ title: "Title, date and start time are required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const costTrimmed = String(form.cost ?? "").trim()
      const costPence = costTrimmed ? Math.round(parseFloat(costTrimmed) * 100) : null
      const body = {
        ...form,
        ageGroups: form.ageGroups.join(","),
        locationLat:  form.locationLat  ? parseFloat(form.locationLat as any)  : null,
        locationLng:  form.locationLng  ? parseFloat(form.locationLng as any)  : null,
        isRosterRestricted: form.isRosterRestricted ? 1 : 0,
        endTime: form.endTime || null,
        costPence: costPence != null && !isNaN(costPence) && costPence > 0 ? costPence : null,
      }
      delete (body as any).cost

      let savedId: number
      if (isEdit) {
        const r = await fetch(`${BASE}/api/events/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
        if (!r.ok) throw new Error()
        savedId = (await r.json()).id
      } else {
        const r = await fetch(`${BASE}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
        if (!r.ok) throw new Error()
        savedId = (await r.json()).id
      }

      if (form.isRosterRestricted && savedId!) {
        await fetch(`${BASE}/api/events/${savedId}/roster`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ memberIds: [...rosterMemberIds] }),
        })
      }

      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() })
      toast({ title: isEdit ? "Event updated" : "Event created" })
      onClose(true)
    } catch {
      toast({ title: "Failed to save event", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const typeInfo = eventTypeInfo(form.eventType)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        {/* Coloured header strip */}
        <div className={`px-6 pt-6 pb-4 border-b ${typeInfo.bg}`}>
          <DialogTitle className={`text-xl font-display font-bold ${typeInfo.color}`}>
            {isEdit ? "Edit Event" : "Create Event"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit ? "Update the details below." : "Fill in the details to add this event to the calendar."}
          </p>
        </div>

        <div className="px-6 py-5 space-y-0">

          {/* ── Event type ── */}
          <SectionHeading>Event type</SectionHeading>
          <div className="grid grid-cols-3 gap-2">
            {EVENT_TYPES.map(({ value, label, icon: Icon, bg, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm(f => ({ ...f, eventType: value }))}
                className={`flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${
                  form.eventType === value
                    ? `${bg} border-current ${color} font-semibold shadow-sm`
                    : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                }`}
              >
                <Icon size={20} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Title ── */}
          <SectionHeading>Title</SectionHeading>
          <Input
            placeholder={
              form.eventType === "training" ? "e.g. Tuesday Dev Ice"
              : form.eventType === "game"   ? "e.g. Home Game vs Paisley Pirates"
              : "e.g. End-of-Season Dinner"
            }
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="text-base font-medium"
          />

          {/* ── Date & time ── */}
          <SectionHeading>Date &amp; time</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date <span className="text-destructive">*</span></Label>
              <DatePickerField value={form.eventDate} onChange={v => setForm(f => ({ ...f, eventDate: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start time <span className="text-destructive">*</span></Label>
              <TimePickerField value={form.startTime} onChange={v => setForm(f => ({ ...f, startTime: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">End time <span className="font-normal">(optional)</span></Label>
              <TimePickerField value={form.endTime} onChange={v => setForm(f => ({ ...f, endTime: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Arrive before start</Label>
              <div className="flex flex-wrap gap-1.5">
                {MEET_OFFSETS.map(({ label, value }) => (
                  <button key={value} type="button"
                    onClick={() => setForm(f => ({ ...f, meetOffsetMins: value }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                      form.meetOffsetMins === value
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Arrive-by callout */}
          {form.startTime && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
              <Clock size={13} className="text-primary shrink-0" />
              <span>Parents &amp; players should arrive by <strong className="text-primary">{arriveTime(form.startTime, form.meetOffsetMins)}</strong>
                {form.endTime && <> · Session ends <strong>{formatTime(form.endTime)}</strong></>}
              </span>
            </div>
          )}

          {/* ── Location ── */}
          <SectionHeading>Location</SectionHeading>
          <Input
            placeholder="e.g. Irvine Ice Rink, Harbourside"
            value={form.locationName}
            onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
          />

          {/* Map pin toggle */}
          <button
            type="button"
            onClick={() => setShowMapPin(v => !v)}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <MapPin size={12} />
            {showMapPin ? "Hide map pin" : "Add map pin (lat/lng)"}
            {showMapPin ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showMapPin && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Latitude</Label>
                <Input type="number" step="any" placeholder="55.6093" value={form.locationLat}
                  onChange={e => setForm(f => ({ ...f, locationLat: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Longitude</Label>
                <Input type="number" step="any" placeholder="-4.6625" value={form.locationLng}
                  onChange={e => setForm(f => ({ ...f, locationLng: e.target.value }))} />
              </div>
              {form.locationLat && form.locationLng && (
                <div className="col-span-2">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${form.locationLat}&mlon=${form.locationLng}&zoom=15`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink size={11} /> Preview on OpenStreetMap
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── Age groups ── */}
          <SectionHeading>Age groups</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map(({ value, label }) => {
              const selected = form.ageGroups.includes(value)
              return (
                <button key={value} type="button" onClick={() => toggleAgeGroup(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    selected ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border hover:border-primary/40 text-muted-foreground"
                  }`}
                >{label}</button>
              )
            })}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer mt-3">
            <input type="checkbox" checked={form.isRosterRestricted}
              onChange={e => handleRosterToggle(e.target.checked)}
              className="rounded border-input" />
            <span>Restricted roster — only selected players are invited</span>
          </label>

          {/* Roster picker */}
          {form.isRosterRestricted && rosterMembers.length > 0 && (
            <div className="mt-3 border rounded-xl p-4 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Select Roster ({rosterMemberIds.size} selected)
                </Label>
                <div className="flex gap-3">
                  <button type="button" className="text-xs text-primary hover:underline"
                    onClick={() => setRosterMemberIds(new Set(rosterMembers.map((m: any) => m.id)))}>
                    Select all
                  </button>
                  <button type="button" className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setRosterMemberIds(new Set())}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {rosterMembers.map((m: any) => {
                  const checked = rosterMemberIds.has(m.id)
                  return (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 text-sm cursor-pointer">
                      <input type="checkbox" checked={checked}
                        onChange={() => setRosterMemberIds(prev => {
                          const next = new Set(prev)
                          checked ? next.delete(m.id) : next.add(m.id)
                          return next
                        })}
                        className="rounded border-input shrink-0" />
                      <span className="truncate">{m.playerName}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Cost ── */}
          <SectionHeading>Cost per player <span className="font-normal normal-case text-muted-foreground">(optional)</span></SectionHeading>
          <div className="relative max-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">£</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.cost}
              onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
              className="pl-7 font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Leave blank if this event is free.</p>

          {/* ── Notes ── */}
          <SectionHeading>Notes <span className="font-normal normal-case text-muted-foreground">(optional)</span></SectionHeading>
          <textarea
            placeholder="Kit requirements, what to bring, parking info, special instructions…"
            className="w-full p-3 border rounded-xl text-sm min-h-[90px] bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t bg-muted/20 sticky bottom-0">
          <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[130px] gap-2">
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : isEdit ? "Save changes" : "Create event"
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Events() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab]             = useState<"upcoming" | "past">("upcoming")
  const [showForm, setShowForm]   = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [deleting, setDeleting]   = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [syncing, setSyncing]     = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [dismissingId, setDismissingId] = useState<number | null>(null)

  const { data: allEvents, isLoading } = useListEvents({})
  const { data: myChildren = [] } = useMyChildren()

  // On return from Stripe (eventPaid=1) show a success toast and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("eventPaid") === "1") {
      toast({ title: "Thank you! Your payment was received." })
      // Stripe records the payment asynchronously via webhook, so poll a few
      // times to let the Paid badge appear once the row lands.
      const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff-event-payments"] })
      const timers = [0, 2000, 5000, 10000].map(ms => setTimeout(invalidate, ms))
      const clean = new URL(window.location.href)
      clean.searchParams.delete("eventPaid")
      window.history.replaceState({}, "", clean.toString())
      return () => { timers.forEach(clearTimeout) }
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: staffMe } = useQuery({
    queryKey: ["staff-me-events"],
    queryFn: () => fetch(`${BASE}/api/staff/me`, { credentials: "include" }).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })
  const isSuperUser = staffMe?.staffLevel === "1"

  const today = new Date().toISOString().slice(0, 10)
  const suggestedEvents = useMemo(() =>
    (allEvents ?? [])
      .filter((e: any) => e.status === "suggested")
      .sort((a: any, b: any) => a.eventDate.localeCompare(b.eventDate)),
    [allEvents])
  const upcoming = useMemo(() =>
    (allEvents ?? []).filter((e: any) => e.eventDate >= today && e.status !== "suggested"), [allEvents, today])
  const past = useMemo(() =>
    (allEvents ?? []).filter((e: any) => e.eventDate < today && e.status !== "suggested").reverse(), [allEvents, today])

  const displayEvents = tab === "upcoming" ? upcoming : past
  const filteredEvents = typeFilter === "all"
    ? displayEvents
    : displayEvents.filter((e: any) => e.eventType === typeFilter)

  const groups = groupByWeek(filteredEvents)

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this event? This cannot be undone.")) return
    setDeleting(id)
    try {
      const r = await fetch(`${BASE}/api/events/${id}`, { method: "DELETE", credentials: "include" })
      if (!r.ok) throw new Error()
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() })
      toast({ title: "Event deleted" })
    } catch {
      toast({ title: "Failed to delete event", variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const r = await fetch(`${BASE}/api/events/sync-snl`, { method: "POST", credentials: "include" })
      const data = await r.json()
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() })
      toast({ title: data.imported > 0 ? `${data.imported} new fixture${data.imported === 1 ? "" : "s"} imported` : "Already up to date" })
    } catch {
      toast({ title: "Sync failed", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const handleApprove = async (id: number) => {
    setApprovingId(id)
    try {
      const r = await fetch(`${BASE}/api/events/${id}/approve`, { method: "POST", credentials: "include" })
      if (!r.ok) throw new Error()
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() })
      toast({ title: "Added to calendar" })
    } catch {
      toast({ title: "Failed to add event", variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  const handleDismiss = async (id: number) => {
    setDismissingId(id)
    try {
      const r = await fetch(`${BASE}/api/events/${id}/dismiss`, { method: "POST", credentials: "include" })
      if (!r.ok) throw new Error()
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() })
    } catch {
      toast({ title: "Failed to dismiss", variant: "destructive" })
    } finally {
      setDismissingId(null)
    }
  }

  const openEdit = (event: any) => {
    setEditingEvent({
      ...event,
      ageGroups: event.ageGroups ? event.ageGroups.split(",").map((g: string) => g.trim()).filter(Boolean) : [],
      isRosterRestricted: event.isRosterRestricted === 1,
      locationLat:  event.locationLat  ?? "",
      locationLng:  event.locationLng  ?? "",
      endTime:      event.endTime      ?? "",
      notes:        event.notes        ?? "",
      cost:         event.costPence && event.costPence > 0 ? (event.costPence / 100).toFixed(2) : "",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Events</h1>
          <p className="text-muted-foreground text-sm mt-1">Training sessions, games and club events</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Sync SNL fixtures
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={16} /> Create Event
          </Button>
        </div>
      </div>

      {/* ── Suggested SNL fixtures ──────────────────────────────────────────── */}
      {suggestedEvents.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-100 border-b border-amber-200">
            <Sparkles size={16} className="text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-amber-900">
                {suggestedEvents.length} suggested SNL fixture{suggestedEvents.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-amber-700 ml-2">Add to your calendar or dismiss</span>
            </div>
          </div>
          <div className="divide-y divide-amber-200">
            {suggestedEvents.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-950 truncate">{e.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-amber-700">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(e.eventDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatTime(e.startTime)}
                    </span>
                    {e.locationName && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={11} />
                        {e.locationName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(e.id)}
                    disabled={approvingId === e.id || dismissingId === e.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {approvingId === e.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Check size={12} />}
                    Add to calendar
                  </button>
                  <button
                    onClick={() => handleDismiss(e.id)}
                    disabled={approvingId === e.id || dismissingId === e.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {dismissingId === e.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <X size={12} />}
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(["upcoming", "past"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "All types" }, ...EVENT_TYPES].map(({ value, label }) => (
          <button key={value} onClick={() => setTypeFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              typeFilter === value
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "border-border hover:border-primary/40 text-muted-foreground"
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Event list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-xl text-muted-foreground">
          <Calendar className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-medium">{tab === "upcoming" ? "No upcoming events" : "No past events"}</p>
          {tab === "upcoming" && (
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Create the first one
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, events }) => (
            <div key={label}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</h2>
              <div className="space-y-3">
                {events.map((event: any) => (
                  <EventCard key={event.id} event={event}
                    onEdit={openEdit} onDelete={handleDelete} myChildren={isSuperUser ? [] : myChildren} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <EventFormDialog initial={null} onClose={() => setShowForm(false)} />}
      {editingEvent && <EventFormDialog initial={editingEvent} onClose={() => setEditingEvent(null)} />}
    </div>
  )
}
