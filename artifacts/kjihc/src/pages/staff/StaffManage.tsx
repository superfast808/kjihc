import { useState } from "react"
import {
  useListStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  getListStaffQueryKey,
  type StaffMember,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { AGE_GROUPS, ageGroupLabel } from "@/lib/ageGroups"
import { PlusCircle, ShieldCheck, ShieldAlert, Pencil, Trash2, Loader2, Mail } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  {
    value: "coach",
    label: "Coach / Manager",
    description: "View their age group players and events; run training sign-ins",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    value: "treasurer",
    label: "Treasurer",
    description: "View fees and compliance data for all members",
    badgeClass: "bg-green-100 text-green-800 border-green-300",
  },
  {
    value: "registrations",
    label: "Registrations",
    description: "View and update SIHA registration status for all members",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
  },
]

// ── Form types / helpers ──────────────────────────────────────────────────────
type StaffForm = {
  staffName: string
  staffEmail: string
  isSuperUser: boolean
  roles: string[]
  allowedGroups: string[]
}

const EMPTY_FORM: StaffForm = {
  staffName: "",
  staffEmail: "",
  isSuperUser: false,
  roles: [],
  allowedGroups: [],
}

function levelFromForm(form: StaffForm): string {
  if (form.isSuperUser) return "1"
  if (form.roles.includes("coach")) return form.allowedGroups.join(",")
  return ""
}

function rolesFromForm(form: StaffForm): string {
  return form.roles.join(",")
}

function formFromStaff(s: StaffMember): StaffForm {
  const isSuperUser = s.staffLevel === "1"
  const allowedGroups = isSuperUser ? [] : s.staffLevel.split(",").map(g => g.trim()).filter(Boolean)
  const rawRoles = (s.staffRoles ?? "").split(",").map(r => r.trim()).filter(Boolean)
  // Backward compat: staff added before roles existed — infer coach from age groups
  const roles = rawRoles.length === 0 && allowedGroups.length > 0 ? ["coach"] : rawRoles
  return { staffName: s.staffName, staffEmail: s.staffEmail, isSuperUser, roles, allowedGroups }
}

// ── Form dialog ───────────────────────────────────────────────────────────────
function StaffFormDialog({
  open, onClose, initial, title, onSave, saving,
}: {
  open: boolean; onClose: () => void; initial: StaffForm
  title: string; onSave: (form: StaffForm) => void; saving: boolean
}) {
  const [form, setForm] = useState<StaffForm>(initial)

  const toggleGroup = (value: string) =>
    setForm(f => ({
      ...f,
      allowedGroups: f.allowedGroups.includes(value)
        ? f.allowedGroups.filter(g => g !== value)
        : [...f.allowedGroups, value],
    }))

  const toggleRole = (value: string) =>
    setForm(f => ({
      ...f,
      roles: f.roles.includes(value) ? f.roles.filter(r => r !== value) : [...f.roles, value],
    }))

  const isValid = Boolean(
    form.staffName.trim() &&
    form.staffEmail.trim() &&
    (form.isSuperUser ||
      (form.roles.length > 0 &&
        (!form.roles.includes("coach") || form.allowedGroups.length > 0)))
  )

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              value={form.staffName}
              onChange={e => setForm(f => ({ ...f, staffName: e.target.value }))}
              placeholder="e.g. Louise MacLachlan"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input
              type="email"
              value={form.staffEmail}
              onChange={e => setForm(f => ({ ...f, staffEmail: e.target.value }))}
              placeholder="name@example.com"
            />
            <p className="text-xs text-muted-foreground">Must match the email they use to log in.</p>
          </div>

          {/* Access Level */}
          <div className="space-y-3">
            <Label>Access Level</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio" name="access" className="accent-primary"
                  checked={form.isSuperUser}
                  onChange={() => setForm(f => ({ ...f, isSuperUser: true, roles: [], allowedGroups: [] }))}
                />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <ShieldCheck size={15} className="text-primary" /> Superuser
                  </div>
                  <div className="text-xs text-muted-foreground">Full access — all players, all age groups, staff management</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio" name="access" className="accent-primary"
                  checked={!form.isSuperUser}
                  onChange={() => setForm(f => ({ ...f, isSuperUser: false }))}
                />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <ShieldAlert size={15} className="text-amber-500" /> Restricted access
                  </div>
                  <div className="text-xs text-muted-foreground">Access limited to the roles assigned below</div>
                </div>
              </label>
            </div>

            {/* Roles (when not superuser) */}
            {!form.isSuperUser && (
              <div className="space-y-3">
                <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</p>
                  {ROLE_OPTIONS.map(({ value, label, description }) => (
                    <label
                      key={value}
                      className={`flex items-start gap-3 p-2.5 rounded-md cursor-pointer transition-colors border ${
                        form.roles.includes(value)
                          ? "bg-primary/10 border-primary/30"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox" className="accent-primary mt-0.5"
                        checked={form.roles.includes(value)}
                        onChange={() => toggleRole(value)}
                      />
                      <div>
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </label>
                  ))}
                  {form.roles.length === 0 && (
                    <p className="text-xs text-destructive">Select at least one role.</p>
                  )}
                </div>

                {/* Age groups for coach */}
                {form.roles.includes("coach") && (
                  <div className="border rounded-lg p-3 space-y-1.5 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coach Age Groups</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AGE_GROUPS.map(({ value, label }) => (
                        <label
                          key={value}
                          className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer text-sm transition-colors ${
                            form.allowedGroups.includes(value)
                              ? "bg-primary/10 border border-primary/30 text-primary font-medium"
                              : "hover:bg-muted/50 border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox" className="accent-primary"
                            checked={form.allowedGroups.includes(value)}
                            onChange={() => toggleGroup(value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {form.allowedGroups.length === 0 && (
                      <p className="text-xs text-destructive mt-1">Select at least one age group for the coach role.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => isValid && onSave(form)} disabled={saving || !isValid}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

async function sendInvite(id: number): Promise<void> {
  const r = await fetch(`${BASE}/api/staff/${id}/send-invite`, {
    method: "POST",
    credentials: "include",
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as any).error ?? "Failed to send invite")
  }
}

export default function StaffManage() {
  const { data: staff, isLoading } = useListStaff()
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const deleteStaff = useDeleteStaff()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [sendingInviteFor, setSendingInviteFor] = useState<number | null>(null)

  const handleSendInvite = async (id: number, name: string, email: string) => {
    setSendingInviteFor(id)
    try {
      await sendInvite(id)
      toast({ title: "Invite sent", description: `Login instructions emailed to ${email}.` })
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message ?? "Could not send invite.", variant: "destructive" })
    } finally {
      setSendingInviteFor(null)
    }
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() })

  const handleAdd = (form: StaffForm) => {
    createStaff.mutate(
      { data: { staffName: form.staffName, staffEmail: form.staffEmail, staffLevel: levelFromForm(form), staffRoles: rolesFromForm(form) } },
      {
        onSuccess: () => {
          toast({ title: "Staff member added", description: `${form.staffName} can now log in.` })
          setAddOpen(false)
          invalidate()
        },
        onError: () => toast({ title: "Error", description: "Could not add staff member.", variant: "destructive" }),
      }
    )
  }

  const handleEdit = (form: StaffForm) => {
    if (!editTarget) return
    updateStaff.mutate(
      { id: editTarget.id, data: { staffName: form.staffName, staffEmail: form.staffEmail, staffLevel: levelFromForm(form), staffRoles: rolesFromForm(form) } },
      {
        onSuccess: () => {
          toast({ title: "Staff updated" })
          setEditTarget(null)
          invalidate()
        },
        onError: () => toast({ title: "Error", description: "Could not update staff member.", variant: "destructive" }),
      }
    )
  }

  const handleDelete = (id: number, name: string) => {
    deleteStaff.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Staff member removed", description: `${name} has been removed.` })
        invalidate()
      },
      onError: () => toast({ title: "Error", description: "Could not remove staff member.", variant: "destructive" }),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Manage Staff</h1>
          <p className="text-muted-foreground">Control who can access the portal and what they can see.</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <PlusCircle size={18} /> Add Staff
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Name</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Email</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Access</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : staff?.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No staff members yet.</td></tr>
              ) : (
                staff?.map((s) => {
                  const isSuperUser = s.staffLevel === "1"
                  const rawRoles = (s.staffRoles ?? "").split(",").map(r => r.trim()).filter(Boolean)
                  const groups = !isSuperUser ? s.staffLevel.split(",").map(g => g.trim()).filter(Boolean) : []
                  const displayRoles = rawRoles.length === 0 && groups.length > 0 ? ["coach"] : rawRoles
                  return (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium">{s.staffName}</td>
                      <td className="px-6 py-4 text-muted-foreground">{s.staffEmail}</td>
                      <td className="px-6 py-4">
                        {isSuperUser ? (
                          <div className="flex items-center gap-2 text-primary font-semibold">
                            <ShieldCheck size={15} /> Superuser
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 flex-wrap">
                            {displayRoles.map(role => {
                              const opt = ROLE_OPTIONS.find(o => o.value === role)
                              return opt ? (
                                <Badge key={role} variant="outline" className={`text-[11px] border ${opt.badgeClass}`}>
                                  {opt.label}
                                </Badge>
                              ) : null
                            })}
                            {displayRoles.includes("coach") && groups.map(grp => (
                              <Badge key={grp} variant="secondary" className="text-[11px]">
                                {ageGroupLabel(grp)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="gap-1.5 text-muted-foreground hover:text-foreground"
                            disabled={sendingInviteFor === s.id}
                            onClick={() => handleSendInvite(s.id, s.staffName, s.staffEmail)}
                            title="Send login invite email"
                          >
                            {sendingInviteFor === s.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Mail size={14} />}
                            Invite
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="gap-1.5"
                            onClick={() => setEditTarget(s)}
                          >
                            <Pencil size={14} /> Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                                <Trash2 size={14} /> Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {s.staffName}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  They will immediately lose access to the staff portal. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(s.id, s.staffName)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StaffFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initial={EMPTY_FORM}
        title="Add Staff Member"
        onSave={handleAdd}
        saving={createStaff.isPending}
      />

      {editTarget && (
        <StaffFormDialog
          open={true}
          onClose={() => setEditTarget(null)}
          initial={formFromStaff(editTarget)}
          title={`Edit — ${editTarget.staffName}`}
          onSave={handleEdit}
          saving={updateStaff.isPending}
        />
      )}
    </div>
  )
}
