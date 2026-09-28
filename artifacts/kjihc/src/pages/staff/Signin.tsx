import { useState, useMemo, useEffect } from "react"
import { useSearch } from "wouter"
import { useListMembers, useListEvents, useListSignins, useSubmitSignins, SigninBatch, SigninEntryStatus } from "@workspace/api-client-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, HeartPulse, Printer, CheckCircle2, XCircle, MinusCircle, History, CalendarDays, ClipboardList } from "lucide-react"
import { getMedicalFlags, highestSeverity, SEVERITY_STYLES } from "@/lib/medicalFlags"
import { ageGroupLabel } from "@/lib/ageGroups"
import { printMedicalSheet } from "@/lib/printMedicalSheet"
import { cn } from "@/lib/utils"

const AGE_GROUP_OPTIONS = [
  { value: "LTP",       label: "Learn to Play (LTP)" },
  { value: "u10",       label: "Under 10" },
  { value: "u12",       label: "Under 12" },
  { value: "u14",       label: "Under 14" },
  { value: "u16",       label: "Under 16" },
  { value: "u19",       label: "Under 19" },
  { value: "lightning", label: "Lightning (Girls)" },
]

const STATUSES = [
  { val: "yes", label: "Present", Icon: CheckCircle2, active: "bg-green-600 text-white border-green-600 shadow-sm",   inactive: "border-border text-muted-foreground hover:border-green-400 hover:text-green-700" },
  { val: "no",  label: "Absent",  Icon: XCircle,      active: "bg-red-500   text-white border-red-500   shadow-sm",   inactive: "border-border text-muted-foreground hover:border-red-400   hover:text-red-600"   },
  { val: "na",  label: "N/A",     Icon: MinusCircle,  active: "bg-muted     text-foreground border-muted-foreground", inactive: "border-border text-muted-foreground hover:bg-muted"                                },
]

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  })
}

export default function Signin() {
  const today = new Date().toISOString().split("T")[0]

  const [sessionName,     setSessionName]     = useState("")
  const [useCustom,       setUseCustom]       = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(undefined)
  const [date,            setDate]            = useState(today)
  const [ageGroup,        setAgeGroup]        = useState("LTP")

  const searchString = useSearch()

  const { data: members, isLoading } = useListMembers({ ageGroup })
  const { data: allEvents = [] }     = useListEvents({})
  const { data: pastSignins }        = useListSignins()
  const submitSignins                = useSubmitSignins()
  const { toast }                    = useToast()

  // Auto-select event from ?eventId URL param once events have loaded
  useEffect(() => {
    const paramId = new URLSearchParams(searchString).get("eventId")
    if (!paramId || allEvents.length === 0) return
    const evId = Number(paramId)
    const ev = allEvents.find(e => e.id === evId)
    if (!ev) return
    setUseCustom(false)
    setSelectedEventId(evId)
    setSessionName(ev.title ?? "")
    if (ev.eventDate) setDate(ev.eventDate)
    if (ev.ageGroups) {
      const first = ev.ageGroups.split(",")[0].trim()
      if (AGE_GROUP_OPTIONS.some(o => o.value === first)) {
        setAgeGroup(first)
        setEntries({})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, searchString])

  const [entries, setEntries] = useState<Record<number, { status: string; reason: string }>>({})

  // ── Classify events into groups for the picker ────────────────────────────
  const { onDate, upcoming, past } = useMemo(() => {
    const onDate   = allEvents.filter(e => e.eventDate === date)
    const upcoming = allEvents.filter(e => e.eventDate > date)
    const past     = allEvents.filter(e => e.eventDate < date).reverse() // newest first
    return { onDate, upcoming, past }
  }, [allEvents, date])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleEventSelect = (value: string) => {
    if (value === "__custom__") {
      setUseCustom(true)
      setSelectedEventId(undefined)
      setSessionName("")
      return
    }
    if (value === "") {
      setUseCustom(false)
      setSelectedEventId(undefined)
      setSessionName("")
      return
    }
    const evId = Number(value)
    const ev   = allEvents.find(e => e.id === evId)
    setUseCustom(false)
    setSelectedEventId(evId)
    setSessionName(ev?.title ?? "")
    // Auto-fill date from event
    if (ev?.eventDate) setDate(ev.eventDate)
    // Auto-fill age group from event's first group
    if (ev?.ageGroups) {
      const first = ev.ageGroups.split(",")[0].trim()
      if (AGE_GROUP_OPTIONS.some(o => o.value === first)) {
        setAgeGroup(first)
        setEntries({})
      }
    }
  }

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    // If the selected event is no longer on this date, clear it
    if (selectedEventId) {
      const ev = allEvents.find(e => e.id === selectedEventId)
      if (ev && ev.eventDate !== newDate) {
        setSelectedEventId(undefined)
        setSessionName("")
        setUseCustom(false)
      }
    }
  }

  const handleGroupChange = (group: string) => {
    setAgeGroup(group)
    setEntries({})
  }

  const handleStatusChange = (memberId: number, status: string) => {
    setEntries(prev => ({ ...prev, [memberId]: { status, reason: prev[memberId]?.reason || "" } }))
  }

  const handleReasonChange = (memberId: number, reason: string) => {
    setEntries(prev => ({ ...prev, [memberId]: { status: prev[memberId]?.status || "no", reason } }))
  }

  const handleSubmit = () => {
    if (!sessionName.trim()) {
      toast({ title: "Session name required", description: "Select an event or enter a custom session name.", variant: "destructive" })
      return
    }
    if (!members?.length) return

    const payloadEntries = members.map(m => {
      const local = entries[m.id] || { status: "na", reason: "" }
      return { memberId: m.id, status: local.status as SigninEntryStatus, missReason: local.status === "no" ? local.reason : null }
    })

    const payload: SigninBatch = {
      session: sessionName,
      date,
      entries: payloadEntries,
      ...(selectedEventId != null ? { eventId: selectedEventId } : {}),
    }

    submitSignins.mutate({ data: payload }, {
      onSuccess: (res) => {
        toast({ title: "Register saved", description: `${res.saved} records saved.` })
      },
      onError: (err: any) => {
        toast({ title: "Save failed", description: err.message || "Please try again.", variant: "destructive" })
      },
    })
  }

  const presentCount  = Object.values(entries).filter(e => e.status === "yes").length
  const absentCount   = Object.values(entries).filter(e => e.status === "no").length
  const unmarkedCount = (members?.length ?? 0) - presentCount - absentCount

  // Current picker value
  const pickerValue = useCustom ? "__custom__" : selectedEventId != null ? String(selectedEventId) : ""

  // Selected event label for header
  const selectedEvent = selectedEventId != null ? allEvents.find(e => e.id === selectedEventId) : undefined

  // ── Past registers ─────────────────────────────────────────────────────────
  const pastRegisters = useMemo(() => {
    if (!pastSignins?.length) return []
    const map = new Map<string, {
      key: string; date: string; session: string
      eventTitle: string | null | undefined; eventId: number | null | undefined
      present: number; absent: number; total: number
    }>()
    for (const row of pastSignins) {
      const key = `${row.date}||${row.session}`
      const ex = map.get(key)
      if (ex) {
        ex.total++
        if (row.missReason == null) ex.present++
        else ex.absent++
      } else {
        map.set(key, {
          key, date: row.date, session: row.session,
          eventTitle: row.eventTitle, eventId: row.eventId,
          present: row.missReason == null ? 1 : 0,
          absent: row.missReason != null ? 1 : 0,
          total: 1,
        })
      }
    }
    return Array.from(map.values())
  }, [pastSignins])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Training Sign-in</h1>

      {/* ── Session config ───────────────────────────────────────────────── */}
      <Card className="border-t-4 border-t-primary">
        <CardContent className="p-6 space-y-5">

          {/* Row 1: Event picker (full width) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays size={14} className="text-primary" />
              Event
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={pickerValue}
              onChange={e => handleEventSelect(e.target.value)}
            >
              <option value="">— Select an event —</option>

              {onDate.length > 0 && (
                <optgroup label={`On ${formatDisplayDate(date)}`}>
                  {onDate.map(ev => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.title}{ev.startTime ? ` · ${ev.startTime}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}

              {upcoming.length > 0 && (
                <optgroup label="Upcoming">
                  {upcoming.map(ev => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.eventDate} — {ev.title}
                    </option>
                  ))}
                </optgroup>
              )}

              {past.length > 0 && (
                <optgroup label="Past events">
                  {past.map(ev => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.eventDate} — {ev.title}
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="──────────────">
                <option value="__custom__">Custom session name…</option>
              </optgroup>
            </select>

            {useCustom && (
              <Input
                autoFocus
                placeholder="e.g. Tuesday Dev Ice"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
              />
            )}
          </div>

          {/* Row 2: Date + Age group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => handleDateChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Age Group</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ageGroup}
                onChange={e => handleGroupChange(e.target.value)}
              >
                {AGE_GROUP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected event summary pill */}
          {selectedEvent && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary">
              <CalendarDays size={14} className="shrink-0" />
              <span className="font-semibold">{selectedEvent.title}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{formatDisplayDate(selectedEvent.eventDate)}</span>
              {selectedEvent.startTime && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{selectedEvent.startTime}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Roster + marking ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <CardTitle className="text-xl font-display">
                {AGE_GROUP_OPTIONS.find(o => o.value === ageGroup)?.label ?? ageGroup}
              </CardTitle>
              {!!members?.length && (
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600 font-semibold">{presentCount} present</span>
                  <span className="text-red-500 font-semibold">{absentCount} absent</span>
                  {unmarkedCount > 0 && <span className="text-muted-foreground">{unmarkedCount} unmarked</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => printMedicalSheet(members ?? [], sessionName, date, ageGroup)}
                disabled={isLoading || !members?.length}
                title="Print medical summary for this session"
              >
                <Printer className="mr-2 h-4 w-4" />
                Medical sheet
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitSignins.isPending || isLoading || !members?.length || !sessionName.trim()}
                className="min-w-[130px]"
              >
                {submitSignins.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  : <><ClipboardList className="mr-2 h-4 w-4" />Submit Register</>
                }
              </Button>
            </div>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !sessionName.trim() ? (
          <div className="p-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select an event above to begin marking attendance</p>
          </div>
        ) : members?.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No players found in this age group.</div>
        ) : (
          <div className="divide-y">
            {members?.map(member => {
              const currentStatus = entries[member.id]?.status || "na"
              const isAbsent = currentStatus === "no"

              return (
                <div
                  key={member.id}
                  className={cn(
                    "p-4 transition-colors",
                    currentStatus === "yes" && "bg-green-50/60",
                    currentStatus === "no"  && "bg-red-50/60",
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold font-display text-lg">{member.playerName}</h4>
                        {member.feesOverdue === 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                            💸 Fees Overdue
                          </span>
                        )}
                        {(member.sihaRegistered ?? 0) !== 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                            ⚠️ Not SIHA
                          </span>
                        )}
                        {member.agreePhoto === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-400 px-2 py-0.5 text-xs font-bold text-purple-800">
                            📵 No Photos
                          </span>
                        )}
                        {member.addAgeGroup &&
                          member.addAgeGroup.split(",").map(g => g.trim()).includes(ageGroup) &&
                          member.ageGroup !== ageGroup && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Home: {ageGroupLabel(member.ageGroup)}
                            </span>
                          )}
                        {member.ageGroup === ageGroup && member.addAgeGroup && (
                          <span className="inline-flex items-center rounded-full bg-sky-100 border border-sky-300 px-2 py-0.5 text-xs font-semibold text-sky-800">
                            Also: {ageGroupLabel(member.addAgeGroup)}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const flags = getMedicalFlags(member.playerMedicalnotes, null)
                        if (!flags.length) return null
                        const sev = highestSeverity(flags)!
                        const st = SEVERITY_STYLES[sev]
                        return (
                          <button
                            type="button"
                            onClick={() => toast({
                              title: `${member.playerName} — Medical`,
                              description: member.playerMedicalnotes || flags.map(f => f.label).join(", "),
                            })}
                            className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border cursor-pointer active:scale-95 transition-transform ${st.bg} ${st.border} ${st.text}`}
                          >
                            <HeartPulse size={11} />
                            {flags[0].label}{flags.length > 1 ? ` +${flags.length - 1} more` : ""}
                          </button>
                        )
                      })()}
                    </div>

                    {/* Attendance segment buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="flex gap-1 bg-muted/40 border rounded-xl p-1">
                        {STATUSES.map(({ val, label, Icon, active, inactive }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleStatusChange(member.id, val)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all select-none",
                              currentStatus === val ? active : inactive,
                            )}
                          >
                            <Icon size={13} />
                            {label}
                          </button>
                        ))}
                      </div>

                      {isAbsent && (
                        <Input
                          placeholder="Reason for absence…"
                          className="w-full sm:w-48 bg-background border-red-200"
                          value={entries[member.id]?.reason || ""}
                          onChange={e => handleReasonChange(member.id, e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Past Registers ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <History size={20} />
            Past Registers
          </CardTitle>
        </CardHeader>
        {pastRegisters.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No past registers found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Session / Event</th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-right">Present</th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-right">Absent</th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pastRegisters.map((reg) => (
                    <tr key={reg.key} className="hover:bg-muted/30">
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">{reg.date}</td>
                      <td className="px-5 py-3">
                        {reg.eventTitle ? (
                          <div className="flex flex-col">
                            <span className="font-semibold font-display flex items-center gap-1.5">
                              <CalendarDays size={13} className="text-primary shrink-0" />
                              {reg.eventTitle}
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5">{reg.session}</span>
                          </div>
                        ) : (
                          <span className="font-medium">{reg.session}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-green-600">{reg.present}</td>
                      <td className="px-5 py-3 text-right font-medium text-red-500">{reg.absent}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{reg.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y">
              {pastRegisters.map((reg) => (
                <div key={reg.key} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {reg.eventTitle ? (
                        <>
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            <CalendarDays size={13} className="text-primary shrink-0" />
                            {reg.eventTitle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{reg.session}</p>
                        </>
                      ) : (
                        <p className="font-medium text-sm">{reg.session}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{reg.date}</p>
                    </div>
                    <div className="flex gap-3 text-sm shrink-0">
                      <span className="font-semibold text-green-600">{reg.present} ✓</span>
                      <span className="font-semibold text-red-500">{reg.absent} ✗</span>
                      <span className="text-muted-foreground">{reg.total}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
