import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSubmitJoin } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Link } from "wouter"
import { useListFees, useListHejaCodes } from "@workspace/api-client-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const joinSchema = z.object({
  playerName: z.string().min(2, "Player name is required"),
  playerDob: z.string().min(1, "Date of birth is required"),
  ageGroup: z.string().min(1, "Age group is required"),
  playerAddress1: z.string().min(5, "Address line 1 is required"),
  playerAddress2: z.string().optional(),
  playerCity: z.string().min(2, "City is required"),
  playerPost: z.string().min(4, "Postcode is required"),
  playerParent: z.string().min(2, "Parent/Guardian name is required"),
  playerContactTel: z.string().min(8, "Valid phone number is required"),
  playerEmail: z.string().email("Valid email is required"),
  playerMedicalnotes: z.string().optional(),
  playerMedication: z.string().optional(),
  playerFee: z.coerce.number(),
  agreeFee: z.number().min(1, "You must agree to the fee structure"),
  agreeGdpr: z.number().min(1, "You must agree to the GDPR policy"),
  agreePhoto: z.number(), // 0 or 1
  readCode: z.number().min(1, "You must agree to the Code of Conduct"),
})

const steps = [
  { id: "welcome", title: "Welcome" },
  { id: "player", title: "Player Details" },
  { id: "parent", title: "Parent/Guardian" },
  { id: "medical", title: "Medical Info" },
  { id: "consents", title: "Consents & Fees" },
]

export default function JoinWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toast } = useToast()
  
  const submitJoin = useSubmitJoin()
  const { data: fees = [] } = useListFees()

  const { data: hejaCodes = [] } = useListHejaCodes()
  const { data: clubInfo } = useQuery<Record<string, string>>({
    queryKey: ["club-info"],
    queryFn: () => fetch(`${BASE}/api/join/club-info`).then(r => r.json()),
  })
  const [submittedGroup, setSubmittedGroup] = useState("")

  const form = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      playerName: "",
      playerDob: "",
      ageGroup: "",
      playerAddress1: "",
      playerAddress2: "",
      playerCity: "",
      playerPost: "",
      playerParent: "",
      playerContactTel: "",
      playerEmail: "",
      playerMedicalnotes: "",
      playerMedication: "",
      playerFee: 0,
      agreeFee: 0,
      agreeGdpr: 0,
      agreePhoto: 0,
      readCode: 0,
    },
  })

  const processNext = async () => {
    let fieldsToValidate: any[] = []
    
    if (currentStep === 1) {
      fieldsToValidate = ['playerName', 'playerDob', 'ageGroup', 'playerAddress1', 'playerCity', 'playerPost']
    } else if (currentStep === 2) {
      fieldsToValidate = ['playerParent', 'playerContactTel', 'playerEmail']
    } else if (currentStep === 3) {
      // no strictly required fields here if left blank, but we trigger trigger() just in case
      fieldsToValidate = ['playerMedicalnotes', 'playerMedication']
    }

    if (fieldsToValidate.length > 0) {
      const isValid = await form.trigger(fieldsToValidate)
      if (!isValid) return
    }

    setCurrentStep(s => Math.min(s + 1, steps.length - 1))
  }

  const onSubmit = (values: z.infer<typeof joinSchema>) => {
    setSubmittedGroup(values.ageGroup)
    submitJoin.mutate({ data: values }, {
      onSuccess: () => {
        setIsSuccess(true)
        window.scrollTo(0, 0)
      },
      onError: (err: any) => {
        toast({
          title: "Registration Failed",
          description: err.message || "An error occurred. Please try again.",
          variant: "destructive",
        })
      }
    })
  }

  if (isSuccess) {
    const teamCode = hejaCodes.find(c =>
      c.codeGroup?.toLowerCase().includes(submittedGroup.toLowerCase()) ||
      submittedGroup.toLowerCase().includes(c.codeGroup?.toLowerCase() ?? "")
    )?.codeCode
    const mainCode = hejaCodes.find(c => c.codeGroup?.toLowerCase().includes("main"))?.codeCode
    const isLTP = ["ltp", "lightning", "u10"].includes(submittedGroup.toLowerCase())

    const kitItems = isLTP
      ? ["Helmet with full cage (mandatory — no open cage)", "Neck guard", "Shoulder pads", "Elbow pads", "Hockey gloves", "Shin pads with knee caps", "Skates (figure skates are fine to start)", "Junior hockey stick", "Comfortable sports clothing underneath"]
      : ["Helmet with full cage", "Neck guard", "Shoulder pads", "Elbow pads", "Hockey gloves", "Shin pads", "Jock / girdle", "Skates", "Hockey stick"]

    return (
      <div className="min-h-screen py-12 px-4" style={{ background: "#f0f4f8" }}>
        <div className="max-w-xl mx-auto space-y-5">

          {/* Header */}
          <div className="text-center">
            <Link href="/"><img src={`${BASE}/logo.png`} alt="KJIHC" className="h-12 w-auto mx-auto mb-6" /></Link>
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="text-3xl font-black font-display text-primary">You're registered!</h1>
            <p className="text-muted-foreground mt-2">Welcome to Kilmarnock Junior Ice Hockey Club. A confirmation email is on its way.</p>
          </div>

          {/* Heja */}
          <Card className="overflow-hidden">
            <div className="bg-primary px-5 py-3">
              <h2 className="text-white font-bold text-base">📱 Download Heja — your team app</h2>
            </div>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">Heja is how the club shares session times, cancellations and team news. Download it now:</p>
              <div className="flex gap-3">
                <a href="https://apps.apple.com/app/heja-team-sports-app/id1041817956" target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-foreground/10 bg-black text-white py-3 text-sm font-bold hover:opacity-90 transition-opacity">
                  <span className="text-lg"></span> App Store
                </a>
                <a href="https://play.google.com/store/apps/details?id=com.heja.android" target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-foreground/10 bg-[#01875f] text-white py-3 text-sm font-bold hover:opacity-90 transition-opacity">
                  <span className="text-lg">▶</span> Google Play
                </a>
              </div>
              {(teamCode || mainCode) && (
                <div className="space-y-3 pt-2 border-t">
                  {teamCode && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your team join code</p>
                      <p className="text-3xl font-black font-mono tracking-[0.25em] text-primary">{teamCode}</p>
                    </div>
                  )}
                  {mainCode && mainCode !== teamCode && (
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Also join the main club group</p>
                      <p className="text-2xl font-black font-mono tracking-[0.2em] text-foreground">{mainCode}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kit list */}
          <Card className="overflow-hidden">
            <div className="bg-accent px-5 py-3">
              <h2 className="text-white font-bold text-base">🏒 {isLTP ? "Starter Kit — what to bring" : "Kit list"}</h2>
            </div>
            <CardContent className="p-5">
              {isLTP && <p className="text-sm text-muted-foreground mb-3">Second-hand gear is perfectly fine! Ask your coach if you're unsure about sizing.</p>}
              <ul className="space-y-2">
                {kitItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {!isLTP && <p className="text-xs text-muted-foreground mt-3">Your KJIHC jersey will be confirmed by your coach.</p>}
            </CardContent>
          </Card>

          {/* Bank / standing order */}
          <Card className="overflow-hidden">
            <div className="bg-emerald-700 px-5 py-3">
              <h2 className="text-white font-bold text-base">🏦 Monthly fees — standing order</h2>
            </div>
            <CardContent className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">Please set up a standing order to arrive by the <strong>5th of each month</strong>.</p>
              {clubInfo?.bank_sort_code ? (
                <div className="rounded-lg border divide-y text-sm overflow-hidden">
                  {[
                    ["Account Name", clubInfo.bank_account_name],
                    ["Sort Code", clubInfo.bank_sort_code],
                    ["Account Number", clubInfo.bank_account_number],
                    ["Reference", clubInfo.bank_reference_hint],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex px-4 py-2.5 bg-background">
                      <span className="w-36 text-muted-foreground shrink-0">{label}</span>
                      <span className="font-mono font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Bank details will be sent by your coach shortly. Fees are due by the 5th of each month.
                </p>
              )}
            </CardContent>
          </Card>

          {/* SIHA fee notice */}
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
            <span className="text-xl leading-snug">🏒</span>
            <div>
              <p className="font-bold text-amber-900">SIHA Registration Fee</p>
              <p className="text-amber-800 mt-1">A one-off Scottish Ice Hockey Association registration fee also applies. Your team manager will be in touch with the details.</p>
            </div>
          </div>

          {/* Facebook + portal */}
          <div className="grid grid-cols-2 gap-3">
            <a href="https://www.facebook.com/kjihcuk" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1877f2] text-white py-4 font-bold text-sm hover:opacity-90 transition-opacity">
              <span className="text-lg">f</span> Follow on Facebook
            </a>
            <a href="https://join.kjihc.org/parent-login"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-primary text-primary py-4 font-bold text-sm hover:bg-primary/5 transition-colors">
              👤 Parent Portal
            </a>
          </div>

          <div className="text-center pb-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Return to homepage</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 md:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <img src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/logo.png`} alt="KJIHC" className="h-12 w-auto" />
          </Link>
        </div>

        <div className="mb-8 hidden md:block">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step.id} className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200 ${
                  i < currentStep ? "bg-primary text-primary-foreground" :
                  i === currentStep ? "bg-accent text-accent-foreground ring-4 ring-accent/20" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs mt-2 font-medium ${i <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.title}
                </span>
              </div>
            ))}
            <div className="absolute left-[10%] right-[10%] h-1 bg-muted -z-10 top-4 rounded-full">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full" 
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <Card className="w-full border-primary/10 shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              
              {currentStep === 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader>
                    <CardTitle className="text-2xl text-primary">Join KJIHC</CardTitle>
                    <CardDescription>
                      Welcome! We're excited to have you join the Kilmarnock Junior Ice Hockey Club.
                      This form will collect player details, medical information, and required consents.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">
                      Please ensure all information provided is accurate, particularly medical details, as this is critical for player safety.
                    </p>
                    <p className="text-sm">
                      The process takes about 5 minutes.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button type="button" onClick={processNext} className="w-full h-12 text-lg font-display">Get Started</Button>
                  </CardFooter>
                </div>
              )}

              {currentStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <CardHeader>
                    <CardTitle className="text-xl">Player Details</CardTitle>
                    <CardDescription>Basic information about the player.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="playerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Player Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="playerDob" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="ageGroup" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age Group</FormLabel>
                          <FormControl>
                            <select 
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              {...field}
                            >
                              <option value="">Select group...</option>
                              <option value="LTP">Learn to Play (LTP)</option>
                              <option value="U10">Under 10</option>
                              <option value="U12">Under 12</option>
                              <option value="U14">Under 14</option>
                              <option value="U16">Under 16</option>
                              <option value="U19">Under 19</option>
                              <option value="Lightning">Lightning (Girls)</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-semibold text-sm text-muted-foreground">Player Address</h4>
                      <FormField control={form.control} name="playerAddress1" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="playerAddress2" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2 (Optional)</FormLabel>
                          <FormControl><Input placeholder="Apartment, suite, etc." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="playerCity" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Town / City</FormLabel>
                            <FormControl><Input placeholder="Kilmarnock" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="playerPost" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postcode</FormLabel>
                            <FormControl><Input placeholder="KA1 1AA" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)}>Back</Button>
                    <Button type="button" onClick={processNext}>Continue</Button>
                  </CardFooter>
                </div>
              )}

              {currentStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <CardHeader>
                    <CardTitle className="text-xl">Parent/Guardian Details</CardTitle>
                    <CardDescription>Primary contact for the club.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="playerParent" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent/Guardian Name</FormLabel>
                        <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="playerContactTel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Telephone</FormLabel>
                        <FormControl><Input type="tel" placeholder="07700 900000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="playerEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
                        <FormDescription>Used for club communications and portal access.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)}>Back</Button>
                    <Button type="button" onClick={processNext}>Continue</Button>
                  </CardFooter>
                </div>
              )}

              {currentStep === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <CardHeader>
                    <CardTitle className="text-xl text-destructive flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                      Medical Information
                    </CardTitle>
                    <CardDescription>Important safety information for coaches and staff.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-destructive/10 rounded-md border border-destructive/20 text-sm mb-4">
                      Please provide comprehensive details about any medical conditions, allergies, or requirements. Leave blank if none.
                    </div>
                    
                    <FormField control={form.control} name="playerMedicalnotes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Conditions / Allergies</FormLabel>
                        <FormControl>
                          <Textarea placeholder="E.g., Asthma, peanut allergy..." className="min-h-[100px]" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="playerMedication" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regular Medication</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Details of any medication the player requires..." className="min-h-[100px]" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)}>Back</Button>
                    <Button type="button" onClick={processNext}>Continue</Button>
                  </CardFooter>
                </div>
              )}

              {currentStep === 4 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <CardHeader>
                    <CardTitle className="text-xl">Consents & Agreements</CardTitle>
                    <CardDescription>Final step. Please review and agree to club policies.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Fee Selection */}
                    <div className="space-y-3 bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold text-primary">Monthly Fee Selection</h4>
                      <FormField control={form.control} name="playerFee" render={({ field }) => (
                        <FormItem className="space-y-3">
                          <RadioGroup 
                            onValueChange={(val) => {
                              const selected = fees.find(f => f.id.toString() === val)
                              field.onChange(selected ? parseInt(selected.feeAmount) : parseInt(val))
                            }} 
                            defaultValue={field.value ? field.value.toString() : ""}
                            className="flex flex-col space-y-1"
                          >
                            {fees.length > 0 ? fees.map((fee) => (
                              <FormItem key={fee.id} className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={fee.id.toString()} />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {fee.feeGroup} - <span className="font-bold">{fee.feeAmount}</span>
                                </FormLabel>
                              </FormItem>
                            )) : (
                              <p className="text-sm text-muted-foreground">Loading fee options...</p>
                            )}
                          </RadioGroup>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* SIHA registration fee notice */}
                    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                      <span className="text-lg leading-snug">🏒</span>
                      <div>
                        <p className="font-semibold text-amber-900">SIHA Registration Fee</p>
                        <p className="text-amber-800 mt-0.5">A one-off Scottish Ice Hockey Association registration fee also applies. Your team manager will be in touch with details once your registration is confirmed.</p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <FormField control={form.control} name="agreeFee" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                          <FormControl>
                            <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>I agree to pay the monthly fees</FormLabel>
                            <FormDescription>Fees are due on the 1st of each month.</FormDescription>
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
                            <FormDescription>I have read and agree to the club Code of Conduct.</FormDescription>
                          </div>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="agreeGdpr" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                          <FormControl>
                            <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Data Protection (GDPR)</FormLabel>
                            <FormDescription>I consent to the club storing my data for membership purposes.</FormDescription>
                          </div>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="agreePhoto" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                          <FormControl>
                            <Checkbox checked={field.value === 1} onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Photography Consent</FormLabel>
                            <FormDescription>I consent to photos/videos of the player being used for club promotion.</FormDescription>
                          </div>
                        </FormItem>
                      )} />
                    </div>

                  </CardContent>
                  <CardFooter className="flex justify-between pt-6 border-t mt-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)} disabled={submitJoin.isPending}>Back</Button>
                    <Button type="submit" disabled={submitJoin.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
                      {submitJoin.isPending ? "Submitting..." : "Complete Registration"}
                    </Button>
                  </CardFooter>
                </div>
              )}

            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}
