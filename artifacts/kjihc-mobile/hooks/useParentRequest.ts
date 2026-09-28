import { useParentAuth } from '@/context/ParentAuthContext';

/**
 * Returns request options that inject the parent session token as an
 * Authorization Bearer header, scoped to each individual API call.
 * Pass as `{ request: parentRequest }` to any generated hook.
 */
export function useParentRequest(): { headers?: Record<string, string> } {
  const { token } = useParentAuth();
  if (!token) return {};
  return { headers: { Authorization: `Bearer ${token}` } };
}
