import { useListEnsignEntries, useUpdateEnsignPayment, getListEnsignEntriesQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Mail, Phone, ExternalLink } from "lucide-react"

export default function Ensign() {
  const { data: entries, isLoading } = useListEnsignEntries()
  const updatePayment = useUpdateEnsignPayment()
  const queryClient = useQueryClient()

  const handleStatusChange = (id: number, newStatus: number) => {
    updatePayment.mutate({ id, data: { paymentStatus: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEnsignEntriesQueryKey() })
      }
    })
  }

  const getStatusBadge = (status: number) => {
    switch(status) {
      case 2: return <Badge className="bg-green-500 hover:bg-green-600">Fully Paid</Badge>
      case 1: return <Badge className="bg-yellow-500 hover:bg-yellow-600">Deposit Paid</Badge>
      default: return <Badge variant="destructive">Pending</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-3">
            <Trophy className="text-accent" /> Ensign Ewart Tournament
          </h1>
          <p className="text-muted-foreground mt-1">Manage team entries and payment status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 animate-pulse">Loading entries...</div>
        ) : entries?.length === 0 ? (
          <div className="col-span-full bg-card p-12 text-center rounded-xl border border-dashed">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-xl font-medium text-muted-foreground">No entries yet</h3>
          </div>
        ) : (
          entries?.map(entry => (
            <Card key={entry.id} className="overflow-hidden border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/10 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription className="uppercase tracking-wider font-semibold text-xs mb-1 text-secondary">{entry.ageGroup}</CardDescription>
                    <CardTitle className="text-2xl font-display">{entry.clubName}</CardTitle>
                    <p className="font-medium text-muted-foreground">{entry.teamName}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    {getStatusBadge(entry.paymentStatus)}
                    <select 
                      className="text-xs border rounded p-1 bg-background"
                      value={entry.paymentStatus}
                      onChange={(e) => handleStatusChange(entry.id, parseInt(e.target.value))}
                      disabled={updatePayment.isPending}
                    >
                      <option value="0">Set: Pending</option>
                      <option value="1">Set: Deposit</option>
                      <option value="2">Set: Paid</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x border-b">
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Manager</p>
                    <p className="font-medium text-sm">{entry.managerName || 'Not provided'}</p>
                    {entry.managerEmail && (
                      <a href={`mailto:${entry.managerEmail}`} className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                        <Mail size={12} /> {entry.managerEmail}
                      </a>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Booking Contact</p>
                    <p className="font-medium text-sm">{entry.bookingContactName || 'Not provided'}</p>
                    {entry.bookingContactPhone && (
                      <a href={`tel:${entry.bookingContactPhone}`} className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                        <Phone size={12} /> {entry.bookingContactPhone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-muted/5 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Submitted: {new Date(entry.createdAt).toLocaleDateString()}</span>
                  <button className="text-primary font-medium flex items-center gap-1 hover:underline">
                    Full Details <ExternalLink size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
