import type { Member } from "@workspace/api-client-react"
import { getMedicalFlags, highestSeverity, type FlagSeverity } from "./medicalFlags"
import { ageGroupLabel } from "./ageGroups"

const SEVERITY_ORDER: Record<FlagSeverity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
}

const SEVERITY_COLOUR: Record<FlagSeverity, { bg: string; border: string; text: string; badge: string }> = {
  critical: { bg: "#fff5f5", border: "#fc8181", text: "#c53030", badge: "#fed7d7" },
  high:     { bg: "#fffaf0", border: "#f6ad55", text: "#c05621", badge: "#feebc8" },
  moderate: { bg: "#fffff0", border: "#f6e05e", text: "#975a16", badge: "#fefcbf" },
}

const SEVERITY_LABEL: Record<FlagSeverity, string> = {
  critical: "⚠ CRITICAL",
  high:     "▲ HIGH",
  moderate: "● MODERATE",
}

interface PlayerRow {
  name: string
  ageGroup: string
  severity: FlagSeverity
  flags: string[]
  notes: string
  medication: string
}

export function printMedicalSheet(
  members: Member[],
  sessionName: string,
  date: string,
  ageGroup: string,
) {
  // Collect only players with medical flags
  const rows: PlayerRow[] = []

  for (const m of members) {
    const flags = getMedicalFlags(m.playerMedicalnotes, m.playerMedication)
    if (!flags.length) continue
    const sev = highestSeverity(flags)!
    rows.push({
      name: m.playerName,
      ageGroup: m.ageGroup,
      severity: sev,
      flags: flags.map(f => f.label),
      notes: m.playerMedicalnotes?.trim() || "",
      medication: m.playerMedication?.trim() || "",
    })
  }

  // Sort by severity, then name
  rows.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.name.localeCompare(b.name)
  )

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : ""

  const playerRows = rows.length === 0
    ? `<tr><td colspan="4" style="padding:20px;text-align:center;color:#718096;font-style:italic;">
        No players in this group have medical notes recorded.
       </td></tr>`
    : rows.map(r => {
        const c = SEVERITY_COLOUR[r.severity]
        const badgeHtml = r.flags.map(f =>
          `<span style="display:inline-block;background:${c.badge};border:1px solid ${c.border};color:${c.text};border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:700;margin:2px 3px 2px 0;">${f}</span>`
        ).join("")
        const noteText = [r.notes, r.medication ? `Medication: ${r.medication}` : ""]
          .filter(Boolean).join(" — ")
        return `
          <tr style="background:${c.bg};border-left:4px solid ${c.border};">
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;">
              <strong style="font-size:14px;">${escHtml(r.name)}</strong>
            </td>
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;white-space:nowrap;">
              <span style="font-size:12px;color:${c.text};font-weight:700;">${SEVERITY_LABEL[r.severity]}</span>
            </td>
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;">
              ${badgeHtml}
            </td>
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;font-size:12px;color:#4a5568;">
              ${noteText ? escHtml(noteText) : '<em style="color:#a0aec0;">—</em>'}
            </td>
          </tr>`
      }).join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Medical Sheet — ${escHtml(sessionName || "Session")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #1a202c; background: #fff; font-size: 13px; }
    .page { max-width: 900px; margin: 0 auto; padding: 24px 28px; }
    .header { border-bottom: 3px solid #1a202c; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header .meta { display: flex; gap: 24px; margin-top: 6px; flex-wrap: wrap; }
    .header .meta span { font-size: 12px; color: #4a5568; }
    .header .meta strong { color: #1a202c; }
    .summary-bar { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .stat { border-radius: 6px; padding: 8px 14px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #2d3748; color: #fff; }
    thead th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #718096; display: flex; justify-content: space-between; }
    .no-print { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 16px; }
    .btn { padding: 8px 18px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-primary { background: #2b6cb0; color: #fff; }
    .btn-secondary { background: #e2e8f0; color: #2d3748; }
    @media print {
      .no-print { display: none !important; }
      .page { padding: 0; }
      body { font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="no-print">
      <button class="btn btn-secondary" onclick="window.close()">Close</button>
      <button class="btn btn-primary" onclick="window.print()">🖨 Print</button>
    </div>

    <div class="header">
      <h1>⚕ Medical Summary Sheet</h1>
      <div class="meta">
        <span><strong>Session:</strong> ${escHtml(sessionName || "—")}</span>
        <span><strong>Date:</strong> ${escHtml(formattedDate)}</span>
        <span><strong>Age Group:</strong> ${escHtml(ageGroupLabel(ageGroup))}</span>
        <span><strong>Printed:</strong> ${new Date().toLocaleString("en-GB")}</span>
      </div>
    </div>

    <div class="summary-bar">
      ${summaryStat(rows, "critical", "#c53030", "#fed7d7", "#fc8181")}
      ${summaryStat(rows, "high",     "#c05621", "#feebc8", "#f6ad55")}
      ${summaryStat(rows, "moderate", "#975a16", "#fefcbf", "#f6e05e")}
      <div class="stat" style="background:#f7fafc;border:1px solid #e2e8f0;color:#4a5568;">
        <strong style="color:#1a202c;">${rows.length}</strong> player${rows.length !== 1 ? "s" : ""} with medical notes (of ${members.length} total)
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:20%">Player</th>
          <th style="width:13%">Priority</th>
          <th style="width:30%">Flags</th>
          <th style="width:37%">Notes / Medication</th>
        </tr>
      </thead>
      <tbody>
        ${playerRows}
      </tbody>
    </table>

    <div class="footer">
      <span>KJIHC — Confidential medical information. For authorised staff only.</span>
      <span>Page 1</span>
    </div>
  </div>
  <script>
    // Auto-focus so Ctrl+P works immediately
    window.focus();
  </script>
</body>
</html>`

  const win = window.open("", "_blank", "width=960,height=700,menubar=no,toolbar=no,scrollbars=yes")
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site and try again.")
    return
  }
  win.document.write(html)
  win.document.close()
}

function summaryStat(
  rows: PlayerRow[],
  sev: FlagSeverity,
  textColor: string,
  bg: string,
  border: string,
): string {
  const count = rows.filter(r => r.severity === sev).length
  if (count === 0) return ""
  return `<div class="stat" style="background:${bg};border:1px solid ${border};color:${textColor};">
    <strong>${count}</strong> ${SEVERITY_LABEL[sev]}
  </div>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
