import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { Shield, ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: number
  createdAt: string
  staffEmail: string
  staffName: string | null
  action: string
  entityType: string | null
  entityId: number | null
  entityName: string | null
  details: Record<string, unknown> | null
}

interface AuditResponse {
  total: number
  page: number
  limit: number
  entries: AuditEntry[]
}

interface StaffOption {
  staffEmail: string
  staffName: string | null
}

// ── Action display helpers ────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "member.edit":                     { label: "Edited player",            color: "bg-blue-100 text-blue-800 border-blue-200"     },
  "member.delete":                   { label: "Deleted player",           color: "bg-red-100 text-red-800 border-red-200"        },
  "member.flag.siha_registered.on":  { label: "SIHA registered ✓",        color: "bg-green-100 text-green-800 border-green-200"  },
  "member.flag.siha_registered.off": { label: "SIHA registration cleared", color: "bg-yellow-100 text-yellow-800 border-yellow-200"},
  "member.flag.fees_overdue.on":     { label: "Fees marked overdue",      color: "bg-red-100 text-red-800 border-red-200"        },
  "member.flag.fees_overdue.off":    { label: "Fees cleared",             color: "bg-green-100 text-green-800 border-green-200"  },
  "member.age_group.update":         { label: "Age group changed",        color: "bg-purple-100 text-purple-800 border-purple-200"},
  "event.create":                    { label: "Created event",            color: "bg-blue-100 text-blue-800 border-blue-200"     },
  "event.edit":                      { label: "Edited event",             color: "bg-blue-100 text-blue-800 border-blue-200"     },
  "event.delete":                    { label: "Deleted event",            color: "bg-red-100 text-red-800 border-red-200"        },
  "staff.create":                    { label: "Added staff member",       color: "bg-blue-100 text-blue-800 border-blue-200"     },
  "staff.edit":                      { label: "Edited staff member",      color: "bg-blue-100 text-blue-800 border-blue-200"     },
  "staff.delete":                    { label: "Removed staff member",     color: "bg-red-100 text-red-800 border-red-200"        },
}

function actionInfo(action: string) {
  return ACTION_LABELS[action] ?? { label: action, color: "bg-slate-100 text-slate-700 border-slate-200" }
}

// ── Detail key pretty-printer ─────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  playerName: "Name", playerDob: "Date of birth", ageGroup: "Age group",
  addAgeGroup: "Additional age group", playerAddress1: "Address 1",
  playerAddress2: "Address 2", playerCity: "City", playerPost: "Postcode",
  playerParent: "Parent/Guardian", playerContactTel: "Phone",
  playerEmail: "Email", playerMedicalnotes: "Medical notes",
  playerMedication: "Medication", playerFee: "Fee", readCode: "Code of conduct",
  agreeFee: "Fee agreement", agreeGdpr: "GDPR consent", agreePhoto: "Photo consent",
  sihaRegistered: "SIHA registered", feesOverdue: "Fees overdue",
  from: "Previous age group", to: "New age group",
  staffEmail: "Email", staffLevel: "Access level", staffRoles: "Roles",
  eventType: "Type", eventDate: "Date", startTime: "Start",
  endTime: "End", locationName: "Location", ageGroups: "Age groups",
  notes: "Notes",
}

function prettyKey(k: string) { return FIELD_LABELS[k] ?? k }
function prettyVal(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") return v === 1 ? "Yes" : v === 0 ? "No" : String(v)
  return String(v)
}

// ── Detail expander ───────────────────────────────────────────────────────────
function DetailsCell({ details }: { details: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false)
  if (!details || Object.keys(details).length === 0) return <span className="text-muted-foreground text-xs">—</span>

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? "Hide" : "Show"} changes
      </button>
      {open && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {Object.entries(details).map(([k, v]) => (
            <span key={k} className="contents">
              <dt className="text-muted-foreground font-medium whitespace-nowrap">{prettyKey(k)}</dt>
              <dd className="text-foreground truncate max-w-[200px]" title={prettyVal(v)}>{prettyVal(v)}</dd>
            </span>
          ))}
        </dl>
      )}
    </div>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────
const ACTION_GROUPS = [
  { value: "",        label: "All actions" },
  { value: "member.", label: "Players"     },
  { value: "event.",  label: "Events"      },
  { value: "staff.",  label: "Staff"       },
]

const LIMIT = 50

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditLog() {
  const [page, setPage] = useState(1)
  const [staffFilter, setStaffFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [fromFilter, setFromFilter] = useState("")
  const [toFilter, setToFilter] = useState("")

  function buildParams() {
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (staffFilter) p.set("staffEmail", staffFilter)
    if (actionFilter) p.set("action", actionFilter)
    if (fromFilter) p.set("from", new Date(fromFilter).toISOString())
    if (toFilter) {
      const d = new Date(toFilter); d.setDate(d.getDate() + 1); p.set("to", d.toISOString())
    }
    return p.toString()
  }

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["audit-log", page, staffFilter, actionFilter, fromFilter, toFilter],
    queryFn: () => fetch(`${BASE}/api/admin/audit-log?${buildParams()}`, { credentials: "include" }).then(r => r.json()),
  })

  const { data: staffList } = useQuery<StaffOption[]>({
    queryKey: ["audit-staff-list"],
    queryFn: () => fetch(`${BASE}/api/admin/audit-log/staff-list`, { credentials: "include" }).then(r => r.json()),
  })

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  function resetPage() { setPage(1) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-[#001f3d]/10">
          <Shield size={20} className="text-[#001f3d]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Every staff action on players, events, and accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Staff member */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Staff member</label>
            <select
              value={staffFilter}
              onChange={e => { setStaffFilter(e.target.value); resetPage() }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Anyone</option>
              {staffList?.map(s => (
                <option key={s.staffEmail} value={s.staffEmail}>
                  {s.staffName ? `${s.staffName} (${s.staffEmail})` : s.staffEmail}
                </option>
              ))}
            </select>
          </div>

          {/* Action category */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); resetPage() }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {ACTION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          {/* From date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={fromFilter} onChange={e => { setFromFilter(e.target.value); resetPage() }} className="h-9" />
          </div>

          {/* To date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={toFilter} onChange={e => { setToFilter(e.target.value); resetPage() }} className="h-9" />
          </div>
        </div>

        {/* Active filter chips */}
        {(staffFilter || actionFilter || fromFilter || toFilter) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {staffFilter && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {staffFilter}
                <button onClick={() => { setStaffFilter(""); resetPage() }}><X size={10} /></button>
              </Badge>
            )}
            {actionFilter && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {ACTION_GROUPS.find(g => g.value === actionFilter)?.label}
                <button onClick={() => { setActionFilter(""); resetPage() }}><X size={10} /></button>
              </Badge>
            )}
            {fromFilter && (
              <Badge variant="secondary" className="gap-1 text-xs">
                From {fromFilter}
                <button onClick={() => { setFromFilter(""); resetPage() }}><X size={10} /></button>
              </Badge>
            )}
            {toFilter && (
              <Badge variant="secondary" className="gap-1 text-xs">
                To {toFilter}
                <button onClick={() => { setToFilter(""); resetPage() }}><X size={10} /></button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : !data?.entries?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Search size={32} className="opacity-30" />
            <p className="text-sm">No audit entries match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Staff</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.entries.map(entry => {
                  const { label, color } = actionInfo(entry.action)
                  const date = parseISO(entry.createdAt)
                  return (
                    <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                      {/* When */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="text-xs text-muted-foreground cursor-default"
                          title={format(date, "d MMM yyyy, HH:mm:ss")}
                        >
                          {formatDistanceToNow(date, { addSuffix: true })}
                        </span>
                      </td>

                      {/* Staff */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-xs">{entry.staffName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{entry.staffEmail}</div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
                          {label}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3">
                        {entry.entityName ? (
                          <div className="font-medium text-xs">{entry.entityName}</div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        {entry.entityType && (
                          <div className="text-xs text-muted-foreground capitalize">{entry.entityType}</div>
                        )}
                      </td>

                      {/* Changes */}
                      <td className="px-4 py-3 min-w-[140px]">
                        <DetailsCell details={entry.details} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {data.total.toLocaleString()} entries · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
