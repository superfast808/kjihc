import { useState } from "react"
import { useListMembers, useDeleteMember } from "@workspace/api-client-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getListMembersQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Trash2, AlertTriangle, Users, Clock } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

function fetchHousekeeping(path: string) {
  return fetch(`${BASE}/api${path}`, { credentials: "include" }).then(r => r.json())
}

function PlayerCard({ member, reason, onDelete }: { member: any; reason?: string; onDelete: (id: number) => void }) {
  const isMultiGroup = !!member.addAgeGroup

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold font-display">{member.playerName}</span>
          <Badge variant="outline" className="text-xs">{member.ageGroup}</Badge>
          {isMultiGroup && (
            <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-800 border-sky-200">
              Also: {member.addAgeGroup}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">ID #{member.id}</span>
        </div>
        <div className="text-sm text-muted-foreground mt-0.5 space-y-0.5">
          {member.playerDob && <span className="mr-3">DOB: {member.playerDob}</span>}
          {member.playerEmail && <span className="mr-3">{member.playerEmail}</span>}
          {member.lastSignin !== undefined && (
            <span className={member.lastSignin ? "text-amber-600" : "text-red-600 font-medium"}>
              {member.lastSignin ? `Last seen: ${member.lastSignin}` : "Never signed in"}
              {member.totalSignins !== undefined && ` (${member.totalSignins} sessions total)`}
            </span>
          )}
          {reason && <span className="block text-xs text-amber-700 font-medium mt-0.5">{reason}</span>}
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.playerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the player record. This cannot be undone.
              {isMultiGroup && (
                <span className="block mt-2 text-amber-700 font-medium">
                  Note: this player trains in multiple age groups — make sure you're removing the right record.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(member.id)}
            >
              Remove Player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function Housekeeping() {
  const [months, setMonths] = useState(3)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const deleteMember = useDeleteMember()

  const duplicatesQuery = useQuery({
    queryKey: ["housekeeping", "duplicates"],
    queryFn: () => fetchHousekeeping("/housekeeping/duplicates"),
  })

  const inactiveQuery = useQuery({
    queryKey: ["housekeeping", "inactive", months],
    queryFn: () => fetchHousekeeping(`/housekeeping/inactive?months=${months}`),
  })

  const handleDelete = (id: number, name: string) => {
    deleteMember.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Player removed", description: `${name} has been deleted.` })
        queryClient.invalidateQueries({ queryKey: ["housekeeping"] })
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to remove player.", variant: "destructive" })
      }
    })
  }

  const totalDuplicatePlayers = duplicatesQuery.data?.reduce(
    (sum: number, g: any) => sum + g.members.length, 0
  ) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Housekeeping</h1>
        <p className="text-muted-foreground mt-1">Identify and remove duplicate or inactive player records.</p>
      </div>

      <Tabs defaultValue="duplicates">
        <TabsList>
          <TabsTrigger value="duplicates" className="gap-2">
            <Users className="h-4 w-4" />
            Duplicates
            {duplicatesQuery.data && duplicatesQuery.data.length > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white text-xs px-1.5">{duplicatesQuery.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-2">
            <Clock className="h-4 w-4" />
            Inactive
            {inactiveQuery.data && (
              <Badge className="ml-1 bg-slate-400 text-white text-xs px-1.5">{inactiveQuery.data.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="mt-4">
          <Card>
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle className="text-lg font-display">Duplicate Records</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Players matched by same name + date of birth, or same name + email. A player training in two age groups is <strong>not</strong> a duplicate — they have one record with an additional age group set.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {duplicatesQuery.isLoading ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : !duplicatesQuery.data?.length ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">✓</div>
                  <p className="font-bold text-lg">No duplicates found</p>
                  <p className="text-muted-foreground text-sm mt-1">All player records appear to be unique.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {duplicatesQuery.data.map((group: any, i: number) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-sm font-semibold text-amber-700">{group.reason}</span>
                        <Badge variant="outline" className="text-xs">{group.members.length} records</Badge>
                      </div>
                      <div className="space-y-2 pl-6">
                        {group.members.map((m: any) => (
                          <PlayerCard
                            key={m.id}
                            member={m}
                            onDelete={(id) => handleDelete(id, m.playerName)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inactive Tab */}
        <TabsContent value="inactive" className="mt-4">
          <Card>
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <div>
                    <CardTitle className="text-lg font-display">Inactive Players</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Players with no sign-in record or last seen more than the selected number of months ago.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">No sign-in in</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={months}
                    onChange={e => setMonths(Number(e.target.value))}
                  >
                    <option value={1}>1 month</option>
                    <option value={2}>2 months</option>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {inactiveQuery.isLoading ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : !inactiveQuery.data?.length ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">✓</div>
                  <p className="font-bold text-lg">No inactive players</p>
                  <p className="text-muted-foreground text-sm mt-1">Everyone has a recent sign-in record.</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 bg-muted/30 border-b text-sm text-muted-foreground">
                    {inactiveQuery.data.length} player{inactiveQuery.data.length !== 1 ? "s" : ""} — review before deleting, some may just be taking a break
                  </div>
                  <div className="divide-y p-4 space-y-2">
                    {inactiveQuery.data.map((m: any) => (
                      <PlayerCard
                        key={m.id}
                        member={m}
                        onDelete={(id) => handleDelete(id, m.playerName)}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
