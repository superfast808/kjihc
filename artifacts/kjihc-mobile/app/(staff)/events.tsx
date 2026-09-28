import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Alert, TextInput, Modal,
  ScrollView, KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useListMembers, useGetMyStaffProfile, getListEventsQueryKey, customFetch } from '@workspace/api-client-react';
import type { Member } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Types & constants ────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'training', label: 'Training', icon: 'barbell-outline' as const, color: '#2563eb', bg: '#eff6ff', gradA: '#2563eb', gradB: '#1d4ed8' },
  { value: 'game',     label: 'Game',     icon: 'trophy-outline'  as const, color: '#b45309', bg: '#fffbeb', gradA: '#f59e0b', gradB: '#d97706' },
  { value: 'social',   label: 'Social',   icon: 'people-outline'  as const, color: '#7c3aed', bg: '#f5f3ff', gradA: '#8b5cf6', gradB: '#7c3aed' },
] as const;

type EventType = 'training' | 'game' | 'social';

const AGE_GROUPS = ['LTP', 'u10', 'u12', 'u14', 'u16', 'u19', 'lightning'] as const;
const AGE_LABELS: Record<string, string> = {
  LTP: 'LTP', u10: 'U10', u12: 'U12', u14: 'U14', u16: 'U16', u19: 'U19', lightning: 'Lightning',
};

function typeInfo(t: string) { return EVENT_TYPES.find(e => e.value === t) ?? EVENT_TYPES[0]; }

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
}
function formatPence(pence: number) { return `£${(pence / 100).toFixed(2)}`; }
function dateToYMD(d: Date) { return d.toISOString().slice(0, 10); }
function dateToHM(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function ymdToDate(s: string) { return s ? new Date(s + 'T00:00:00') : new Date(); }
function hmToDate(s: string) {
  const d = new Date(); if (!s) return d;
  const [h, m] = s.split(':').map(Number);
  d.setHours(h, m, 0, 0); return d;
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function getEligibleChildren(event: any, children: any[]): any[] {
  if (!children || !children.length) return [];
  return children.filter(child => {
    if (event.isRosterRestricted === 1) {
      const roster: number[] = event.rosterMemberIds ?? [];
      return roster.includes(child.id);
    }
    if (event.ageGroups) {
      const allowed = (event.ageGroups as string).split(',').map((g: string) => g.trim()).filter(Boolean);
      if (allowed.length > 0) {
        const childGroups = [child.ageGroup, ...(child.addAgeGroup
          ? (child.addAgeGroup as string).split(',').map((g: string) => g.trim())
          : [])].filter(Boolean);
        return childGroups.some(g => allowed.includes(g));
      }
    }
    return true;
  });
}

const RSVP_STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  yes:   { label: '✓ Going',    color: '#15803d', bg: '#dcfce7' },
  maybe: { label: '? Maybe',    color: '#a16207', bg: '#fef9c3' },
  no:    { label: "✗ Can't go", color: '#b91c1c', bg: '#fee2e2' },
};

function EventCard({
  event, index, onPress, staffChildren, onRsvpPress, staffRsvpMap,
}: {
  event: any; index: number; onPress: () => void;
  staffChildren?: any[]; onRsvpPress?: (child: any) => void;
  staffRsvpMap?: Record<number, string>;
}) {
  const colors = useColors();
  const eligibleChildren = getEligibleChildren(event, staffChildren ?? []);
  const info = typeInfo(event.eventType);
  const counts = event.rsvpCounts ?? { yes: 0, no: 0, maybe: 0 };
  const isPast = event.eventDate < new Date().toISOString().slice(0, 10);
  const ageLabels = event.ageGroups
    ? (event.ageGroups as string).split(',').map(g => AGE_LABELS[g.trim()] ?? g.trim()).filter(Boolean)
    : [];
  const myRsvpStatus = staffRsvpMap ? (staffRsvpMap[event.id] ?? null) : null;
  const rsvpDisplay = myRsvpStatus ? RSVP_STATUS_DISPLAY[myRsvpStatus] : null;
  const costPence: number = event.costPence ?? 0;

  // Expandable "who's coming" list
  const [showRsvps, setShowRsvps] = useState(false);
  const [rsvpList, setRsvpList] = useState<{ playerName: string; status: string }[] | null>(null);
  const toggleRsvps = () => {
    Haptics.selectionAsync();
    const next = !showRsvps;
    setShowRsvps(next);
    if (next && rsvpList === null) {
      customFetch<{ responses: { playerName: string; status: string }[] }>(`/api/events/${event.id}/rsvp`)
        .then(d => setRsvpList(d.responses ?? []))
        .catch(() => setRsvpList([]));
    }
  };

  // Expandable payments list (only for paid events)
  const [showPayments, setShowPayments] = useState(false);
  const [payments, setPayments] = useState<
    { playerName?: string; method: 'bank' | 'stripe' }[] | null
  >(null);
  const togglePayments = () => {
    Haptics.selectionAsync();
    const next = !showPayments;
    setShowPayments(next);
    if (next && payments === null) {
      customFetch<{ payments: { playerName?: string; method: 'bank' | 'stripe' }[] }>(`/api/events/${event.id}/payments`)
        .then(d => setPayments(d.payments ?? []))
        .catch(() => setPayments([]));
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).springify().damping(18)}
      layout={LinearTransition.springify()}
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: isPast ? 0.65 : 1 }]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ flex: 1 }}>
        {/* Colored top bar */}
        <LinearGradient
          colors={[info.gradA, info.gradB]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.cardBar}
        />

        <View style={s.cardBody}>
          {/* Type badge + age groups + edit hint */}
          <View style={s.cardTopRow}>
            <View style={[s.typeBadge, { backgroundColor: info.bg }]}>
              <Ionicons name={info.icon} size={12} color={info.color} />
              <Text style={[s.typeBadgeText, { color: info.color }]}>{info.label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {ageLabels.length > 0 && (
                <Text style={[s.ageText, { color: colors.mutedForeground }]}>
                  {ageLabels.join(' · ')}
                </Text>
              )}
              <Ionicons name="create-outline" size={15} color={colors.mutedForeground} />
            </View>
          </View>

          {/* Title */}
          <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {event.title}
          </Text>

          {/* Date & time */}
          <View style={s.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
            <Text style={[s.metaText, { color: colors.mutedForeground }]}>
              {fmtDate(event.eventDate)}
            </Text>
          </View>
          <View style={s.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={[s.metaText, { color: colors.mutedForeground }]}>
              {fmtTime(event.startTime)}{event.endTime ? ` – ${fmtTime(event.endTime)}` : ''}
            </Text>
          </View>
          {event.locationName ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
              <Text style={[s.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {event.locationName}
              </Text>
            </View>
          ) : null}
          {costPence > 0 ? (
            <View style={s.metaRow}>
              <Ionicons name="cash-outline" size={13} color={colors.mutedForeground} />
              <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                {formatPence(costPence)} per player
              </Text>
            </View>
          ) : null}

          {/* RSVP pill row — tap to see who's coming */}
          <TouchableOpacity style={s.rsvpRow} onPress={toggleRsvps} activeOpacity={0.7}>
            <View style={[s.rsvpPill, { backgroundColor: '#dcfce7' }]}>
              <Text style={[s.rsvpPillText, { color: '#15803d' }]}>✓ {counts.yes} going</Text>
            </View>
            {counts.no > 0 && (
              <View style={[s.rsvpPill, { backgroundColor: '#fee2e2' }]}>
                <Text style={[s.rsvpPillText, { color: '#b91c1c' }]}>✗ {counts.no} no</Text>
              </View>
            )}
            {counts.maybe > 0 && (
              <View style={[s.rsvpPill, { backgroundColor: '#fef9c3' }]}>
                <Text style={[s.rsvpPillText, { color: '#a16207' }]}>? {counts.maybe} maybe</Text>
              </View>
            )}
            {(counts.yes + counts.no + counts.maybe) > 0 && (
              <Ionicons name={showRsvps ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
          {showRsvps && (
            <View style={[s.rsvpListWrap, { borderTopColor: colors.border }]}>
              {rsvpList === null ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginVertical: 6 }} />
              ) : rsvpList.length === 0 ? (
                <Text style={[s.rsvpListEmpty, { color: colors.mutedForeground }]}>No responses yet.</Text>
              ) : (
                rsvpList.map(r => {
                  const chip = RSVP_CHIP[r.status] ?? RSVP_CHIP.pending;
                  return (
                    <View key={r.playerName + r.status} style={s.rsvpListRow}>
                      <Text style={[s.rsvpListName, { color: colors.foreground }]} numberOfLines={1}>{r.playerName}</Text>
                      <View style={[s.rsvpChip, { backgroundColor: chip.bg }]}>
                        <Text style={[s.rsvpChipText, { color: chip.color }]}>{chip.label}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Payments — only for paid events */}
          {costPence > 0 && (
            <>
              <TouchableOpacity style={s.rsvpRow} onPress={togglePayments} activeOpacity={0.7}>
                <View style={[s.rsvpPill, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[s.rsvpPillText, { color: '#1d4ed8' }]}>
                    💷 {payments === null ? '…' : payments.length} paid
                  </Text>
                </View>
                <Ionicons name={showPayments ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showPayments && (
                <View style={[s.rsvpListWrap, { borderTopColor: colors.border }]}>
                  {payments === null ? (
                    <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginVertical: 6 }} />
                  ) : payments.length === 0 ? (
                    <Text style={[s.rsvpListEmpty, { color: colors.mutedForeground }]}>No payments yet.</Text>
                  ) : (
                    payments.map((p, i) => (
                      <View key={(p.playerName ?? 'player') + i} style={s.rsvpListRow}>
                        <Text style={[s.rsvpListName, { color: colors.foreground }]} numberOfLines={1}>
                          {p.playerName ?? 'Player'}
                        </Text>
                        <View style={[s.rsvpChip, { backgroundColor: p.method === 'stripe' ? '#dbeafe' : '#dcfce7' }]}>
                          <Text style={[s.rsvpChipText, { color: p.method === 'stripe' ? '#1d4ed8' : '#15803d' }]}>
                            {p.method === 'stripe' ? 'Card' : 'Bank'}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
      {eligibleChildren.length > 0 && onRsvpPress && (
        <TouchableOpacity
          style={[s.rsvpStrip, { borderTopColor: colors.border }]}
          onPress={() => onRsvpPress(eligibleChildren[0])}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={15} color="#001f3d" />
          <Text style={s.rsvpStripLabel}>{eligibleChildren[0].playerName}</Text>
          {rsvpDisplay ? (
            <View style={[s.rsvpStatusBadge, { backgroundColor: rsvpDisplay.bg }]}>
              <Text style={[s.rsvpStatusText, { color: rsvpDisplay.color }]}>{rsvpDisplay.label}</Text>
            </View>
          ) : (
            <Text style={s.rsvpStripAction}>RSVP as parent →</Text>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

type FormState = {
  title: string;
  eventType: EventType;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  ageGroups: string[];
  notes: string;
  memberIds: number[];
  cost: string; // pounds text, '' = free
};
const EMPTY: FormState = {
  title: '', eventType: 'training', eventDate: '', startTime: '', endTime: '',
  locationName: '', ageGroups: [], notes: '', memberIds: [], cost: '',
};

/** Convert the pounds text field to integer pence, or null when empty/invalid. */
function costToPence(cost: string): number | null {
  const t = cost.trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const RSVP_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  yes:     { label: '✓ Going',   color: '#15803d', bg: '#dcfce7' },
  maybe:   { label: '? Maybe',   color: '#a16207', bg: '#fef9c3' },
  no:      { label: '✗ No',      color: '#b91c1c', bg: '#fee2e2' },
  pending: { label: '· Pending', color: '#64748b', bg: '#f1f5f9' },
};

function EventFormBody({
  form, setForm, activePicker, setActivePicker,
  members, playerSearch, onPlayerSearchChange, rsvpByMemberId,
  allowedAgeGroups,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  activePicker: 'date' | 'start' | 'end' | null;
  setActivePicker: React.Dispatch<React.SetStateAction<'date' | 'start' | 'end' | null>>;
  members?: any[];
  playerSearch?: string;
  onPlayerSearchChange?: (q: string) => void;
  rsvpByMemberId?: Record<number, string>;
  /** When non-null, only these age-group chips are shown (coach-scoped). */
  allowedAgeGroups?: string[] | null;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const filteredPlayers = useMemo(() => {
    if (!members) return [];
    if (!(playerSearch ?? '').trim()) return members;
    const q = (playerSearch ?? '').toLowerCase();
    return members.filter((m: any) => (m.playerName ?? '').toLowerCase().includes(q));
  }, [members, playerSearch]);

  const selectedPlayers = useMemo(
    () => (members ?? []).filter((m: any) => form.memberIds.includes(m.id)),
    [members, form.memberIds],
  );

  const togglePlayer = (id: number) =>
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter(x => x !== id) : [...f.memberIds, id],
    }));

  const openPicker = (target: 'date' | 'start' | 'end') => {
    setActivePicker(prev => (prev === target ? null : target));
    Haptics.selectionAsync();
  };

  const pickerValue = useMemo(() => {
    if (activePicker === 'date') return form.eventDate ? ymdToDate(form.eventDate) : new Date();
    if (activePicker === 'start') return form.startTime ? hmToDate(form.startTime) : hmToDate('18:00');
    if (activePicker === 'end') return form.endTime ? hmToDate(form.endTime) : hmToDate('19:30');
    return new Date();
  }, [activePicker, form]);

  const handlePickerChange = (_: any, d?: Date) => {
    if (Platform.OS === 'android') setActivePicker(null);
    if (!d || !activePicker) return;
    if (activePicker === 'date') setForm(f => ({ ...f, eventDate: dateToYMD(d) }));
    else if (activePicker === 'start') setForm(f => ({ ...f, startTime: dateToHM(d) }));
    else setForm(f => ({ ...f, endTime: dateToHM(d) }));
  };

  const toggleAge = (g: string) =>
    setForm(f => ({ ...f, ageGroups: f.ageGroups.includes(g) ? f.ageGroups.filter(a => a !== g) : [...f.ageGroups, g] }));

  // Chips shown: all groups if unrestricted, or only the coach's assigned groups.
  const visibleAgeGroups: readonly string[] = allowedAgeGroups ?? AGE_GROUPS;

  return (
    <ScrollView contentContainerStyle={[s.formScroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      {/* Event type */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>EVENT TYPE</Text>
      <View style={s.typeRow}>
        {EVENT_TYPES.map(t => {
          const active = form.eventType === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => { setForm(f => ({ ...f, eventType: t.value })); Haptics.selectionAsync(); }}
              style={s.typeBtnWrap}
              activeOpacity={0.8}
            >
              {active ? (
                <LinearGradient colors={[t.gradA, t.gradB]} style={s.typeBtn}>
                  <Ionicons name={t.icon} size={22} color="#fff" />
                  <Text style={[s.typeBtnLabel, { color: '#fff' }]}>{t.label}</Text>
                </LinearGradient>
              ) : (
                <View style={[s.typeBtn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}>
                  <Ionicons name={t.icon} size={22} color={colors.mutedForeground} />
                  <Text style={[s.typeBtnLabel, { color: colors.mutedForeground }]}>{t.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Title */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>TITLE</Text>
      <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[s.formInput, { color: colors.foreground }]}
          value={form.title}
          onChangeText={t => setForm(f => ({ ...f, title: t }))}
          placeholder="e.g. U12 Training Session"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
        />
      </View>

      {/* Date & time — inline pickers (no nested Modal) */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>DATE & TIME</Text>
      <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* Date row */}
        <TouchableOpacity
          style={[s.pickerRow, { borderBottomColor: colors.border, backgroundColor: activePicker === 'date' ? colors.muted : 'transparent' }]}
          onPress={() => openPicker('date')} activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
          <Text style={[s.pickerRowLabel, { color: colors.mutedForeground }]}>Date</Text>
          <Text style={[s.pickerRowValue, { color: form.eventDate ? colors.foreground : colors.mutedForeground }]}>
            {form.eventDate ? fmtDate(form.eventDate) : 'Tap to pick'}
          </Text>
          <Ionicons name={activePicker === 'date' ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
        </TouchableOpacity>
        {activePicker === 'date' && (
          <View style={[s.inlinePicker, { borderBottomColor: colors.border }]}>
            {Platform.OS === 'web' ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                {/* @ts-ignore — HTML element valid in Expo web context */}
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(e: any) => {
                    setForm(f => ({ ...f, eventDate: e.target.value }));
                    setActivePicker(null);
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '15px',
                    borderRadius: '10px', border: `1px solid ${colors.border}`,
                    backgroundColor: 'transparent', color: colors.foreground,
                    fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                    colorScheme: 'dark',
                  }}
                />
              </View>
            ) : (
              <>
                <DateTimePicker
                  value={pickerValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handlePickerChange}
                  style={{ width: '100%' }}
                  accentColor="#001f3d"
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setActivePicker(null)} style={s.inlinePickerDone}>
                    <Text style={s.inlinePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* Start time row */}
        <TouchableOpacity
          style={[s.pickerRow, { borderBottomColor: colors.border, backgroundColor: activePicker === 'start' ? colors.muted : 'transparent' }]}
          onPress={() => openPicker('start')} activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
          <Text style={[s.pickerRowLabel, { color: colors.mutedForeground }]}>Start</Text>
          <Text style={[s.pickerRowValue, { color: form.startTime ? colors.foreground : colors.mutedForeground }]}>
            {form.startTime ? fmtTime(form.startTime) : 'Tap to pick'}
          </Text>
          <Ionicons name={activePicker === 'start' ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
        </TouchableOpacity>
        {activePicker === 'start' && (
          <View style={[s.inlinePicker, { borderBottomColor: colors.border }]}>
            {Platform.OS === 'web' ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                {/* @ts-ignore — HTML element valid in Expo web context */}
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e: any) => {
                    setForm(f => ({ ...f, startTime: e.target.value }));
                    setActivePicker(null);
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '15px',
                    borderRadius: '10px', border: `1px solid ${colors.border}`,
                    backgroundColor: 'transparent', color: colors.foreground,
                    fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                    colorScheme: 'dark',
                  }}
                />
              </View>
            ) : (
              <>
                <DateTimePicker
                  value={pickerValue}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePickerChange}
                  style={{ width: '100%' }}
                  textColor={colors.foreground}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setActivePicker(null)} style={s.inlinePickerDone}>
                    <Text style={s.inlinePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* End time row */}
        <TouchableOpacity
          style={[s.pickerRow, { borderBottomWidth: 0, backgroundColor: activePicker === 'end' ? colors.muted : 'transparent' }]}
          onPress={() => openPicker('end')} activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
          <Text style={[s.pickerRowLabel, { color: colors.mutedForeground }]}>End</Text>
          <Text style={[s.pickerRowValue, { color: form.endTime ? colors.foreground : colors.mutedForeground }]}>
            {form.endTime ? fmtTime(form.endTime) : 'Optional'}
          </Text>
          <Ionicons name={activePicker === 'end' ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
        </TouchableOpacity>
        {activePicker === 'end' && (
          <View style={s.inlinePicker}>
            {Platform.OS === 'web' ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                {/* @ts-ignore — HTML element valid in Expo web context */}
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e: any) => {
                    setForm(f => ({ ...f, endTime: e.target.value }));
                    setActivePicker(null);
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '15px',
                    borderRadius: '10px', border: `1px solid ${colors.border}`,
                    backgroundColor: 'transparent', color: colors.foreground,
                    fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                    colorScheme: 'dark',
                  }}
                />
              </View>
            ) : (
              <>
                <DateTimePicker
                  value={pickerValue}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePickerChange}
                  style={{ width: '100%' }}
                  textColor={colors.foreground}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setActivePicker(null)} style={s.inlinePickerDone}>
                    <Text style={s.inlinePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

      </View>

      {/* Location */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>LOCATION <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL)</Text></Text>
      <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.pickerRow}>
          <Ionicons name="location-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
          <TextInput
            style={[s.formInputInline, { color: colors.foreground, flex: 1 }]}
            value={form.locationName}
            onChangeText={t => setForm(f => ({ ...f, locationName: t }))}
            placeholder="e.g. Irvine Ice Rink"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      </View>

      {/* Cost per player */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>COST PER PLAYER <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL — LEAVE BLANK IF FREE)</Text></Text>
      <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.pickerRow}>
          <Text style={[s.formInputInline, { color: colors.mutedForeground, marginRight: 4 }]}>£</Text>
          <TextInput
            style={[s.formInputInline, { color: colors.foreground, flex: 1 }]}
            value={form.cost}
            onChangeText={t => setForm(f => ({ ...f, cost: t }))}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Age groups */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>AGE GROUPS</Text>
      <View style={s.ageChips}>
        {visibleAgeGroups.map(g => {
          const active = form.ageGroups.includes(g);
          return (
            <TouchableOpacity
              key={g}
              onPress={() => { toggleAge(g); Haptics.selectionAsync(); }}
              style={[s.ageChip, {
                backgroundColor: active ? '#001f3d' : colors.muted,
                borderColor: active ? '#f6a800' : colors.border,
                borderWidth: active ? 2 : 1,
              }]}
              activeOpacity={0.7}
            >
              <Text style={[s.ageChipText, { color: active ? '#fff' : colors.foreground }]}>
                {active ? '✓ ' : ''}{AGE_LABELS[g] ?? g}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notes */}
      <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>NOTES <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL)</Text></Text>
      <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[s.formInput, s.notesInput, { color: colors.foreground }]}
          value={form.notes}
          onChangeText={t => setForm(f => ({ ...f, notes: t }))}
          placeholder="Kit requirements, what to bring, special instructions…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Specific players — only shown when members are provided (edit mode) */}
      {members !== undefined && (
        <>
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>
            SPECIFIC PLAYERS{' '}
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL — leave blank for all eligible)</Text>
          </Text>
          {selectedPlayers.length > 0 && (
            <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 8 }]}>
              {selectedPlayers.map((m: any, idx: number) => {
                const rsvpKey = rsvpByMemberId ? (rsvpByMemberId[m.id] ?? 'pending') : null;
                const chip = rsvpKey ? RSVP_CHIP[rsvpKey] : null;
                return (
                  <View
                    key={m.id}
                    style={[
                      s.rosterRow,
                      {
                        borderBottomWidth: idx < selectedPlayers.length - 1 ? 0.5 : 0,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View style={[s.playerAvatar, { backgroundColor: colors.muted }]}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: colors.mutedForeground }}>
                        {(m.playerName ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[s.rosterName, { color: colors.foreground }]} numberOfLines={1}>
                      {m.playerName}
                    </Text>
                    {chip && (
                      <View style={[s.rsvpChip, { backgroundColor: chip.bg }]}>
                        <Text style={[s.rsvpChipText, { color: chip.color }]}>{chip.label}</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => togglePlayer(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.pickerRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.formInputInline, { color: colors.foreground, flex: 1 }]}
                value={playerSearch ?? ''}
                onChangeText={onPlayerSearchChange}
                placeholder="Search players to add…"
                placeholderTextColor={colors.mutedForeground}
              />
              {(playerSearch ?? '').length > 0 && (
                <TouchableOpacity onPress={() => onPlayerSearchChange?.('')}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {(playerSearch ?? '').trim().length > 0 && (
            <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 6 }]}>
              {filteredPlayers.length === 0 ? (
                <View style={{ padding: 14 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>No players found</Text>
                </View>
              ) : filteredPlayers.slice(0, 8).map((m: any, idx: number) => {
                const sel = form.memberIds.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => { togglePlayer(m.id); Haptics.selectionAsync(); }}
                    style={[
                      s.pickerRow,
                      {
                        borderBottomWidth: idx < Math.min(filteredPlayers.length, 8) - 1 ? 0.5 : 0,
                        borderBottomColor: colors.border,
                        backgroundColor: sel ? '#001f3d08' : 'transparent',
                      },
                    ]}
                  >
                    <View style={[s.playerAvatar, { backgroundColor: sel ? '#001f3d' : colors.muted }]}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: sel ? '#fff' : colors.mutedForeground }}>
                        {(m.playerName ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.foreground }}>{m.playerName}</Text>
                      {m.ageGroup && (
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.mutedForeground }}>
                          {AGE_LABELS[m.ageGroup as keyof typeof AGE_LABELS] ?? m.ageGroup}
                        </Text>
                      )}
                    </View>
                    {sel && <Ionicons name="checkmark-circle" size={20} color="#15803d" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
function CreateModal({
  visible, onClose, allowedAgeGroups,
}: {
  visible: boolean;
  onClose: (saved?: boolean) => void;
  /** When non-null, only these age-group chips are shown (coach-scoped). */
  allowedAgeGroups?: string[] | null;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { mutateAsync: createEvent, isPending } = useCreateEvent();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [playerSearch, setPlayerSearch] = useState('');
  const { data: members } = useListMembers({});

  // Chips shown: all groups if unrestricted, or only the coach's assigned groups.
  const visibleAgeGroupsCreate: readonly string[] = allowedAgeGroups ?? AGE_GROUPS;

  const filteredPlayers = useMemo(() => {
    const list = (members ?? []) as any[];
    if (!playerSearch.trim()) return list;
    const q = playerSearch.toLowerCase();
    return list.filter(m => (m.playerName ?? '').toLowerCase().includes(q));
  }, [members, playerSearch]);

  const selectedPlayers = useMemo(
    () => ((members ?? []) as any[]).filter(m => form.memberIds.includes(m.id)),
    [members, form.memberIds],
  );

  const togglePlayer = (id: number) =>
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter(x => x !== id) : [...f.memberIds, id],
    }));

  // Inline date/time picker state — a single field open at a time.
  // Nested Modals are broken on iOS, so we render DateTimePicker inline in the
  // ScrollView instead of wrapping it in its own Modal.
  const [activePicker, setActivePicker] = useState<'date' | 'start' | 'end' | null>(null);

  const openPicker = (target: 'date' | 'start' | 'end') => {
    setActivePicker(prev => (prev === target ? null : target));
    Haptics.selectionAsync();
  };

  const pickerMode = activePicker === 'date' ? 'date' : 'time';

  const pickerValue = useMemo(() => {
    if (activePicker === 'date') return form.eventDate ? ymdToDate(form.eventDate) : new Date();
    if (activePicker === 'start') return form.startTime ? hmToDate(form.startTime) : hmToDate('18:00');
    if (activePicker === 'end') return form.endTime ? hmToDate(form.endTime) : hmToDate('19:30');
    return new Date();
  }, [activePicker, form]);

  const handlePickerChange = (_: any, d?: Date) => {
    if (Platform.OS === 'android') {
      // Android dialog auto-dismisses on selection
      setActivePicker(null);
    }
    if (!d || !activePicker) return;
    if (activePicker === 'date') setForm(f => ({ ...f, eventDate: dateToYMD(d) }));
    else if (activePicker === 'start') setForm(f => ({ ...f, startTime: dateToHM(d) }));
    else setForm(f => ({ ...f, endTime: dateToHM(d) }));
  };

  const toggleAge = (g: string) =>
    setForm(f => ({ ...f, ageGroups: f.ageGroups.includes(g) ? f.ageGroups.filter(a => a !== g) : [...f.ageGroups, g] }));

  // Auto-pre-select when the coach only has a single allowed group.
  React.useEffect(() => {
    if (visible && allowedAgeGroups && allowedAgeGroups.length > 0) {
      setForm(f => ({ ...f, ageGroups: allowedAgeGroups }));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!form.eventDate) { Alert.alert('Required', 'Please pick a date.'); return; }
    if (!form.startTime) { Alert.alert('Required', 'Please pick a start time.'); return; }
    try {
      const restricted = form.memberIds.length > 0;
      const created: any = await createEvent({
        data: {
          title: form.title.trim(), eventType: form.eventType,
          eventDate: form.eventDate, startTime: form.startTime,
          endTime: form.endTime || undefined,
          locationName: form.locationName.trim() || undefined,
          ageGroups: form.ageGroups.join(','),
          notes: form.notes.trim() || undefined,
          meetOffsetMins: 60, isRosterRestricted: restricted ? 1 : 0,
          costPence: costToPence(form.cost),
        } as any,
      });
      const newId = created?.id ?? created?.data?.id;
      if (restricted && newId) {
        await customFetch(`/api/events/${newId}/roster`, {
          method: 'PUT',
          body: JSON.stringify({ memberIds: form.memberIds }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForm(EMPTY);
      setPlayerSearch('');
      onClose(true);
    } catch {
      Alert.alert('Error', 'Failed to create event.');
    }
  };

  const dismiss = () => { setForm(EMPTY); setPlayerSearch(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <LinearGradient colors={['#001f3d', '#00356b']} style={[s.formHeader, { paddingTop: Platform.OS === 'ios' ? 20 : 16 }]}>
          <TouchableOpacity onPress={dismiss} style={s.formHeaderBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={s.formHeaderTitle}>New Event</Text>
          <TouchableOpacity onPress={save} disabled={isPending} style={[s.formSaveBtn, isPending && { opacity: 0.6 }]}>
            {isPending
              ? <ActivityIndicator size="small" color="#001f3d" />
              : <Text style={s.formSaveBtnText}>Create</Text>}
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView contentContainerStyle={[s.formScroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          {/* Event type */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>EVENT TYPE</Text>
          <View style={s.typeRow}>
            {EVENT_TYPES.map(t => {
              const active = form.eventType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => { setForm(f => ({ ...f, eventType: t.value })); Haptics.selectionAsync(); }}
                  style={s.typeBtnWrap}
                  activeOpacity={0.8}
                >
                  {active ? (
                    <LinearGradient colors={[t.gradA, t.gradB]} style={s.typeBtn}>
                      <Ionicons name={t.icon} size={22} color="#fff" />
                      <Text style={[s.typeBtnLabel, { color: '#fff' }]}>{t.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.typeBtn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}>
                      <Ionicons name={t.icon} size={22} color={colors.mutedForeground} />
                      <Text style={[s.typeBtnLabel, { color: colors.mutedForeground }]}>{t.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Title */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>TITLE</Text>
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[s.formInput, { color: colors.foreground }]}
              value={form.title}
              onChangeText={t => setForm(f => ({ ...f, title: t }))}
              placeholder="e.g. U12 Training Session"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
            />
          </View>

          {/* Date & time — inline pickers (no nested Modal) */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>DATE & TIME</Text>
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* Date row */}
            <TouchableOpacity
              style={[s.pickerRow, { borderBottomColor: colors.border, backgroundColor: activePicker === 'date' ? colors.muted : 'transparent' }]}
              onPress={() => openPicker('date')} activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <Text style={[s.pickerRowLabel, { color: colors.mutedForeground }]}>Date</Text>
              <Text style={[s.pickerRowValue, { color: form.eventDate ? colors.foreground : colors.mutedForeground }]}>
                {form.eventDate ? fmtDate(form.eventDate) : 'Tap to pick'}
              </Text>
              <Ionicons name={activePicker === 'date' ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
            </TouchableOpacity>
            {activePicker === 'date' && (
              <View style={[s.inlinePicker, { borderBottomColor: colors.border }]}>
                {Platform.OS === 'web' ? (
                  // DateTimePicker doesn't render on Expo web — use native HTML input
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    {/* @ts-ignore — HTML element valid in Expo web context */}
                    <input
                      type="date"
                      value={form.eventDate}
                      onChange={(e: any) => {
                        setForm(f => ({ ...f, eventDate: e.target.value }));
                        setActivePicker(null);
                      }}
                      style={{
                        width: '100%', padding: '10px 14px', fontSize: '15px',
                        borderRadius: '10px', border: `1px solid ${colors.border}`,
                        backgroundColor: 'transparent', color: colors.foreground,
                        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                        colorScheme: 'dark',
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <DateTimePicker
                      value={pickerValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={handlePickerChange}
                      style={{ width: '100%' }}
                      accentColor="#001f3d"
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setActivePicker(null)} style={s.inlinePickerDone}>
                        <Text style={s.inlinePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Start time row */}
            <TouchableOpacity
              style={[s.pickerRow, { borderBottomColor: colors.border, backgroundColor: activePicker === 'start' ? colors.muted : 'transparent' }]}
              onPress={() => openPicker('start')} activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <Text style={[s.pickerRowLabel, { color: colors.mutedForeground }]}>Start</Text>
              <Text style={[s.pickerRowValue, { color: form.startTime ? colors.foreground : colors.mutedForeground }]}>
                {form.startTime ? fmtTime(form.startTime) : 'Tap to pick'}
              </Text>
              <Ionicons name={activePicker === 'start' ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
            </TouchableOpacity>
            {activePicker === 'start' && (
              <View style={[s.inlinePicker, { borderBottomColor: colors.border }]}>
                {Platform.OS === 'web' ? (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    {/* @ts-ignore — HTML element valid in Expo web context */}
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e: any) => {
                        setForm(f => ({ ...f, startTime: e.target.value }));
                        setActivePicker(null);
                      }}
                      style={{
                        width: '100%', padding: '10px 14px', fontSize: '15px',
                        borderRadius: '10px', border: `1px solid ${colors.border}`,
                        backgroundColor: 'transparent', color: colors.foreground,
                        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                        colorScheme: 'dark',
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <DateTimePicker
                      value={pickerValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handlePickerChange}
                      style={{ width: '100%' }}
                      textColor={colors.foreground}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setActivePicker(null)} style={s.inlinePickerDone}>
                        <Text style={s.inlinePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* End time row */}
            <TouchableOpacity
              style={[s.pickerRow, { borderBottomWidth: 0, backgroundColor: activePicker === 'end' ? colors.muted : 'transparent' }]}
              onPress={() => openPicker('end')} activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <Text style={[s.pickerRowLabel, { color: colors.mutedForeground }]}>End</Text>
              <Text style={[s.pickerRowValue, { color: form.endTime ? colors.foreground : colors.mutedForeground }]}>
                {form.endTime ? fmtTime(form.endTime) : 'Optional'}
              </Text>
              <Ionicons name={activePicker === 'end' ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
            </TouchableOpacity>
            {activePicker === 'end' && (
              <View style={s.inlinePicker}>
                {Platform.OS === 'web' ? (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    {/* @ts-ignore — HTML element valid in Expo web context */}
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e: any) => {
                        setForm(f => ({ ...f, endTime: e.target.value }));
                        setActivePicker(null);
                      }}
                      style={{
                        width: '100%', padding: '10px 14px', fontSize: '15px',
                        borderRadius: '10px', border: `1px solid ${colors.border}`,
                        backgroundColor: 'transparent', color: colors.foreground,
                        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                        colorScheme: 'dark',
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <DateTimePicker
                      value={pickerValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handlePickerChange}
                      style={{ width: '100%' }}
                      textColor={colors.foreground}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setActivePicker(null)} style={s.inlinePickerDone}>
                        <Text style={s.inlinePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

          </View>

          {/* Location */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>LOCATION <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL)</Text></Text>
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.pickerRow}>
              <Ionicons name="location-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.formInputInline, { color: colors.foreground, flex: 1 }]}
                value={form.locationName}
                onChangeText={t => setForm(f => ({ ...f, locationName: t }))}
                placeholder="e.g. Irvine Ice Rink"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          {/* Cost per player */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>COST PER PLAYER <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL — LEAVE BLANK IF FREE)</Text></Text>
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.pickerRow}>
              <Text style={[s.formInputInline, { color: colors.mutedForeground, marginRight: 4 }]}>£</Text>
              <TextInput
                style={[s.formInputInline, { color: colors.foreground, flex: 1 }]}
                value={form.cost}
                onChangeText={t => setForm(f => ({ ...f, cost: t }))}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Age groups */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>AGE GROUPS</Text>
          <View style={s.ageChips}>
            {visibleAgeGroupsCreate.map(g => {
              const active = form.ageGroups.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  onPress={() => { toggleAge(g); Haptics.selectionAsync(); }}
                  style={[s.ageChip, {
                    backgroundColor: active ? '#001f3d' : colors.muted,
                    borderColor: active ? '#f6a800' : colors.border,
                    borderWidth: active ? 2 : 1,
                  }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.ageChipText, { color: active ? '#fff' : colors.foreground }]}>
                    {active ? '✓ ' : ''}{AGE_LABELS[g] ?? g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>NOTES <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL)</Text></Text>
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[s.formInput, s.notesInput, { color: colors.foreground }]}
              value={form.notes}
              onChangeText={t => setForm(f => ({ ...f, notes: t }))}
              placeholder="Kit requirements, what to bring, special instructions…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Specific players — optional roster restriction */}
          <Text style={[s.formSectionLabel, { color: colors.mutedForeground }]}>
            SPECIFIC PLAYERS{' '}
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}>(OPTIONAL — leave blank for all eligible)</Text>
          </Text>
          {selectedPlayers.length > 0 && (
            <View style={s.selectedChips}>
              {selectedPlayers.map((m: any) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => togglePlayer(m.id)}
                  style={[s.selectedChip, { backgroundColor: '#001f3d12', borderColor: '#001f3d40' }]}
                >
                  <Text style={[s.selectedChipText, { color: '#001f3d' }]}>{m.playerName}</Text>
                  <Ionicons name="close-circle" size={14} color="#001f3d" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.pickerRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.formInputInline, { color: colors.foreground, flex: 1 }]}
                value={playerSearch}
                onChangeText={setPlayerSearch}
                placeholder="Search players to add…"
                placeholderTextColor={colors.mutedForeground}
              />
              {playerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPlayerSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {playerSearch.trim().length > 0 && (
            <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 6 }]}>
              {filteredPlayers.length === 0 ? (
                <View style={{ padding: 14 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>No players found</Text>
                </View>
              ) : filteredPlayers.slice(0, 8).map((m: any, idx: number) => {
                const sel = form.memberIds.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => { togglePlayer(m.id); Haptics.selectionAsync(); }}
                    style={[
                      s.pickerRow,
                      {
                        borderBottomWidth: idx < Math.min(filteredPlayers.length, 8) - 1 ? 0.5 : 0,
                        borderBottomColor: colors.border,
                        backgroundColor: sel ? '#001f3d08' : 'transparent',
                      },
                    ]}
                  >
                    <View style={[s.playerAvatar, { backgroundColor: sel ? '#001f3d' : colors.muted }]}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: sel ? '#fff' : colors.mutedForeground }}>
                        {(m.playerName ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.foreground }}>{m.playerName}</Text>
                      {m.ageGroup && (
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.mutedForeground }}>
                          {AGE_LABELS[m.ageGroup as keyof typeof AGE_LABELS] ?? m.ageGroup}
                        </Text>
                      )}
                    </View>
                    {sel && <Ionicons name="checkmark-circle" size={20} color="#15803d" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

    </Modal>
  );
}

function eventToForm(event: any): FormState {
  return {
    title: event.title ?? '',
    eventType: (event.eventType ?? 'training') as EventType,
    eventDate: event.eventDate ?? '',
    startTime: event.startTime ?? '',
    endTime: event.endTime ?? '',
    locationName: event.locationName ?? '',
    ageGroups: event.ageGroups ? (event.ageGroups as string).split(',').map((g: string) => g.trim()).filter(Boolean) : [],
    notes: event.notes ?? '',
    memberIds: [],
    cost: event.costPence != null && event.costPence > 0 ? (event.costPence / 100).toFixed(2) : '',
  };
}
// ─── RSVP sheet (staff-as-parent) ────────────────────────────────────────────

const RSVP_OPTS = [
  { status: 'yes',   label: 'Going',    icon: 'checkmark-circle-outline' as const, color: '#15803d', bg: '#dcfce7' },
  { status: 'maybe', label: 'Maybe',    icon: 'help-circle-outline'      as const, color: '#a16207', bg: '#fef9c3' },
  { status: 'no',    label: "Can't go", icon: 'close-circle-outline'     as const, color: '#b91c1c', bg: '#fee2e2' },
] as const;

const ABSENCE_REASONS = [
  'Injured / unwell',
  'School exam / study',
  'Family commitment',
  'Holiday / travel',
  'Transport issue',
  'Coaching conflict',
  'Other',
];

function RsvpSheet({ eventId, eventTitle, child, onClose }: {
  eventId: number; eventTitle: string;
  child: { id: number; playerName: string };
  onClose: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = React.useState<string | null>(null);
  const [currentReason, setCurrentReason] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [showReasons, setShowReasons] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setCurrentStatus(null);
    setCurrentReason(null);
    setShowReasons(false);
    customFetch<{ responses: any[] }>(`/api/events/${eventId}/rsvp`)
      .then(data => {
        const entry = (data.responses ?? []).find((r: any) => r.memberId === child.id);
        setCurrentStatus(entry?.status ?? null);
        setCurrentReason(entry?.reason ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, child.id]);

  const submit = async (status: string, reason?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await customFetch(`/api/events/${eventId}/staff-rsvp`, {
        method: 'POST',
        body: JSON.stringify({ memberId: child.id, status, reason: reason ?? null }),
        headers: { 'Content-Type': 'application/json' },
      });
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save RSVP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptPress = (status: string) => {
    if (status === 'no') {
      setShowReasons(true);
    } else {
      setShowReasons(false);
      submit(status);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[rs.root, { backgroundColor: colors.background }]}>
        <View style={[rs.handle, { backgroundColor: colors.border }]} />
        <Text style={[rs.title, { color: colors.foreground }]}>RSVP as Parent</Text>
        <Text style={[rs.eventName, { color: colors.mutedForeground }]} numberOfLines={2}>{eventTitle}</Text>
        <View style={[rs.childBadge, { backgroundColor: '#001f3d12' }]}>
          <Ionicons name="person" size={14} color="#001f3d" />
          <Text style={rs.childName}>{child.playerName}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <>
            {/* Current absence reason (if already declined) */}
            {currentStatus === 'no' && currentReason && !showReasons && (
              <View style={[rs.reasonBanner, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                <Ionicons name="information-circle-outline" size={15} color="#b91c1c" />
                <Text style={rs.reasonBannerText}>{currentReason}</Text>
              </View>
            )}

            <View style={rs.options}>
              {RSVP_OPTS.map(opt => {
                const sel = currentStatus === opt.status && !showReasons;
                return (
                  <TouchableOpacity
                    key={opt.status}
                    style={[
                      rs.option,
                      { borderColor: sel ? opt.color : colors.border, borderWidth: sel ? 2 : 1, backgroundColor: sel ? opt.bg : colors.card },
                      submitting && { opacity: 0.5 },
                    ]}
                    onPress={() => handleOptPress(opt.status)}
                    disabled={submitting}
                    activeOpacity={0.75}
                  >
                    {sel && <Ionicons name="checkmark-circle" size={16} color={opt.color} style={{ position: 'absolute', top: 8, right: 8 }} />}
                    <Ionicons name={opt.icon} size={30} color={opt.color} />
                    <Text style={[rs.optionLabel, { color: opt.color }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Reason picker — slides in when "Can't go" is tapped */}
            {showReasons && (
              <View style={rs.reasonSection}>
                <Text style={[rs.reasonTitle, { color: colors.foreground }]}>Why can't they make it?</Text>
                <View style={rs.reasonGrid}>
                  {ABSENCE_REASONS.map(reason => (
                    <TouchableOpacity
                      key={reason}
                      style={[rs.reasonChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => submit('no', reason)}
                      disabled={submitting}
                      activeOpacity={0.7}
                    >
                      {submitting
                        ? <ActivityIndicator size="small" color={colors.mutedForeground} />
                        : <Text style={[rs.reasonChipText, { color: colors.foreground }]}>{reason}</Text>
                      }
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={[rs.dismiss, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
          <Text style={[rs.dismissText, { color: colors.mutedForeground }]}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const rs = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, textAlign: 'center', marginBottom: 6 },
  eventName: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  childBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'center', marginBottom: 20 },
  childName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#001f3d' },
  reasonBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  reasonBannerText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#b91c1c', flex: 1 },
  options: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 22, gap: 8, position: 'relative' },
  optionLabel: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  reasonSection: { marginBottom: 16 },
  reasonTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  reasonChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, minWidth: 80, alignItems: 'center' },
  reasonChipText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  dismiss: { borderWidth: 1, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  dismissText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [staffChildren, setStaffChildren] = useState<any[]>([]);
  const [staffRsvpMap, setStaffRsvpMap] = useState<Record<number, string>>({});
  const [rsvpVersion, setRsvpVersion] = useState(0);
  const [rsvpTarget, setRsvpTarget] = useState<{ eventId: number; eventTitle: string; child: any } | null>(null);

  const { data: staffProfile } = useGetMyStaffProfile();

  // Derive the coach's permitted age groups, mirroring the API's role logic exactly:
  // superusers, treasurers, and registrations staff are unrestricted (null).
  // Coaches with at least one assigned age group are restricted to those groups.
  const allowedAgeGroups: string[] | null = useMemo(() => {
    if (!staffProfile) return null;
    if (staffProfile.isSuperUser) return null;
    if ((staffProfile as any).isTreasurer) return null;
    if ((staffProfile as any).isRegistrations) return null;
    const groups = (staffProfile as any).allowedGroups as string[] | undefined;
    return groups && groups.length > 0 ? groups : null;
  }, [staffProfile]);

  const { data: allEvents, isLoading, refetch, isRefetching } = useListEvents({});

  React.useEffect(() => {
    customFetch<any[]>('/api/staff/me/children').then(setStaffChildren).catch(() => {});
  }, []);

  React.useEffect(() => {
    customFetch<Record<number, string>>('/api/staff/me/rsvps').then(setStaffRsvpMap).catch(() => {});
  }, [rsvpVersion]);

  const today = new Date().toISOString().slice(0, 10);

  // Client-side age-group filter — mirrors the server logic so counts and lists
  // are always consistent even if a cached response pre-dates the server change.
  // Club-wide events (empty ageGroups) remain visible to all coaches.
  const scopedEvents = useMemo(() => {
    const events = (allEvents ?? []) as any[];
    if (!allowedAgeGroups || allowedAgeGroups.length === 0) return events;
    return events.filter((e: any) => {
      if (!e.ageGroups || e.ageGroups === '') return true; // club-wide
      const eventGroups: string[] = (e.ageGroups as string).split(',').map((g: string) => g.trim());
      return allowedAgeGroups.some(g => eventGroups.includes(g));
    });
  }, [allEvents, allowedAgeGroups]);

  const upcoming = useMemo(() => scopedEvents.filter((e: any) => e.eventDate >= today), [scopedEvents, today]);
  const past     = useMemo(() => [...scopedEvents.filter((e: any) => e.eventDate < today)].reverse(), [scopedEvents, today]);
  const displayed = tab === 'upcoming' ? upcoming : past;

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 60;

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <EventCard
      event={item}
      index={index}
      staffChildren={staffChildren}
      staffRsvpMap={staffRsvpMap}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingEvent(item);
      }}
      onRsvpPress={child => setRsvpTarget({ eventId: item.id, eventTitle: item.title, child })}
    />
  ), [staffChildren, staffRsvpMap]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Gradient header */}
      <LinearGradient
        colors={['#001f3d', '#003366']}
        style={[s.header, { paddingTop: topPad + 16 }]}
      >
        {/* Gold accent line */}
        <View style={s.goldAccent} />

        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Events</Text>
            <Text style={s.headerSub}>
              {upcoming.length} upcoming · {past.length} past
              {allowedAgeGroups && allowedAgeGroups.length > 0
                ? ` · ${allowedAgeGroups.map(g => AGE_LABELS[g] ?? g).join(', ')}`
                : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreate(true); }}
            style={s.fab}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#f6a800', '#e09500']} style={s.fabGradient}>
              <Ionicons name="add" size={24} color="#001f3d" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View style={s.tabRow}>
          {(['upcoming', 'past'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => { setTab(t); Haptics.selectionAsync(); }}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[s.tabBtnText, tab === t ? s.tabBtnTextActive : { color: 'rgba(255,255,255,0.55)' }]}>
                {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : displayed.length === 0 ? (
        <Animated.View entering={FadeInDown.springify()} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <View style={[s.emptyIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="calendar-outline" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>
            {tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
          </Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
            {tab === 'upcoming' ? 'Tap the gold button to create one' : 'Events will appear here after they pass'}
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={displayed as any[]}
          keyExtractor={e => String(e.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
        />
      )}

      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} allowedAgeGroups={allowedAgeGroups} />
      <EditModal event={editingEvent} onClose={() => setEditingEvent(null)} allowedAgeGroups={allowedAgeGroups} />
      {rsvpTarget && (
        <RsvpSheet
          eventId={rsvpTarget.eventId}
          eventTitle={rsvpTarget.eventTitle}
          child={rsvpTarget.child}
          onClose={() => { setRsvpTarget(null); setRsvpVersion(v => v + 1); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  goldAccent: { height: 3, width: 40, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff' },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  fab: { borderRadius: 14, overflow: 'hidden', shadowColor: '#f6a800', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabGradient: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  tabRow: { flexDirection: 'row', gap: 4, paddingBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  tabBtnTextActive: { color: '#fff' },
  // Cards
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardBar: { height: 4 },
  cardBody: { padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.3 },
  ageText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  rsvpListWrap: { borderTopWidth: 1, marginTop: 10, paddingTop: 8, gap: 6 },
  rsvpListRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rsvpListName: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  rsvpListEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingVertical: 4 },
  rsvpRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  rsvpPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  rsvpPillText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  rsvpStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5 },
  rsvpStripLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#001f3d', flex: 1 },
  rsvpStripAction: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#001f3d88' },
  rsvpStatusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  rsvpStatusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  // Player selection
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  selectedChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  playerAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // Restricted roster with RSVP chips
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  rosterName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  rsvpChip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  rsvpChipText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  // Empty state
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  // Form modal
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  formHeaderBtn: { padding: 4, width: 44 },
  formHeaderTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#fff' },
  formSaveBtn: { backgroundColor: '#f6a800', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, width: 72, alignItems: 'center' },
  formSaveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#001f3d' },
  formScroll: { padding: 20 },
  formSectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
  formCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  formInput: { fontFamily: 'Inter_400Regular', fontSize: 15, paddingHorizontal: 16, paddingVertical: 14 },
  formInputInline: { fontFamily: 'Inter_400Regular', fontSize: 15, paddingVertical: 14 },
  notesInput: { minHeight: 90, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  pickerRowLabel: { fontFamily: 'Inter_400Regular', fontSize: 15, width: 50 },
  pickerRowValue: { fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1, textAlign: 'right', marginRight: 8 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtnWrap: { flex: 1 },
  typeBtn: { borderRadius: 14, alignItems: 'center', paddingVertical: 14, gap: 6 },
  typeBtnLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  ageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ageChip: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8 },
  ageChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  playerNote: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 10, marginTop: -4 },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  playerAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  playerRowName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  playerRowAge: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  // Inline picker (replaces the old nested-Modal picker sheet)
  inlinePicker: { borderBottomWidth: 0.5, paddingBottom: 4 },
  inlinePickerDone: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 10, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#001f3d', borderRadius: 10 },
  inlinePickerDoneText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#f6a800' },
  // Delete / cancel event bar
  deleteBar: { borderTopWidth: 1, paddingVertical: 14, paddingHorizontal: 20 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#dc2626' },
  deleteBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#dc2626' },
});

function EditModal({
  event, onClose, allowedAgeGroups,
}: {
  event: any | null;
  onClose: (saved?: boolean) => void;
  /** When non-null, only these age-group chips are shown (coach-scoped). */
  allowedAgeGroups?: string[] | null;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { mutateAsync: updateEvent, isPending: isSaving } = useUpdateEvent();
  const { mutateAsync: deleteEvent, isPending: isDeleting } = useDeleteEvent();
  const { data: members } = useListMembers({});

  const [form, setForm] = useState<FormState>(EMPTY);
  const [activePicker, setActivePicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [rsvpByMemberId, setRsvpByMemberId] = useState<Record<number, string>>({});

  // Sync form + roster + RSVP statuses when event changes (modal opens with new event)
  React.useEffect(() => {
    if (!event) return;
    setForm(eventToForm(event));
    setPlayerSearch('');
    setRsvpByMemberId({});
    if (event.isRosterRestricted === 1) {
      // Fetch roster member IDs and RSVP statuses in parallel
      Promise.all([
        customFetch<{ rosterMemberIds: number[] }>(`/api/events/${event.id}`),
        customFetch<{ responses: Array<{ memberId: number; status: string }> }>(`/api/events/${event.id}/rsvp`),
      ]).then(([rosterData, rsvpData]) => {
        const ids = rosterData?.rosterMemberIds ?? [];
        setForm(f => ({ ...f, memberIds: ids }));
        const map: Record<number, string> = {};
        for (const r of rsvpData?.responses ?? []) {
          map[r.memberId] = r.status;
        }
        setRsvpByMemberId(map);
      }).catch(() => {});
    }
  }, [event]);

  const visible = event !== null;

  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!form.eventDate) { Alert.alert('Required', 'Please pick a date.'); return; }
    if (!form.startTime) { Alert.alert('Required', 'Please pick a start time.'); return; }
    try {
      const restricted = form.memberIds.length > 0;
      await updateEvent({
        id: event.id,
        data: {
          title: form.title.trim(),
          eventType: form.eventType,
          eventDate: form.eventDate,
          startTime: form.startTime,
          endTime: form.endTime || null,
          locationName: form.locationName.trim() || '',
          ageGroups: form.ageGroups.join(','),
          notes: form.notes.trim() || null,
          isRosterRestricted: restricted ? 1 : 0,
          costPence: costToPence(form.cost),
        } as any,
      });
      // Always sync the restricted roster (clears it when memberIds is empty)
      await customFetch(`/api/events/${event.id}/roster`, {
        method: 'PUT',
        body: JSON.stringify({ memberIds: form.memberIds }),
        headers: { 'Content-Type': 'application/json' },
      });
      await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose(true);
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Cancel Event',
      `Are you sure you want to cancel "${event?.title ?? 'this event'}"? This cannot be undone.`,
      [
        { text: 'Keep Event', style: 'cancel' },
        {
          text: 'Cancel Event',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent({ id: event.id });
              await queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onClose(true);
            } catch {
              Alert.alert('Error', 'Failed to cancel event.');
            }
          },
        },
      ],
    );
  };

  const dismiss = () => { setActivePicker(null); onClose(); };
  const isBusy = isSaving || isDeleting;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <LinearGradient colors={['#001f3d', '#00356b']} style={[s.formHeader, { paddingTop: Platform.OS === 'ios' ? 20 : 16 }]}>
          <TouchableOpacity onPress={dismiss} style={s.formHeaderBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={s.formHeaderTitle}>Edit Event</Text>
          <TouchableOpacity onPress={save} disabled={isBusy} style={[s.formSaveBtn, isBusy && { opacity: 0.6 }]}>
            {isSaving
              ? <ActivityIndicator size="small" color="#001f3d" />
              : <Text style={s.formSaveBtnText}>Save</Text>}
          </TouchableOpacity>
        </LinearGradient>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Re-use the same form body, with player-search section */}
          <EventFormBody
            form={form}
            setForm={setForm}
            activePicker={activePicker}
            setActivePicker={setActivePicker}
            members={members as any[] | undefined}
            playerSearch={playerSearch}
            onPlayerSearchChange={setPlayerSearch}
            rsvpByMemberId={rsvpByMemberId}
            allowedAgeGroups={allowedAgeGroups}
          />
        </KeyboardAvoidingView>

        {/* Cancel event button — outside scroll, fixed at bottom */}
        <View style={[s.deleteBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={isBusy}
            style={[s.deleteBtn, isBusy && { opacity: 0.5 }]}
            activeOpacity={0.7}
          >
            {isDeleting
              ? <ActivityIndicator size="small" color="#dc2626" />
              : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text style={s.deleteBtnText}>Cancel Event</Text>
                </>
              )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
