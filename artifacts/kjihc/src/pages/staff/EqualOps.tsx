import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Copy, Check } from "lucide-react"

const API_BASE = `${import.meta.env.BASE_URL}api`

const CATEGORY_LABELS: Record<string, string> = {
  minorityEthnic: "Minority ethnic",
  disabledChild: "Families with disabled child",
  threeOrMoreChildren: "Families with 3 or more children",
  childUnderOne: "Families with child under 1",
  motherUnder25: "Families with a mother aged under 25",
  youngCarer: "Young carers",
  careExperienced: "Care experienced people",
}

type CategoryRow = {
  field: string
  male: number
  female: number
  other: number
  prefer_not_gender: number
  no: number
  prefer_not: number
}

type Report = {
  totalResponses: number
  genderTotals: Record<string, number>
  categories: CategoryRow[]
}

export default function EqualOps() {
  const { data, isLoading } = useQuery<Report>({
    queryKey: ["equal-ops-report"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/equal-ops/report`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load report")
      return res.json()
    },
  })

  const [copied, setCopied] = React.useState(false)
  const surveyUrl = `${window.location.origin}${import.meta.env.BASE_URL}equal-ops`

  const copyLink = async () => {
    await navigator.clipboard.writeText(surveyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportCsv = () => {
    if (!data) return
    const headers = ["Category", "Male", "Female", "Other", "Prefer not to say (gender)", "Total yes"]
    const rows = data.categories.map((c) => [
      CATEGORY_LABELS[c.field] ?? c.field,
      String(c.male),
      String(c.female),
      String(c.other),
      String(c.prefer_not_gender),
      String(c.male + c.female + c.other + c.prefer_not_gender),
    ])
    const genderRow = [
      "All respondents (by gender)",
      String(data.genderTotals.male ?? 0),
      String(data.genderTotals.female ?? 0),
      String(data.genderTotals.other ?? 0),
      String(data.genderTotals.prefer_not ?? 0),
      String(data.totalResponses),
    ]
    const csv = [headers, genderRow, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `kjihc-equal-opportunities-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Equal Opportunities</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={copyLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />} Copy survey link
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportCsv}
            disabled={!data || data.totalResponses === 0}
          >
            <Download size={16} /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anonymous survey results</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading…"
              : `${data?.totalResponses ?? 0} anonymous response${data?.totalResponses === 1 ? "" : "s"} so far. Share the survey link with families — no login needed and nothing identifying is stored.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Male</TableHead>
                <TableHead className="text-right">Female</TableHead>
                <TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right">Not said</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-medium">
                <TableCell>All respondents (by gender)</TableCell>
                <TableCell className="text-right">{data?.genderTotals.male ?? 0}</TableCell>
                <TableCell className="text-right">{data?.genderTotals.female ?? 0}</TableCell>
                <TableCell className="text-right">{data?.genderTotals.other ?? 0}</TableCell>
                <TableCell className="text-right">{data?.genderTotals.prefer_not ?? 0}</TableCell>
                <TableCell className="text-right">{data?.totalResponses ?? 0}</TableCell>
              </TableRow>
              {data?.categories.map((c) => (
                <TableRow key={c.field}>
                  <TableCell>{CATEGORY_LABELS[c.field] ?? c.field}</TableCell>
                  <TableCell className="text-right">{c.male}</TableCell>
                  <TableCell className="text-right">{c.female}</TableCell>
                  <TableCell className="text-right">{c.other}</TableCell>
                  <TableCell className="text-right">{c.prefer_not_gender}</TableCell>
                  <TableCell className="text-right">
                    {c.male + c.female + c.other + c.prefer_not_gender}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            Counts show how many families answered "yes" in each category, split by the
            player's gender. Responses are fully anonymous, so figures can't be traced
            back to individual families.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
