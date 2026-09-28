import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { NAVY, NAVY_LIGHT, GOLD, CLUB_LOGO } from '@/constants/branding';
import { useListMembers, useListEvents, useSubmitSignins } from '@workspace/api-client-react';
import type { Member, Event } from '@workspace/api-client-react';

type AttendanceStatus = 'yes' | 'no' | 'na';

const ABSENCE_REASONS = [
  'Injured / unwell',
  'School exam / study',
  'Family commitment',
  'Holiday / travel',
  'Transport issue',
  'Coaching conflict',
  'Other',
];

// Canonical age-group values matching the DB — must match artifacts/kjihc/src/lib/ageGroups.ts
const AGE_GROUPS = ['All', 'LTP', 'u10', 'u12', 'u14', 'u16', 'u19', 'lightning'];
const AGE_GROUP_LABELS: Record<string, string> = {
  All: 'All', LTP: 'LTP',
  u10: 'U10', u12: 'U12', u14: 'U14', u16: 'U16', u19: 'U19',
  lightning: 'Lightning',
};

function formatDate(d: Date): string {
  // Local calendar date (avoid toISOString — UTC shifts the date in positive-offset zones)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [customSession, setCustomSession] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [ageGroupFilter, setAgeGroupFilter] = useState('All');
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
  const [missReasons, setMissReasons] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: allEvents, isLoading: loadingEvents } = useListEvents({});
  const { data: members, isLoading: loadingMembers } = useListMembers(
    ageGroupFilter !== 'All' ? { ageGroup: ageGroupFilter } : undefined
  );
  const { mutateAsync: submitSignins } = useSubmitSignins();

  const todayEvents = useMemo(
    () => (allEvents ?? []).filter(ev => ev.eventDate === formatDate(date)),
    [allEvents, date]
  );

  // Events within the last 14 days / next 30 days, for the cross-date picker
  const nearbyEvents = useMemo(() => {
    const today = formatDate(new Date());
    const past = new Date(); past.setDate(past.getDate() - 14);
    const future = new Date(); future.setDate(future.getDate() + 30);
    const min = formatDate(past);
    const max = formatDate(future);
    const inRange = (allEvents ?? []).filter(ev => ev.eventDate >= min && ev.eventDate <= max);
    return {
      upcoming: inRange.filter(ev => ev.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.startTime ?? '').localeCompare(b.startTime ?? '')),
      recent: inRange.filter(ev => ev.eventDate < today).sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    };
  }, [allEvents]);

  const pickEventFromList = (ev: Event) => {
    setShowEventPicker(false);
    // parse as local date (YYYY-MM-DD)
    const [y, m, d] = ev.eventDate.split('-').map(Number);
    setDate(new Date(y, m - 1, d));
    setAttendance({});
    setMissReasons({});
    setCustomSession('');
    setShowCustomInput(false);
    setSubmitStatus('idle');
    setSelectedEvent(ev);
    if (ev.ageGroups) {
      const firstGroup = ev.ageGroups.split(',')[0].trim();
      if (AGE_GROUPS.includes(firstGroup)) setAgeGroupFilter(firstGroup);
    }
  };

  const changeDate = (delta: number) => {
    setDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
    setAttendance({});
    setMissReasons({});
    setSelectedEvent(null);
    setCustomSession('');
    setShowCustomInput(false);
    setSubmitStatus('idle');
  };

  const selectEvent = (ev: Event) => {
    const isDeselect = selectedEvent?.id === ev.id;
    setSelectedEvent(isDeselect ? null : ev);
    setCustomSession('');
    setShowCustomInput(false);
    setAttendance({});
    setMissReasons({});
    if (!isDeselect && ev.ageGroups) {
      const firstGroup = ev.ageGroups.split(',')[0].trim();
      if (AGE_GROUPS.includes(firstGroup)) setAgeGroupFilter(firstGroup);
    }
  };

  const setStatus = (memberId: number, status: AttendanceStatus) => {
    Haptics.selectionAsync();
    setAttendance(prev => ({ ...prev, [memberId]: status }));
    if (status !== 'no') {
      setMissReasons(prev => { const next = { ...prev }; delete next[memberId]; return next; });
    }
  };

  const setMissReason = (memberId: number, reason: string) => {
    setMissReasons(prev => ({ ...prev, [memberId]: reason }));
  };

  const markedCount = useMemo(
    () => Object.values(attendance).filter(s => s !== 'na').length,
    [attendance]
  );

  const handleSubmit = async () => {
    const sessionName = selectedEvent?.title || customSession.trim();
    if (!sessionName || loadingMembers || !members?.length) return;
    setSubmitting(true);
    setSubmitStatus('idle');
    try {
      const entries = (members ?? []).map((m: Member) => ({
        memberId: m.id,
        status: attendance[m.id] ?? 'na',
        missReason: attendance[m.id] === 'no' ? (missReasons[m.id] ?? null) : null,
      }));
      await submitSignins({ data: { session: sessionName, date: formatDate(date), entries, ...(selectedEvent?.id != null ? { eventId: selectedEvent.id } : {}) } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitStatus('success');
      setAttendance({});
      setMissReasons({});
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch {
      setSubmitStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  const topPad = insets.top;
  const bottomTabPad = Platform.OS === 'web' ? 84 : insets.bottom + 50;

  const renderMember = ({ item }: { item: Member }) => {
    const status = attendance[item.id] ?? 'na';
    const selectedReason = missReasons[item.id];
    const isAbsent = status === 'no';
    return (
      <View style={[styles.memberRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: colors.foreground }]}>{item.playerName}</Text>
          <Text style={[styles.memberGroup, { color: colors.mutedForeground }]}>{item.ageGroup}</Text>
        </View>
        <View style={styles.memberRight}>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, status === 'yes' && { backgroundColor: '#22c55e' }]}
              onPress={() => setStatus(item.id, status === 'yes' ? 'na' : 'yes')}
            >
              <Ionicons name="checkmark" size={16} color={status === 'yes' ? '#fff' : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, status === 'no' && { backgroundColor: colors.destructive }]}
              onPress={() => setStatus(item.id, status === 'no' ? 'na' : 'no')}
            >
              <Ionicons name="close" size={16} color={status === 'no' ? '#fff' : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, status === 'na' && { backgroundColor: colors.muted }]}
              onPress={() => setStatus(item.id, 'na')}
            >
              <Text style={[styles.naText, { color: status === 'na' ? colors.foreground : colors.mutedForeground }]}>—</Text>
            </TouchableOpacity>
          </View>
          {isAbsent && (
            <View style={styles.reasonWrap}>
              <Text style={[styles.reasonLabel, { color: colors.mutedForeground }]}>Reason (optional)</Text>
              <View style={styles.reasonChips}>
                {ABSENCE_REASONS.map(reason => {
                  const active = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonChip,
                        {
                          backgroundColor: active ? '#fee2e2' : colors.muted,
                          borderColor: active ? colors.destructive : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setMissReason(item.id, active ? '' : reason);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.reasonChipText, { color: active ? colors.destructive : colors.mutedForeground }]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <View style={styles.goldBar} />
            <Text style={styles.headerTitle}>Attendance</Text>
          </View>
          <Image source={CLUB_LOGO} style={styles.headerLogo} resizeMode="contain" />
        </View>

        {/* Date navigation */}
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.dateText, { color: '#fff' }]}>{displayDate(date)}</Text>
          <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Event picker */}
        <View style={styles.eventPickerWrap}>
          {loadingEvents ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 16 }} />
          ) : (
            <>
              {(
                <FlatList
                  data={todayEvents}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={ev => String(ev.id)}
                  contentContainerStyle={styles.eventChips}
                  renderItem={({ item }) => {
                    const active = selectedEvent?.id === item.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.eventChip,
                          {
                            backgroundColor: active ? GOLD : 'rgba(255,255,255,0.10)',
                            borderColor: active ? GOLD : 'rgba(255,255,255,0.18)',
                          },
                        ]}
                        onPress={() => selectEvent(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.eventChipTitle, { color: active ? NAVY : 'rgba(255,255,255,0.9)' }]}>
                          {item.title}
                        </Text>
                        {item.startTime ? (
                          <Text style={[styles.eventChipTime, { color: active ? 'rgba(0,31,61,0.7)' : 'rgba(255,255,255,0.6)' }]}>
                            {item.startTime}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                  ListFooterComponent={
                    <View style={{ flexDirection: 'row' }}>
                      {selectedEvent && selectedEvent.eventDate !== formatDate(date) ? null : null}
                      <TouchableOpacity
                        style={[
                          styles.eventChip,
                          {
                            backgroundColor: 'rgba(255,255,255,0.10)',
                            borderColor: 'rgba(255,255,255,0.18)',
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                          },
                        ]}
                        onPress={() => setShowEventPicker(true)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.9)" />
                        <Text style={[styles.eventChipTitle, { color: 'rgba(255,255,255,0.9)' }]}>Pick event…</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.eventChip,
                          {
                            backgroundColor: showCustomInput ? GOLD : 'rgba(255,255,255,0.10)',
                            borderColor: showCustomInput ? GOLD : 'rgba(255,255,255,0.18)',
                            marginLeft: 8,
                          },
                        ]}
                        onPress={() => { setShowCustomInput(v => !v); setSelectedEvent(null); setCustomSession(''); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.eventChipTitle, { color: showCustomInput ? NAVY : 'rgba(255,255,255,0.9)' }]}>Other…</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              )}
              {(showCustomInput || (todayEvents.length === 0 && !selectedEvent)) && (
                <TextInput
                  style={[styles.customInput, { backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }]}
                  value={customSession}
                  onChangeText={setCustomSession}
                  placeholder={todayEvents.length === 0 ? 'Session name (e.g. LTP Ice)' : 'Custom session name'}
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  autoFocus={showCustomInput}
                />
              )}
            </>
          )}
        </View>

        {/* Age group filter */}
        <FlatList
          data={AGE_GROUPS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={i => i}
          contentContainerStyle={styles.filterChips}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: ageGroupFilter === item ? GOLD : 'rgba(255,255,255,0.10)',
                  borderColor: ageGroupFilter === item ? GOLD : 'rgba(255,255,255,0.18)',
                },
              ]}
              onPress={() => { setAgeGroupFilter(item); setAttendance({}); setMissReasons({}); }}
            >
              <Text style={[styles.chipText, { color: ageGroupFilter === item ? NAVY : 'rgba(255,255,255,0.9)' }]}>{AGE_GROUP_LABELS[item] ?? item}</Text>
            </TouchableOpacity>
          )}
        />
      </LinearGradient>

      {/* Member list */}
      {loadingMembers ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !members?.length ? (
        <View style={styles.centered}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No players found</Text>
        </View>
      ) : (
        <FlatList
          data={members as Member[]}
          keyExtractor={m => String(m.id)}
          renderItem={renderMember}
          contentContainerStyle={{ paddingBottom: bottomTabPad + 80 }}
        />
      )}

      {/* Submit button */}
      {!!members?.length && (
        <View style={[styles.submitWrap, { paddingBottom: bottomTabPad, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {submitStatus === 'success' && (
            <View style={[styles.statusBanner, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={[styles.statusText, { color: '#15803d' }]}>Attendance saved!</Text>
            </View>
          )}
          {submitStatus === 'error' && (
            <View style={[styles.statusBanner, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
              <Ionicons name="close-circle" size={16} color="#dc2626" />
              <Text style={[styles.statusText, { color: '#b91c1c' }]}>Failed to save — please try again.</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              (loadingMembers || (!selectedEvent && !customSession.trim())) && styles.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || loadingMembers || (!selectedEvent && !customSession.trim())}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>
                  Submit{markedCount > 0 ? ` (${markedCount} marked)` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Cross-date event picker */}
      <Modal visible={showEventPicker} animationType="slide" transparent onRequestClose={() => setShowEventPicker(false)}>
        <Pressable style={pickerStyles.backdrop} onPress={() => setShowEventPicker(false)}>
          <Pressable style={[pickerStyles.sheet, { backgroundColor: colors.card, paddingBottom: 28 + (Platform.OS === 'web' ? 0 : insets.bottom) }]}>
            <View style={pickerStyles.sheetHandle} />
            <Text style={[pickerStyles.sheetTitle, { color: colors.foreground }]}>Pick an event</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(['upcoming', 'recent'] as const).map(section => (
                nearbyEvents[section].length > 0 && (
                  <View key={section}>
                    <Text style={[pickerStyles.sectionLabel, { color: colors.mutedForeground }]}>
                      {section === 'upcoming' ? 'UPCOMING' : 'RECENT'}
                    </Text>
                    {nearbyEvents[section].map(ev => (
                      <TouchableOpacity
                        key={ev.id}
                        style={[pickerStyles.eventRow, { borderBottomColor: colors.border }]}
                        onPress={() => pickEventFromList(ev)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[pickerStyles.eventTitle, { color: colors.foreground }]}>{ev.title}</Text>
                          <Text style={[pickerStyles.eventMeta, { color: colors.mutedForeground }]}>
                            {new Date(ev.eventDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {ev.startTime ? ` \u00b7 ${ev.startTime}` : ''}
                            {ev.ageGroups ? ` \u00b7 ${ev.ageGroups}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ))}
              {nearbyEvents.upcoming.length === 0 && nearbyEvents.recent.length === 0 && (
                <Text style={[pickerStyles.eventMeta, { color: colors.mutedForeground, padding: 16, textAlign: 'center' }]}>
                  No events in the last 2 weeks or next 30 days.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28, paddingHorizontal: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 6 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, gap: 8 },
  eventTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  eventMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  goldBar: { height: 3, width: 28, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 6 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  headerLogo: { width: 66, height: 32 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  arrowBtn: { padding: 4 },
  dateText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  eventPickerWrap: { minHeight: 52, justifyContent: 'center', marginBottom: 8 },
  eventChips: { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  eventChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90 },
  eventChipTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  eventChipTime: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  noEventsText: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingHorizontal: 16 },
  customInput: { marginHorizontal: 12, marginTop: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, fontFamily: 'Inter_400Regular', fontSize: 14 },
  filterChips: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  memberInfo: { flex: 1, paddingTop: 6 },
  memberName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  memberGroup: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  memberRight: { alignItems: 'flex-end', gap: 8 },
  toggleGroup: { flexDirection: 'row', gap: 8 },
  toggleBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#e5e7eb' },
  naText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  reasonWrap: { alignItems: 'flex-end', marginTop: 2 },
  reasonLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 5 },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: 260 },
  reasonChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  reasonChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15 },
  submitWrap: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 15, gap: 8 },
  submitBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
  btnDisabled: { opacity: 0.45 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
});
