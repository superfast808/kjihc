import { useState, useEffect } from "react"
import {
  useListMembers, useGetMember, useUpdateMember, useDeleteMember, getListMembersQueryKey,
  useGetMyStaffProfile,
} from "@workspace/api-client-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { AGE_GROUPS, ageGroupLabel } from "@/lib/ageGroups"
import { getMedicalFlags, highestSeverity, SEVERITY_STYLES } from "@/lib/medicalFlags"
import {
  Search, SlidersHorizontal, AlertCircle, HeartPulse, User,
  CheckSquare, Square, Users, ChevronDown, Loader2, ShieldCheck, TriangleAlert, UserPen,
  CalendarDays, Mail, Receipt, ExternalLink, Printer, Inbox, Hash,
} from "lucide-react"
import { getGetMemberQueryKey } from "@workspace/api-client-react"
import PlayerAvatar from "@/components/PlayerAvatar"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type FlagFilter = "all" | "fees_overdue" | "not_siha" | "no_photo" | "med_high" | "med_any"

const FLAG_OPTIONS: { value: FlagFilter; label: string; color: string; badgeColor: string }[] = [
  {
    value: "fees_overdue",
    label: "Fees Overdue",
    color: "bg-red-50 border-red-300 text-red-800 hover:bg-red-100",
    badgeColor: "bg-red-200 text-red-900",
  },
  {
    value: "not_siha",
    label: "Not SIHA Registered",
    color: "bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100",
    badgeColor: "bg-orange-200 text-orange-900",
  },
  {
    value: "no_photo",
    label: "No Photo Consent",
    color: "bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100",
    badgeColor: "bg-purple-200 text-purple-900",
  },
  {
    value: "med_high",
    label: "High Severity Medical",
    color: "bg-red-50 border-red-400 text-red-900 hover:bg-red-100",
    badgeColor: "bg-red-300 text-red-900",
  },
  {
    value: "med_any",
    label: "Any Medical Notes",
    color: "bg-pink-50 border-pink-300 text-pink-800 hover:bg-pink-100",
    badgeColor: "bg-pink-200 text-pink-900",
  },
]

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const ageGroups = ["All", ...AGE_GROUPS.map(g => g.value)]

// ---------- Medical flag pill ----------
function MedFlagPill({ notes, medication, compact = false }: {
  notes?: string | null
  medication?: string | null
  compact?: boolean
}) {
  const flags = getMedicalFlags(notes, medication)
  if (!flags.length) return null
  const sev = highestSeverity(flags)!
  const st = SEVERITY_STYLES[sev]
  if (compact) {
    return (
      <span title={flags.map(f => f.label).join(", ")}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${st.bg} ${st.border} ${st.text}`}>
        <HeartPulse size={10} /> {flags[0].label}{flags.length > 1 ? ` +${flags.length - 1}` : ""}
      </span>
    )
  }
  return (
    <div className={`flex flex-wrap gap-1.5`}>
      {flags.map(f => {
        const s = SEVERITY_STYLES[f.severity]
        return (
          <span key={f.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${s.bg} ${s.border} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {f.label}
          </span>
        )
      })}
    </div>
  )
}

/** Returns "12 yrs · 15 Mar 2012" from a dob string (YYYY-MM-DD or DD/MM/YYYY). */
function formatAge(dob: string | null | undefined): string | null {
  if (!dob) return null
  let date: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    date = new Date(dob + "T00:00:00")
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
    const [d, m, y] = dob.split("/")
    date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`)
  } else {
    return null
  }
  if (isNaN(date.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const md = today.getMonth() - date.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < date.getDate())) age--
  if (age < 0) return null
  const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  return `${age} yrs · ${label}`
}

export default function Players() {
  const [search, setSearch] = useState("")
  const [ageGroupFilter, setAgeGroupFilter] = useState("All")
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all")
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [sihaOpen, setSihaOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)

  const { data: staffProfile } = useGetMyStaffProfile()
  const isSuperUser = staffProfile?.staffLevel === "1"
  const isCoach = isSuperUser || staffProfile?.isCoach === true
  const isTreasurer = isSuperUser || staffProfile?.isTreasurer === true
  const isRegistrations = isSuperUser || staffProfile?.isRegistrations === true

  const visibleFlagOptions = FLAG_OPTIONS.filter(opt => {
    if (opt.value === "fees_overdue") return isTreasurer
    if (opt.value === "not_siha") return isRegistrations
    return true
  })

  useEffect(() => {
    if (flagFilter !== "all" && !visibleFlagOptions.some(o => o.value === flagFilter)) {
      setFlagFilter("all")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffProfile?.staffLevel, staffProfile?.staffRoles])


  // Always fetch without flag filter so we can compute counts for all flag options
  const { data: members, isLoading } = useListMembers({
    search: search.length > 2 ? search : undefined,
    ageGroup: ageGroupFilter !== "All" ? ageGroupFilter : undefined,
  })

  // Client-side flag filtering
  const filteredMembers = flagFilter === "all" ? members : members?.filter((m) => {
    if (flagFilter === "fees_overdue") return m.feesOverdue === 1
    if (flagFilter === "not_siha") return !m.sihaRegistered || m.sihaRegistered !== 1
    if (flagFilter === "no_photo") return m.agreePhoto === 0
    if (flagFilter === "med_high") {
      const sev = highestSeverity(getMedicalFlags(m.playerMedicalnotes, m.playerMedication))
      return sev === "critical" || sev === "high"
    }
    if (flagFilter === "med_any") return getMedicalFlags(m.playerMedicalnotes, m.playerMedication).length > 0
    return true
  })

  // Count per flag option (from unfiltered data)
  const flagCounts: Record<FlagFilter, number> = {
    all: members?.length ?? 0,
    fees_overdue: members?.filter((m) => m.feesOverdue === 1).length ?? 0,
    not_siha: members?.filter((m) => !m.sihaRegistered || m.sihaRegistered !== 1).length ?? 0,
    no_photo: members?.filter((m) => m.agreePhoto === 0).length ?? 0,
    med_high: members?.filter((m) => {
      const sev = highestSeverity(getMedicalFlags(m.playerMedicalnotes, m.playerMedication))
      return sev === "critical" || sev === "high"
    }).length ?? 0,
    med_any: members?.filter((m) => getMedicalFlags(m.playerMedicalnotes, m.playerMedication).length > 0).length ?? 0,
  }
  const updateMember = useUpdateMember()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(members?.map(m => m.id) ?? []))
  const clearSelect = () => { setSelected(new Set()); setSelectMode(false) }

  const handleDrop = async (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault()
    const memberId = parseInt(e.dataTransfer.getData("text/plain"), 10)
    setDraggingId(null)
    setDragOverGroup(null)
    if (!memberId || isNaN(memberId)) return
    const member = members?.find(m => m.id === memberId)
    if (!member || member.ageGroup === targetGroup) return
    try {
      await updateMember.mutateAsync({ id: memberId, data: { ageGroup: targetGroup } })
      await queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
      toast({ title: `${member.playerName} moved to ${ageGroupLabel(targetGroup)}` })
    } catch {
      toast({ title: "Failed to move player", variant: "destructive" })
    }
  }

  const handleBulkAgeGroup = async (newGroup: string) => {
    if (!selected.size) return
    setBulkSaving(true)
    let done = 0
    for (const id of selected) {
      await updateMember.mutateAsync({ id, data: { ageGroup: newGroup } }).catch(() => {})
      done++
    }
    await queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
    toast({ title: `${done} player${done !== 1 ? "s" : ""} moved to ${ageGroupLabel(newGroup)}` })
    clearSelect()
    setBulkSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-display font-bold">Roster</h1>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {isRegistrations && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setSihaOpen(true)}>
              <Inbox size={15} /> Check SIHA inbox
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPrintOpen(true)}>
            <Printer size={15} /> Print list
          </Button>
          <Button
            variant={selectMode ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
          >
            <CheckSquare size={15} /> {selectMode ? "Cancel selection" : "Select players"}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-sm font-semibold text-primary flex items-center gap-2">
            <Users size={16} /> {selected.size} selected
          </span>
          <Button variant="ghost" size="sm" className="text-xs" onClick={selectAll}>Select all visible</Button>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
          )}
          <div className="flex-1" />
          {selected.size > 0 && isSuperUser && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
              <Mail size={14} /> Email portal invites
            </Button>
          )}
          {selected.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2" disabled={bulkSaving}>
                  {bulkSaving
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : <><ChevronDown size={14} /> Move to age group</>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {AGE_GROUPS.map(({ value, label }) => (
                  <DropdownMenuItem key={value} onClick={() => handleBulkAgeGroup(value)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-card p-4 rounded-xl shadow-sm border">
        {/* Search + age group row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search players by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center px-3 border rounded-md bg-muted/50 text-muted-foreground shrink-0">
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Age
            </div>
            {ageGroups.map(group => (
              <button
                key={group}
                onClick={() => setAgeGroupFilter(group)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  ageGroupFilter === group
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background border hover:bg-muted"
                }`}
              >
                {group === "All" ? "All" : ageGroupLabel(group)}
              </button>
            ))}
          </div>
        </div>

        {/* Flag filter row */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center text-xs text-muted-foreground shrink-0 gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Flags:
          </div>
          <button
            onClick={() => setFlagFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors border ${
              flagFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm border-primary"
                : "bg-background hover:bg-muted"
            }`}
          >
            All players
          </button>
          {visibleFlagOptions.map(opt => {
            const count = flagCounts[opt.value]
            const isActive = flagFilter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setFlagFilter(isActive ? "all" : opt.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors border ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm border-primary"
                    : opt.color
                }`}
              >
                {opt.label}
                <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold min-w-[20px] ${
                  isActive ? "bg-white/25 text-white" : opt.badgeColor
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Flag filter summary bar */}
      {flagFilter !== "all" && !isLoading && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium ${
          flagFilter === "fees_overdue" ? "bg-red-50 border-red-200 text-red-800" :
          flagFilter === "not_siha" ? "bg-orange-50 border-orange-200 text-orange-800" :
          flagFilter === "med_high" ? "bg-red-50 border-red-300 text-red-900" :
          flagFilter === "med_any" ? "bg-pink-50 border-pink-200 text-pink-800" :
          "bg-purple-50 border-purple-200 text-purple-800"
        }`}>
          <span>
            Showing <strong>{filteredMembers?.length ?? 0}</strong>{" "}
            {flagFilter === "fees_overdue" ? "player(s) with fees overdue" :
             flagFilter === "not_siha" ? "player(s) not yet SIHA registered" :
             flagFilter === "med_high" ? "player(s) with high or critical severity medical notes" :
             flagFilter === "med_any" ? "player(s) with any medical notes" :
             "player(s) without photo consent"}
          </span>
          <button
            onClick={() => setFlagFilter("all")}
            className="text-xs underline underline-offset-2 hover:no-underline opacity-70 hover:opacity-100"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
      ) : ageGroupFilter === "All" && flagFilter === "all" ? (
        /* ── Grouped view with drag-and-drop (All groups, no flag filter) ───── */
        <div className="space-y-8">
          {AGE_GROUPS.map(({ value, label }) => {
            const groupMembers = (members ?? []).filter(m => m.ageGroup === value)
            const isOver = dragOverGroup === value
            return (
              <div key={value}>
                {/* Section header — also a drop target */}
                <div
                  className={`flex items-center gap-3 mb-3 px-3 py-2 rounded-lg border-2 border-dashed transition-all ${
                    isOver ? "border-primary bg-primary/5 text-primary" : "border-transparent text-foreground"
                  }`}
                  onDragEnter={() => draggingId !== null && setDragOverGroup(value)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                  onDrop={(e) => handleDrop(e, value)}
                >
                  <h2 className="font-bold text-base font-display">{label}</h2>
                  <span className="text-sm text-muted-foreground">({groupMembers.length})</span>
                  {isOver && draggingId !== null && (
                    <span className="ml-auto text-xs font-semibold text-primary">Drop to move here</span>
                  )}
                </div>

                {/* Cards drop zone */}
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 rounded-xl border-2 p-2 transition-all min-h-[90px] ${
                    isOver ? "border-primary/40 bg-primary/[0.03]" : "border-transparent"
                  }`}
                  onDragEnter={() => draggingId !== null && setDragOverGroup(value)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                  onDrop={(e) => handleDrop(e, value)}
                >
                  {groupMembers.map((member) => {
                    const flags = getMedicalFlags(member.playerMedicalnotes, null)
                    const sev = highestSeverity(flags)
                    const sevSt = sev ? SEVERITY_STYLES[sev] : null
                    const isChecked = selected.has(member.id)
                    const isDragging = draggingId === member.id
                    return (
                      <Card
                        key={member.id}
                        draggable={!selectMode}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move"
                          e.dataTransfer.setData("text/plain", String(member.id))
                          setDraggingId(member.id)
                        }}
                        onDragEnd={() => { setDraggingId(null); setDragOverGroup(null) }}
                        onClick={() => selectMode ? toggleSelect(member.id) : setSelectedPlayerId(member.id)}
                        className={`p-5 cursor-pointer transition-all group flex flex-col relative select-none ${
                          isDragging ? "opacity-40 ring-2 ring-primary/40 scale-[0.98]" :
                          isChecked ? "border-primary ring-2 ring-primary/30 bg-primary/5" :
                          sev === "critical" ? "border-red-300 hover:border-red-400" :
                          "hover:border-primary/50"
                        }`}
                      >
                        {sev && <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${sevSt!.dot}`} />}
                        {selectMode && (
                          <div className="absolute top-3 right-3">
                            {isChecked ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} className="text-muted-foreground" />}
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant={member.ageGroup === 'lightning' ? 'secondary' : member.ageGroup === 'LTP' ? 'outline' : 'default'}>{ageGroupLabel(member.ageGroup)}</Badge>
                            {member.addAgeGroup && <Badge variant="outline" className="text-xs">+{ageGroupLabel(member.addAgeGroup)}</Badge>}
                          </div>
                          <PlayerAvatar memberId={member.id} playerPhoto={member.playerPhoto} name={member.playerName} size="sm" />
                        </div>
                        <h3 className="font-bold text-lg font-display mb-1 group-hover:text-primary transition-colors line-clamp-1">{member.playerNumber != null && <span className="text-primary mr-1">#{member.playerNumber}</span>}{member.playerName}</h3>
                        {member.playerDob && formatAge(member.playerDob) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                            <CalendarDays size={11} /> {formatAge(member.playerDob)}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mb-3"><User size={14} /> {member.playerParent}</p>
                        {flags.length > 0 && <div className="mb-3"><MedFlagPill notes={member.playerMedicalnotes} medication={null} compact /></div>}
                        <div className="mt-auto pt-3 border-t flex gap-2 flex-wrap items-center">
                          {member.agreeFee !== 1 && <Badge variant="warning" className="gap-1 text-xs"><AlertCircle size={11} /> Fee Pending</Badge>}
                          {member.agreePhoto === 0 && <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-400 px-2 py-0.5 text-xs font-bold text-purple-800">📵 No Photos</span>}
                          {member.feesOverdue === 1 && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-400 px-2 py-0.5 text-xs font-bold text-red-800"><TriangleAlert size={10} /> Fees Overdue</span>}
                          {member.feesOverdue === 1 && isTreasurer && (member as any).feesBalance != null && (
                            <span className="inline-flex items-center rounded-full bg-red-700 px-2 py-0.5 text-xs font-mono font-bold text-white">
                              £{parseFloat((member as any).feesBalance).toFixed(2)}
                            </span>
                          )}
                          {member.sihaRegistered === 1 && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-400 px-2 py-0.5 text-xs font-bold text-green-800"><ShieldCheck size={10} /> SIHA ✓</span>}
                        </div>
                      </Card>
                    )
                  })}
                  {groupMembers.length === 0 && (
                    <div className={`col-span-full flex items-center justify-center h-[70px] rounded-lg border-2 border-dashed text-sm transition-colors ${
                      isOver ? "border-primary text-primary" : "border-muted-foreground/20 text-muted-foreground"
                    }`}>
                      {isOver ? "Drop here" : "No players"}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Flat grid (age group or flag filter active) ────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers?.map((member) => {
            const flags = getMedicalFlags(member.playerMedicalnotes, null)
            const sev = highestSeverity(flags)
            const sevSt = sev ? SEVERITY_STYLES[sev] : null
            const isChecked = selected.has(member.id)
            return (
              <Card
                key={member.id}
                onClick={() => selectMode ? toggleSelect(member.id) : setSelectedPlayerId(member.id)}
                className={`p-5 cursor-pointer transition-all group flex flex-col relative ${
                  isChecked ? "border-primary ring-2 ring-primary/30 bg-primary/5" :
                  sev === "critical" ? "border-red-300 hover:border-red-400" :
                  "hover:border-primary/50"
                }`}
              >
                {sev && <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${sevSt!.dot}`} />}
                {selectMode && (
                  <div className="absolute top-3 right-3">
                    {isChecked ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} className="text-muted-foreground" />}
                  </div>
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant={member.ageGroup === 'lightning' ? 'secondary' : member.ageGroup === 'LTP' ? 'outline' : 'default'}>{ageGroupLabel(member.ageGroup)}</Badge>
                    {member.addAgeGroup && <Badge variant="outline" className="text-xs">+{ageGroupLabel(member.addAgeGroup)}</Badge>}
                  </div>
                  <PlayerAvatar memberId={member.id} playerPhoto={member.playerPhoto} name={member.playerName} size="sm" />
                </div>
                <h3 className="font-bold text-lg font-display mb-1 group-hover:text-primary transition-colors line-clamp-1">{member.playerNumber != null && <span className="text-primary mr-1">#{member.playerNumber}</span>}{member.playerName}</h3>
                {member.playerDob && formatAge(member.playerDob) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <CalendarDays size={11} /> {formatAge(member.playerDob)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-2 mb-3"><User size={14} /> {member.playerParent}</p>
                {flags.length > 0 && <div className="mb-3"><MedFlagPill notes={member.playerMedicalnotes} medication={null} compact /></div>}
                <div className="mt-auto pt-3 border-t flex gap-2 flex-wrap items-center">
                  {member.agreeFee !== 1 && <Badge variant="warning" className="gap-1 text-xs"><AlertCircle size={11} /> Fee Pending</Badge>}
                  {member.agreePhoto === 0 && <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-400 px-2 py-0.5 text-xs font-bold text-purple-800">📵 No Photos</span>}
                  {member.feesOverdue === 1 && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-400 px-2 py-0.5 text-xs font-bold text-red-800"><TriangleAlert size={10} /> Fees Overdue</span>}
                  {member.feesOverdue === 1 && isTreasurer && (member as any).feesBalance != null && (
                    <span className="inline-flex items-center rounded-full bg-red-700 px-2 py-0.5 text-xs font-mono font-bold text-white">
                      £{parseFloat((member as any).feesBalance).toFixed(2)}
                    </span>
                  )}
                  {member.sihaRegistered === 1 && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-400 px-2 py-0.5 text-xs font-bold text-green-800"><ShieldCheck size={10} /> SIHA ✓</span>}
                  {flagFilter === "fees_overdue" && isTreasurer && (
                    <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
                      <InlineResendButton playerId={member.id} />
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
          {filteredMembers?.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
              No players found matching your criteria.
            </div>
          )}
        </div>
      )}

      {inviteOpen && (
        <InvitePreviewDialog
          members={(members ?? []).filter(m => selected.has(m.id))}
          onClose={() => setInviteOpen(false)}
          onSent={() => { setInviteOpen(false); clearSelect() }}
        />
      )}

      {selectedPlayerId && (
        <PlayerDetailModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {printOpen && (
        <PrintListDialog
          members={members ?? []}
          initialAgeGroup={ageGroupFilter}
          onClose={() => setPrintOpen(false)}
        />
      )}

      {sihaOpen && <SihaCheckDialog onClose={() => setSihaOpen(false)} />}
    </div>
  )
}

// ---------- Inline Fees Reminder Button (fees_overdue filtered view, superuser only) ----------
function InlineResendButton({ playerId }: { playerId: number }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/members/${playerId}/flags`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feesOverdue: 1, sendEmail: true }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
      toast({ title: "Fees reminder sent ✓" })
      setTimeout(() => setSent(false), 4000)
    } catch {
      toast({ title: "Failed to send reminder", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading || sent}
      title="Send fees overdue reminder to parent"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
        sent
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      } disabled:opacity-60`}
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" />
      ) : sent ? (
        <><Mail size={11} /> Sent</>
      ) : (
        <><Mail size={11} /> Remind</>
      )}
    </button>
  )
}

// ---------- Player Payments Tab ----------
function PlayerPaymentsTab({ memberId }: { memberId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["member-fee-payments", memberId],
    queryFn: () =>
      fetch(`${BASE}/api/members/${memberId}/fee-payments`, { credentials: "include" })
        .then(r => r.json()) as Promise<{
          entries: { id: number; createdAt: string; amountPounds: string; parentEmail: string; stripeSessionId: string | null; notes: string | null }[]
          totalPaid: number
        }>,
  })

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const entries = data?.entries ?? []
  const totalPaid = data?.totalPaid ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{entries.length} payment{entries.length !== 1 ? "s" : ""} recorded</p>
        {totalPaid > 0 && (
          <span className="font-mono font-bold text-green-700 text-sm">
            Total paid: £{totalPaid.toFixed(2)}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed rounded-xl text-muted-foreground text-sm">
          No online payments recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Parent email</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Stripe</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium">{new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{e.parentEmail || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700">£{parseFloat(e.amountPounds).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    {e.stripeSessionId ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${e.stripeSessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink size={11} /> View
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Detail Modal ----------
function PlayerDetailModal({ playerId, onClose }: { playerId: number; onClose: () => void }) {
  const { data: player, isLoading } = useGetMember(playerId)
  const { data: staffProfile } = useGetMyStaffProfile()
  const updateMember = useUpdateMember()
  const deleteMember = useDeleteMember()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notes, setNotes] = useState("")

  const [editingGroup, setEditingGroup] = useState(false)
  const [newAgeGroup, setNewAgeGroup] = useState("")
  const [newAddAgeGroups, setNewAddAgeGroups] = useState<string[]>([])
  const [editingNumber, setEditingNumber] = useState(false)
  const [numberVal, setNumberVal] = useState("")
  const [editingSiha, setEditingSiha] = useState(false)
  const [sihaVal, setSihaVal] = useState("")

  if (isLoading || !player) return null

  const isTreasurer = staffProfile?.staffLevel === "1" || staffProfile?.isTreasurer === true

  const flags = getMedicalFlags(player.playerMedicalnotes, player.playerMedication)

  const handleSaveNotes = () => {
    updateMember.mutate({ id: playerId, data: { playerMedicalnotes: notes } }, {
      onSuccess: () => {
        toast({ title: "Notes updated" })
        setIsEditingNotes(false)
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
      },
    })
  }

  const handleSaveGroup = () => {
    const addAgeGroup = newAddAgeGroups.filter(g => g !== newAgeGroup).join(",") || undefined
    updateMember.mutate(
      { id: playerId, data: { ageGroup: newAgeGroup, addAgeGroup } },
      {
        onSuccess: () => {
          toast({ title: "Age group updated" })
          setEditingGroup(false)
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
        },
        onError: () => toast({ title: "Error", description: "Could not update age group.", variant: "destructive" }),
      }
    )
  }

  const handleDelete = () => {
    if (!confirm(`Permanently delete ${player?.playerName}? This cannot be undone.`)) return
    deleteMember.mutate({ id: playerId }, {
      onSuccess: () => {
        toast({ title: `${player?.playerName} deleted` })
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
        onClose()
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    })
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-2">
          <div className="flex items-start gap-3 flex-wrap">
            <DialogTitle className="text-2xl">{player.playerName}</DialogTitle>
            {editingGroup ? null : (
              <>
                <Badge>{ageGroupLabel(player.ageGroup)}</Badge>
                {player.addAgeGroup && (
                  <Badge variant="outline">+{ageGroupLabel(player.addAgeGroup)}</Badge>
                )}
                <button
                  onClick={() => {
                    setNewAgeGroup(player.ageGroup ?? "")
                    setNewAddAgeGroups(player.addAgeGroup ? player.addAgeGroup.split(",").map(s => s.trim()).filter(Boolean) : [])
                    setEditingGroup(true)
                  }}
                  className="text-xs text-primary underline underline-offset-2 hover:no-underline ml-1"
                >
                  Change
                </button>
              </>
            )}
          </div>
          {editingGroup && (
            <div className="mt-3 p-4 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-sm font-semibold">Change Age Group</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Primary group</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={newAgeGroup}
                    onChange={e => setNewAgeGroup(e.target.value)}
                  >
                    {AGE_GROUPS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Also trains in (optional)</Label>
                  <div className="border rounded-md bg-background divide-y max-h-48 overflow-y-auto">
                    {AGE_GROUPS.filter(g => g.value !== newAgeGroup).map(({ value, label }) => {
                      const checked = newAddAgeGroups.includes(value)
                      return (
                        <label key={value} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/30 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setNewAddAgeGroups(prev =>
                              checked ? prev.filter(v => v !== value) : [...prev, value]
                            )}
                            className="rounded border-input"
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingGroup(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveGroup} disabled={updateMember.isPending}>
                  {updateMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3 text-sm">
          <Hash size={15} className="text-muted-foreground" />
          {editingNumber ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={99}
                className="h-8 w-20"
                value={numberVal}
                onChange={e => setNumberVal(e.target.value)}
                autoFocus
              />
              <Button size="sm" className="h-8" disabled={updateMember.isPending}
                onClick={() => {
                  const n = numberVal.trim() === "" ? null : Number(numberVal)
                  if (n !== null && (!Number.isInteger(n) || n < 0 || n > 99)) {
                    toast({ title: "Enter a number between 0 and 99", variant: "destructive" })
                    return
                  }
                  updateMember.mutate({ id: playerId, data: { playerNumber: n } }, {
                    onSuccess: () => {
                      toast({ title: "Player number saved" })
                      setEditingNumber(false)
                      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
                      queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(playerId) })
                    },
                    onError: () => toast({ title: "Could not save number", variant: "destructive" }),
                  })
                }}>
                {updateMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingNumber(false)}>Cancel</Button>
            </div>
          ) : (
            <>
              <span className="font-semibold">
                {player.playerNumber != null ? `Number ${player.playerNumber}` : "No player number"}
              </span>
              <button
                onClick={() => { setNumberVal(player.playerNumber != null ? String(player.playerNumber) : ""); setEditingNumber(true) }}
                className="text-xs text-primary underline underline-offset-2 hover:no-underline"
              >
                {player.playerNumber != null ? "Change" : "Add"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 -mt-1 mb-3 text-sm">
          <ShieldCheck size={15} className="text-muted-foreground" />
          {editingSiha ? (
            <div className="flex items-center gap-2">
              <Input
                className="h-8 w-40"
                placeholder="e.g. SIHA-12345"
                value={sihaVal}
                onChange={e => setSihaVal(e.target.value)}
                autoFocus
              />
              <Button size="sm" className="h-8" disabled={updateMember.isPending}
                onClick={() => {
                  const v = sihaVal.trim().toUpperCase()
                  if (v.length > 30) {
                    toast({ title: "SIHA number is too long", variant: "destructive" })
                    return
                  }
                  updateMember.mutate({ id: playerId, data: { sihaNumber: v === "" ? null : v } }, {
                    onSuccess: () => {
                      toast({ title: "SIHA number saved" })
                      setEditingSiha(false)
                      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
                      queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(playerId) })
                    },
                    onError: () => toast({ title: "Could not save SIHA number", variant: "destructive" }),
                  })
                }}>
                {updateMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingSiha(false)}>Cancel</Button>
            </div>
          ) : (
            <>
              <span className="font-semibold">
                {player.sihaNumber ? `SIHA reg ${player.sihaNumber}` : "No SIHA registration number"}
              </span>
              <button
                onClick={() => { setSihaVal(player.sihaNumber ?? ""); setEditingSiha(true) }}
                className="text-xs text-primary underline underline-offset-2 hover:no-underline"
              >
                {player.sihaNumber ? "Change" : "Add"}
              </button>
            </>
          )}
        </div>

        <Tabs defaultValue="details">
          {isTreasurer && (
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-1.5">
                <Receipt size={13} /> Payments
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="payments" className="mt-0">
            <PlayerPaymentsTab memberId={playerId} />
          </TabsContent>

          <TabsContent value="details" className="mt-0">
        <div className="grid gap-6">
          {/* Medical alerts — prominent if critical/high */}
          {flags.length > 0 && (
            <div className={`rounded-lg border-2 p-4 ${
              flags.some(f => f.severity === "critical")
                ? "bg-red-50 border-red-400"
                : flags.some(f => f.severity === "high")
                ? "bg-orange-50 border-orange-400"
                : "bg-yellow-50 border-yellow-300"
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className={`font-bold flex items-center gap-2 ${
                    flags.some(f => f.severity === "critical") ? "text-red-700"
                    : flags.some(f => f.severity === "high") ? "text-orange-700"
                    : "text-yellow-700"
                  }`}>
                    <HeartPulse size={18} />
                    {flags.some(f => f.severity === "critical")
                      ? "⚠ Critical Medical Needs"
                      : flags.some(f => f.severity === "high")
                      ? "Medical Needs"
                      : "Medical Notes"}
                  </h4>
                  {player.medicalUpdatedByParentAt && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <UserPen size={11} />
                      Updated by parent {new Date(player.medicalUpdatedByParentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                {!isEditingNotes && (
                  <Button variant="outline" size="sm"
                    onClick={() => { setNotes(player.playerMedicalnotes || ""); setIsEditingNotes(true) }}>
                    Edit
                  </Button>
                )}
              </div>
              <MedFlagPill notes={player.playerMedicalnotes} medication={player.playerMedication} />
              {isEditingNotes ? (
                <div className="space-y-3 mt-3">
                  <textarea
                    className="w-full p-2 border rounded-md text-sm min-h-[80px] bg-background"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateMember.isPending}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm mt-3">
                  {player.playerMedicalnotes && (
                    <p className="bg-white/60 p-2.5 rounded border text-sm">{player.playerMedicalnotes}</p>
                  )}
                  {player.playerMedication && (
                    <p className="bg-white/60 p-2.5 rounded border text-sm">
                      <span className="font-semibold">Medication: </span>{player.playerMedication}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No medical — still allow editing */}
          {flags.length === 0 && (
            <div className="bg-muted/20 border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <HeartPulse size={15} /> Medical Information
                  </h4>
                  {player.medicalUpdatedByParentAt && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <UserPen size={11} />
                      Updated by parent {new Date(player.medicalUpdatedByParentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                {!isEditingNotes && (
                  <Button variant="ghost" size="sm"
                    onClick={() => { setNotes(""); setIsEditingNotes(true) }}>
                    Add notes
                  </Button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="space-y-3 mt-3">
                  <textarea
                    className="w-full p-2 border rounded-md text-sm min-h-[80px] bg-background"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateMember.isPending}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No medical notes on file.</p>
              )}
            </div>
          )}

          {/* Contact */}
          <div className="grid md:grid-cols-2 gap-6 bg-muted/30 p-4 rounded-lg border">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">Contact Info</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Parent/Guardian</span>
                  <span className="font-medium">{player.playerParent}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Phone</span>
                  <span className="font-medium">{player.playerContactTel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Email</span>
                  <span className="font-medium">{player.playerEmail}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">Address</h4>
              <div className="text-sm">
                {player.playerAddress1}<br />
                {player.playerAddress2 && <>{player.playerAddress2}<br /></>}
                {player.playerCity}<br />
                {player.playerPost}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusIndicator label="Fee Status" status={player.agreeFee === 1} />
            <StatusIndicator label="GDPR Consent" status={player.agreeGdpr === 1} />
            <StatusIndicator label="Photo Consent" status={player.agreePhoto === 1} />
            <StatusIndicator label="Code of Conduct" status={player.readCode === 1} />
          </div>

          {/* Admin flags */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b">
              <p className="font-semibold text-sm">Admin Flags</p>
            </div>
            <div className="divide-y">
              <FlagToggle
                playerId={player.id}
                flag="sihaRegistered"
                label="SIHA Registered"
                description="Mark as registered with the Scottish Ice Hockey Association"
                icon={<ShieldCheck size={16} className="text-green-600" />}
                activeColor="bg-green-50 border-green-300"
                current={player.sihaRegistered ?? 0}
                emailPrompt="Send a confirmation email to the parent?"
              />
              <FlagToggle
                playerId={player.id}
                flag="feesOverdue"
                label="Fees Overdue"
                description="Mark fees as overdue and optionally notify the parent"
                icon={<TriangleAlert size={16} className="text-red-500" />}
                activeColor="bg-red-50 border-red-300"
                current={player.feesOverdue ?? 0}
                emailPrompt="Send a fees overdue reminder to the parent?"
              />
              {isTreasurer && (
                <FeesBalanceEditor playerId={player.id} initial={(player as any).feesBalance ?? null} />
              )}
            </div>
          </div>

          {/* Resend welcome email */}
          <div className="border rounded-lg p-4 bg-muted/20 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Welcome Email</p>
              <p className="text-xs text-muted-foreground mt-0.5">Resend the registration welcome email to {player.playerEmail}</p>
            </div>
            <ResendEmailButton playerId={player.id} />
          </div>

          {/* Danger zone */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/50 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-red-700">Delete Player</p>
              <p className="text-xs text-red-600/80 mt-0.5">Permanently removes {player.playerName} and all their attendance records.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMember.isPending}
              className="shrink-0"
            >
              {deleteMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Fees Balance Editor (treasurer-only) ----------
function FeesBalanceEditor({ playerId, initial }: { playerId: number; initial: number | null }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial != null ? String(initial.toFixed(2)) : "")
  const [saving, setSaving] = useState(false)

  useEffect(() => { setValue(initial != null ? String(initial.toFixed(2)) : "") }, [initial])

  const save = async () => {
    const parsed = parseFloat(value)
    if (value !== "" && (isNaN(parsed) || parsed < 0)) {
      toast({ title: "Enter a valid amount (e.g. 45.00)", variant: "destructive" }); return
    }
    setSaving(true)
    try {
      const res = await fetch(`${BASE}/api/members/${playerId}/fees-balance`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feesBalance: value === "" ? null : parsed }),
      })
      if (!res.ok) throw new Error()
      const newBalance = value === "" ? null : parsed
      // Update cache immediately so modal reopen shows the new value
      queryClient.setQueryData(
        getGetMemberQueryKey(playerId),
        (old: any) => old ? { ...old, feesBalance: newBalance } : old,
      )
      queryClient.setQueryData(
        getListMembersQueryKey(),
        (old: any) => Array.isArray(old)
          ? old.map((m: any) => m.id === playerId ? { ...m, feesBalance: newBalance } : m)
          : old,
      )
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
      queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(playerId) })
      toast({ title: value === "" ? "Balance cleared" : `Balance set to £${parsed.toFixed(2)}` })
      setEditing(false)
    } catch {
      toast({ title: "Failed to save balance", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Outstanding Balance</p>
        <p className="text-xs text-muted-foreground mt-0.5">Amount shown to the parent for online payment</p>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
            <Input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
              placeholder="0.00"
              className="w-28 pl-6 h-8 text-sm font-mono"
            />
          </div>
          <Button size="sm" variant="outline" onClick={save} disabled={saving} className="h-8">
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setValue(initial != null ? String(initial.toFixed(2)) : ""); setEditing(false) }} className="h-8">
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {initial != null ? (
            <span className="font-mono font-bold text-red-700">£{initial.toFixed(2)}</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Not set</span>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 text-xs">
            {initial != null ? "Edit" : "Set amount"}
          </Button>
        </div>
      )}
    </div>
  )
}

function FlagToggle({ playerId, flag, label, description, icon, activeColor, current, emailPrompt }: {
  playerId: number; flag: "sihaRegistered" | "feesOverdue"; label: string; description: string;
  icon: React.ReactNode; activeColor: string; current: number; emailPrompt: string;
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(current)
  const [loading, setLoading] = useState(false)

  // Keep the switch in sync when fresh detail data arrives (e.g. reopening the panel)
  useEffect(() => { setValue(current) }, [current])

  const toggle = async () => {
    const newVal = value === 1 ? 0 : 1
    const isTurningOn = newVal === 1
    // Always email the parent when turning a flag ON (confirm() is unreliable on mobile)
    const sendEmail = isTurningOn
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/members/${playerId}/flags`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: newVal, sendEmail }),
      })
      if (!res.ok) throw new Error()
      setValue(newVal)
      // Update the cache immediately so reopening the modal shows the new value
      // (invalidateQueries alone can lose the refetch if the modal closes before it completes)
      queryClient.setQueryData(
        getGetMemberQueryKey(playerId),
        (old: any) => old ? { ...old, [flag]: newVal } : old,
      )
      queryClient.setQueryData(
        getListMembersQueryKey(),
        (old: any) => Array.isArray(old)
          ? old.map((m: any) => m.id === playerId ? { ...m, [flag]: newVal } : m)
          : old,
      )
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
      queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(playerId) })
      toast({
        title: isTurningOn ? `${label} marked` : `${label} cleared`,
        description: isTurningOn ? "Email sent to parent." : undefined,
      })
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const isActive = value === 1
  return (
    <div className={`flex items-center justify-between px-4 py-3 gap-4 ${isActive ? activeColor : "bg-background"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          isActive ? "bg-primary" : "bg-muted-foreground/30"
        } ${loading ? "opacity-50" : ""}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  )
}

function ResendEmailButton({ playerId }: { playerId: number }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleResend = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/members/${playerId}/resend-welcome`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error()
      toast({ title: "Welcome email sent ✓", description: "The email has been dispatched." })
    } catch {
      toast({ title: "Failed to send", description: "Check SMTP settings are configured correctly.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleResend} disabled={loading} className="shrink-0">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
    </Button>
  )
}

function StatusIndicator({ label, status }: { label: string; status: boolean }) {
  return (
    <div className="border rounded-lg p-3 text-center flex flex-col items-center justify-center bg-card">
      <span className="text-xs text-muted-foreground mb-2">{label}</span>
      {status ? (
        <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
      ) : (
        <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </span>
      )}
    </div>
  )
}

function InvitePreviewDialog({ members, onClose, onSent }: {
  members: { id: number; playerName: string; playerParent: string; playerEmail: string; ageGroup: string }[];
  onClose: () => void;
  onSent: () => void;
}) {
  const { toast } = useToast()
  const [sending, setSending] = useState(false)

  // Group selected players by parent email — one invite per parent
  const byEmail = new Map<string, { parentName: string; children: string[] }>()
  const skipped: string[] = []
  for (const m of members) {
    const email = m.playerEmail?.trim().toLowerCase()
    if (!email || !email.includes("@")) { skipped.push(m.playerName); continue }
    const entry = byEmail.get(email) ?? { parentName: m.playerParent || "Parent", children: [] }
    entry.children.push(`${m.playerName} (${ageGroupLabel(m.ageGroup)})`)
    byEmail.set(email, entry)
  }
  const recipients = Array.from(byEmail.entries())

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch(`${BASE}/api/members/bulk-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: members.map(m => m.id) }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed")
      const result = await res.json() as { sent: string[]; failed: { email: string; error: string }[]; skipped: string[] }
      if (result.failed.length > 0) {
        toast({
          title: `${result.sent.length} invite${result.sent.length !== 1 ? "s" : ""} sent, ${result.failed.length} failed`,
          description: `Failed: ${result.failed.map(f => f.email).join(", ")}`,
          variant: "destructive",
        })
      } else {
        toast({
          title: `${result.sent.length} invite${result.sent.length !== 1 ? "s" : ""} sent`,
          description: "Each parent received one email covering all their selected children.",
        })
      }
      onSent()
    } catch (err: any) {
      toast({ title: "Failed to send invites", description: err?.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !sending) onClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail size={18} /> Send Parent Portal invites</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {recipients.length} parent{recipients.length !== 1 ? "s" : ""} will receive an email inviting
          them to the Parent Portal. Parents with multiple selected children get a single email.
        </p>

        <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
          {recipients.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No selected players have a parent email address.</p>
          )}
          {recipients.map(([email, r]) => (
            <div key={email} className="px-4 py-2.5">
              <p className="text-sm font-semibold">{r.parentName} <span className="font-normal text-muted-foreground">&lt;{email}&gt;</span></p>
              <p className="text-xs text-muted-foreground">{r.children.join(", ")}</p>
            </div>
          ))}
        </div>

        {skipped.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Skipped (no email on file):</strong> {skipped.join(", ")}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={sending || recipients.length === 0} className="gap-2">
            {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <>Send {recipients.length} invite{recipients.length !== 1 ? "s" : ""}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


// ---------- Print List Dialog ----------
function PrintListDialog({ members, initialAgeGroup, onClose }: {
  members: { id: number; playerName: string; ageGroup: string; addAgeGroup?: string | null; playerNumber?: number | null; playerDob?: string | null; sihaRegistered?: number; playerPhoto?: string | null }[]
  initialAgeGroup: string
  onClose: () => void
}) {
  const [group, setGroup] = useState(initialAgeGroup)
  const [preparing, setPreparing] = useState(false)

  // Radix can leave `pointer-events: none` on <body> when the dialog unmounts
  // mid-close (especially after opening the print window), freezing the page.
  useEffect(() => () => { document.body.style.pointerEvents = "" }, [])

  // A player belongs to a group if it's their primary group OR one of their
  // play-up / train-up groups (addAgeGroup, comma-separated). Case-insensitive.
  // Rank of an age group for direction: LTP lowest, then u10..u19. Unknown groups (e.g. Lightning) have no rank.
  const groupRank = (g: string) => {
    const i = AGE_GROUPS.findIndex(a => a.value.toLowerCase() === g.trim().toLowerCase() && a.value !== "lightning")
    return i === -1 ? null : i
  }
  // Player from an older group appearing in a younger group trains down; younger in older plays up.
  const crossGroupLabel = (playerGroup: string, selectedGroup: string) => {
    const p = groupRank(playerGroup), sel = groupRank(selectedGroup)
    if (p != null && sel != null && p > sel) return "Train-down"
    return "Play-up"
  }
  const matchesGroup = (m: { ageGroup: string; addAgeGroup?: string | null }, g: string) => {
    if (g === "All") return true
    const want = g.trim().toLowerCase()
    if (m.ageGroup?.trim().toLowerCase() === want) return true
    return (m.addAgeGroup ?? "").split(",").some(x => x.trim().toLowerCase() === want)
  }

  const inGroup = members.filter(m => matchesGroup(m, group))
  const [checked, setChecked] = useState<Set<number>>(() => new Set(inGroup.map(m => m.id)))

  const changeGroup = (g: string) => {
    setGroup(g)
    setChecked(new Set(members.filter(m => matchesGroup(m, g)).map(m => m.id)))
  }

  const toggle = (id: number) => setChecked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const sorted = [...inGroup].sort((a, b) => {
    const an = a.playerNumber ?? 1000, bn = b.playerNumber ?? 1000
    if (an !== bn) return an - bn
    return a.playerName.localeCompare(b.playerName)
  })

  const handlePrint = async () => {
    const rows = sorted.filter(m => checked.has(m.id))
    if (rows.length === 0) return
    setPreparing(true)

    // Fetch short-lived signed photo URLs for the selected players with photos
    const photoUrls: Record<number, string> = {}
    await Promise.all(rows.filter(m => m.playerPhoto).map(async m => {
      try {
        const r = await fetch(`${BASE}/api/members/${m.id}/photo-url`, { credentials: "include" })
        if (r.ok) {
          const { url } = await r.json() as { url: string }
          if (url) photoUrls[m.id] = url
        }
      } catch { /* no photo — initials fallback */ }
    }))
    setPreparing(false)

    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    const now = new Date()
    const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    const seasonStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    const season = `${seasonStartYear}/${(seasonStartYear + 1).toString().slice(2)}`
    const title = group === "All" ? "All Age Groups" : ageGroupLabel(group)
    const logoUrl = `${window.location.origin}${BASE}/logo.png`
    const initialsOf = (name: string) =>
      name.split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("")
    const ageOf = (dob?: string | null) => {
      if (!dob) return null
      const d = new Date(dob)
      if (isNaN(d.getTime())) return null
      let age = now.getFullYear() - d.getFullYear()
      const m = now.getMonth() - d.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
      return age >= 0 && age < 100 ? age : null
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>KJIHC Official Player List — ${esc(title)}</title>
<style>
  :root { --navy: #0f1f3d; --gold: #e8a020; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #16181d; margin: 0; }
  .page { padding: 34px 44px; }
  .band { background: var(--navy); color: #fff; border-radius: 10px; padding: 20px 26px; display: flex; align-items: center; gap: 20px; border-bottom: 4px solid var(--gold); }
  .band img { height: 62px; width: auto; }
  .band .club { flex: 1; }
  .band .club h1 { margin: 0; font-size: 21px; letter-spacing: 0.04em; text-transform: uppercase; }
  .band .club .tag { font-size: 11.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); margin-top: 3px; font-weight: 600; }
  .band .meta { text-align: right; font-size: 12px; line-height: 1.7; color: #dce3f0; }
  .band .meta b { color: #fff; font-size: 15px; display: block; letter-spacing: 0.02em; }
  .subline { display: flex; justify-content: space-between; align-items: baseline; margin: 18px 2px 10px; }
  .subline .lt { font-size: 15px; font-weight: 700; color: var(--navy); text-transform: uppercase; letter-spacing: 0.06em; }
  .subline .rt { font-size: 11.5px; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: var(--navy); color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 10px; text-align: left; }
  thead th:first-child { border-radius: 6px 0 0 0; }
  thead th:last-child { border-radius: 0 6px 0 0; text-align: center; }
  tbody td { border-bottom: 1px solid #d9dde5; padding: 6px 10px; font-size: 13px; vertical-align: middle; }
  tbody tr:nth-child(even) { background: #f4f6fa; }
  td.photo { width: 46px; padding: 5px 6px 5px 10px; }
  .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid var(--navy); display: block; }
  .avatar-fallback { width: 34px; height: 34px; border-radius: 50%; background: var(--navy); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; letter-spacing: 0.03em; }
  td.num { width: 52px; font-weight: 800; color: var(--navy); font-size: 14px; }
  td.name { font-weight: 600; }
  td.age { width: 60px; font-variant-numeric: tabular-nums; }
  td.reg { width: 110px; }
  .pill { display: inline-block; padding: 2.5px 11px; border-radius: 99px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .pill.ok { background: #1e9e50; color: #fff; }
  .pill.no { background: #eee; color: #888; border: 1px solid #ccc; }
  td.sheet { width: 150px; text-align: center; }
  .sq { display: inline-block; width: 15px; height: 15px; border: 1.6px solid var(--navy); border-radius: 3px; vertical-align: middle; }
  .sigrow { display: flex; gap: 60px; margin-top: 44px; }
  .sig { flex: 1; }
  .sig .line { border-bottom: 1.4px solid #16181d; height: 30px; }
  .sig .lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-top: 5px; }
  .foot { margin-top: 26px; padding-top: 10px; border-top: 2px solid var(--navy); font-size: 10px; color: #777; display: flex; justify-content: space-between; letter-spacing: 0.03em; }
  @media print { .page { padding: 8mm 6mm; } .band, thead th, tbody tr:nth-child(even), .avatar-fallback, .pill { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="band">
    <img src="${esc(logoUrl)}" alt="KJIHC" onerror="this.style.display='none'">
    <div class="club">
      <h1>Kilmarnock Junior Ice Hockey Club</h1>
      <div class="tag">Official Player List</div>
    </div>
    <div class="meta">
      <b>${esc(title)}</b>
      Season ${esc(season)}<br>
      ${rows.length} player${rows.length === 1 ? "" : "s"}
    </div>
  </div>
  <div class="subline">
    <span class="lt">Team Roster</span>
    <span class="rt">Printed as of ${esc(dateStr)}, ${esc(timeStr)}</span>
  </div>
  <table>
    <thead><tr>
      <th></th><th>No.</th><th>Player</th><th>Age group</th><th>Age</th><th>Registered</th><th>Added to game sheet</th>
    </tr></thead>
    <tbody>
      ${rows.map(m => `<tr>
        <td class="photo">${photoUrls[m.id]
          ? `<img class="avatar" src="${esc(photoUrls[m.id])}" alt="">`
          : `<div class="avatar-fallback">${esc(initialsOf(m.playerName))}</div>`}</td>
        <td class="num">${m.playerNumber != null ? "#" + m.playerNumber : "—"}</td>
        <td class="name">${esc(m.playerName)}</td>
        <td>${esc(ageGroupLabel(m.ageGroup))}</td>
        <td class="age">${ageOf(m.playerDob) ?? "—"}</td>
        <td class="reg">${m.sihaRegistered === 1 ? `<span class="pill ok">Registered</span>` : `<span class="pill no">Not reg.</span>`}</td>
        <td class="sheet"><span class="sq"></span></td>
      </tr>`).join("")}
    </tbody>
  </table>
  <div class="sigrow">
    <div class="sig"><div class="line"></div><div class="lbl">Coach / Team Manager signature</div></div>
    <div class="sig"><div class="line"></div><div class="lbl">Date</div></div>
  </div>
  <div class="foot"><span>Kilmarnock Junior Ice Hockey Club — internal use only</span><span>join.kjihc.org</span></div>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print() }, 150) }</script>
</body></html>`
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer size={18} /> Print player list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Age group</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={group}
              onChange={e => changeGroup(e.target.value)}
            >
              <option value="All">All age groups</option>
              {AGE_GROUPS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{checked.size} of {sorted.length} selected</span>
            <div className="flex gap-3">
              <button className="text-primary underline underline-offset-2" onClick={() => setChecked(new Set(sorted.map(m => m.id)))}>Select all</button>
              <button className="text-primary underline underline-offset-2" onClick={() => setChecked(new Set())}>Clear</button>
            </div>
          </div>
          <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
            {sorted.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No players in this group.</p>}
            {sorted.map(m => (
              <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/30 text-sm">
                <input type="checkbox" className="rounded border-input" checked={checked.has(m.id)} onChange={() => toggle(m.id)} />
                <span className="w-9 text-primary font-semibold">{m.playerNumber != null ? `#${m.playerNumber}` : ""}</span>
                <span className="flex-1">
                  {m.playerName}
                  {group !== "All" && m.ageGroup?.trim().toLowerCase() !== group.trim().toLowerCase() && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">{crossGroupLabel(m.ageGroup, group)}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{ageGroupLabel(m.ageGroup)}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button className="gap-2" disabled={checked.size === 0 || preparing} onClick={handlePrint}>
              {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer size={15} />}
              Print {checked.size} player{checked.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- SIHA Inbox Check Dialog ----------
function SihaCheckDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  useEffect(() => () => { document.body.style.pointerEvents = "" }, [])
  const [scanning, setScanning] = useState(false)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    seasonSince: string
    emailsScanned: number
    sihaEmails: number
    candidates: { memberId: number; playerName: string; ageGroup: string; matchedSubject: string; receivedAt: string; sihaNumber: string | null }[]
    numberUpdates: { memberId: number; playerName: string; ageGroup: string; sihaNumber: string; matchedSubject: string; receivedAt: string }[]
  } | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [checkedNums, setCheckedNums] = useState<Set<number>>(new Set())

  const scan = async () => {
    setScanning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${BASE}/api/siha/scan`, { method: "POST", credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Scan failed")
      setResult(data)
      setChecked(new Set(data.candidates.map((c: { memberId: number }) => c.memberId)))
      setCheckedNums(new Set((data.numberUpdates ?? []).map((c: { memberId: number }) => c.memberId)))
    } catch (e: any) {
      setError(e?.message || "Could not check the mailbox")
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => { scan() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMark = async () => {
    if (checked.size === 0 && checkedNums.size === 0) return
    setMarking(true)
    try {
      const res = await fetch(`${BASE}/api/siha/mark-registered`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: [...checked],
          sihaNumbers: Object.fromEntries([
            ...(result?.candidates ?? [])
              .filter(c => checked.has(c.memberId) && c.sihaNumber)
              .map(c => [c.memberId, c.sihaNumber] as const),
            ...(result?.numberUpdates ?? [])
              .filter(c => checkedNums.has(c.memberId))
              .map(c => [c.memberId, c.sihaNumber] as const),
          ]),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed")
      const parts: string[] = []
      if (data.updated > 0) parts.push(`${data.updated} player${data.updated === 1 ? "" : "s"} marked as registered`)
      if (data.numbersSaved > 0) parts.push(`${data.numbersSaved} registration number${data.numbersSaved === 1 ? "" : "s"} saved`)
      toast({ title: parts.join(" · ") || "Nothing changed" })
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
      onClose()
    } catch (e: any) {
      toast({ title: "Could not mark players", description: e?.message, variant: "destructive" })
    } finally {
      setMarking(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Inbox size={18} /> Check SIHA inbox</DialogTitle>
        </DialogHeader>
        {scanning && (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            Reading the secretary mailbox…
          </div>
        )}
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">{error}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button onClick={scan}>Try again</Button>
            </div>
          </div>
        )}
        {result && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Checked {result.emailsScanned} email{result.emailsScanned === 1 ? "" : "s"} since {new Date(result.seasonSince).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} ({result.sihaEmails} from SIHA).
            </p>
            {result.candidates.length === 0 && (result.numberUpdates ?? []).length === 0 ? (
              <p className="text-sm bg-muted/40 rounded-md p-4 text-center">
                No unregistered players matched SIHA emails, and no new registration numbers were found.
              </p>
            ) : (
              <>
                {result.candidates.length > 0 && (
                <>
                <p className="text-sm font-medium">Mark the players below as SIHA registered? No emails will be sent.</p>
                <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                  {result.candidates.map(c => (
                    <label key={c.memberId} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/30 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-input mt-1"
                        checked={checked.has(c.memberId)}
                        onChange={() => setChecked(prev => {
                          const next = new Set(prev)
                          if (next.has(c.memberId)) next.delete(c.memberId); else next.add(c.memberId)
                          return next
                        })}
                      />
                      <span className="flex-1">
                        <span className="font-semibold">{c.playerName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{ageGroupLabel(c.ageGroup)}</span>
                        {c.sihaNumber && <span className="text-xs font-medium text-primary ml-2">Reg {c.sihaNumber}</span>}
                        <span className="block text-xs text-muted-foreground truncate">
                          "{c.matchedSubject}" — {new Date(c.receivedAt).toLocaleDateString("en-GB")}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                </>
                )}
                {(result.numberUpdates ?? []).length > 0 && (
                <>
                <p className="text-sm font-medium">Registration numbers found for players already marked as registered:</p>
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {result.numberUpdates.map(c => (
                    <label key={c.memberId} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/30 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-input mt-1"
                        checked={checkedNums.has(c.memberId)}
                        onChange={() => setCheckedNums(prev => {
                          const next = new Set(prev)
                          if (next.has(c.memberId)) next.delete(c.memberId); else next.add(c.memberId)
                          return next
                        })}
                      />
                      <span className="flex-1">
                        <span className="font-semibold">{c.playerName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{ageGroupLabel(c.ageGroup)}</span>
                        <span className="text-xs font-medium text-primary ml-2">Reg {c.sihaNumber}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          "{c.matchedSubject}" — {new Date(c.receivedAt).toLocaleDateString("en-GB")}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                </>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={onClose}>Cancel</Button>
                  <Button className="gap-2" disabled={(checked.size === 0 && checkedNums.size === 0) || marking} onClick={handleMark}>
                    {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck size={15} />}
                    {checked.size > 0
                      ? `Mark ${checked.size} as registered${checkedNums.size > 0 ? ` + save ${checkedNums.size} number${checkedNums.size === 1 ? "" : "s"}` : ""}`
                      : `Save ${checkedNums.size} registration number${checkedNums.size === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
