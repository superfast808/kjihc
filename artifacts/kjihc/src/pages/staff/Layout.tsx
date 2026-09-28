import { Link, useLocation } from "wouter"
import { useClerk, useUser } from "@clerk/react"
import { PieChart, LayoutDashboard, Users, UserCheck, Trophy, Shield, FileText, Menu, X, LogOut, Sparkles, Settings2, CalendarDays, MessageSquare, ClipboardList, Receipt } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useGetMyStaffProfile } from "@workspace/api-client-react"
import { useStaffWebPush } from "@/hooks/useStaffWebPush"
import NotificationPrompt from "@/components/NotificationPrompt"

const navItems = [
  { path: "/staff",             label: "Dashboard",        icon: LayoutDashboard, requiredRole: "coach"     },
  { path: "/staff/players",     label: "Players",          icon: Users                                       },
  { path: "/staff/events",      label: "Events",           icon: CalendarDays                                },
  { path: "/staff/messages",    label: "Messages",         icon: MessageSquare                               },
  { path: "/staff/signin",      label: "Training Sign-in", icon: UserCheck,       requiredRole: "coach"     },
  { path: "/staff/attendance",  label: "Attendance",       icon: FileText,        requiredRole: "coach"     },
  { path: "/staff/ensign",      label: "Ensign Ewart",     icon: Trophy                                     },
  { path: "/staff/staff",       label: "Manage Staff",     icon: Shield,          requiredRole: "superuser" },
  { path: "/staff/documents",   label: "Documents",        icon: FileText                                   },
  { path: "/staff/housekeeping",label: "Housekeeping",     icon: Sparkles,        requiredRole: "superuser" },
  { path: "/staff/transactions", label: "Transactions",     icon: Receipt,         requiredRole: "treasurer" },
  { path: "/staff/equal-ops",   label: "Equal Ops",        icon: PieChart,        requiredRole: "superuser" },
  { path: "/staff/audit",       label: "Audit Log",        icon: ClipboardList,   requiredRole: "superuser" },
  { path: "/staff/settings",    label: "Settings",         icon: Settings2,       requiredRole: "superuser" },
]

const LS_KEY = 'kjihc_msg_last_seen'
function hasUnreadMessages(): boolean {
  try {
    const seen: Record<number, string> = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
    // Simply show a dot if there are any channels not yet visited this session
    // (the Messages page itself manages per-channel accuracy)
    return Object.keys(seen).length === 0
  } catch { return false }
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [msgUnread, setMsgUnread] = useState(false)
  useEffect(() => { setMsgUnread(hasUnreadMessages()) }, [])
  const [location] = useLocation()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { state: pushState, subscribe, unsubscribe } = useStaffWebPush()
  
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

  const { data: staffProfile } = useGetMyStaffProfile()
  const _isSuperUser  = staffProfile?.staffLevel === "1"
  const _isCoach      = _isSuperUser || staffProfile?.isCoach === true
  const _isTreasurer  = _isSuperUser || staffProfile?.isTreasurer === true

  const filteredNavItems = navItems.filter(item => {
    if (!('requiredRole' in item)) return true
    if (!staffProfile) return true
    if (_isSuperUser) return true
    if (item.requiredRole === "superuser") return false
    if (item.requiredRole === "coach")     return _isCoach
    if (item.requiredRole === "treasurer") return _isTreasurer
    return true
  })


  return (
    <div className="flex flex-col md:flex-row relative bg-slate-50 min-h-screen md:h-[100dvh] md:overflow-hidden">
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-100" />
      
      {/* Mobile Header */}
      <div className="md:hidden bg-gradient-to-r from-[#001f3d] to-[#0b2854] flex items-center justify-between p-4 text-white sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <img src={`${basePath}/logo.png`} alt="Logo" className="h-8 drop-shadow-md" />
          <span className="font-display font-bold">KJIHC Staff</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white/80 hover:text-white">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 fixed md:relative top-0 left-0 z-40 w-64 h-[100dvh] md:h-full bg-gradient-to-b from-[#001f3d] to-[#0b2854] text-white border-r border-white/10 transition-transform duration-300 ease-in-out flex flex-col shadow-xl md:shadow-none
      `}>
        {/* Logo + gold accent bar */}
        <div className="hidden md:block">
          <div className="px-6 pt-6 pb-4 flex items-center gap-3">
            <img src={`${basePath}/logo.png`} alt="KJIHC" className="h-10 w-auto drop-shadow-md" />
          </div>
          <div className="h-0.5 mx-4 rounded-full bg-[#f6a800] shadow-[0_0_8px_rgba(246,168,0,0.6)]" />
        </div>

        <div className="px-4 py-3 border-b border-white/10 mt-4 mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#f6a800] mb-0.5">Staff Portal</p>
          <p className="font-bold truncate text-sm text-white/90">{user?.firstName || user?.primaryEmailAddress?.emailAddress}</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location === item.path || (item.path !== '/staff' && location.startsWith(item.path))
            const showBadge = item.path === '/staff/messages' && msgUnread && !isActive
            return (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => { setMobileMenuOpen(false); if (item.path === '/staff/messages') setMsgUnread(false) }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                  isActive 
                    ? "bg-white/10 text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_6px_rgba(0,0,0,0.1)] ring-1 ring-white/5" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
                {showBadge && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10 mt-auto">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-white/60 hover:bg-white/5 hover:text-white gap-3"
            onClick={() => signOut({ redirectUrl: basePath })}
          >
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto min-h-[calc(100dvh-64px)] md:min-h-0 relative z-10">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Notification prompt — shown until enabled or dismissed for the session */}
          {pushState !== 'loading' && (
            <div className="mb-4">
              <NotificationPrompt
                state={pushState}
                onEnable={subscribe}
                onDisable={unsubscribe}
                dismissKey="kjihc_staff_notify_dismissed"
                theme="light"
              />
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  )
}
