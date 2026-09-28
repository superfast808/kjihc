import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRequestParentLink } from "@workspace/api-client-react"
import { useUser } from "@clerk/react"
import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Link } from "wouter"
import { Loader2, ArrowRight } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

export default function ParentLogin() {
  const requestLink = useRequestParentLink()
  const { isSignedIn, user } = useUser()
  const [, setLocation] = useLocation()
  const [staffParentPending, setStaffParentPending] = useState(false)
  const [staffParentError, setStaffParentError] = useState<string | null>(null)

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    requestLink.mutate({ data: values })
  }

  // Staff members who are also parents can bypass the magic-link flow
  const handleStaffParentAccess = async () => {
    setStaffParentPending(true)
    setStaffParentError(null)
    try {
      const res = await fetch("/api/parent/staff-parent-access", { method: "POST" })
      const body = await res.json()
      if (!res.ok) {
        setStaffParentError(body.error ?? "Something went wrong. Please try again.")
        return
      }
      setLocation(`/parent?token=${encodeURIComponent(body.token)}`)
    } catch {
      setStaffParentError("Could not connect to the server. Please try again.")
    } finally {
      setStaffParentPending(false)
    }
  }

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Link href="/">
            <img src={`${BASE}/logo.png`} alt="KJIHC" className="h-16 w-auto" />
          </Link>
        </div>

        {/* ── Staff-who-are-parents shortcut ───────────────────────────────── */}
        {isSignedIn && (
          <Card className="shadow-lg border-t-4 border-t-primary mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Continue as a Parent</CardTitle>
              <CardDescription>
                You're signed in as{" "}
                <span className="font-semibold text-foreground">
                  {user.primaryEmailAddress?.emailAddress}
                </span>
                . If that email is linked to a registered player, you can access
                the parent portal directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {staffParentError && (
                <p className="text-sm text-destructive mb-3">{staffParentError}</p>
              )}
              <Button
                className="w-full"
                onClick={handleStaffParentAccess}
                disabled={staffParentPending}
              >
                {staffParentPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Access Parent Portal
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Magic-link form ───────────────────────────────────────────────── */}
        <Card className="shadow-lg border-t-4 border-t-secondary">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              {isSignedIn ? "Or sign in with a different email" : "Parent Portal Login"}
            </CardTitle>
            <CardDescription>
              Enter the email address you registered with to receive a magic sign-in link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestLink.isSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 text-sm text-center">
                <p className="font-semibold mb-1">Check your inbox!</p>
                <p>If an account exists for that email, we've sent a magic link to sign in.</p>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => requestLink.reset()}
                >
                  Try another email
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input placeholder="jane@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 text-base bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={requestLink.isPending}
                  >
                    {requestLink.isPending ? "Sending..." : "Send Magic Link"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t py-4">
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{" "}
              <Link href="/join" className="text-secondary font-medium hover:underline">
                Register a player
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
