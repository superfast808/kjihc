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
  Modal,
  ScrollView,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useListMembers,
  useGetMember,
  useGetMyStaffProfile,
  useUpdateMemberFlags,
  useGetAttendanceSummary,
  getListMembersQueryKey,
  getGetMemberQueryKey,
  customFetch,
} from '@workspace/api-client-react';
import { NAVY, NAVY_LIGHT, GOLD, CLUB_LOGO, ageGroupColor } from '@/constants/branding';
import { useQueryClient } from '@tanstack/react-query';
import type { Member, MemberDetail, MemberAttendance } from '@workspace/api-client-react';

// Canonical age-group values matching the DB — must match artifacts/kjihc/src/lib/ageGroups.ts
const AGE_GROUPS = ['All', 'LTP', 'u10', 'u12', 'u14', 'u16', 'u19', 'lightning'];
const AGE_GROUP_LABELS: Record<string, string> = {
  All: 'All', LTP: 'LTP',
  u10: 'U10', u12: 'U12', u14: 'U14', u16: 'U16', u19: 'U19',
  lightning: 'Lightning',
};

// Attendance period options
type AttendancePeriod = '30' | '90' | 'all';
const ATTENDANCE_PERIODS: { value: AttendancePeriod; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];
const AT_RISK_THRESHOLD = 0.70; // below 70% is at risk
const MIN_SESSIONS_FOR_RISK = 3; // need at least this many sessions to flag

function getPeriodFrom(period: AttendancePeriod): string | undefined {
  if (period === 'all') return undefined;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(period, 10));
  return d.toISOString().split('T')[0];
}

function hasMedicalInfo(m: Member | MemberDetail): boolean {
  return !!(
    ('playerMedicalnotes' in m && m.playerMedicalnotes) ||
    ('playerMedication' in m && m.playerMedication)
  );
}

function AttendanceRateBadge({ rate, total }: { rate: number; total: number }) {
  const isAtRisk = total >= MIN_SESSIONS_FOR_RISK && rate < AT_RISK_THRESHOLD;
  const pct = Math.round(rate * 100);
  return (
    <View style={[
      attendanceStyles.badge,
      { backgroundColor: isAtRisk ? '#ef444420' : '#22c55e20', borderColor: isAtRisk ? '#ef4444' : '#22c55e' },
    ]}>
      <Text style={[attendanceStyles.badgeText, { color: isAtRisk ? '#ef4444' : '#22c55e' }]}>
        {pct}%
      </Text>
    </View>
  );
}

const attendanceStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  periodRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  periodChip: {
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5,
  },
  periodChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  bigRate: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  bigRateUnit: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  rateRow: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  rateSubtext: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  progressBg: { height: 8, borderRadius: 4, width: '100%', marginHorizontal: 14, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  atRiskBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 10, borderRadius: 10,
    borderWidth: 1, padding: 10,
    backgroundColor: '#ef444410', borderColor: '#ef4444',
  },
  atRiskText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#ef4444' },
  noDataText: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
});

function FlagToggleRow({
  memberId,
  flag,
  label,
  current,
  activeColor,
  confirmMsg,
  onDone,
}: {
  memberId: number;
  flag: 'sihaRegistered' | 'feesOverdue';
  label: string;
  current: number | null | undefined;
  activeColor: string;
  confirmMsg: string;
  onDone: () => void;
}) {
  const colors = useColors();
  const { mutateAsync: updateFlags, isPending } = useUpdateMemberFlags();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<number>(current ?? 0);
  // Sync local state when the server value changes (e.g. toggled from the web app)
  React.useEffect(() => { setValue(current ?? 0); }, [current]);
  // Replace 3-button Alert.alert (broken on Expo web) with a Modal-based dialog
  const [pendingAction, setPendingAction] = useState<'turnOn' | 'turnOff' | null>(null);

  const toggle = () => {
    setPendingAction(value !== 1 ? 'turnOn' : 'turnOff');
    Haptics.selectionAsync();
  };

  const doUpdate = async (newVal: number, sendEmail: boolean) => {
    setPendingAction(null);
    try {
      await updateFlags({ id: memberId, data: { [flag]: newVal, sendEmail } as any });
      setValue(newVal);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId) }),
      ]);
      onDone();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to update flag.');
    }
  };

  const isActive = value === 1;
  return (
    <>
      <View style={[flagStyles.row, { borderBottomColor: colors.border, backgroundColor: isActive ? `${activeColor}12` : 'transparent' }]}>
        <View style={[flagStyles.iconWrap, { backgroundColor: `${activeColor}20` }]}>
          <Text style={{ fontSize: 16 }}>{flag === 'sihaRegistered' ? '🛡️' : '⚠️'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[flagStyles.label, { color: colors.foreground }]}>{label}</Text>
          <Text style={[flagStyles.sublabel, { color: isActive ? activeColor : colors.mutedForeground }]}>
            {isActive ? 'Marked — toggle to clear' : 'Not set — toggle to mark'}
          </Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={toggle}
          disabled={isPending}
          trackColor={{ false: colors.border, true: activeColor }}
          thumbColor={Platform.OS === 'android' ? (isActive ? '#fff' : '#e5e7eb') : '#fff'}
          ios_backgroundColor={colors.border}
        />
      </View>

      {/* Cross-platform confirm dialog — replaces the 3-button Alert that breaks on Expo web */}
      <Modal
        visible={pendingAction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={flagStyles.modalOverlay}>
          <View style={[flagStyles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinearGradient colors={['#001f3d', '#00356b']} style={flagStyles.modalHeader}>
              <Text style={flagStyles.modalTitle}>
                {pendingAction === 'turnOn' ? 'Confirm' : 'Clear Flag'}
              </Text>
            </LinearGradient>
            <View style={flagStyles.modalBody}>
              <Text style={[flagStyles.modalMsg, { color: colors.foreground }]}>
                {pendingAction === 'turnOn'
                  ? confirmMsg
                  : `Remove "${label}" from this player?`}
              </Text>
            </View>
            {pendingAction === 'turnOn' ? (
              <>
                <TouchableOpacity
                  style={[flagStyles.modalBtn, { backgroundColor: '#001f3d' }]}
                  onPress={() => doUpdate(1, true)}
                >
                  <Text style={flagStyles.modalBtnPrimary}>Yes, send email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[flagStyles.modalBtn, { borderTopWidth: 0.5, borderTopColor: colors.border }]}
                  onPress={() => doUpdate(1, false)}
                >
                  <Text style={[flagStyles.modalBtnSecondary, { color: colors.foreground }]}>No email</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[flagStyles.modalBtn, { backgroundColor: '#ef444412' }]}
                onPress={() => doUpdate(0, false)}
              >
                <Text style={[flagStyles.modalBtnSecondary, { color: '#ef4444' }]}>Clear Flag</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[flagStyles.modalBtn, { borderTopWidth: 0.5, borderTopColor: colors.border }]}
              onPress={() => setPendingAction(null)}
            >
              <Text style={[flagStyles.modalBtnSecondary, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const flagStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  sublabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  // Confirm modal (cross-platform replacement for 3-button Alert)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalBox: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', width: '100%', maxWidth: 340 },
  modalHeader: { paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
  modalBody: { paddingHorizontal: 20, paddingVertical: 16 },
  modalMsg: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  modalBtn: { paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  modalBtnPrimary: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  modalBtnSecondary: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

function AttendanceSection({ memberId, ageGroup }: { memberId: number; ageGroup: string | null | undefined }) {
  const colors = useColors();
  const [period, setPeriod] = useState<AttendancePeriod>('90');
  const from = getPeriodFrom(period);

  const { data: summaryData, isLoading } = useGetAttendanceSummary(
    { from, ageGroup: ageGroup ?? undefined },
  );

  const record: MemberAttendance | undefined = useMemo(() => {
    if (!summaryData) return undefined;
    return summaryData.find(r => r.memberId === memberId);
  }, [summaryData, memberId]);

  const pct = record ? Math.round(record.rate * 100) : 0;
  const isAtRisk = !!record && record.total >= MIN_SESSIONS_FOR_RISK && record.rate < AT_RISK_THRESHOLD;
  const rateColor = isAtRisk ? '#ef4444' : record && record.total > 0 ? '#22c55e' : colors.mutedForeground;

  return (
    <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ATTENDANCE</Text>

      {/* Period picker */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }}>
        <View style={attendanceStyles.periodRow}>
          {ATTENDANCE_PERIODS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[
                attendanceStyles.periodChip,
                {
                  backgroundColor: period === p.value ? colors.primary : colors.muted,
                  borderColor: period === p.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setPeriod(p.value)}
            >
              <Text style={[
                attendanceStyles.periodChipText,
                { color: period === p.value ? '#fff' : colors.foreground },
              ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : !record || record.total === 0 ? (
        <Text style={[attendanceStyles.noDataText, { color: colors.mutedForeground }]}>
          No sessions recorded for this period
        </Text>
      ) : (
        <>
          {isAtRisk && (
            <View style={attendanceStyles.atRiskBanner}>
              <Ionicons name="warning" size={16} color="#ef4444" />
              <Text style={attendanceStyles.atRiskText}>Below 70% — needs attention</Text>
            </View>
          )}

          {/* Big rate display */}
          <View style={attendanceStyles.rateRow}>
            <Text style={[attendanceStyles.bigRate, { color: rateColor }]}>
              {pct}<Text style={[attendanceStyles.bigRateUnit, { color: rateColor }]}>%</Text>
            </Text>
            <Text style={[attendanceStyles.rateSubtext, { color: colors.mutedForeground }]}>
              attendance rate
            </Text>
          </View>

          {/* Progress bar */}
          <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
            <View style={[attendanceStyles.progressBg, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  attendanceStyles.progressFill,
                  { width: `${Math.min(pct, 100)}%`, backgroundColor: rateColor },
                ]}
              />
            </View>
          </View>

          {/* Stats rows */}
          <View style={[attendanceStyles.statRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <Text style={[attendanceStyles.statLabel, { color: colors.mutedForeground }]}>Sessions attended</Text>
            <Text style={[attendanceStyles.statValue, { color: colors.foreground }]}>{record.attended}</Text>
          </View>
          <View style={[attendanceStyles.statRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <Text style={[attendanceStyles.statLabel, { color: colors.mutedForeground }]}>Total sessions</Text>
            <Text style={[attendanceStyles.statValue, { color: colors.foreground }]}>{record.total}</Text>
          </View>
          <View style={[attendanceStyles.statRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <Text style={[attendanceStyles.statLabel, { color: colors.mutedForeground }]}>Sessions missed</Text>
            <Text style={[attendanceStyles.statValue, { color: colors.foreground }]}>{record.total - record.attended}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function PlayerDetailModal({ memberId, onClose }: { memberId: number; onClose: () => void }) {
  const colors = useColors();
  const { data: member, isLoading, refetch } = useGetMember(memberId);
  const { data: staffProfile } = useGetMyStaffProfile();
  const canEditBalance = staffProfile?.staffLevel === '1' || (staffProfile as any)?.isTreasurer === true;

  const hasMedical = member ? hasMedicalInfo(member) : false;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: colors.background }]}>
        {/* Modal header */}
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Player Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !member ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Player not found</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Name + group */}
            <LinearGradient colors={['#001f3d', '#003366']} style={styles.playerHero}>
              <View style={{ height: 3, width: 32, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 14 }} />
              <View style={[styles.playerAvatar, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Text style={styles.avatarInitial}>
                  {member.playerName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.heroName}>{member.playerName}</Text>
              <Text style={styles.heroGroup}>{member.ageGroup?.toUpperCase()}</Text>
              {(member.feesOverdue === 1 || member.sihaRegistered !== 1) && (
                <View style={styles.heroFlags}>
                  {member.feesOverdue === 1 && (
                    <View style={[styles.heroFlag, { backgroundColor: '#ef444430' }]}>
                      <Text style={[styles.heroFlagText, { color: '#fca5a5' }]}>⚠ Fees overdue</Text>
                    </View>
                  )}
                  {member.sihaRegistered !== 1 && (
                    <View style={[styles.heroFlag, { backgroundColor: '#f6a80030' }]}>
                      <Text style={[styles.heroFlagText, { color: '#fcd34d' }]}>🛡 SIHA pending</Text>
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>

            {/* Medical alert */}
            {hasMedical && (
              <View style={[styles.medicalAlert, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
                <Ionicons name="medical" size={20} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medicalAlertTitle, { color: '#92400e' }]}>Medical Information</Text>
                  {member.playerMedicalnotes ? (
                    <Text style={[styles.medicalText, { color: '#92400e' }]}>{member.playerMedicalnotes}</Text>
                  ) : null}
                  {member.playerMedication ? (
                    <Text style={[styles.medicalText, { color: '#92400e' }]}>
                      Medication: {member.playerMedication}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Attendance History */}
            <AttendanceSection memberId={memberId} ageGroup={member.ageGroup} />

            {/* Details grid */}
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <DetailRow label="Date of Birth" value={member.playerDob ?? '—'} colors={colors} />
              <DetailRow label="Parent/Guardian" value={member.playerParent} colors={colors} />
              <DetailRow label="Contact Phone" value={member.playerContactTel} colors={colors} />
              <DetailRow label="Email" value={member.playerEmail} colors={colors} />
              {member.playerAddress1 && (
                <DetailRow
                  label="Address"
                  value={[member.playerAddress1, member.playerAddress2, member.playerCity, member.playerPost]
                    .filter(Boolean)
                    .join(', ')}
                  colors={colors}
                />
              )}
              {member.addAgeGroup && (
                <DetailRow label="Also trains with" value={member.addAgeGroup} colors={colors} />
              )}
            </View>

            {/* Consents */}
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONSENTS</Text>
              <ConsentRow label="Fee agreed" value={!!member.agreeFee} colors={colors} />
              <ConsentRow label="GDPR consent" value={!!member.agreeGdpr} colors={colors} />
              <ConsentRow label="Photo consent" value={!!member.agreePhoto} colors={colors} />
              <ConsentRow label="Code of conduct" value={!!member.readCode} colors={colors} />
            </View>

            {/* Admin Flags */}
            <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ADMIN FLAGS</Text>
              <FlagToggleRow
                memberId={memberId}
                flag="sihaRegistered"
                label="SIHA Registered"
                current={member.sihaRegistered}
                activeColor="#22c55e"
                confirmMsg="Send a SIHA confirmation email to the parent?"
                onDone={() => refetch()}
              />
              <FlagToggleRow
                memberId={memberId}
                flag="feesOverdue"
                label="Fees Overdue"
                current={member.feesOverdue}
                activeColor="#ef4444"
                confirmMsg="Send a fees overdue reminder to the parent?"
                onDone={() => refetch()}
              />
              {canEditBalance && (
                <ModalFeesBalanceRow
                  memberId={memberId}
                  initial={(member as any).feesBalance ?? null}
                  onDone={() => refetch()}
                />
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// Amount owed editor — treasurers and superusers only
function ModalFeesBalanceRow({ memberId, initial, onDone }: { memberId: number; initial: number | null; onDone: () => void }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial != null ? Number(initial).toFixed(2) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const parsed = parseFloat(value);
    if (value !== '' && (isNaN(parsed) || parsed < 0)) {
      Alert.alert('Invalid amount', 'Enter a valid amount, e.g. 45.00');
      return;
    }
    setSaving(true);
    try {
      await customFetch(`/api/members/${memberId}/fees-balance`, {
        method: 'PATCH',
        body: JSON.stringify({ feesBalance: value === '' ? null : parsed }),
      });
      await queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onDone();
    } catch {
      Alert.alert('Error', 'Failed to save the amount owed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.balanceRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground, flex: 1 }]}>Amount owed (£)</Text>
      <View style={[styles.balanceInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <TextInput
          style={[styles.balanceInput, { color: colors.foreground }]}
          value={value}
          onChangeText={setValue}
          placeholder="0.00"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          editable={!saving}
        />
      </View>
      <TouchableOpacity
        style={[styles.balanceSaveBtn, { backgroundColor: saved ? '#22c55e' : NAVY, opacity: saving ? 0.6 : 1 }]}
        onPress={save}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={16} color="#fff" />}
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function ConsentRow({ label, value, colors }: { label: string; value: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Ionicons
        name={value ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={value ? '#22c55e' : colors.destructive}
      />
    </View>
  );
}

export default function PlayersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState('All');
  const [attendancePeriod, setAttendancePeriod] = useState<AttendancePeriod>('90');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: members, isLoading, refetch } = useListMembers(
    ageGroupFilter !== 'All' ? { ageGroup: ageGroupFilter } : undefined
  );

  // Fetch attendance summary to decorate the player list with at-risk badges
  const attendanceFrom = getPeriodFrom(attendancePeriod);
  const { data: attendanceSummary } = useGetAttendanceSummary(
    attendanceFrom
      ? { from: attendanceFrom, ageGroup: ageGroupFilter !== 'All' ? ageGroupFilter : undefined }
      : { ageGroup: ageGroupFilter !== 'All' ? ageGroupFilter : undefined }
  );

  const attendanceMap = useMemo<Map<number, MemberAttendance>>(() => {
    if (!attendanceSummary) return new Map();
    return new Map(attendanceSummary.map(r => [r.memberId, r]));
  }, [attendanceSummary]);

  const filtered = useMemo(() => {
    if (!members) return [];
    if (!search) return members as Member[];
    const q = search.toLowerCase();
    return (members as Member[]).filter(
      m => m.playerName.toLowerCase().includes(q) || m.playerParent.toLowerCase().includes(q)
    );
  }, [members, search]);

  const topPad = insets.top;
  const bottomTabPad = Platform.OS === 'web' ? 84 : insets.bottom + 50;

  const renderPlayer = ({ item }: { item: Member }) => {
    const medical = hasMedicalInfo(item);
    const att = attendanceMap.get(item.id);
    const showAtRisk = att && att.total >= MIN_SESSIONS_FOR_RISK && att.rate < AT_RISK_THRESHOLD;

    return (
      <TouchableOpacity
        style={[styles.playerCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: ageGroupColor(item.ageGroup) }]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.playerInitials, { backgroundColor: NAVY }]}>
          <Text style={[styles.initialsText, { color: '#fff' }]}>
            {item.playerName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </Text>
          <View style={[styles.initialsDot, { backgroundColor: ageGroupColor(item.ageGroup) }]} />
        </View>
        <View style={styles.playerCardBody}>
          <View style={styles.playerNameRow}>
            <Text style={[styles.playerName, { color: colors.foreground }]}>{item.playerName}</Text>
            {medical && (
              <View style={styles.medBadge}>
                <Ionicons name="medical" size={12} color="#d97706" />
              </View>
            )}
          </View>
          <View style={styles.playerMetaRow}>
            <View style={[styles.groupPill, { backgroundColor: `${ageGroupColor(item.ageGroup)}22`, borderColor: ageGroupColor(item.ageGroup) }]}>
              <Text style={[styles.groupPillText, { color: colors.foreground }]}>{(AGE_GROUP_LABELS[item.ageGroup] ?? item.ageGroup)?.toUpperCase()}</Text>
            </View>
            <Text style={[styles.playerMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {item.addAgeGroup ? `+${item.addAgeGroup} · ` : ''}{item.playerParent}
            </Text>
          </View>
        </View>
        {att && att.total >= MIN_SESSIONS_FOR_RISK ? (
          <AttendanceRateBadge rate={att.rate} total={att.total} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <View style={styles.goldBar} />
            <Text style={styles.headerTitle}>Players</Text>
          </View>
          <Image source={CLUB_LOGO} style={styles.headerLogo} resizeMode="contain" />
        </View>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)' }]}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
          <TextInput
            style={[styles.searchInput, { color: '#fff' }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search players or parents..."
            placeholderTextColor="rgba(255,255,255,0.55)"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
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
              onPress={() => setAgeGroupFilter(item)}
            >
              <Text style={[styles.chipText, { color: ageGroupFilter === item ? NAVY : 'rgba(255,255,255,0.9)' }]}>{AGE_GROUP_LABELS[item] ?? item}</Text>
            </TouchableOpacity>
          )}
        />

        {/* Attendance period filter */}
        <View style={[styles.attendancePeriodRow]}>
          <Ionicons name="stats-chart" size={13} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />
          <Text style={[styles.attendancePeriodLabel, { color: 'rgba(255,255,255,0.6)' }]}>Attendance:</Text>
          {ATTENDANCE_PERIODS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[
                styles.attendanceChip,
                {
                  backgroundColor: attendancePeriod === p.value ? GOLD : 'rgba(255,255,255,0.10)',
                  borderColor: attendancePeriod === p.value ? GOLD : 'rgba(255,255,255,0.18)',
                },
              ]}
              onPress={() => setAttendancePeriod(p.value)}
            >
              <Text style={[styles.attendanceChipText, { color: attendancePeriod === p.value ? NAVY : 'rgba(255,255,255,0.85)' }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !filtered.length ? (
        <View style={styles.centered}>
          <Feather name="user-x" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search ? 'No players match your search' : 'No players found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => String(m.id)}
          renderItem={renderPlayer}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomTabPad }}
          onRefresh={refetch}
          refreshing={isLoading}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {selectedId !== null && (
        <PlayerDetailModal memberId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  goldBar: { height: 3, width: 28, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 6 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  headerLogo: { width: 66, height: 32 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1,
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, gap: 8,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 10 },
  filterChips: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  attendancePeriodRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 6, paddingBottom: 10,
  },
  attendancePeriodLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  attendanceChip: {
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  attendanceChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    borderWidth: 1, padding: 14, gap: 12,
  },
  playerInitials: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  initialsText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  initialsDot: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#fff',
  },
  playerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupPill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  groupPillText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4 },
  playerCardBody: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  playerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  medBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff3cd',
    alignItems: 'center', justifyContent: 'center',
  },
  playerMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15 },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, paddingTop: 20,
  },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  closeBtn: { padding: 4 },
  modalContent: { paddingBottom: 48 },
  playerHero: { padding: 24, alignItems: 'center', gap: 8 },
  playerAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarInitial: { fontFamily: 'Inter_700Bold', fontSize: 32, color: '#fff' },
  heroName: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#fff' },
  heroGroup: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  heroFlags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  heroFlag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  heroFlagText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  medicalAlert: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    margin: 16, borderRadius: 12, borderWidth: 1, padding: 14,
  },
  medicalAlertTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 4 },
  medicalText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  detailCard: { margin: 16, marginTop: 0, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5, padding: 14, paddingBottom: 4 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  detailLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  detailValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1, textAlign: 'right', marginLeft: 16 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  balanceInputWrap: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, width: 96 },
  balanceInput: { fontFamily: 'Inter_600SemiBold', fontSize: 13, paddingVertical: 7 },
  balanceSaveBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
