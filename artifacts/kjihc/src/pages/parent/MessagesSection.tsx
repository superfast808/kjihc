import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MessageSquare, ArrowLeft, Send, Megaphone, Users, MessageCircle, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"

interface Channel {
  id: number
  name: string
  type: "noticeboard" | "direct" | "group"
  ageGroup: string | null
  latestMessageAt: string | null
}

interface Attachment {
  id: number
  objectPath: string
  mimeType: string
  fileName: string
}

interface Message {
  id: number
  channelId: number
  senderName: string
  content: string
  createdAt: string
  parentMessageId: number | null
  replyCount: number
  reactions?: Record<string, number>
  attachments?: Attachment[]
}

const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "🏒"]

async function fetchChannels(token: string): Promise<Channel[]> {
  const r = await fetch("/api/channels", { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error("Failed to load channels")
  return r.json()
}

async function fetchMessages(token: string, channelId: number): Promise<Message[]> {
  const r = await fetch(`/api/channels/${channelId}/messages?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Failed to load messages")
  return r.json()
}

async function toggleReaction(token: string, messageId: number, emoji: string) {
  const r = await fetch(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emoji }),
  })
  if (!r.ok) throw new Error("Failed to react")
  return r.json()
}

async function fetchThread(token: string, messageId: number): Promise<{ parent: Message; replies: Message[] }> {
  const r = await fetch(`/api/messages/${messageId}/thread`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Failed to load comments")
  return r.json()
}

async function sendMessage(token: string, channelId: number, content: string, parentMessageId?: number) {
  const r = await fetch(`/api/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content, ...(parentMessageId ? { parentMessageId } : {}) }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to send message")
  }
  return r.json()
}

function channelIcon(type: Channel["type"]) {
  if (type === "noticeboard") return <Megaphone className="h-4 w-4" />
  if (type === "group") return <Users className="h-4 w-4" />
  return <MessageCircle className="h-4 w-4" />
}

function AuthImage({ token, objectPath, className, onClick }: {
  token: string; objectPath: string; className?: string; onClick?: () => void
}) {
  const { data: url } = useQuery({
    queryKey: ["parent-storage-object", objectPath],
    queryFn: async () => {
      const r = await fetch(`/api/storage/objects/${objectPath.replace(/^\/+/, "")}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error("Failed to load image")
      return URL.createObjectURL(await r.blob())
    },
    staleTime: Infinity,
  })
  if (!url) return <div className={cn("bg-muted animate-pulse rounded-lg", className)} style={{ minHeight: 120 }} />
  return <img src={url} className={className} onClick={onClick} alt="" />
}

function MessageAttachments({ token, attachments }: { token: string; attachments?: Attachment[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  if (!attachments || attachments.length === 0) return null
  const images = attachments.filter(a => a.mimeType.startsWith("image/"))
  const files  = attachments.filter(a => !a.mimeType.startsWith("image/"))
  return (
    <div className="mt-2.5 space-y-2">
      {images.map(a => (
        <AuthImage
          key={a.id} token={token} objectPath={a.objectPath}
          className="rounded-lg max-h-72 w-auto max-w-full object-contain cursor-pointer border border-border"
          onClick={() => setLightbox(a.objectPath)}
        />
      ))}
      {files.map(a => (
        <button
          key={a.id}
          onClick={async () => {
            const r = await fetch(`/api/storage/objects/${a.objectPath.replace(/^\/+/, "")}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (!r.ok) return
            const url = URL.createObjectURL(await r.blob())
            const link = document.createElement("a")
            link.href = url; link.download = a.fileName; link.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs text-foreground transition-colors"
        >
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate max-w-[220px]">{a.fileName}</span>
        </button>
      ))}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <AuthImage token={token} objectPath={lightbox} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}

function fmtWallDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" }) + ` at ${time}`
}

function formatTs(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7)  return d.toLocaleDateString("en-GB", { weekday: "short" })
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

interface Props {
  token: string
}

export default function MessagesSection({ token }: Props) {
  const qc = useQueryClient()
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [mobileView, setMobileView]         = useState<"list" | "messages">("list")
  const [text, setText] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [threadMsg, setThreadMsg] = useState<Message | null>(null)
  const [replyText, setReplyText] = useState("")
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: channels = [], isLoading: chLoading } = useQuery({
    queryKey: ["parent-channels", token],
    queryFn: () => fetchChannels(token),
    staleTime: 30_000,
  })

  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ["parent-messages", token, activeChannel?.id],
    queryFn: () => fetchMessages(token, activeChannel!.id),
    enabled: !!activeChannel,
    staleTime: 15_000,
    refetchInterval: 20_000,
  })

  const mutation = useMutation({
    mutationFn: (content: string) => sendMessage(token, activeChannel!.id, content),
    onSuccess: () => {
      setText("")
      setSendError(null)
      qc.invalidateQueries({ queryKey: ["parent-messages", token, activeChannel?.id] })
      qc.invalidateQueries({ queryKey: ["parent-channels", token] })
    },
    onError: (err: Error) => setSendError(err.message),
  })

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) =>
      toggleReaction(token, messageId, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-messages", token, activeChannel?.id] })
      if (threadMsg) qc.invalidateQueries({ queryKey: ["parent-thread", token, threadMsg.id] })
    },
  })

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ["parent-thread", token, threadMsg?.id],
    queryFn: () => fetchThread(token, threadMsg!.id),
    enabled: !!threadMsg,
  })

  const replyMutation = useMutation({
    mutationFn: () => sendMessage(token, activeChannel!.id, replyText.trim(), threadMsg!.id),
    onSuccess: () => {
      setReplyText("")
      qc.invalidateQueries({ queryKey: ["parent-thread", token, threadMsg?.id] })
      qc.invalidateQueries({ queryKey: ["parent-messages", token, activeChannel?.id] })
    },
  })

  const isNoticeboard = activeChannel?.type === "noticeboard"

  const handleSend = () => {
    if (!text.trim() || !activeChannel) return
    if (isNoticeboard) return // top-level blocked
    mutation.mutate(text.trim())
  }

  useEffect(() => {
    if (!isNoticeboard) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isNoticeboard])

  const selectChannel = (ch: Channel) => {
    setActiveChannel(ch)
    setMobileView("messages")
    setThreadMsg(null)
    setPickerFor(null)
  }

  // Chats: oldest at top. Noticeboard wall: newest first, like a feed.
  const orderedMessages = isNoticeboard ? messages : [...messages].reverse()

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-display md:hidden">Messages</h2>

      <div className="flex h-[calc(100vh-260px)] min-h-[400px] gap-0 overflow-hidden rounded-xl border border-border shadow-sm bg-card">

        {/* Channel list */}
        <div className={cn(
          "flex flex-col border-r border-border",
          "w-full md:w-64 md:flex-shrink-0",
          mobileView === "list" ? "flex" : "hidden md:flex"
        )}>
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm hidden md:block">Messages</h2>
          </div>

          {chLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">No channels yet</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => selectChannel(ch)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0",
                    activeChannel?.id === ch.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    activeChannel?.id === ch.id ? "bg-primary/20" : "bg-muted"
                  )}>
                    {channelIcon(ch.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.name}</p>
                    {ch.type === "noticeboard" && (
                      <p className="text-xs text-muted-foreground">Read &amp; reply only</p>
                    )}
                  </div>
                  {ch.latestMessageAt && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTs(ch.latestMessageAt)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message pane */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          mobileView === "messages" ? "flex" : "hidden md:flex"
        )}>
          {!activeChannel ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
              <MessageSquare className="h-12 w-12 opacity-30" />
              <p className="font-medium text-foreground">Select a channel</p>
              <p className="text-sm">Choose a channel from the list to read messages</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {channelIcon(activeChannel.type)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{activeChannel.name}</p>
                  {isNoticeboard && (
                    <p className="text-xs text-muted-foreground">Announcements — you can reply to messages</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : orderedMessages.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : isNoticeboard ? (
                  // Wall feed — newest first
                  orderedMessages.map(msg => (
                    <div key={msg.id} className="rounded-xl border border-border bg-card shadow-sm p-4">
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold">
                            {msg.senderName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{msg.senderName}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtWallDate(msg.createdAt)}</p>
                        </div>
                        <Megaphone className="h-4 w-4 text-secondary flex-shrink-0" />
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </p>
                      <MessageAttachments token={token} attachments={msg.attachments} />
                      <div className="flex items-center justify-between gap-2 border-t border-border mt-3 pt-2.5">
                        <div className="relative flex flex-wrap items-center gap-1">
                          {Object.entries(msg.reactions ?? {}).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              onClick={() => reactMutation.mutate({ messageId: msg.id, emoji })}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 border border-border text-xs transition-colors"
                            >
                              <span>{emoji}</span>
                              <span className="text-muted-foreground font-medium">{count}</span>
                            </button>
                          ))}
                          <button
                            onClick={() => setPickerFor(p => p === msg.id ? null : msg.id)}
                            className="px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted text-xs transition-colors"
                            title="Add reaction"
                          >
                            +
                          </button>
                          {pickerFor === msg.id && (
                            <div className="absolute left-0 bottom-7 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-md px-1 py-0.5 z-10">
                              {QUICK_REACTIONS.map(e => (
                                <button
                                  key={e}
                                  className="text-base px-1 py-0.5 hover:bg-muted rounded transition-colors"
                                  onClick={() => { reactMutation.mutate({ messageId: msg.id, emoji: e }); setPickerFor(null) }}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => { setThreadMsg(msg); setReplyText("") }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline flex-shrink-0"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {msg.replyCount > 0
                            ? `${msg.replyCount} ${msg.replyCount === 1 ? "comment" : "comments"}`
                            : "Comment"}
                        </button>
                      </div>
                      {threadMsg?.id === msg.id && (
                        <div className="mt-3 rounded-lg bg-muted/40 border border-border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">Comments</p>
                            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setThreadMsg(null)}>Close</button>
                          </div>
                          {threadLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (thread?.replies?.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">No comments yet — be the first.</p>
                          ) : (
                            thread!.replies.map(r => (
                              <div key={r.id} className="flex gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-[10px] font-bold text-primary">{r.senderName.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs">
                                    <span className="font-semibold text-foreground">{r.senderName}</span>{" "}
                                    <span className="text-muted-foreground">{formatTs(r.createdAt)}</span>
                                  </p>
                                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{r.content}</p>
                                </div>
                              </div>
                            ))
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && replyText.trim() && !replyMutation.isPending) { e.preventDefault(); replyMutation.mutate() } }}
                              placeholder="Write a comment…"
                              className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                              disabled={replyMutation.isPending}
                            />
                            <Button
                              size="sm"
                              onClick={() => replyMutation.mutate()}
                              disabled={!replyText.trim() || replyMutation.isPending}
                              className="flex-shrink-0"
                            >
                              {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  orderedMessages.map(msg => (
                    <div key={msg.id} className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">
                          {msg.senderName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground">{msg.senderName}</span>
                          <span className="text-xs text-muted-foreground">{formatTs(msg.createdAt)}</span>
                        </div>
                        <div className="bg-muted/40 rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground leading-relaxed max-w-prose">
                          {msg.content}
                          <MessageAttachments token={token} attachments={msg.attachments} />
                        </div>
                        {msg.replyCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Compose */}
              <div className="border-t border-border p-3">
                {isNoticeboard ? (
                  <p className="text-xs text-center text-muted-foreground py-1">
                    This is a notice board — only coaches can post. You can react and comment on notices above.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="Type a message…"
                      className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      disabled={mutation.isPending}
                    />
                    <Button
                      size="sm"
                      onClick={handleSend}
                      disabled={!text.trim() || mutation.isPending}
                      className="flex-shrink-0"
                    >
                      {mutation.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                )}
                {sendError && <p className="text-xs text-destructive mt-1">{sendError}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
