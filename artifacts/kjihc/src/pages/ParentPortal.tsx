import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useGetParentChildren, useParentPatchChild, getGetParentChildrenQueryKey, useListFees, MemberDetail } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Link } from "wouter"
import { Loader2, MapPin, Mail, Facebook, CreditCard, ShieldCheck, Bell, BellOff, BellRing, ChevronRight, Users, CalendarDays, MessageSquare, AlertCircle, PenLine } from "lucide-react"
import { useWebPush } from "@/hooks/useWebPush"
import { cn } from "@/lib/utils"
import NotificationPrompt from "@/components/NotificationPrompt"
import { type PushState } from "@/hooks/useWebPush"
import EventsSection from "@/pages/parent/EventsSection"
import MessagesSection from "@/pages/parent/MessagesSection"
import StatusSection from "@/pages/parent/StatusSection"
import ConductSection from "@/pages/parent/ConductSection"
import { isConductCurrent } from "@/lib/codeOfConduct"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const editChildSchema = z.object({
  playerName: z.string().min(2, "Name is required"),
  playerDob: z.string().min(1, "DOB is required"),
  playerAddress1: z.string().min(1, "Address is required"),
  playerAddress2: z.string().optional(),
  playerCity: z.string().min(1, "City is required"),
  playerPost: z.string().min(1, "Postcode is required"),
  playerParent: z.string().min(1, "Parent name is required"),
  playerContactTel: z.string().min(1, "Phone is required"),
  playerEmail: z.string().email(),
  playerMedicalnotes: z.string().optional(),
  playerMedication: z.string().optional(),
  agreeFee: z.number(),
  agreeGdpr: z.number(),
  agreePhoto: z.number(),
  readCode: z.number(),
})

type Section = "players" | "events" | "messages" | "conduct" | "status" | "club-info"

export default function ParentPortal() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const [section, setSection] = useState<Section>("players")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get("token")
    if (!t) {
      toast({ title: "Invalid Link", description: "Please request a new login link.", variant: "destructive" })
      setLocation("/parent-login")
    } else {
      setToken(t)
    }
  }, [setLocation, toast])

  const { data: children, isLoading, error } = useGetParentChildren(
    { token: token || "" },
    { query: { enabled: !!token, queryKey: getGetParentChildrenQueryKey({ token: token || "" }) } }
  )

  useEffect(() => {
    if (error) {
      toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" })
      setLocation("/parent-login")
    }
  }, [error, setLocation, toast])

  const { state: pushState, subscribe, unsubscribe } = useWebPush({ parentToken: token })

  if (!token || isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!children || children.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 p-6 flex flex-col items-center">
        <Card className="w-full max-w-md mt-12 text-center py-10">
          <CardTitle className="mb-4">No Players Found</CardTitle>
          <CardDescription className="mb-6">We couldn't find any players linked to this email address.</CardDescription>
          <Button asChild><Link href="/join">Register a Player</Link></Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-6 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={`${BASE}/logo.png`} alt="KJIHC" className="h-8 w-auto" />
            <span className="font-display font-semibold hidden sm:inline">Parent Portal</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification toggle */}
            {pushState === "default" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/10 gap-1.5"
                onClick={subscribe}
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">Enable notifications</span>
              </Button>
            )}
            {pushState === "granted" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={unsubscribe}
                title="Notifications on — click to disable"
              >
                <BellRing className="h-4 w-4" />
              </Button>
            )}
            {pushState === "denied" && (
              <span title="Notifications blocked in browser settings" className="opacity-50 px-2">
                <BellOff className="h-4 w-4" />
              </span>
            )}
            <Button
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setLocation("/")}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Notification prompt — shown each session until enabled */}
      {pushState !== 'loading' && pushState !== 'granted' && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <NotificationPrompt
            state={pushState as PushState}
            onEnable={subscribe}
            onDisable={unsubscribe}
            dismissKey="kjihc_parent_notify_dismissed"
            theme="light"
          />
        </div>
      )}

      {/* Section navigation */}
      <div className="bg-card border-b shadow-sm overflow-x-auto">
        <div className="max-w-5xl mx-auto flex min-w-max">
          {([
            { id: "players",  icon: Users,         label: "My Players" },
            { id: "events",   icon: CalendarDays,  label: "Events" },
            { id: "messages", icon: MessageSquare, label: "Messages" },
            { id: "conduct",  icon: PenLine,       label: "Conduct" },
            { id: "status",   icon: AlertCircle,   label: "Status" },
            { id: "club-info",icon: ShieldCheck,   label: "Club Info" },
          ] as { id: Section; icon: React.ComponentType<{ className?: string }>; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                section === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto mt-8 px-4">
        {section === "players" && (
          <>
            <h1 className="text-2xl font-bold mb-6 font-display">Manage Your Players</h1>
            <Tabs defaultValue={children[0].id.toString()} className="w-full">
              <TabsList className="mb-6 bg-transparent h-auto p-0 flex-wrap justify-start gap-2">
                {children.map(child => (
                  <TabsTrigger
                    key={child.id}
                    value={child.id.toString()}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card text-foreground px-6 py-3 rounded-full text-base font-medium shadow-sm transition-all"
                  >
                    {child.playerName}
                  </TabsTrigger>
                ))}
              </TabsList>
              {children.map(child => (
                <TabsContent key={child.id} value={child.id.toString()} className="outline-none">
                  <ChildEditor child={child} token={token} />
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
        {section === "events" && (
          <EventsSection token={token} children={children} />
        )}
        {section === "messages" && (
          <MessagesSection token={token} />
        )}
        {section === "conduct" && (
          <ConductSection token={token} children={children} />
        )}
        {section === "status" && (
          <StatusSection children={children} token={token} />
        )}
        {section === "club-info" && (
          <ClubInfo />
        )}
      </main>
    </div>
  )
}

// ── Club Info ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href?: string
}) {
  const inner = (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <p className={cn("text-sm leading-snug", href ? "text-secondary font-medium" : "text-foreground")}>{value}</p>
      </div>
      {href && <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />}
    </div>
  )

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-muted/40 transition-colors rounded-lg px-1 -mx-1">
      {inner}
    </a>
  ) : (
    <div>{inner}</div>
  )
}

function ClubInfo() {
  const { data: fees, isLoading: feesLoading } = useListFees()

  return (
    <div className="space-y-6">
      {/* Club identity */}
      <div className="rounded-2xl bg-primary text-primary-foreground p-6 flex items-center gap-5 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
          <span className="font-display font-black text-xl text-secondary">KJIHC</span>
        </div>
        <div>
          <h2 className="font-display font-bold text-xl leading-tight">Kilmarnock Junior Ice Hockey Club</h2>
          <p className="text-primary-foreground/60 text-sm mt-1">Est. 1996 · Kilmarnock, Scotland</p>
        </div>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contact &amp; Location</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border pt-0">
          <InfoRow
            icon={MapPin}
            label="Home Rink"
            value="Galleon Centre, Titchfield Street, Kilmarnock, KA1 1QU"
            href="https://maps.google.com/?q=Galleon+Centre+Kilmarnock"
          />
          <InfoRow
            icon={Mail}
            label="Email"
            value="chairperson@kjihc.org"
            href="mailto:chairperson@kjihc.org"
          />
          <InfoRow
            icon={Facebook}
            label="Facebook"
            value="/kjihcuk"
            href="https://www.facebook.com/kjihcuk"
          />
        </CardContent>
      </Card>

      {/* Membership fees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Membership Fees</CardTitle>
          <CardDescription>Monthly fees paid by standing order</CardDescription>
        </CardHeader>
        <CardContent>
          {feesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : fees && fees.length > 0 ? (
            <div className="divide-y divide-border">
              {fees.map(fee => (
                <div key={fee.id} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium uppercase tracking-wide">{fee.feeGroup}</span>
                  <span className="text-lg font-bold text-secondary">£{fee.feeAmount}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Contact the club for fee information.</p>
          )}

          {/* Standing order note */}
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 flex gap-3">
            <CreditCard className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-1">Standing Order Payments</p>
              <p className="text-xs text-amber-700 leading-snug">
                Fees are paid monthly by standing order. Contact the club treasurer for bank account details and reference instructions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SIHA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">SIHA Registration</CardTitle>
          <CardDescription>Scottish Ice Hockey Association</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            All players must be registered with SIHA before competing. Your club administrator will contact you when registration is due.
          </p>
          <InfoRow
            icon={ShieldCheck}
            label="SIHA Website"
            value="www.siha-uk.co.uk"
            href="https://www.siha-uk.co.uk"
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ── Child editor (unchanged) ───────────────────────────────────────────────────

function ChildEditor({ child, token }: { child: MemberDetail, token: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const patchChild = useParentPatchChild()
  const { data: fees = [] } = useListFees()

  const form = useForm<z.infer<typeof editChildSchema>>({
    resolver: zodResolver(editChildSchema),
    defaultValues: {
      playerName: child.playerName,
      playerDob: child.playerDob ? child.playerDob.split('T')[0] : "",
      playerAddress1: child.playerAddress1 || "",
      playerAddress2: child.playerAddress2 || "",
      playerCity: child.playerCity || "",
      playerPost: child.playerPost || "",
      playerParent: child.playerParent || "",
      playerContactTel: child.playerContactTel || "",
      playerEmail: child.playerEmail || "",
      playerMedicalnotes: child.playerMedicalnotes || "",
      playerMedication: child.playerMedication || "",
      agreeFee: child.agreeFee || 0,
      agreeGdpr: child.agreeGdpr || 0,
      agreePhoto: child.agreePhoto || 0,
      readCode: child.readCode || 0,
    }
  })

  const onSubmit = (values: z.infer<typeof editChildSchema>) => {
    patchChild.mutate({
      id: child.id,
      data: { token, ...values }
    }, {
      onSuccess: () => {
        toast({ title: "Profile Updated", description: "Changes saved successfully." })
        queryClient.invalidateQueries({ queryKey: getGetParentChildrenQueryKey({ token }) })
      },
      onError: (err: any) => {
        toast({ title: "Update Failed", description: err.message || "An error occurred.", variant: "destructive" })
      }
    })
  }

  return (
    <Card className="shadow-md border-t-4 border-t-secondary">
      <CardHeader className="bg-muted/30 border-b pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl text-primary">{child.playerName}</CardTitle>
            <CardDescription className="text-sm mt-1">Age Group: <span className="font-semibold text-foreground">{child.ageGroup}</span></CardDescription>
          </div>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-center">
            <span className="block text-xs uppercase font-bold tracking-wider opacity-70">Monthly Fee</span>
            <span className="text-xl font-bold">£{
              (fees.find(f => f.feeGroup.toLowerCase() === child.ageGroup?.toLowerCase()) ??
               fees.find(f => f.id === child.playerFee))?.feeAmount ??
              child.playerFee ?? 0
            }</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold font-display border-b pb-2">Player Details</h3>
                <FormField control={form.control} name="playerName" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="playerDob" render={({ field }) => (
                  <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold font-display border-b pb-2">Contact Info</h3>
                <FormField control={form.control} name="playerParent" render={({ field }) => (
                  <FormItem><FormLabel>Parent/Guardian Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="playerContactTel" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="playerEmail" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold font-display border-b pb-2">Address</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="playerAddress1" render={({ field }) => (
                  <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="playerAddress2" render={({ field }) => (
                  <FormItem><FormLabel>Address Line 2</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="playerCity" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="playerPost" render={({ field }) => (
                  <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-4 bg-destructive/5 p-4 rounded-lg border border-destructive/20">
              <h3 className="text-lg font-semibold font-display text-destructive">Medical Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="playerMedicalnotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditions / Allergies</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ''} className="bg-background" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="playerMedication" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regular Medication</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ''} className="bg-background" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold font-display border-b pb-2">Consents</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="agreePhoto" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                    <FormControl>
                      <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Photography Consent</FormLabel>
                      <FormDescription>Allow photos/videos for club promotion.</FormDescription>
                    </div>
                  </FormItem>
                )} />

                <FormField control={form.control} name="agreeGdpr" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                    <FormControl>
                      <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>GDPR Consent</FormLabel>
                      <FormDescription>Allow data storage for club purposes.</FormDescription>
                    </div>
                  </FormItem>
                )} />

                <FormField control={form.control} name="readCode" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                    <FormControl>
                      <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Code of Conduct</FormLabel>
                      <FormDescription>Agree to the club Code of Conduct.</FormDescription>
                    </div>
                  </FormItem>
                )} />

                <FormField control={form.control} name="agreeFee" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                    <FormControl>
                      <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Fee Agreement</FormLabel>
                      <FormDescription>Agree to pay monthly fees on time.</FormDescription>
                    </div>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="flex justify-end border-t pt-6">
              <Button type="submit" size="lg" disabled={patchChild.isPending}>
                {patchChild.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
