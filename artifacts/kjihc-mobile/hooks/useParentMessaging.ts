/**
 * Messaging hooks scoped to parent (magic-link) auth.
 * Parents authenticate via `Authorization: Bearer <parent-token>`.
 */
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useParentAuth } from '@/context/ParentAuthContext';
import type {
  Channel,
  ChatMessage,
  Attachment,
  UploadGrant,
  Thread,
} from '@workspace/api-client-react';

export type { Channel, ChatMessage, Attachment, UploadGrant, Thread };

// ─── Query keys ───────────────────────────────────────────────────────────────

export const pChannelsKey  = ()                  => ['parent', 'channels'] as const;
export const pMessagesKey  = (channelId: number)  => ['parent', 'messages', channelId] as const;
export const pThreadKey    = (messageId: number)  => ['parent', 'thread', messageId] as const;

// ─── Auth header helper ───────────────────────────────────────────────────────

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export function useParentListChannels() {
  const { token } = useParentAuth();
  return useQuery<Channel[]>({
    queryKey: pChannelsKey(),
    queryFn: () =>
      customFetch<Channel[]>('/api/channels', { headers: authHeader(token) }),
    enabled: !!token,
    staleTime: 30_000,
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useParentListMessages(channelId: number, enabled = true) {
  const { token } = useParentAuth();
  return useInfiniteQuery<ChatMessage[]>({
    queryKey: pMessagesKey(channelId),
    queryFn: ({ pageParam }) => {
      const cursor = pageParam != null ? `&before=${pageParam}` : '';
      return customFetch<ChatMessage[]>(
        `/api/channels/${channelId}/messages?limit=40${cursor}`,
        { headers: authHeader(token) },
      );
    },
    getNextPageParam: (page) =>
      page.length === 40 ? page[page.length - 1]?.id : undefined,
    initialPageParam: undefined as number | undefined,
    enabled: enabled && !!token,
    staleTime: 10_000,
  });
}

export function useParentCreateMessage(channelId: number) {
  const { token } = useParentAuth();
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
      customFetch<ChatMessage>(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: authHeader(token),
      }),
    onSuccess: (msg) => {
      qc.setQueryData<InfiniteData<ChatMessage[]>>(
        pMessagesKey(channelId),
        (old) => {
          if (!old) return { pages: [[msg]], pageParams: [undefined] };
          const firstPage = old.pages[0] ?? [];
          if (firstPage.some((m) => m.id === msg.id)) return old;
          return { ...old, pages: [[msg, ...firstPage], ...old.pages.slice(1)] };
        },
      );
    },
  });
}

export function useParentGetThread(messageId: number, enabled = true) {
  const { token } = useParentAuth();
  return useQuery<Thread>({
    queryKey: pThreadKey(messageId),
    queryFn: () =>
      customFetch<Thread>(`/api/messages/${messageId}/thread`, {
        headers: authHeader(token),
      }),
    enabled: enabled && !!token,
    staleTime: 10_000,
  });
}

export function useParentToggleReaction(channelId: number) {
  const { token } = useParentAuth();
  const qc = useQueryClient();
  return useMutation<unknown, Error, { messageId: number; emoji: string }>({
    mutationFn: ({ messageId, emoji }) =>
      customFetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
        headers: authHeader(token),
      }),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: pMessagesKey(channelId) }),
  });
}

export function useParentRequestUploadUrl() {
  const { token } = useParentAuth();
  return useMutation<UploadGrant, Error, { name: string; size: number; contentType: string }>({
    mutationFn: (body) =>
      customFetch<UploadGrant>('/api/upload/request-url', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: authHeader(token),
      }),
  });
}
