import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  FileText, FileSpreadsheet, Presentation, Download, ExternalLink,
  Upload, Trash2, Loader2, Plus, X, FilePlus,
} from "lucide-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface Doc {
  id: number
  title: string
  objectPath: string
  mimeType: string
  fileSize: number | null
  uploadedBy: string | null
  createdAt: string
}

const MIME_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  "application/pdf": {
    label: "PDF", Icon: FileText,
    color: "bg-red-100 text-red-700 group-hover:bg-red-600 group-hover:text-white",
  },
  "application/msword": {
    label: "Word", Icon: FileText,
    color: "bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    label: "Word", Icon: FileText,
    color: "bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white",
  },
  "application/vnd.ms-excel": {
    label: "Excel", Icon: FileSpreadsheet,
    color: "bg-green-100 text-green-700 group-hover:bg-green-600 group-hover:text-white",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    label: "Excel", Icon: FileSpreadsheet,
    color: "bg-green-100 text-green-700 group-hover:bg-green-600 group-hover:text-white",
  },
  "application/vnd.ms-powerpoint": {
    label: "PPT", Icon: Presentation,
    color: "bg-orange-100 text-orange-700 group-hover:bg-orange-600 group-hover:text-white",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    label: "PPT", Icon: Presentation,
    color: "bg-orange-100 text-orange-700 group-hover:bg-orange-600 group-hover:text-white",
  },
}

function formatBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function openDocument(id: number) {
  // Open in a new tab — PDFs will render inline, Word/Excel will download
  window.open(`${BASE}/api/documents/${id}/download`, "_blank", "noopener,noreferrer")
}

// ── Upload dialog ──────────────────────────────────────────────────────────────

function UploadDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle]     = useState("")
  const [file, setFile]       = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast }      = useToast()
  const queryClient    = useQueryClient()

  async function handleUpload() {
    if (!title.trim() || !file) return
    setUploading(true)
    try {
      // 1. Get presigned upload URL
      const urlRes = await fetch(`${BASE}/api/documents/upload-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      })
      if (!urlRes.ok) {
        const { error } = await urlRes.json().catch(() => ({}))
        throw new Error(error ?? "Could not get upload URL")
      }
      const { uploadUrl, objectPath, mimeType } = await urlRes.json()

      // 2. PUT file directly to storage
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error("Upload to storage failed")

      // 3. Create the document record
      const docRes = await fetch(`${BASE}/api/documents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), objectPath, mimeType, fileSize: file.size }),
      })
      if (!docRes.ok) throw new Error("Failed to save document record")

      await queryClient.invalidateQueries({ queryKey: ["documents"] })
      toast({ title: "Document uploaded", description: title.trim() })
      onClose()
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Please try again.", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <FilePlus size={20} /> Upload Document
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Club Constitution 2025"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">File</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              {file ? (
                <div className="space-y-1">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div className="space-y-1 text-muted-foreground">
                  <Upload size={24} className="mx-auto" />
                  <p className="text-sm">Click to choose a file</p>
                  <p className="text-xs">PDF, Word, Excel, PowerPoint — up to 25 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""))
              }}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button
            onClick={handleUpload}
            disabled={!title.trim() || !file || uploading}
            className="gap-2"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Documents() {
  const { toast }   = useToast()
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: staffMe } = useQuery({
    queryKey: ["staff-me-docs"],
    queryFn: () => fetch(`${BASE}/api/staff/me`, { credentials: "include" }).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })
  const isSuperUser = staffMe?.staffLevel === "1"

  const { data: docs = [], isLoading } = useQuery<Doc[]>({
    queryKey: ["documents"],
    queryFn: () => fetch(`${BASE}/api/documents`, { credentials: "include" }).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!r.ok) throw new Error()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      toast({ title: "Document removed" })
    },
    onError: () => toast({ title: "Could not delete document", variant: "destructive" }),
    onSettled: () => setDeletingId(null),
  })

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Remove "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    deleteMutation.mutate(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Useful Documents</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Club policies, forms, and procedural documents for KJIHC staff and coaches.
          </p>
        </div>
        {isSuperUser && (
          <Button onClick={() => setShowUpload(true)} className="gap-2 shrink-0">
            <Plus size={16} /> Upload Document
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-xl text-muted-foreground">
          <FileText className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-medium">No documents uploaded yet</p>
          {isSuperUser && (
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowUpload(true)}>
              <Plus size={14} /> Upload the first document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => {
            const meta = MIME_META[doc.mimeType] ?? {
              label: "File", Icon: FileText,
              color: "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground",
            }
            const { Icon } = meta
            const isDeleting = deletingId === doc.id

            return (
              <div key={doc.id} className="relative group">
                <Card
                  className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => openDocument(doc.id)}
                >
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${meta.color}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-medium">
                        <span className="bg-muted px-2 py-0.5 rounded uppercase">{meta.label}</span>
                        {doc.fileSize && <span>{formatBytes(doc.fileSize)}</span>}
                      </div>
                    </div>
                    <Download
                      size={16}
                      className="text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                    />
                  </CardContent>
                </Card>

                {isSuperUser && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(doc.id, doc.title) }}
                    disabled={isDeleting}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove document"
                  >
                    {isDeleting
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* External Links */}
      <h2 className="text-2xl font-display font-bold mt-8 mb-4">External Links</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="https://www.scottishicehockey.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div>
            <h4 className="font-bold text-primary">Scottish Ice Hockey (SIH)</h4>
            <p className="text-sm text-muted-foreground">Governing body portal</p>
          </div>
          <ExternalLink size={20} className="text-muted-foreground" />
        </a>
        <a
          href="https://www.galleoncentre.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div>
            <h4 className="font-bold text-primary">Ice Arena Booking</h4>
            <p className="text-sm text-muted-foreground">Galleon Centre ice time</p>
          </div>
          <ExternalLink size={20} className="text-muted-foreground" />
        </a>
      </div>

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}
    </div>
  )
}
