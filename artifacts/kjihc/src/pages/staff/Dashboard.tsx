import { useGetDashboardStats, useGetAttendanceTrend, useGetAgeGroupBreakdown, useGetRecentSignins, useListEvents } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Activity, HeartPulse, Calendar, Clock, MapPin, Trophy, Dumbbell, PartyPopper, ArrowRight } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const EVENT_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; text: string }> = {
  training: { label: "Training",  icon: Dumbbell,     bg: "bg-blue-100",   text: "text-blue-700"  },
  game:     { label: "Game",      icon: Trophy,       bg: "bg-amber-100",  text: "text-amber-700" },
  social:   { label: "Social",    icon: PartyPopper,  bg: "bg-purple-100", text: "text-purple-700" },
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats()
  const { data: trendData } = useGetAttendanceTrend()
  const { data: breakdownData } = useGetAgeGroupBreakdown()
  const { data: recentSignins } = useGetRecentSignins()
  const { data: upcomingEvents, isLoading: eventsLoading, isError: eventsError } = useListEvents({ upcoming: "true" })

  if (statsLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading dashboard...</div>
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-display font-bold">Dashboard</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-primary shadow-sm hover-elevate">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Members</p>
                <h3 className="text-3xl font-bold">{stats?.totalMembers || 0}</h3>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-full">
                <Users size={20} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4"><span className="text-green-600 font-medium">{stats?.activeMembers || 0}</span> active recently</p>
          </CardContent>
        </Card>
        
        <Card className="border-t-4 border-t-secondary shadow-sm hover-elevate">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Sessions this Month</p>
                <h3 className="text-3xl font-bold">{stats?.sessionsThisMonth || 0}</h3>
              </div>
              <div className="p-3 bg-secondary/20 text-secondary-foreground rounded-full">
                <Calendar size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-accent shadow-sm hover-elevate">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Medical Records</p>
                <h3 className="text-3xl font-bold">{stats?.membersWithMedical || 0}</h3>
              </div>
              <div className="p-3 bg-accent/10 text-accent rounded-full">
                <HeartPulse size={20} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Members with medical notes</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-chart-5 shadow-sm hover-elevate">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Avg Attendance</p>
                <h3 className="text-3xl font-bold">
                  {trendData && trendData.length > 0 ? 
                    Math.round(trendData.reduce((acc, curr) => acc + curr.count, 0) / trendData.length) : 0}
                </h3>
              </div>
              <div className="p-3 bg-chart-5/10 text-chart-5 rounded-full">
                <Activity size={20} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Players per week (last 8 weeks)</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events Widget */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
          <div>
            <CardTitle className="text-lg">Upcoming Events</CardTitle>
            <CardDescription>Next sessions and games</CardDescription>
          </div>
          <Link
            to={`${BASE}/staff/events`}
            className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
          >
            View all <ArrowRight size={14} />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {eventsLoading ? (
            <div className="px-6 py-10 text-center text-muted-foreground text-sm animate-pulse">Loading events…</div>
          ) : eventsError ? (
            <div className="px-6 py-10 text-center text-sm text-destructive">Could not load upcoming events</div>
          ) : upcomingEvents && upcomingEvents.length > 0 ? (
            <ul className="divide-y">
              {upcomingEvents.slice(0, 5).map((event) => {
                const meta = EVENT_TYPE_META[event.eventType ?? "training"] ?? EVENT_TYPE_META["training"]
                const Icon = meta.icon
                const counts = (event as any).rsvpCounts as { yes: number; no: number; maybe: number } | undefined
                return (
                  <li key={event.id}>
                    <Link
                      to={`${BASE}/staff/events`}
                      className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`mt-0.5 p-2 rounded-lg ${meta.bg} ${meta.text} shrink-0`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {formatEventDate(event.eventDate)}
                          </span>
                          {event.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {event.startTime.slice(0, 5)}
                            </span>
                          )}
                          {event.locationName && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              <span className="truncate max-w-[120px]">{event.locationName}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {counts && (
                        <div className="shrink-0 flex gap-2 text-xs mt-0.5">
                          <span className="flex items-center gap-0.5 text-green-700 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                            {counts.yes}
                          </span>
                          <span className="flex items-center gap-0.5 text-red-700 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                            {counts.no}
                          </span>
                          <span className="flex items-center gap-0.5 text-amber-700 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {counts.maybe}
                          </span>
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-muted-foreground text-sm">
              No upcoming events scheduled
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Attendance Trend (Last 8 Weeks)</CardTitle>
            <CardDescription>Total players signed in across all sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {trendData && trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 6, fill: 'hsl(var(--accent))' }} name="Players" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Age Group Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Members by Age Group</CardTitle>
            <CardDescription>Current active roster</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {breakdownData && breakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="ageGroup" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Players">
                      {breakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Recent Sign-ins</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-3">Player</th>
                <th className="px-6 py-3">Session</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentSignins?.map((event) => (
                <tr key={event.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 font-medium">{event.memberName}</td>
                  <td className="px-6 py-4">{event.session}</td>
                  <td className="px-6 py-4">{new Date(event.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {event.missReason ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        Absent: {event.missReason}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        Present
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!recentSignins || recentSignins.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No recent sign-ins found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
