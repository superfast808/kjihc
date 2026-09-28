import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { Receipt, Loader2, Search, X, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface FeePayment {
  id: number
  createdAt: string
  memberId: number
  memberName: string
  parentEmail: string
  amountPounds: string
  stripeSessionId: string | null
  notes: string | null
}

interface PaymentsResponse {
  total: number
  totalAmount: number
  page: number
  limit: number
  entries: FeePayment[]
}

function fetchPayments(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return fetch(`${BASE}/api/admin/fee-payments${qs ? "?" + qs : ""}`, {
    credentials: "include",
  }).then(r => r.json()) as Promise<PaymentsResponse>
}

export default function Transactions() {
  const [search, setSearch] = useState("")
  const [page, setPage]     = useState(1)
  const LIMIT = 50

  const queryParams: Record<string, string> = {
    page: String(page),
    limit: String(LIMIT),
  }

  const { data, isLoading } = useQuery({
    queryKey: ["fee-payments", page],
    queryFn: () => fetchPayments(queryParams),
  })

  const entries = data?.entries ?? []
  const total   = data?.total ?? 0
  const totalAmount = data?.totalAmount ?? 0
  const totalPages  = Math.max(1, Math.ceil(total / LIMIT))

  // Client-side search over loaded page
  const filtered = search.trim()
    ? entries.filter(e =>
        e.memberName.toLowerCase().includes(search.toLowerCase()) ||
        e.parentEmail.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Receipt className="h-7 w-7" /> Fee Payment History
        </h1>
        <p className="text-muted-foreground mt-1">All online fee payments made through the parent portal.</p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total payments</p>
        </div>
        <div className="rounded-xl border bg-green-50 border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">£{totalAmount.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-1">Total collected</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by player or email…"
          className="pl-9 pr-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
          {search ? "No payments match your search." : "No payments recorded yet."}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Player</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Parent email</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden md:table-cell">Stripe</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(e => {
                const dt = parseISO(e.createdAt)
                return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span title={format(dt, "dd MMM yyyy HH:mm")} className="cursor-default">
                        {formatDistanceToNow(dt, { addSuffix: true })}
                      </span>
                      <p className="text-xs text-muted-foreground">{format(dt, "dd MMM yyyy")}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{e.memberName}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.parentEmail}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700">
                      £{parseFloat(e.amountPounds).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {e.stripeSessionId ? (
                        <a
                          href={`https://dashboard.stripe.com/payments/${e.stripeSessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink size={11} /> View
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
