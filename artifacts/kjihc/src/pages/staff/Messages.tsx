import {
  useState, useRef, useEffect, useMemo, useCallback,
  type KeyboardEvent, type DragEvent, type ChangeEvent,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useListStaff, useListMembers } from '@workspace/api-client-react'
import {
  useListChannels, useCreateChannel,
  useListMessages, useCreateMessage, useGetThread,
  useToggleReaction, useRequestUploadUrl,
  useMessageStream, messagesQueryKey,
  type Channel, type ChatMessage, type Attachment,
  type StreamEvent,
} from '@workspace/api-client-react'
import {
  Hash, Megaphone, User, Users, Plus, X, Send, Paperclip, ArrowLeft,
  ChevronRight, MessageSquare, Loader2, ImageIcon, Shield, SmilePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '😮']

const AGE_GROUP_LABELS: Record<string, string> = {
  LTP: 'LTP', u10: 'U10', u12: 'U12', u14: 'U14',
  u16: 'U16', u19: 'U19', lightning: 'Lightning',
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function channelDisplayName(ch: Channel) {
  if (ch.ageGroup) return `${AGE_GROUP_LABELS[ch.ageGroup] ?? ch.ageGroup} Notice Board`
  return ch.name || 'Unnamed'
}

// ── DM enrichment types ───────────────────────────────────────────────────────

interface DmMember { email: string; playerParent: string | null; children: string[] }
type EnrichedChannel = Channel & { dmMembers?: DmMember[] }

function dmNames(ch: EnrichedChannel): { name: string; sub: string } {
  if (ch.type !== 'direct') return { name: channelDisplayName(ch), sub: '' }
  const dm = (ch.dmMembers ?? [])[0]
  const name = dm?.playerParent || ch.name || 'Unknown'
  const sub  = dm?.children.join(', ') ?? ''
  return { name, sub }
}

// ── LocalStorage unread tracking ──────────────────────────────────────────────

const LS_KEY = 'kjihc_msg_last_seen'
function getLastSeen(): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}
function markSeen(channelId: number) {
  const m = getLastSeen(); m[channelId] = new Date().toISOString()
  localStorage.setItem(LS_KEY, JSON.stringify(m))
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <X size={28} />
      </button>
      <img
        src={src}
        alt="Attachment"
        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── Attachment thumbnail ───────────────────────────────────────────────────────

function AttachmentThumb({ att, onLightbox }: { att: Attachment; onLightbox: (src: string) => void }) {
  const src = `/api/storage/objects/${att.objectPath.replace(/^\/+/, '')}`
  if (att.mimeType.startsWith('image/')) {
    return (
      <button
        className="mt-1 block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity"
        onClick={() => onLightbox(src)}
        title={att.fileName}
      >
        <img
          src={src}
          alt={att.fileName}
          className="max-h-48 max-w-xs object-cover"
          loading="lazy"
        />
      </button>
    )
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-2 text-xs text-secondary underline"
    >
      <ImageIcon size={14} /> {att.fileName}
    </a>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  staffById,
  channelType,
  onReact,
  onThreadOpen,
  onLightbox,
}: {
  msg: ChatMessage
  staffById: Record<string, string>
  channelType: Channel['type']
  onReact: (messageId: number, emoji: string) => void
  onThreadOpen: (msg: ChatMessage) => void
  onLightbox: (src: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const senderName = msg.senderStaffId
    ? (staffById[msg.senderStaffId] ?? msg.senderName ?? 'Staff')
    : (msg.senderName || msg.senderParentId?.split('@')[0] || 'Parent')

  const isAnnouncement = channelType === 'noticeboard' && !msg.parentMessageId
  const hasReactions = Object.keys(msg.reactions ?? {}).length > 0

  function onMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShowPicker(true), 200)
  }
  function onMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShowPicker(false), 400)
  }

  return (
    <div
      className={cn(
        'group relative px-4 py-2 hover:bg-muted/40 rounded-lg',
        isAnnouncement && 'border-l-4 border-l-primary bg-primary/5 px-4 py-3 rounded-l-none rounded-r-xl mb-1',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {isAnnouncement && (
        <div className="flex items-center gap-1.5 mb-1">
          <Megaphone size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Notice</span>
        </div>
      )}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold select-none">
          {getInitials(senderName)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm text-foreground">{senderName}</span>
            <span className="text-[11px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
            {msg.replyCount > 0 && (
              <button
                className="ml-1 flex items-center gap-1 text-[11px] text-secondary hover:underline"
                onClick={() => onThreadOpen(msg)}
              >
                <MessageSquare size={11} />
                {msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Content */}
          {msg.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {msg.content}
            </p>
          )}

          {/* Attachments */}
          {msg.attachments?.map((att: Attachment) => (
            <AttachmentThumb key={att.id} att={att} onLightbox={onLightbox} />
          ))}

          {/* Reactions */}
          {hasReactions && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(msg.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 border border-border text-xs transition-colors"
                >
                  <span>{emoji}</span>
                  <span className="text-muted-foreground font-medium">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover action bar */}
      {showPicker && (
        <div
          className="absolute right-3 -top-4 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-md px-1 py-0.5 z-10"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {QUICK_REACTIONS.map(e => (
            <button
              key={e}
              className="text-base px-1 py-0.5 hover:bg-muted rounded transition-colors"
              onClick={() => { onReact(msg.id, e); setShowPicker(false) }}
            >
              {e}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            className="p-1 hover:bg-muted rounded transition-colors"
            title="View thread"
            onClick={() => { onThreadOpen(msg); setShowPicker(false) }}
          >
            <MessageSquare size={14} className="text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Noticeboard wall post card ────────────────────────────────────────────────

function NoticeCard({
  msg,
  staffById,
  onReact,
  onThreadOpen,
  onLightbox,
}: {
  msg: ChatMessage
  staffById: Record<string, string>
  onReact: (messageId: number, emoji: string) => void
  onThreadOpen: (msg: ChatMessage) => void
  onLightbox: (src: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const senderName = msg.senderStaffId
    ? (staffById[msg.senderStaffId] ?? msg.senderName ?? 'Staff')
    : (msg.senderName || msg.senderParentId?.split('@')[0] || 'Parent')
  const isDeleted = msg.deletedAt !== null

  function fmtWallDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ` at ${time}`
  }

  return (
    <div className="mx-3 my-2 rounded-xl border border-border bg-card shadow-sm p-4 relative">
      {/* Author row */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold select-none flex-shrink-0">
          {getInitials(senderName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{senderName}</p>
          <p className="text-[11px] text-muted-foreground">{fmtWallDate(msg.createdAt)}</p>
        </div>
        <Megaphone size={15} className="text-secondary flex-shrink-0" />
      </div>

      {/* Body */}
      {isDeleted ? (
        <p className="text-sm italic text-muted-foreground">This notice was removed</p>
      ) : (
        <>
          {msg.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          )}
          {msg.attachments?.map((att: Attachment) => (
            <AttachmentThumb key={att.id} att={att} onLightbox={onLightbox} />
          ))}
        </>
      )}

      {/* Footer */}
      {!isDeleted && (
        <div className="flex items-center justify-between gap-2 border-t border-border mt-3 pt-2.5">
          <div className="flex flex-wrap items-center gap-1 relative">
            {Object.entries(msg.reactions ?? {}).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 border border-border text-xs transition-colors"
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground font-medium">{count}</span>
              </button>
            ))}
            <button
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted text-xs transition-colors"
              title="Add reaction"
            >
              <SmilePlus size={13} />
            </button>
            {showPicker && (
              <div className="absolute left-0 bottom-7 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-md px-1 py-0.5 z-10">
                {QUICK_REACTIONS.map(e => (
                  <button
                    key={e}
                    className="text-base px-1 py-0.5 hover:bg-muted rounded transition-colors"
                    onClick={() => { onReact(msg.id, e); setShowPicker(false) }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline flex-shrink-0"
            onClick={() => onThreadOpen(msg)}
          >
            <MessageSquare size={13} />
            {msg.replyCount > 0
              ? `${msg.replyCount} ${msg.replyCount === 1 ? 'comment' : 'comments'}`
              : 'Comment'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Flat message list (one page) ──────────────────────────────────────────────

function flattenPages(data: { pages: ChatMessage[][] } | undefined): ChatMessage[] {
  if (!data) return []
  // pages[0] = newest 40 (desc). For chronological display: reverse pages, reverse each.
  return [...data.pages].reverse().flatMap(page => [...page].reverse())
}

// ── ComposeBar ────────────────────────────────────────────────────────────────

interface PendingFile {
  file: File
  preview: string // object URL
  grant?: { objectPath: string; mimeType: string; fileName: string }
  uploading: boolean
  error?: string
}

function ComposeBar({
  channelId,
  parentMessageId,
  placeholder,
  onSent,
}: {
  channelId: number
  parentMessageId?: number
  placeholder?: string
  onSent?: () => void
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const createMsg = useCreateMessage(channelId)
  const requestUrl = useRequestUploadUrl()

  const uploadFile = useCallback(async (file: File) => {
    const idx = pending.length
    const preview = URL.createObjectURL(file)
    setPending(p => [...p, { file, preview, uploading: true }])

    try {
      const grant = await requestUrl.mutateAsync({
        name: file.name,
        size: file.size,
        contentType: file.type,
      })
      // PUT directly to the presigned URL
      await fetch(grant.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      setPending(p => p.map((item, i) =>
        i === idx ? { ...item, uploading: false, grant: { objectPath: grant.objectPath, mimeType: grant.mimeType, fileName: grant.fileName } } : item,
      ))
    } catch {
      setPending(p => p.map((item, i) =>
        i === idx ? { ...item, uploading: false, error: 'Upload failed' } : item,
      ))
    }
  }, [pending.length, requestUrl])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => {
      if (f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024) uploadFile(f)
    })
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const send = async () => {
    const content = text.trim()
    if (!content && pending.length === 0) return
    const attachments = pending
      .filter(p => p.grant && !p.error)
      .map(p => p.grant!)

    await createMsg.mutateAsync({ content: content || undefined, parentMessageId, attachments })
    setText('')
    setPending([])
    onSent?.()
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const canSend = (text.trim() || pending.some(p => p.grant)) && !createMsg.isPending

  return (
    <div
      className={cn(
        'border-t border-border bg-background p-3 transition-colors',
        dragging && 'bg-secondary/10 border-secondary',
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Pending file previews */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pending.map((p, i) => (
            <div key={i} className="relative group/chip">
              <div className="h-16 w-16 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center">
                {p.file.type.startsWith('image/')
                  ? <img src={p.preview} className="h-full w-full object-cover" alt="" />
                  : <ImageIcon size={20} className="text-muted-foreground" />
                }
                {p.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md">
                    <Loader2 size={16} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <button
                className="absolute -top-1.5 -right-1.5 hidden group-hover/chip:flex w-4 h-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center"
                onClick={() => { URL.revokeObjectURL(p.preview); setPending(ps => ps.filter((_, j) => j !== i)) }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={dragging ? 'Drop image here…' : (placeholder ?? 'Message…')}
            rows={1}
            className="w-full resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary max-h-36 overflow-y-auto leading-relaxed"
            style={{ minHeight: '44px' }}
            onInput={e => {
              const t = e.currentTarget; t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 144) + 'px'
            }}
          />
        </div>
        <button
          className="flex-shrink-0 p-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Attach image"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={18} />
        </button>
        <button
          disabled={!canSend}
          onClick={send}
          className={cn(
            'flex-shrink-0 p-2.5 rounded-xl transition-colors',
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
          title="Send (Enter)"
        >
          {createMsg.isPending
            ? <Loader2 size={18} className="animate-spin" />
            : <Send size={18} />
          }
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => { handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}

// ── MessageView ───────────────────────────────────────────────────────────────

function MessageView({
  channel,
  staffById,
  onThreadOpen,
  onBackToList,
}: {
  channel: Channel
  staffById: Record<string, string>
  onThreadOpen: (msg: ChatMessage) => void
  onBackToList: () => void
}) {
  const qc = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [initialScrollDone, setInitialScrollDone] = useState(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useListMessages(channel.id)
  const toggleReaction = useToggleReaction(channel.id)

  const messages = useMemo(() => flattenPages(data), [data])

  // SSE: invalidate messages on new events for this channel
  useMessageStream([channel.id], useCallback((evt) => {
    if (evt.type === 'message_created' && evt.data) {
      qc.setQueryData<ReturnType<typeof useListMessages>['data']>(
        messagesQueryKey(channel.id),
        (old: any) => {
          if (!old) return old
          const msg = evt.data as ChatMessage
          // pages[0] = newest messages (desc). flattenPages reverses everything for
          // chronological display, so new messages must be prepended to pages[0]
          // so they appear at the bottom of the chat view after reversal.
          const firstPage = old.pages[0] ?? []
          if (firstPage.some((m: ChatMessage) => m.id === msg.id)) return old
          const pages = [[msg, ...firstPage], ...old.pages.slice(1)]
          return { ...old, pages }
        },
      )
    } else {
      qc.invalidateQueries({ queryKey: messagesQueryKey(channel.id) })
    }
  }, [channel.id, qc]))

  // Scroll to bottom on first load (chats only — the noticeboard wall starts at the top)
  useEffect(() => {
    if (!isLoading && !initialScrollDone) {
      if (channel.type !== 'noticeboard') bottomRef.current?.scrollIntoView()
      setInitialScrollDone(true)
    }
  }, [isLoading, initialScrollDone, channel.type])

  // Scroll to bottom when a new message arrives (if already near bottom; chats only)
  useEffect(() => {
    if (!initialScrollDone || channel.type === 'noticeboard') return
    const el = bottomRef.current?.parentElement
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, initialScrollDone])

  // Intersection observer for "load older" trigger
  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    }, { threshold: 0.1 })
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Mark channel as seen
  useEffect(() => { markSeen(channel.id) }, [channel.id])

  const handleReact = (messageId: number, emoji: string) => {
    toggleReaction.mutate({ messageId, emoji })
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={onBackToList}
          className="md:hidden flex-shrink-0 -ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to channels"
        >
          <ArrowLeft size={20} />
        </button>
        {channel.type === 'noticeboard' && <Megaphone size={18} className="text-primary flex-shrink-0" />}
        {channel.type === 'direct' && <User size={18} className="text-secondary flex-shrink-0" />}
        {channel.type === 'group' && <Users size={18} className="text-secondary flex-shrink-0" />}
        {channel.type === 'staff' && <Shield size={18} className="text-amber-500 flex-shrink-0" />}
        <div className="min-w-0">
          {channel.type === 'direct' ? (() => {
            const { name, sub } = dmNames(channel as EnrichedChannel)
            return (
              <>
                <h2 className="font-semibold text-base text-foreground truncate">{name}</h2>
                {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
              </>
            )
          })() : (
            <>
              <h2 className="font-semibold text-base text-foreground truncate">{channelDisplayName(channel)}</h2>
              {channel.type === 'noticeboard' && (
                <p className="text-xs text-muted-foreground">
                  {channel.ageGroup ? `${AGE_GROUP_LABELS[channel.ageGroup] ?? channel.ageGroup} age group notice board` : 'Club-wide announcements'}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Chats load older pages at the top; the newest-first wall loads them at the bottom */}
        {channel.type !== 'noticeboard' && <div ref={topSentinelRef} className="h-1" />}
        {channel.type !== 'noticeboard' && isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            {channel.type === 'noticeboard'
              ? <Megaphone size={32} strokeWidth={1.5} />
              : <MessageSquare size={32} strokeWidth={1.5} />}
            <p className="text-sm">
              {channel.type === 'noticeboard' ? 'No notices posted yet.' : 'No messages yet. Be the first to write one!'}
            </p>
          </div>
        ) : channel.type === 'noticeboard' ? (
          // Wall feed — newest first
          [...messages].reverse().map(msg => (
            <NoticeCard
              key={msg.id}
              msg={msg}
              staffById={staffById}
              onReact={handleReact}
              onThreadOpen={onThreadOpen}
              onLightbox={setLightboxSrc}
            />
          ))
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              staffById={staffById}
              channelType={channel.type}
              onReact={handleReact}
              onThreadOpen={onThreadOpen}
              onLightbox={setLightboxSrc}
            />
          ))
        )}
        {channel.type === 'noticeboard' && (
          <>
            {isFetchingNextPage && (
              <div className="flex justify-center py-3">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={topSentinelRef} className="h-1" />
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <ComposeBar
        channelId={channel.id}
        placeholder={
          channel.type === 'noticeboard'
            ? `Post an announcement to ${channelDisplayName(channel)}…`
            : `Message ${channelDisplayName(channel)}…`
        }
      />

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}

// ── ReplyPane ─────────────────────────────────────────────────────────────────

function ReplyPane({
  message,
  staffById,
  onClose,
  onLightbox,
  onBackToMessages,
  mobileVisible,
}: {
  message: ChatMessage
  staffById: Record<string, string>
  onClose: () => void
  onLightbox: (src: string) => void
  onBackToMessages: () => void
  mobileVisible: boolean
}) {
  const { data, isLoading } = useGetThread(message.id)
  const bottomRef = useRef<HTMLDivElement>(null)

  const senderName = message.senderStaffId
    ? (staffById[message.senderStaffId] ?? message.senderName ?? 'Staff')
    : (message.senderName || message.senderParentId?.split('@')[0] || 'Parent')

  // Scroll to bottom after replies load
  useEffect(() => {
    if (!isLoading) bottomRef.current?.scrollIntoView()
  }, [isLoading, data?.replies.length])

  return (
    <div className={cn("flex flex-col border-l border-border h-full bg-background md:w-80 md:flex-shrink-0", mobileVisible ? "w-full" : "hidden md:flex")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToMessages}
            className="md:hidden flex-shrink-0 -ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to messages"
          >
            <ArrowLeft size={20} />
          </button>
          <MessageSquare size={16} className="text-primary" />
          <span className="font-semibold text-sm">Thread</span>
        </div>
        <button onClick={onClose} className="hidden md:block text-muted-foreground hover:text-foreground p-1 rounded">
          <X size={18} />
        </button>
      </div>

      {/* Original message */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {getInitials(senderName)}
          </div>
          <span className="font-semibold text-xs">{senderName}</span>
          <span className="text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
        {message.content && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed pl-8">
            {message.content}
          </p>
        )}
        {message.attachments?.map(att => (
          <div key={att.id} className="pl-8"><AttachmentThumb att={att} onLightbox={onLightbox} /></div>
        ))}
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
        ) : (data?.replies ?? []).length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">No replies yet</p>
        ) : (
          data!.replies.map(reply => {
            const rName = reply.senderStaffId
              ? (staffById[reply.senderStaffId] ?? reply.senderName ?? 'Staff')
              : (reply.senderName || reply.senderParentId?.split('@')[0] || 'Parent')
            return (
              <div key={reply.id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-muted/40 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {getInitials(rName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="font-semibold text-xs">{rName}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(reply.createdAt)}</span>
                  </div>
                  {reply.content && (
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">{reply.content}</p>
                  )}
                  {reply.attachments?.map(att => (
                    <AttachmentThumb key={att.id} att={att} onLightbox={onLightbox} />
                  ))}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply compose */}
      <ComposeBar
        channelId={message.channelId}
        parentMessageId={message.id}
        placeholder="Reply…"
      />
    </div>
  )
}

// ── ChannelItem ───────────────────────────────────────────────────────────────

function ChannelItem({
  channel,
  isActive,
  hasUnread,
  onClick,
}: {
  channel: Channel
  isActive: boolean
  hasUnread: boolean
  onClick: () => void
}) {
  const Icon = channel.type === 'noticeboard'
    ? Megaphone
    : channel.type === 'direct' ? User
    : channel.type === 'staff' ? Shield
    : Hash

  const { name, sub } = channel.type === 'direct'
    ? dmNames(channel as EnrichedChannel)
    : { name: channelDisplayName(channel), sub: '' }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-sm truncate">{name}</span>
        {sub && <span className="text-[10px] leading-tight truncate opacity-70">{sub}</span>}
      </span>
      {hasUnread && !isActive && (
        <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
      )}
    </button>
  )
}

// ── ChannelList sidebar ───────────────────────────────────────────────────────

function ChannelList({
  channels,
  activeId,
  onSelect,
  onNew,
  mobileVisible,
}: {
  channels: Channel[]
  activeId: number | null
  onSelect: (ch: Channel) => void
  onNew: () => void
  mobileVisible: boolean
}) {
  const lastSeen = useMemo(() => getLastSeen(), [])

  const noticeboards = channels.filter(c => c.type === 'noticeboard')
  const staffChats = channels.filter(c => c.type === 'staff')
  const directs = channels.filter(c => c.type === 'direct')
  const groups = channels.filter(c => c.type === 'group')

  function Section({ label, items }: { label: string; items: Channel[] }) {
    if (items.length === 0) return null
    return (
      <div className="mt-4">
        <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          {label}
        </p>
        {items.map(ch => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            isActive={ch.id === activeId}
            hasUnread={!lastSeen[ch.id]}
            onClick={() => onSelect(ch)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col border-r border-border bg-background h-full overflow-hidden md:w-64 md:flex-shrink-0", mobileVisible ? "w-full" : "hidden md:flex")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
        <h2 className="font-display font-bold text-base text-foreground">Messages</h2>
        <button
          onClick={onNew}
          className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 font-semibold px-2 py-1 rounded-lg hover:bg-secondary/10 transition-colors"
          title="New message or group"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <Section label="Staff Channels" items={staffChats} />
        <Section label="Notice Boards" items={noticeboards} />
        <Section label="Direct Messages" items={directs} />
        <Section label="Group Chats" items={groups} />
        {channels.length === 0 && (
          <p className="px-3 py-6 text-xs text-muted-foreground text-center">
            No channels yet
          </p>
        )}
      </div>
    </div>
  )
}

// ── NewChannelModal ───────────────────────────────────────────────────────────

function NewChannelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (channelId: number) => void
}) {
  const [tab, setTab] = useState<'direct' | 'group' | 'staff'>('direct')
  const [search, setSearch] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [ageGroup, setAgeGroup] = useState<string>('')

  const createChannel = useCreateChannel()
  const { data: members = [] } = useListMembers({})

  // Build a per-email parent map collecting all children's names
  const parentMap = useMemo(() => {
    const map = new Map<string, { email: string; playerParent: string | null; children: string[] }>()
    for (const m of members as any[]) {
      if (!m.playerEmail) continue
      if (!map.has(m.playerEmail)) {
        map.set(m.playerEmail, { email: m.playerEmail, playerParent: m.playerParent ?? null, children: [] })
      }
      if (m.playerName) map.get(m.playerEmail)!.children.push(m.playerName)
    }
    return map
  }, [members])

  const parents = useMemo(() => Array.from(parentMap.values()), [parentMap])

  const filtered = useMemo(() =>
    parents.filter(p =>
      p.playerParent?.toLowerCase().includes(search.toLowerCase()) ||
      p.children.some(c => c.toLowerCase().includes(search.toLowerCase())) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20),
    [parents, search],
  )

  const toggleEmail = (email: string) =>
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email],
    )

  const handleCreate = async () => {
    if (tab === 'direct' && selectedEmails.length === 0) return
    if ((tab === 'group' || tab === 'staff') && !groupName.trim()) return

    const body =
      tab === 'direct'
        ? {
            type: 'direct',
            name: (() => {
              const info = parentMap.get(selectedEmails[0])
              return info?.playerParent || info?.children[0] || `DM with ${selectedEmails[0]?.split('@')[0] ?? 'Parent'}`
            })(),
            memberEmails: selectedEmails,
          }
        : tab === 'staff'
        ? {
            type: 'staff',
            name: groupName.trim(),
          }
        : {
            type: 'group',
            name: groupName.trim(),
            ageGroup: ageGroup || undefined,
            memberEmails: selectedEmails,
          }

    const ch = await createChannel.mutateAsync(body)
    onCreated(ch.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl shadow-xl border border-border w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display font-bold text-lg">New Message</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Tab */}
        <div className="flex gap-1 px-5 pt-4">
          {([
            { value: 'direct', label: '👤 Direct' },
            { value: 'group',  label: '👥 Group' },
            { value: 'staff',  label: '🛡️ Staff' },
          ] as const).map(t => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setGroupName(''); setSelectedEmails([]); setSearch('') }}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                tab === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3">
          {tab === 'staff' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Channel Name
              </label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-muted/30"
                placeholder="e.g. Coaches Chat"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                All current and future staff members are added automatically.
              </p>
            </div>
          )}

          {tab === 'group' && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Group Name
                </label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-muted/30"
                  placeholder="e.g. U12 Parents"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Age Group <span className="font-normal normal-case">(auto-adds all parents)</span>
                </label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-muted/30"
                  value={ageGroup}
                  onChange={e => setAgeGroup(e.target.value)}
                >
                  <option value="">— None —</option>
                  {Object.entries(AGE_GROUP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Parent search — only for direct and group tabs */}
          {tab !== 'staff' && <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              {tab === 'direct' ? 'Parent' : 'Additional Parents'}
            </label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-muted/30 mb-2"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {/* Selected chips */}
            {selectedEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedEmails.map(email => {
                  const info = parentMap.get(email)
                  const chipLabel = info?.playerParent || info?.children[0] || email.split('@')[0]
                  return (
                    <span
                      key={email}
                      className="flex items-center gap-1 bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1"
                    >
                      {chipLabel}
                      <button onClick={() => toggleEmail(email)}><X size={10} /></button>
                    </span>
                  )
                })}
              </div>
            )}

            <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-lg border border-border bg-muted/20">
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                  {search ? 'No parents match' : 'Type to search parents'}
                </p>
              )}
              {filtered.map((p: any) => {
                const sel = selectedEmails.includes(p.email)
                const displayName = p.playerParent || p.children[0] || p.email.split('@')[0]
                return (
                  <button
                    key={p.email}
                    onClick={() => {
                      toggleEmail(p.email)
                      if (tab === 'direct') setSearch('')
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
                      sel && 'bg-primary/5',
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {getInitials(displayName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{displayName}</p>
                      {p.children.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">{p.children.join(', ')}</p>
                      )}
                    </div>
                    {sel && <ChevronRight size={14} className="ml-auto text-primary flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={
              createChannel.isPending ||
              (tab === 'direct' && selectedEmails.length === 0) ||
              (tab === 'group' && !groupName.trim()) ||
              (tab === 'staff' && !groupName.trim())
            }
            onClick={handleCreate}
          >
            {createChannel.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Messages page ────────────────────────────────────────────────────────

export default function Messages() {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [threadMsg, setThreadMsg] = useState<ChatMessage | null>(null)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [mobilePanelView, setMobilePanelView] = useState<'list' | 'messages' | 'thread'>('list')

  const { data: channels = [], isLoading: loadingChannels } = useListChannels()
  const { data: staffList = [] } = useListStaff({})

  // Build staffId → name map for fast lookups in message bubbles
  const staffById = useMemo<Record<string, string>>(() =>
    Object.fromEntries(
      (staffList as any[]).map((s: any) => [s.clerkUserId ?? s.userId ?? '', s.staffName ?? s.name ?? 'Staff']),
    ),
    [staffList],
  )

  // Auto-select first channel
  useEffect(() => {
    if (!activeChannel && channels.length > 0) setActiveChannel(channels[0])
  }, [channels, activeChannel])

  function handleChannelSelect(ch: Channel) {
    setActiveChannel(ch)
    setThreadMsg(null)
    setMobilePanelView('messages')
  }

  function handleCreated(channelId: number) {
    setShowNewChannel(false)
    const ch = channels.find(c => c.id === channelId)
    if (ch) { setActiveChannel(ch); setMobilePanelView('messages') }
  }

  function handleThreadOpen(msg: ChatMessage) {
    setThreadMsg(msg)
    setMobilePanelView('thread')
  }

  return (
    // Escape the StaffLayout's p-4 md:p-8 max-w-7xl wrapper
    <div className="-m-4 md:-m-8 h-[calc(100dvh-64px)] md:h-screen flex overflow-hidden bg-background">

      {/* Channel sidebar — full screen on mobile when showing list, fixed w-64 on desktop */}
      {loadingChannels ? (
        <div className={cn(
          "border-r border-border flex items-center justify-center md:w-64",
          mobilePanelView === 'list' ? "w-full" : "hidden md:flex",
        )}>
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ChannelList
          channels={channels}
          activeId={activeChannel?.id ?? null}
          onSelect={handleChannelSelect}
          onNew={() => setShowNewChannel(true)}
          mobileVisible={mobilePanelView === 'list'}
        />
      )}

      {/* Main message area — hidden on mobile unless actively viewing messages */}
      <div className={cn(
        "flex-1 min-w-0 flex flex-col h-full overflow-hidden",
        mobilePanelView === 'messages' ? "flex" : "hidden md:flex",
      )}>
        {activeChannel ? (
          <MessageView
            channel={activeChannel}
            staffById={staffById}
            onThreadOpen={handleThreadOpen}
            onBackToList={() => setMobilePanelView('list')}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/20">
            <MessageSquare size={48} strokeWidth={1} />
            <div className="text-center">
              <p className="font-semibold text-foreground">Select a channel</p>
              <p className="text-sm mt-1">Choose from the sidebar or start a new conversation</p>
            </div>
            <Button variant="outline" onClick={() => setShowNewChannel(true)}>
              <Plus size={16} className="mr-2" /> New Message
            </Button>
          </div>
        )}
      </div>

      {/* Thread reply pane — full screen on mobile, fixed w-80 sidebar on desktop */}
      {threadMsg && (
        <ReplyPane
          message={threadMsg}
          staffById={staffById}
          onClose={() => { setThreadMsg(null); setMobilePanelView('messages') }}
          onLightbox={setLightboxSrc}
          onBackToMessages={() => setMobilePanelView('messages')}
          mobileVisible={mobilePanelView === 'thread'}
        />
      )}

      {/* New channel modal */}
      {showNewChannel && (
        <NewChannelModal
          onClose={() => setShowNewChannel(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Global lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}
