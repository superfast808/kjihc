import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Settings2, Building2, Smartphone, Mail, Eye, EyeOff, CheckCircle2, Send, AlertTriangle, Info, PoundSterling, Pencil, Trash2, Plus, X, Check, PenLine, Users, CreditCard } from "lucide-react"
import { useListHejaCodes } from "@workspace/api-client-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

type Setting = { key: string; value: string; label: string }

function fetchSettings(): Promise<Setting[]> {
  return fetch(`${BASE}/api/settings`, { credentials: "include" }).then(r => r.json())
}
function saveSetting(key: string, value: string) {
  return fetch(`${BASE}/api/settings/${key}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  }).then(r => r.json())
}

function SettingRow({ setting, onSave }: { setting: Setting; onSave: (key: string, value: string) => void }) {
  const isPassword = setting.key === "smtp_pass" || setting.key === "stripe_secret_key" || setting.key === "ms_client_secret"
  const isConfigured = isPassword && setting.value === "__SET__"
  const [val, setVal] = useState(isConfigured ? "" : setting.value)
  const [dirty, setDirty] = useState(false)
  const [showPass, setShowPass] = useState(false)
  useEffect(() => {
    setVal((setting.key === "smtp_pass" || setting.key === "ms_client_secret") && setting.value === "__SET__" ? "" : setting.value)
    setDirty(false)
  }, [setting.value, setting.key])
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-2">
        {setting.label}
        {isConfigured && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-normal">
            <CheckCircle2 size={11} /> Configured
          </span>
        )}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={isPassword && !showPass ? "password" : "text"}
            value={val}
            onChange={e => { setVal(e.target.value); setDirty(true) }}
            placeholder={isConfigured && !dirty ? "Leave blank to keep existing password" : `Enter ${setting.label.toLowerCase()}…`}
            className="font-mono text-sm pr-10"
          />
          {isPassword && (
            <button type="button" onClick={() => setShowPass(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {dirty && val && (
          <Button size="sm" onClick={() => { onSave(setting.key, val); setDirty(false) }}>
            Save
          </Button>
        )}
      </div>
    </div>
  )
}

function SmtpTestPanel() {
  const { toast } = useToast()
  const [testEmail, setTestEmail] = useState("")
  const [result, setResult] = useState<{ ok?: boolean; message?: string; error?: string; hint?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function runTest() {
    if (!testEmail) return
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch(`${BASE}/api/settings/smtp/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      })
      const json = await r.json()
      setResult(json)
      if (json.ok) {
        toast({ title: "Test email sent", description: json.message })
      }
    } catch {
      setResult({ error: "Request failed — check the server is running." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Test email delivery</Label>
      <p className="text-xs text-muted-foreground">
        Send a test email to confirm the current SMTP settings are working. The result will show you exactly what went wrong if delivery fails.
      </p>
      <div className="flex gap-2">
        <Input
          type="email"
          value={testEmail}
          onChange={e => { setTestEmail(e.target.value); setResult(null) }}
          placeholder="your@email.com"
          className="text-sm"
          onKeyDown={e => e.key === "Enter" && runTest()}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={runTest}
          disabled={loading || !testEmail}
          className="shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
          Send test
        </Button>
      </div>

      {result && (
        <div className={`rounded-lg border p-3 text-sm space-y-1 ${result.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {result.ok ? (
            <p className="flex items-center gap-1.5"><CheckCircle2 size={14} /> {result.message}</p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 font-medium"><AlertTriangle size={14} /> Delivery failed</p>
              <p className="font-mono text-xs bg-red-100 rounded px-2 py-1 break-all">{result.error}</p>
              {result.hint && (
                <p className="text-red-700 mt-1 leading-relaxed">{result.hint}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Fee row component ─────────────────────────────────────────────────────────

type Fee = { id: number; feeGroup: string; feeAmount: string }

function FeeRow({ fee, onSave, onDelete }: {
  fee: Fee
  onSave: (id: number, feeGroup: string, feeAmount: string) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [group, setGroup]   = useState(fee.feeGroup)
  const [amount, setAmount] = useState(fee.feeAmount)

  useEffect(() => { setGroup(fee.feeGroup); setAmount(fee.feeAmount) }, [fee.feeGroup, fee.feeAmount])

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40">
        <Input
          value={group}
          onChange={e => setGroup(e.target.value)}
          placeholder="Fee group name"
          className="h-8 text-sm flex-1"
        />
        <div className="relative w-28 flex-shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
          <Input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="h-8 text-sm pl-6"
          />
        </div>
        <button
          onClick={() => { onSave(fee.id, group, amount); setEditing(false) }}
          disabled={!group.trim() || !amount.trim()}
          className="text-green-600 hover:text-green-700 disabled:opacity-40"
          title="Save"
        >
          <Check size={16} />
        </button>
        <button
          onClick={() => { setGroup(fee.feeGroup); setAmount(fee.feeAmount); setEditing(false) }}
          className="text-muted-foreground hover:text-foreground"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-background group">
      <span className="text-sm font-medium">{fee.feeGroup}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-primary">£{fee.feeAmount}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(fee.id)}
            className="text-muted-foreground hover:text-destructive p-1 rounded"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddFeeRow({ onAdd }: { onAdd: (feeGroup: string, feeAmount: string) => void }) {
  const [open, setOpen]     = useState(false)
  const [group, setGroup]   = useState("")
  const [amount, setAmount] = useState("")

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <Plus size={14} /> Add fee tier
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-t">
      <Input
        autoFocus
        value={group}
        onChange={e => setGroup(e.target.value)}
        placeholder="Fee group name (e.g. LTP)"
        className="h-8 text-sm flex-1"
      />
      <div className="relative w-28 flex-shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
        <Input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
          className="h-8 text-sm pl-6"
        />
      </div>
      <button
        onClick={() => { onAdd(group, amount); setGroup(""); setAmount(""); setOpen(false) }}
        disabled={!group.trim() || !amount.trim()}
        className="text-green-600 hover:text-green-700 disabled:opacity-40"
        title="Add"
      >
        <Check size={16} />
      </button>
      <button
        onClick={() => { setGroup(""); setAmount(""); setOpen(false) }}
        className="text-muted-foreground hover:text-foreground"
        title="Cancel"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function fetchFees(): Promise<Fee[]> {
  return fetch(`${BASE}/api/join/fees`, { credentials: "include" }).then(r => r.json())
}

export default function Settings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: settings = [], isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings })
  const { data: hejaCodes = [], isLoading: hejaLoading } = useListHejaCodes()
  const { data: fees = [], isLoading: feesLoading } = useQuery({ queryKey: ["fees"], queryFn: fetchFees })

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => saveSetting(key, value),
    onSuccess: () => {
      toast({ title: "Setting saved" })
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: () => toast({ title: "Error saving", variant: "destructive" }),
  })

  const updateFeeMutation = useMutation({
    mutationFn: ({ id, feeGroup, feeAmount }: { id: number; feeGroup: string; feeAmount: string }) =>
      fetch(`${BASE}/api/join/fees/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeGroup, feeAmount }),
      }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json() }),
    onSuccess: () => {
      toast({ title: "Fee updated" })
      queryClient.invalidateQueries({ queryKey: ["fees"] })
    },
    onError: () => toast({ title: "Error updating fee", variant: "destructive" }),
  })

  const addFeeMutation = useMutation({
    mutationFn: ({ feeGroup, feeAmount }: { feeGroup: string; feeAmount: string }) =>
      fetch(`${BASE}/api/join/fees`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeGroup, feeAmount }),
      }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json() }),
    onSuccess: () => {
      toast({ title: "Fee tier added" })
      queryClient.invalidateQueries({ queryKey: ["fees"] })
    },
    onError: () => toast({ title: "Error adding fee", variant: "destructive" }),
  })

  const deleteFeeMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/join/fees/${id}`, { method: "DELETE", credentials: "include" })
        .then(r => { if (!r.ok && r.status !== 204) throw new Error("Failed") }),
    onSuccess: () => {
      toast({ title: "Fee tier removed" })
      queryClient.invalidateQueries({ queryKey: ["fees"] })
    },
    onError: () => toast({ title: "Error deleting fee", variant: "destructive" }),
  })

  const settingsList = Array.isArray(settings) ? settings : []

  // Always show these rows even if no DB row exists yet (default value = "")
  const STRIPE_KEYS: Setting[] = [
    { key: "stripe_publishable_key",  value: "", label: "Publishable Key (pk_live_…)" },
    { key: "stripe_secret_key",       value: "", label: "Secret Key (sk_live_…)" },
    { key: "stripe_webhook_secret",   value: "", label: "Webhook Signing Secret (whsec_…)" },
  ]
  const BANK_KEYS: Setting[] = [
    { key: "bank_name",       value: "", label: "Bank / Building Society Name" },
    { key: "bank_sort_code",  value: "", label: "Sort Code" },
    { key: "bank_account",    value: "", label: "Account Number" },
    { key: "bank_reference",  value: "", label: "Payment Reference (e.g. player surname)" },
  ]
  const SIHA_KEYS: Setting[] = [
    { key: "ms_tenant_id",       value: "", label: "Microsoft Tenant (Directory) ID" },
    { key: "ms_client_id",       value: "", label: "Application (Client) ID" },
    { key: "ms_client_secret",   value: "", label: "Client Secret Value" },
    { key: "siha_mailbox",       value: "", label: "Secretary mailbox address (e.g. secretary@kjihc.org)" },
    { key: "siha_sender_filter", value: "", label: "SIHA email filter word (default: siha)" },
  ]
  const SMTP_KEYS: Setting[] = [
    { key: "smtp_host", value: "", label: "SMTP Host" },
    { key: "smtp_port", value: "", label: "SMTP Port" },
    { key: "smtp_user", value: "", label: "SMTP Username / From address" },
    { key: "smtp_pass", value: "", label: "SMTP Password" },
    { key: "smtp_from", value: "", label: "From display name (e.g. KJIHC Club)" },
  ]

  function mergeSettings(defaults: Setting[]): Setting[] {
    return defaults.map(def => {
      const saved = settingsList.find(s => s.key === def.key)
      return saved ?? def
    })
  }

  const bankSettings    = mergeSettings(BANK_KEYS)
  const smtpSettings    = mergeSettings(SMTP_KEYS)
  const stripeSettings  = mergeSettings(STRIPE_KEYS)
  const sihaSettings    = mergeSettings(SIHA_KEYS)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Settings2 className="h-7 w-7" /> Club Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure bank details, email delivery, and Heja codes.</p>
      </div>

      {/* Stripe */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Online Payments (Stripe)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enables parents with overdue fees to pay online from the parent portal. Add your Stripe live keys here — find them at <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">dashboard.stripe.com/apikeys</a>. The webhook signing secret is under <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="underline">dashboard.stripe.com/webhooks</a> — point it at <code className="bg-amber-100 px-1 rounded text-xs">https://join.kjihc.org/api/webhooks/stripe</code> and listen for <code className="bg-amber-100 px-1 rounded text-xs">checkout.session.completed</code>.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            stripeSettings.map(s => (
              <SettingRow
                key={s.key}
                setting={s}
                onSave={(key, value) => saveMutation.mutate({ key, value })}
              />
            ))
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Important:</strong> Use <em>live</em> keys (pk_live_… / sk_live_…) for real payments. Test keys only charge test cards.
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Bank Transfer Details
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            These are shown to parents on the registration form and success screen so they know where to pay monthly fees.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            bankSettings.map(s => (
              <SettingRow
                key={s.key}
                setting={s}
                onSave={(key, value) => saveMutation.mutate({ key, value })}
              />
            ))
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Tip:</strong> Leave sort code and account number blank to hide the bank transfer section until you're ready to publish it.
          </div>
        </CardContent>
      </Card>

      {/* SIHA / Microsoft 365 mailbox */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> SIHA Registration Checker (Microsoft 365)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lets the "Check SIHA inbox" button on the Roster page read the secretary mailbox and suggest
            players to mark as registered. Create an app registration in Microsoft Entra (Intune admin centre)
            with application permission <code className="bg-muted px-1 rounded">Mail.Read</code> granted for the
            secretary mailbox, then enter its details here.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            sihaSettings.map(s => (
              <SettingRow
                key={s.key}
                setting={s}
                onSave={(key, value) => saveMutation.mutate({ key, value })}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* SMTP / Email Settings */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Email Delivery (SMTP)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Used to send welcome emails and parent portal login links. Settings here override environment variables.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            smtpSettings.map(s => (
              <SettingRow
                key={s.key}
                setting={s}
                onSave={(key, value) => saveMutation.mutate({ key, value })}
              />
            ))
          )}

          {/* Test panel */}
          <div className="border-t pt-5">
            <SmtpTestPanel />
          </div>

          {/* Provider guidance */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3 text-sm text-blue-900">
            <p className="flex items-center gap-1.5 font-semibold text-blue-800">
              <Info size={15} /> Provider setup guides
            </p>

            <div className="space-y-1">
              <p className="font-medium">Microsoft 365 / Outlook</p>
              <p className="text-blue-800">
                Host: <code className="bg-blue-100 px-1 rounded">smtp.office365.com</code> · Port: <code className="bg-blue-100 px-1 rounded">587</code>
              </p>
              <p className="text-blue-700 leading-relaxed">
                Microsoft disabled SMTP Basic Auth by default. You must{" "}
                <strong>enable Authenticated SMTP</strong> for the mailbox in the M365 Admin Centre
                (Users → Active users → select mailbox → Mail → Manage email apps → tick <em>Authenticated SMTP</em>).
                If the account has MFA enabled, generate an <strong>App Password</strong> and use that as the password here instead of the regular account password.
              </p>
            </div>

            <div className="space-y-1 border-t border-blue-200 pt-3">
              <p className="font-medium">Gmail</p>
              <p className="text-blue-800">
                Host: <code className="bg-blue-100 px-1 rounded">smtp.gmail.com</code> · Port: <code className="bg-blue-100 px-1 rounded">587</code>
              </p>
              <p className="text-blue-700">Use a <strong>Gmail App Password</strong>, not your regular account password. Enable 2-Step Verification first, then create an App Password under Google Account → Security.</p>
            </div>

            <div className="space-y-1 border-t border-blue-200 pt-3">
              <p className="font-medium">Resend (recommended — no M365 restrictions)</p>
              <p className="text-blue-800">
                Host: <code className="bg-blue-100 px-1 rounded">smtp.resend.com</code> · Port: <code className="bg-blue-100 px-1 rounded">465</code>
              </p>
              <p className="text-blue-700">
                User: <code className="bg-blue-100 px-1 rounded">resend</code> · Password: your Resend API key.{" "}
                <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">resend.com</a> — free tier sends up to 3,000 emails/month.
                Works immediately without any Microsoft admin access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Fees */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <PoundSterling className="h-5 w-5 text-primary" /> Monthly Fee Tiers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The fee amounts shown to parents on the registration form and in the parent portal. Each member is assigned one of these tiers.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {feesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="divide-y rounded-b-lg overflow-hidden border-x border-b">
              {(Array.isArray(fees) ? fees : []).map((fee: Fee) => (
                <FeeRow
                  key={fee.id}
                  fee={fee}
                  onSave={(id, feeGroup, feeAmount) => updateFeeMutation.mutate({ id, feeGroup, feeAmount })}
                  onDelete={(id) => deleteFeeMutation.mutate(id)}
                />
              ))}
              <AddFeeRow
                onAdd={(feeGroup, feeAmount) => addFeeMutation.mutate({ feeGroup, feeAmount })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heja Codes (read-only reference) */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> Heja Team Codes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            These codes are shown to parents after registration. Manage the underlying data in your database or ask your developer to update them.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {hejaLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {hejaCodes.map(c => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-background">
                  <span className="text-sm font-medium">{c.codeGroup}</span>
                  <span className="font-mono font-bold text-primary tracking-widest">{c.codeCode}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual Code of Conduct Reminders */}
      <ConductReminderCard />
    </div>
  )
}

// ── Conduct Reminder Card ─────────────────────────────────────────────────────

function ConductReminderCard() {
  const { toast } = useToast()
  const [sent, setSent] = useState<{ sent: number; failed: number } | null>(null)
  const [sending, setSending] = useState(false)

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["conduct-reminder-stats"],
    queryFn: () =>
      fetch(`${BASE}/api/conduct-reminder/stats`, { credentials: "include" }).then(r => r.json()),
  })

  const handleSend = async () => {
    if (!stats || stats.uniqueParentsToNotify === 0) return
    setSending(true)
    setSent(null)
    try {
      const r = await fetch(`${BASE}/api/conduct-reminder/send`, {
        method: "POST",
        credentials: "include",
      })
      if (!r.ok) throw new Error("Failed")
      const result = await r.json()
      setSent(result)
      refetchStats()
      toast({ title: `Reminders sent`, description: `${result.sent} email${result.sent !== 1 ? "s" : ""} sent successfully.` })
    } catch {
      toast({ title: "Failed to send reminders", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" /> Annual Code of Conduct Reminders
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Send a reminder email to all parents whose Code of Conduct signature is missing or more than 12 months old.
          Each email includes a 7-day login link so parents can sign immediately.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {statsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stats…
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.upToDate}</p>
              <p className="text-xs text-muted-foreground mt-1">Up to date</p>
            </div>
            <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.needsRenewal}</p>
              <p className="text-xs text-amber-600 mt-1">Renewal due</p>
            </div>
            <div className="rounded-xl border bg-red-50 border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.neverSigned}</p>
              <p className="text-xs text-red-600 mt-1">Never signed</p>
            </div>
            <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.uniqueParentsToNotify}</p>
              <p className="text-xs text-muted-foreground mt-1">Emails to send</p>
            </div>
          </div>
        ) : null}

        {sent && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>{sent.sent}</strong> reminder{sent.sent !== 1 ? "s" : ""} sent
              {sent.failed > 0 ? `, ${sent.failed} failed` : " — all delivered"}.
            </span>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={sending || !stats || stats.uniqueParentsToNotify === 0}
          className="gap-2"
        >
          {sending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            : <><Send className="h-4 w-4" /> Send annual signing reminders{stats ? ` (${stats.uniqueParentsToNotify})` : ""}</>
          }
        </Button>

        {stats && stats.uniqueParentsToNotify === 0 && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            All parents are up to date — no reminders needed.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
