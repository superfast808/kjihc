/**
 * Hand-written hooks for the KJIHC messaging API.
 * Covers channels, messages, reactions, uploads, and SSE streaming.
 */
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { customFetch } from './custom-fetch';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Channel {
  id: number;

  type: 'noticeboard' | 'direct' | 'group' | 'staff';

  name: string;

  ageGroup: string | null;

  createdAt: string;
  /** ID of the newest non-deleted top-level message; null when no messages exist. */

  latestMessageId: number | null;
  /** ISO timestamp of the newest non-deleted top-level message; null when no messages exist. */

  latestMessageAt: string | null;

  lastMessageAt: string | null;
}

export interface Attachment {
  id: number;
  messageId: number;
  objectPath: string;
  mimeType: string;
  fileName: string;
}

export interface ChatMessage {
  id: number;
  channelId: number;
  content: string;
  senderStaffId: string | null;
  senderParentId: string | null;
  senderName: string;
  parentMessageId: number | null;
  deletedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  reactions: Record<string, number>;
  attachments: Attachment[];
  replyCount: number;
}

export interface Thread {
  parent: ChatMessage;
  replies: ChatMessage[];
}

export interface UploadGrant {
  uploadUrl: string;
  objectPath: string;
  fileName: string;
  mimeType: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const channelsQueryKey = () => ['kjihc', 'channels'] as const;
export const messagesQueryKey = (channelId: number) =>
  ['kjihc', 'messages', channelId] as const;
export const threadQueryKey = (messageId: number) =>
  ['kjihc', 'thread', messageId] as const;

// ── Channels ──────────────────────────────────────────────────────────────────

export function useListChannels() {
  return useQuery<Channel[]>({
    queryKey: channelsQueryKey(),
    queryFn: () => customFetch('/api/channels'),
    staleTime: 30_000,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation<
    Channel,
    Error,
    { type: string; name: string; ageGroup?: string; memberEmails?: string[] }
  >({
    mutationFn: (body) =>
      customFetch('/api/channels', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: channelsQueryKey() }),
  });
}

// ── Messages ──────────────────────────────────────────────────────────────────

/** Infinite query; pages[0] = newest 40, pages[1] = next older 40, etc. */
export function useListMessages(channelId: number, enabled = true) {
  return useInfiniteQuery<ChatMessage[]>({
    queryKey: messagesQueryKey(channelId),
    queryFn: ({ pageParam }) => {
      const cursor = pageParam != null ? `&before=${pageParam}` : '';
      return customFetch<ChatMessage[]>(
        `/api/channels/${channelId}/messages?limit=40${cursor}`,
      );
    },
    // oldest id in the current page → fetch messages before that id next time
    getNextPageParam: (page) =>
      page.length === 40 ? page[page.length - 1]?.id : undefined,
    initialPageParam: undefined as number | undefined,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateMessage(channelId: number) {
  const qc = useQueryClient();
  return useMutation<
    ChatMessage,
    Error,
    {
      content?: string;
      parentMessageId?: number;
      attachments?: { objectPath: string; mimeType: string; fileName: string }[];
    }
  >({
    mutationFn: (body) =>
      customFetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (msg) => {
      // Prepend to the first (newest) page so inverted FlatList renders it at
      // the bottom. The web app's non-inverted scroll-div also looks correct
      // because the first page's newest message is at the front of the list.
      qc.setQueryData<InfiniteData<ChatMessage[]>>(
        messagesQueryKey(channelId),
        (old) => {
          if (!old) return { pages: [[msg]], pageParams: [undefined] };
          const firstPage = old.pages[0] ?? [];
          if (firstPage.some((m) => m.id === msg.id)) return old;
          return {
            ...old,
            pages: [[msg, ...firstPage], ...old.pages.slice(1)],
          };
        },
      );
    },
  });
}

export function useGetThread(messageId: number, enabled = true) {
  return useQuery<Thread>({
    queryKey: threadQueryKey(messageId),
    queryFn: () => customFetch(`/api/messages/${messageId}/thread`),
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateReply(messageId: number, channelId: number) {
  const qc = useQueryClient();
  return useMutation<
    ChatMessage,
    Error,
    {
      content?: string;
      attachments?: { objectPath: string; mimeType: string; fileName: string }[];
    }
  >({
    mutationFn: (body) =>
      customFetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ ...body, parentMessageId: messageId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: threadQueryKey(messageId) });
      // bump replyCount in the messages list
      qc.invalidateQueries({ queryKey: messagesQueryKey(channelId) });
    },
  });
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export function useToggleReaction(channelId: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { messageId: number; emoji: string }>({
    mutationFn: ({ messageId, emoji }) =>
      customFetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: messagesQueryKey(channelId) }),
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────

export function useRequestUploadUrl() {
  return useMutation<
    UploadGrant,
    Error,
    { name: string; size: number; contentType: string }
  >({
    mutationFn: (body) =>
      customFetch('/api/upload/request-url', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

// ── SSE stream ────────────────────────────────────────────────────────────────

export type StreamEvent = {
  type: string;
  channelId?: number;
  messageId?: number;
  data?: ChatMessage;
  [key: string]: unknown;
};

/**
 * Opens an EventSource to /api/messages/stream and calls onEvent for each
 * non-"connected" event. Auto-reconnects on error (EventSource built-in).
 *
 * Pass a stable `onEvent` ref — the hook uses an internal ref so it never
 * needs to be listed as a dep.
 */
export function useMessageStream(
  channelIds: number[],
  onEvent: (e: StreamEvent) => void,
  enabled = true,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const key = channelIds.slice().sort().join(',');

  useEffect(() => {
    if (!enabled || channelIds.length === 0) return;
    const es = new EventSource(`/api/messages/stream?channelIds=${key}`);

    es.onmessage = (raw) => {
      try {
        const evt: StreamEvent = JSON.parse(raw.data);
        if (evt.type !== 'connected') onEventRef.current(evt);
      } catch { /* ignore malformed */ }
    };

    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}
