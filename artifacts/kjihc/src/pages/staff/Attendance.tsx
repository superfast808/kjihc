import React, { useState, useEffect } from "react"
import { useGetAttendanceSummary, useListEvents, useGetMyStaffProfile } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Download, Loader2, ChevronDown, ChevronRight, Users, TrendingUp, AlertTriangle, Award } from "lucide-react"
import { cn } from "@/lib/utils"

function RateBar({ rate }: { rate: number }) {
  const colour = rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500"
  const text   = rate >= 80 ? "text-green-600" : rate >= 50 ? "text-yellow-600" : "text-red-600"
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 sm:w-24 h-2 bg-muted rounded-full overflow-hidden flex-shrink-0">
        <div className={cn("h-full rounded-full", colour)} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className={cn("font-bold tabular-nums text-sm", text)}>{rate}%</span>
    </div>
  )
}

const ALL_AGE_GROUPS = [
  { value: "LTP",       label: "Learn to Play (LTP)" },
  { value: "u10",       label: "Under 10"             },
  { value: "u12",       label: "Under 12"             },
  { value: "u14",       label: "Under 14"             },
  { value: "u16",       label: "Under 16"             },
  { value: "u19",       label: "Under 19"             },
  { value: "lightning", label: "Lightning (Girls)"    },
]

export default function Attendance() {
  const [dateFrom,     setDateFrom]     = useState("")
  const [dateTo,       setDateTo]       = useState("")
  const [ageGroup,     setAgeGroup]     = useState("")
  const [eventId,      setEventId]      = useState<number | undefined>(undefined)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const { data: staffProfile } = useGetMyStaffProfile()
  const isSuperUser    = staffProfile?.isSuperUser === true
  const allowedGroups: string[] = !isSuperUser && staffProfile?.allowedGroups?.length
    ? (staffProfile.allowedGroups as string[])
    : []
  const visibleGroups  = allowedGroups.length > 0
    ? ALL_AGE_GROUPS.filter(g => allowedGroups.includes(g.value))
    : ALL_AGE_GROUPS

  // Default restricted staff to their first group on profile load
  useEffect(() => {
    if (allowedGroups.length > 0 && !ageGroup) {
      setAgeGroup(allowedGroups[0])
    }
  }, [allowedGroups.join(",")])  // eslint-disable-line react-hooks/exhaustive-deps

  const { data: events = [] } = useListEvents()

  const { data: records, isLoading } = useGetAttendanceSummary({
    from:     dateFrom  || undefined,
    to:       dateTo    || undefined,
    ageGroup: ageGroup  || undefined,
    eventId,
  })

  const toggleRow = (memberId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(memberId) ? next.delete(memberId) : next.add(memberId)
      return next
    })
  }

  // ── KPI summary ────────────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    if (!records?.length) return null
    const total    = records.length
    const avgRate  = Math.round(records.reduce((s, r) => s + r.rate, 0) / total)
    const atRisk   = records.filter(r => r.rate < 50).length
    const perfect  = records.filter(r => r.rate === 100).length
    return { total, avgRate, atRisk, perfect }
  }, [records])

  const handleExportCsv = () => {
    if (!records?.length) return
    const selectedEvent = eventId ? events.find(e => e.id === eventId) : undefined
    const headers = ["Player Name", "Age Group", "Sessions Attended", "Total Possible", "Attendance Rate", "Absence Reasons"]
    const rows = records.map(r => {
      const absenceSummary = r.absences?.length
        ? r.absences.map(a => `${a.date}${a.eventTitle ? ` (${a.eventTitle})` : ""}: ${a.reason}`).join(" | ")
        : ""
      return [r.memberName, r.ageGroup, String(r.attended), String(r.total), `${r.rate}%`, absenceSummary]
    })
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = `kjihc-attendance${selectedEvent ? `-${selectedEvent.title.replace(/\s+/g, "-")}` : ""}${dateFrom ? `-from-${dateFrom}` : ""}${dateTo ? `-to-${dateTo}` : ""}${ageGroup ? `-${ageGroup}` : ""}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Sort events: most recent first so past events are easy to find
  const sortedEvents = React.useMemo(
    () => [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [events],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Attendance Reports</h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExportCsv}
          disabled={!records?.length}
          title={records?.length ? "Download as CSV" : "No data to export"}
        >
          <Download size={16} /> Export CSV
        </Button>
      </div>

      {/* KPI summary cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{kpis.total}</p>
                <p className="text-xs text-muted-foreground">Players</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                kpis.avgRate >= 80 ? "bg-green-100" : kpis.avgRate >= 50 ? "bg-yellow-100" : "bg-red-100"
              )}>
                <TrendingUp className={cn("h-5 w-5", kpis.avgRate >= 80 ? "text-green-600" : kpis.avgRate >= 50 ? "text-yellow-600" : "text-red-600")} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold tabular-nums", kpis.avgRate >= 80 ? "text-green-600" : kpis.avgRate >= 50 ? "text-yellow-600" : "text-red-600")}>
                  {kpis.avgRate}%
                </p>
                <p className="text-xs text-muted-foreground">Avg attendance</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", kpis.atRisk > 0 ? "bg-red-100" : "bg-green-100")}>
                <AlertTriangle className={cn("h-5 w-5", kpis.atRisk > 0 ? "text-red-500" : "text-green-600")} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold tabular-nums", kpis.atRisk > 0 ? "text-red-600" : "text-green-600")}>
                  {kpis.atRisk}
                </p>
                <p className="text-xs text-muted-foreground">At risk (&lt;50%)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-amber-600">{kpis.perfect}</p>
                <p className="text-xs text-muted-foreground">100% attendance</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Event</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={eventId ?? ""}
                onChange={e => setEventId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">All Events</option>
                {sortedEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.eventDate} — {ev.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Age Group</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ageGroup}
                onChange={e => setAgeGroup(e.target.value)}
                disabled={allowedGroups.length === 1}
              >
                {allowedGroups.length === 0 && <option value="">All Groups</option>}
                {visibleGroups.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Filters apply automatically. Event list shows most recent first.</p>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Card>
          <CardContent className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : !records?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No attendance records found for these filters.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Desktop table ──────────────────────────────────────────────── */}
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 w-8" />
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider">Player</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider">Group</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-right">Attended</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-right">Total</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map(record => {
                    const hasAbsences = (record.absences?.length ?? 0) > 0
                    const isExpanded  = expandedRows.has(record.memberId)
                    return (
                      <React.Fragment key={record.memberId}>
                        <tr
                          className={cn("hover:bg-muted/30", hasAbsences && "cursor-pointer")}
                          onClick={() => hasAbsences && toggleRow(record.memberId)}
                        >
                          <td className="px-4 py-4 text-center text-muted-foreground">
                            {hasAbsences && (isExpanded
                              ? <ChevronDown size={16} className="mx-auto text-primary" />
                              : <ChevronRight size={16} className="mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium font-display text-base">{record.memberName}</td>
                          <td className="px-6 py-4">
                            <span className="bg-muted px-2 py-1 rounded text-xs font-semibold">{record.ageGroup}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{record.attended}</td>
                          <td className="px-6 py-4 text-right text-muted-foreground">{record.total}</td>
                          <td className="px-6 py-4 text-right">
                            <RateBar rate={record.rate} />
                          </td>
                        </tr>
                        {hasAbsences && isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={6} className="px-8 pb-4 pt-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Absence reasons</p>
                              <div className="space-y-1">
                                {record.absences?.map((absence, i) => (
                                  <div key={i} className="flex gap-3 text-sm">
                                    <span className="text-muted-foreground tabular-nums shrink-0 w-24">{absence.date}</span>
                                    {absence.eventTitle && (
                                      <span className="text-muted-foreground shrink-0 italic">{absence.eventTitle}</span>
                                    )}
                                    <span className="text-foreground">{absence.reason}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Mobile cards ──────────────────────────────────────────────── */}
          <div className="sm:hidden space-y-2">
            {records.map(record => {
              const hasAbsences = (record.absences?.length ?? 0) > 0
              const isExpanded  = expandedRows.has(record.memberId)
              return (
                <Card key={record.memberId} className={cn(
                  "overflow-hidden border-l-4",
                  record.rate >= 80 ? "border-l-green-500" : record.rate >= 50 ? "border-l-yellow-500" : "border-l-red-500"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold font-display text-base leading-tight">{record.memberName}</p>
                        <span className="inline-block bg-muted px-2 py-0.5 rounded text-xs font-semibold mt-1">{record.ageGroup}</span>
                      </div>
                      <RateBar rate={record.rate} />
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span><strong className="text-foreground">{record.attended}</strong> attended</span>
                      <span>of <strong className="text-foreground">{record.total}</strong> sessions</span>
                    </div>

                    {hasAbsences && (
                      <button
                        onClick={() => toggleRow(record.memberId)}
                        className="mt-3 flex items-center gap-1.5 text-xs text-primary font-semibold"
                      >
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        {record.absences!.length} absence{record.absences!.length > 1 ? "s" : ""}
                      </button>
                    )}

                    {hasAbsences && isExpanded && (
                      <div className="mt-2 pt-2 border-t space-y-1.5">
                        {record.absences?.map((absence, i) => (
                          <div key={i} className="text-xs">
                            <span className="text-muted-foreground">{absence.date}</span>
                            {absence.eventTitle && (
                              <span className="text-muted-foreground italic"> · {absence.eventTitle}</span>
                            )}
                            <span className="text-foreground"> — {absence.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
