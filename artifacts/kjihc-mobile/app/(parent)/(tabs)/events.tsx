import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, RefreshControl, ScrollView,
  Modal, KeyboardAvoidingView, Pressable, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

const LOGO = require('@/assets/images/club-logo.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useParentAuth } from '@/context/ParentAuthContext';
import { useListEvents, useGetParentChildren, getBaseUrl, getListEventsQueryKey } from '@workspace/api-client-react';
import type { Event, MemberDetail } from '@workspace/api-client-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  training: { bg: '#dbeafe', text: '#1d4ed8' },
  game:     { bg: '#dcfce7', text: '#15803d' },
  social:   { bg: '#fef3c7', text: '#b45309' },
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  training: 'Training', game: 'Game', social: 'Social',
};
const RSVP_OPTIONS: { key: string; label: string; icon: string; bg: string; text: string }[] = [
  { key: 'yes',   label: 'Going',     icon: 'checkmark-circle', bg: '#dcfce7', text: '#15803d' },
  { key: 'maybe', label: 'Maybe',     icon: 'help-circle',      bg: '#fef3c7', text: '#b45309' },
  { key: 'no',    label: 'Not going', icon: 'close-circle',     bg: '#fee2e2', text: '#b91c1c' },
];
const RSVP_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  yes:   { bg: '#dcfce7', text: '#15803d', label: '✓ Going' },
  no:    { bg: '#fee2e2', text: '#b91c1c', label: '✗ Not going' },
  maybe: { bg: '#fef3c7', text: '#b45309', label: '? Maybe' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}
function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function computeArriveBy(startTime: string, meetOffsetMins: number): string {
  const [h, m] = startTime.split(':').map(Number);
  let total = h * 60 + m - meetOffsetMins;
  if (total < 0) total += 24 * 60;
  const ah = Math.floor(total / 60) % 24;
  const am = total % 60;
  const period = ah >= 12 ? 'pm' : 'am';
  const display = ah > 12 ? ah - 12 : ah === 0 ? 12 : ah;
  return `${display}:${String(am).padStart(2, '0')} ${period}`;
}
function formatStartTime(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function getWeekLabel(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86400000,
  );
  if (diffDays < 0)  return 'Past';
  if (diffDays < 7)  return 'This week';
  if (diffDays < 14) return 'Next week';
  return 'Coming up';
}

// ─── RSVP hook ────────────────────────────────────────────────────────────────

function useParentRsvpEvent() {
  const { token } = useParentAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, memberId, status }: { eventId: number; memberId: number; status: string }) => {
      const base = getBaseUrl() ?? '';
      const res = await fetch(`${base}/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId, status }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save RSVP');
      }
      return res.json() as Promise<{ ok: boolean; status: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
    },
  });
}

// ─── Event detail + RSVP modal ────────────────────────────────────────────────

function EventDetailModal({
  event, child, onClose,
}: { event: Event; child: MemberDetail | undefined; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mutateAsync: rsvp, isPending } = useParentRsvpEvent();
  const [localRsvp, setLocalRsvp] = useState<string | null>(event.myRsvp ?? null);
  const badge = EVENT_TYPE_COLORS[event.eventType] ?? { bg: colors.muted, text: colors.mutedForeground };

  const handleRsvp = async (status: string) => {
    if (!child) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await rsvp({ eventId: event.id, memberId: child.id, status });
      setLocalRsvp(status);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const arriveBy   = computeArriveBy(event.startTime, event.meetOffsetMins);
  const kickOff    = formatStartTime(event.startTime);

  // ── Payment ──────────────────────────────────────────────────────────────
  const { token } = useParentAuth();
  const costPence = (event as { costPence?: number | null }).costPence ?? 0;
  const hasCost = costPence > 0 && !!child;
  const cardTotalPence = costPence + 10; // event cost + 10p handling fee
  const [payment, setPayment] = useState<
    { method: 'bank' | 'stripe' } | null | undefined
  >(undefined); // undefined = loading, null = not paid
  const [payBusy, setPayBusy] = useState(false);

  const mountedRef = React.useRef(true);
  const pollTimersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const fetchPayment = React.useCallback(() => {
    if (!child || !mountedRef.current) return;
    const base = getBaseUrl() ?? '';
    setPayment(undefined);
    fetch(`${base}/api/events/${event.id}/payments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { payments?: { memberId: number; method: 'bank' | 'stripe' }[] }) => {
        if (!mountedRef.current) return;
        const mine = (d.payments ?? []).find(p => p.memberId === child.id);
        setPayment(mine ? { method: mine.method } : null);
      })
      .catch(() => { if (mountedRef.current) setPayment(null); });
  }, [child, event.id, token]);

  // Stripe records the payment asynchronously via webhook, so poll a few times
  // after a successful return to catch the update.
  const pollPayment = React.useCallback(() => {
    fetchPayment();
    for (const delay of [2000, 5000, 10000]) {
      const t = setTimeout(() => { if (mountedRef.current) fetchPayment(); }, delay);
      pollTimersRef.current.push(t);
    }
  }, [fetchPayment]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollTimersRef.current.forEach(clearTimeout);
      pollTimersRef.current = [];
    };
  }, []);

  React.useEffect(() => {
    if (hasCost) fetchPayment();
  }, [hasCost, fetchPayment]);

  const handleMarkPaid = async () => {
    if (!child || payBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPayBusy(true);
    try {
      const base = getBaseUrl() ?? '';
      const res = await fetch(`${base}/api/events/${event.id}/payments/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId: child.id }),
      });
      if (!res.ok) throw new Error();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchPayment();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPayBusy(false);
    }
  };

  const handlePayByCard = async () => {
    if (!child || payBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPayBusy(true);
    try {
      const base = getBaseUrl() ?? '';
      const successUrl = `${base}/api/pay-return?status=success`;
      const cancelUrl = `${base}/api/pay-return?status=cancel`;
      const res = await fetch(`${base}/api/events/${event.id}/payments/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId: child.id, successUrl, cancelUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Payment failed');
      const result = await WebBrowser.openAuthSessionAsync(json.checkoutUrl, 'kjihc-mobile://paid');
      if (result.type === 'success' && result.url.includes('status=success')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thank you!', 'Your payment was received.');
        pollPayment();
      } else {
        fetchPayment();
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPayBusy(false);
    }
  };

  // Who's coming — sanitized list (names + status) from the API
  const [rsvpList, setRsvpList] = useState<{ playerName: string; status: string }[] | null>(null);
  React.useEffect(() => {
    const base = getBaseUrl() ?? '';
    fetch(`${base}/api/events/${event.id}/rsvp`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setRsvpList(d.responses ?? []))
      .catch(() => setRsvpList([]));
  }, [event.id, token, localRsvp]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
        {/* Header */}
        <LinearGradient colors={['#001f3d', '#003366']}
          style={[det.header, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={det.headerBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={[det.typePill, { backgroundColor: badge.bg }]}>
              <Text style={[det.typePillText, { color: badge.text }]}>
                {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
              </Text>
            </View>
            <Text style={det.title} numberOfLines={2}>{event.title}</Text>
          </View>
          <Image source={LOGO} style={det.logo} contentFit="contain" />
        </LinearGradient>

        <ScrollView contentContainerStyle={det.body} showsVerticalScrollIndicator={false}>
          {/* Details */}
          <View style={[det.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DetailRow icon="calendar-outline" label={formatDate(event.eventDate)} colors={colors} />
            <DetailRow icon="time-outline"     label={`Arrive by ${arriveBy} · Kick-off ${kickOff}`} colors={colors} />
            <DetailRow icon="location-outline" label={event.locationName} colors={colors} />
            {event.meetOffsetMins > 0 && (
              <DetailRow icon="walk-outline"
                label={`Arrive ${event.meetOffsetMins} min before kick-off`} colors={colors} />
            )}
          </View>

          {/* RSVP */}
          {child ? (
            <View style={det.section}>
              <Text style={[det.sectionLabel, { color: colors.mutedForeground }]}>
                {localRsvp ? 'CHANGE YOUR RSVP' : 'ARE YOU COMING?'}
              </Text>
              <View style={det.rsvpRow}>
                {RSVP_OPTIONS.map((opt) => {
                  const active = localRsvp === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[det.rsvpBtn,
                        active
                          ? { backgroundColor: opt.bg, borderColor: opt.text, borderWidth: 2 }
                          : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 },
                      ]}
                      onPress={() => handleRsvp(opt.key)}
                      disabled={isPending}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={20}
                        color={active ? opt.text : colors.mutedForeground}
                      />
                      <Text style={[det.rsvpBtnText, { color: active ? opt.text : colors.mutedForeground }]}>
                        {opt.label}
                      </Text>
                      {isPending && active && (
                        <ActivityIndicator size="small" color={opt.text} style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={[det.card, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[det.noChild, { color: colors.mutedForeground }]}>
                Select a child at the top to RSVP.
              </Text>
            </View>
          )}

          {/* Payment */}
          {hasCost && (
            <View style={det.section}>
              <Text style={[det.sectionLabel, { color: colors.mutedForeground }]}>PAYMENT</Text>
              <View style={[det.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={det.payCostRow}>
                  <Text style={[det.payCostLabel, { color: colors.mutedForeground }]}>Cost per player</Text>
                  <Text style={[det.payCostValue, { color: colors.foreground }]}>{formatPence(costPence)}</Text>
                </View>
                {payment === undefined ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : payment ? (
                  <View style={[det.paidBadge, { backgroundColor: '#dcfce7' }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                    <Text style={det.paidText}>
                      Paid ✓ ({payment.method === 'stripe' ? 'card' : 'bank'})
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[det.payBtn, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
                      onPress={handleMarkPaid}
                      disabled={payBusy}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cash-outline" size={18} color={colors.foreground} />
                      <Text style={[det.payBtnText, { color: colors.foreground }]}>I&apos;ve paid by bank</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[det.payBtn, det.payBtnPrimary]}
                      onPress={handlePayByCard}
                      disabled={payBusy}
                      activeOpacity={0.8}
                    >
                      {payBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="card-outline" size={18} color="#fff" />
                          <Text style={[det.payBtnText, { color: '#fff' }]}>
                            Pay by card {formatPence(cardTotalPence)} (incl. 10p handling)
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text style={[det.payNote, { color: colors.mutedForeground }]}>
                      Payment can take a few seconds to appear.
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Notes */}
          {event.notes ? (
            <View style={det.section}>
              <Text style={[det.sectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
              <View style={[det.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[det.notes, { color: colors.foreground }]}>{event.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* Who's coming */}
          <View style={det.section}>
            <Text style={[det.sectionLabel, { color: colors.mutedForeground }]}>WHO&apos;S COMING</Text>
            <View style={[det.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {rsvpList === null ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : rsvpList.length === 0 ? (
                <Text style={[det.noChild, { color: colors.mutedForeground }]}>No responses yet.</Text>
              ) : (
                rsvpList.map(r => {
                  const b = RSVP_BADGE[r.status];
                  return (
                    <View key={`${r.playerName}-${r.status}`} style={det.whoRow}>
                      <Text style={[det.whoName, { color: colors.foreground }]} numberOfLines={1}>{r.playerName}</Text>
                      {b && (
                        <View style={[det.whoBadge, { backgroundColor: b.bg }]}>
                          <Text style={[det.whoBadgeText, { color: b.text }]}>{b.label}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DetailRow({ icon, label, colors }: { icon: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={det.detailRow}>
      <Ionicons name={icon as any} size={16} color={colors.mutedForeground} />
      <Text style={[det.detailText, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

const det = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingBottom: 18 },
  headerBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  typePill:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  typePillText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 19, color: '#fff', lineHeight: 25 },
  logo:         { width: 60, height: 29, marginTop: 2 },
  body:         { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 64, gap: 12 },
  whoRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  whoName:      { fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1 },
  whoBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  whoBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  card:         { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText:   { fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1, lineHeight: 20 },
  section:      { gap: 8 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.6 },
  rsvpRow:      { flexDirection: 'row', gap: 8 },
  rsvpBtn:      { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 6 },
  rsvpBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 12, textAlign: 'center' },
  noChild:      { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center' },
  notes:        { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  payCostRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payCostLabel: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  payCostValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  paidBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  paidText:     { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#15803d' },
  payBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 },
  payBtnPrimary:{ backgroundColor: '#001f3d' },
  payBtnText:   { fontFamily: 'Inter_700Bold', fontSize: 13, textAlign: 'center' },
  payNote:      { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 2 },
});

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const colors = useColors();
  const badge  = EVENT_TYPE_COLORS[event.eventType] ?? { bg: colors.muted, text: colors.mutedForeground };
  const rsvp   = event.myRsvp ? RSVP_BADGE[event.myRsvp] : null;
  const costPence = (event as { costPence?: number | null }).costPence ?? 0;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={s.cardTop}>
        <View style={[s.typeBadge, { backgroundColor: badge.bg }]}>
          <Text style={[s.typeBadgeText, { color: badge.text }]}>
            {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
          </Text>
        </View>
        {rsvp ? (
          <View style={[s.rsvpBadge, { backgroundColor: rsvp.bg }]}>
            <Text style={[s.rsvpBadgeText, { color: rsvp.text }]}>{rsvp.label}</Text>
          </View>
        ) : (
          <View style={[s.rsvpBadge, { backgroundColor: colors.muted }]}>
            <Text style={[s.rsvpBadgeText, { color: colors.mutedForeground }]}>Tap to RSVP</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />
      </View>
      <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{event.title}</Text>
      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
          <Text style={[s.metaText, { color: colors.mutedForeground }]}>{formatDateShort(event.eventDate)}</Text>
        </View>
        {costPence > 0 && (
          <View style={s.metaItem}>
            <Ionicons name="cash-outline" size={14} color={colors.mutedForeground} />
            <Text style={[s.metaText, { color: colors.mutedForeground }]}>{formatPence(costPence)} per player</Text>
          </View>
        )}
        <View style={s.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
          <Text style={[s.metaText, { color: colors.mutedForeground }]}>
            Arrive {computeArriveBy(event.startTime, event.meetOffsetMins)}
          </Text>
        </View>
        <View style={s.metaItem}>
          <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
          <Text style={[s.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {event.locationName}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type ListItem = { type: 'header'; label: string } | { type: 'event'; event: Event };

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, selectedChildId, setSelectedChildId } = useParentAuth();
  const [showPast, setShowPast] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const topPad    = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const tabBarH   = Platform.OS === 'web' ? 84 : 80;

  const parentRequest = { headers: { Authorization: `Bearer ${token}` } };

  const { data: children, isLoading: childrenLoading, refetch: refetchChildren } =
    useGetParentChildren(
      {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { request: parentRequest, query: { enabled: !!token } as any },
    );

  const child = children
    ? (selectedChildId ? children.find(c => c.id === selectedChildId) ?? children[0] : children[0])
    : undefined;

  const { data: upcomingEvents, isLoading: eventsLoading, refetch: refetchUpcoming } =
    useListEvents(
      { upcoming: 'true', ageGroup: child?.ageGroup ?? undefined, memberId: child?.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { request: parentRequest, query: { enabled: !!child } as any },
    );

  const { data: pastEvents, refetch: refetchPast } =
    useListEvents(
      { upcoming: 'false', ageGroup: child?.ageGroup ?? undefined, memberId: child?.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { request: parentRequest, query: { enabled: !!child && showPast } as any },
    );

  const listItems = useMemo<ListItem[]>(() => {
    const grouped: Record<string, Event[]> = {};
    for (const event of (upcomingEvents ?? [])) {
      const label = getWeekLabel(event.eventDate);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(event);
    }
    const ORDER = ['This week', 'Next week', 'Coming up'];
    const sections = ORDER.filter(k => grouped[k]).map(k => ({ label: k, data: grouped[k] }));
    if (showPast && (pastEvents?.length ?? 0) > 0) {
      sections.push({ label: 'Past', data: pastEvents ?? [] });
    }
    return sections.flatMap(sec => [
      { type: 'header' as const, label: sec.label },
      ...sec.data.map(event => ({ type: 'event' as const, event })),
    ]);
  }, [upcomingEvents, pastEvents, showPast]);

  const isLoading = childrenLoading || eventsLoading;
  const handleRefresh = () => {
    refetchChildren(); refetchUpcoming(); if (showPast) refetchPast();
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header + inline child selector */}
      <LinearGradient colors={['#001f3d', '#003366']} style={[s.header, { paddingTop: topPad + 4 }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={s.goldAccent} />
            <Text style={s.headerTitle}>Events</Text>
            {child && <Text style={s.headerSub}>{child.ageGroup.toUpperCase()}</Text>}
          </View>
          <View style={s.headerRight}>
            {eventsLoading && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />}
            <Image source={LOGO} style={s.headerLogo} contentFit="contain" />
          </View>
        </View>

        {/* Child selector — compact horizontal pills inside the header band */}
        {children && children.length > 1 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pillRow}
            style={s.pillScroll}
          >
            {children.map((c) => {
              const active = c.id === (child?.id ?? children[0]?.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.pill, active ? s.pillActive : s.pillInactive]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedChildId(c.id); }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.pillText, { color: active ? '#001f3d' : '#fff' }]}>
                    {c.playerName.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      {isLoading && !upcomingEvents ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Loading events…</Text>
        </View>
      ) : listItems.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No upcoming events</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Check back soon for new training sessions and games.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `h-${item.label}` : `e-${(item as {type:'event';event:Event}).event.id}-${i}`
          }
          renderItem={({ item }) =>
            item.type === 'header'
              ? <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{item.label.toUpperCase()}</Text>
              : <EventCard event={item.event} onPress={() => { Haptics.selectionAsync(); setSelectedEvent(item.event); }} />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + tabBarH + 8, paddingTop: 12 }}
          refreshControl={
            <RefreshControl refreshing={!!(isLoading && upcomingEvents)} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListFooterComponent={() => (
            <TouchableOpacity
              style={[s.pastBtn, { borderColor: colors.border }]}
              onPress={() => setShowPast(!showPast)}
            >
              <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              <Text style={[s.pastBtnText, { color: colors.mutedForeground }]}>
                {showPast ? 'Hide past events' : 'Show past events'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          child={child}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight:  { flexDirection: 'row', alignItems: 'center' },
  headerLogo:   { width: 72, height: 34 },
  goldAccent:   { width: 28, height: 3, borderRadius: 2, backgroundColor: '#f6a800', marginBottom: 8 },
  headerTitle:  { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#fff' },
  headerSub:    { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  // Compact pill row — lives inside the gradient, never taller than its content
  pillScroll:   { marginTop: 10 },
  pillRow:      { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  pill:         { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  pillActive:   { backgroundColor: '#f6a800' },
  pillInactive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pillText:     { fontFamily: 'Inter_700Bold', fontSize: 13 },

  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle:   { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center' },
  emptyText:    { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  card:         { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText:{ fontFamily: 'Inter_700Bold', fontSize: 11 },
  rsvpBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rsvpBadgeText:{ fontFamily: 'Inter_700Bold', fontSize: 11 },
  cardTitle:    { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 10, lineHeight: 22 },
  cardMeta:     { gap: 5 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:     { fontFamily: 'Inter_400Regular', fontSize: 13 },
  pastBtn:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 12, marginTop: 8,
  },
  pastBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
