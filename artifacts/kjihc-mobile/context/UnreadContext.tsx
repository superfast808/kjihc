/**
 * Simple context for the Messages tab unread badge count.
 * The MessagesScreen sets the count; the tab layout reads it.
 */
import React, { createContext, useContext, useState } from 'react';

interface UnreadContextValue {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

const UnreadContext = createContext<UnreadContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  return (
    <UnreadContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
