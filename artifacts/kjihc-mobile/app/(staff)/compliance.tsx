import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
  TextInput,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useListMembers,
  useUpdateMemberFlags,
  useGetMyStaffProfile,
  getListMembersQueryKey,
  customFetch,
} from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';
import { NAVY, NAVY_LIGHT, CLUB_LOGO, ageGroupColor } from '@/constants/branding';
import { useQueryClient } from '@tanstack/react-query';
import type { Member } from '@workspace/api-client-react';

type FlagKey = 'sihaRegistered' | 'feesOverdue';

interface FlagState {
  sihaRegistered: number;
  feesOverdue: number;
}

// Per-row local state so toggling one player doesn't re-render others
function ComplianceRow({ item, canEditBalance }: { item: Member; canEditBalance: boolean }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { mutateAsync: updateFlags, isPending } = useUpdateMemberFlags();

  const [flags, setFlags] = useState<FlagState>({
    sihaRegistered: item.sihaRegistered ?? 0,
    feesOverdue: item.feesOverdue ?? 0,
  });

  const toggle = (flag: FlagKey) => {
    const current = flags[flag];
    const newVal = current === 1 ? 0 : 1;
    const isTurningOn = newVal === 1;

    const labels: Record<FlagKey, string> = {
      sihaRegistered: 'SIHA Registered',
      feesOverdue: 'Fees Overdue',
    };
    const confirmMsgs: Record<FlagKey, string> = {
      sihaRegistered: 'Send a SIHA confirmation email to the parent?',
      feesOverdue: 'Send a fees overdue reminder to the parent?',
    };

    const applyUpdate = async (sendEmail: boolean) => {
      try {
        await updateFlags({ id: item.id, data: { [flag]: newVal, sendEmail } as any });
        setFlags(prev => ({ ...prev, [flag]: newVal }));
        await queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert('Error', 'Failed to update flag.');
      }
    };

    if (isTurningOn) {
      Alert.alert('Confirm', confirmMsgs[flag], [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, send email', onPress: () => applyUpdate(true) },
        { text: 'No email', onPress: () => applyUpdate(false) },
      ]);
    } else {
      Alert.alert('Clear flag', `Remove "${labels[flag]}" from ${item.playerName}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => applyUpdate(false),
        },
      ]);
    }
  };

  const hasFees = flags.feesOverdue === 1;
  const hasSiha = flags.sihaRegistered !== 1;

  // If both flags are cleared, the row still shows until the list is refreshed
  return (
    <View style={[rowStyles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: ageGroupColor(item.ageGroup) }]}>
      {/* Player identity */}
      <View style={rowStyles.identity}>
        <View style={[rowStyles.avatar, { backgroundColor: NAVY }]}>
          <Text style={[rowStyles.avatarText, { color: '#fff' }]}>
            {item.playerName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rowStyles.name, { color: colors.foreground }]}>{item.playerName}</Text>
          <Text style={[rowStyles.meta, { color: colors.mutedForeground }]}>
            {item.ageGroup?.toUpperCase() ?? '—'}
            {item.addAgeGroup ? ` · ${item.addAgeGroup.toUpperCase()}` : ''}
          </Text>
          {/* Flag chips */}
          <View style={rowStyles.chipRow}>
            {hasFees && (
              <View style={[rowStyles.chip, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
                <Text style={[rowStyles.chipText, { color: '#ef4444' }]}>⚠ Fees overdue</Text>
              </View>
            )}
            {hasSiha && (
              <View style={[rowStyles.chip, { backgroundColor: '#f6a80020', borderColor: '#f6a800' }]}>
                <Text style={[rowStyles.chipText, { color: '#b45309' }]}>🛡 SIHA pending</Text>
              </View>
            )}
            {!hasFees && !hasSiha && (
              <View style={[rowStyles.chip, { backgroundColor: '#22c55e20', borderColor: '#22c55e' }]}>
                <Text style={[rowStyles.chipText, { color: '#16a34a' }]}>✓ Resolved</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Inline toggles */}
      <View style={[rowStyles.toggleSection, { borderTopColor: colors.border }]}>
        <View style={[rowStyles.toggleRow, { borderBottomColor: colors.border }]}>
          <View style={rowStyles.toggleIcon}>
            <Text style={{ fontSize: 15 }}>🛡️</Text>
          </View>
          <Text style={[rowStyles.toggleLabel, { color: colors.foreground }]}>SIHA Registered</Text>
          <Switch
            value={flags.sihaRegistered === 1}
            onValueChange={() => toggle('sihaRegistered')}
            disabled={isPending}
            trackColor={{ false: colors.border, true: '#22c55e' }}
            thumbColor={Platform.OS === 'android' ? (flags.sihaRegistered === 1 ? '#fff' : '#e5e7eb') : '#fff'}
            ios_backgroundColor={colors.border}
          />
        </View>
        <View style={rowStyles.toggleRow}>
          <View style={rowStyles.toggleIcon}>
            <Text style={{ fontSize: 15 }}>⚠️</Text>
          </View>
          <Text style={[rowStyles.toggleLabel, { color: colors.foreground }]}>Fees Overdue</Text>
          <Switch
            value={flags.feesOverdue === 1}
            onValueChange={() => toggle('feesOverdue')}
            disabled={isPending}
            trackColor={{ false: colors.border, true: '#ef4444' }}
            thumbColor={Platform.OS === 'android' ? (flags.feesOverdue === 1 ? '#fff' : '#e5e7eb') : '#fff'}
            ios_backgroundColor={colors.border}
          />
        </View>
        {canEditBalance && flags.feesOverdue === 1 && (
          <FeesBalanceRow memberId={item.id} initial={(item as any).feesBalance ?? null} />
        )}
      </View>
    </View>
  );
}

// Amount owed editor — treasurers and superusers only
function FeesBalanceRow({ memberId, initial }: { memberId: number; initial: number | null }) {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to save the amount owed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[rowStyles.balanceRow, { borderTopColor: colors.border }]}>
      <View style={rowStyles.toggleIcon}>
        <Text style={{ fontSize: 15 }}>£</Text>
      </View>
      <Text style={[rowStyles.toggleLabel, { color: colors.foreground }]}>Amount owed</Text>
      <View style={[rowStyles.balanceInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[rowStyles.balanceCurrency, { color: colors.mutedForeground }]}>£</Text>
        <TextInput
          style={[rowStyles.balanceInput, { color: colors.foreground }]}
          value={value}
          onChangeText={setValue}
          placeholder="0.00"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          editable={!saving}
        />
      </View>
      <TouchableOpacity
        style={[rowStyles.balanceSaveBtn, { backgroundColor: saved ? '#22c55e' : NAVY, opacity: saving ? 0.6 : 1 }]}
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

const rowStyles = StyleSheet.create({
  card: {
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
  },
  identity: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 2 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  toggleSection: { borderTopWidth: 0.5 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 0.5, gap: 10,
  },
  toggleIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 0.5, gap: 10,
  },
  balanceInputWrap: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, width: 96,
  },
  balanceCurrency: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  balanceInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, paddingVertical: 7, marginLeft: 2 },
  balanceSaveBtn: {
    width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Summary banner ────────────────────────────────────────────────────────────

function SummaryBanner({ feeCount, sihaCount }: { feeCount: number; sihaCount: number }) {
  const colors = useColors();
  const total = feeCount + sihaCount;
  return (
    <View style={[bannerStyles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={bannerStyles.stat}>
        <Text style={bannerStyles.statNum}>{feeCount}</Text>
        <Text style={[bannerStyles.statLabel, { color: colors.mutedForeground }]}>Fees overdue</Text>
      </View>
      <View style={[bannerStyles.divider, { backgroundColor: colors.border }]} />
      <View style={bannerStyles.stat}>
        <Text style={bannerStyles.statNum}>{sihaCount}</Text>
        <Text style={[bannerStyles.statLabel, { color: colors.mutedForeground }]}>SIHA pending</Text>
      </View>
      <View style={[bannerStyles.divider, { backgroundColor: colors.border }]} />
      <View style={bannerStyles.stat}>
        <Text style={[bannerStyles.statNum, { color: total > 0 ? '#ef4444' : '#22c55e' }]}>{total}</Text>
        <Text style={[bannerStyles.statLabel, { color: colors.mutedForeground }]}>Total issues</Text>
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ef4444' },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  divider: { width: 1, marginVertical: 4 },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ComplianceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: members, isLoading, refetch } = useListMembers();
  const { data: staffProfile } = useGetMyStaffProfile();
  const canEditBalance = staffProfile?.staffLevel === '1' || (staffProfile as any)?.isTreasurer === true;

  const nonCompliant = useMemo<Member[]>(() => {
    if (!members) return [];
    return (members as Member[]).filter(
      m => m.feesOverdue === 1 || m.sihaRegistered !== 1
    );
  }, [members]);

  const feeCount = useMemo(
    () => nonCompliant.filter(m => m.feesOverdue === 1).length,
    [nonCompliant]
  );
  const sihaCount = useMemo(
    () => nonCompliant.filter(m => m.sihaRegistered !== 1).length,
    [nonCompliant]
  );

  const topPad = insets.top;
  const bottomTabPad = Platform.OS === 'web' ? 84 : insets.bottom + 50;

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={[screenStyles.header, { paddingTop: topPad + 12 }]}>
        <View style={screenStyles.headerRow}>
          <View>
            <View style={screenStyles.goldBar} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={screenStyles.headerTitle}>Compliance</Text>
              {nonCompliant.length > 0 && (
                <View style={screenStyles.badge}>
                  <Text style={screenStyles.badgeText}>{nonCompliant.length}</Text>
                </View>
              )}
            </View>
          </View>
          <Image source={CLUB_LOGO} style={screenStyles.headerLogo} resizeMode="contain" />
        </View>
        <Text style={screenStyles.headerSub}>
          Players needing fee or SIHA action
        </Text>
      </LinearGradient>

      {/* Summary */}
      {!isLoading && nonCompliant.length > 0 && (
        <SummaryBanner feeCount={feeCount} sihaCount={sihaCount} />
      )}

      {isLoading ? (
        <View style={screenStyles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : nonCompliant.length === 0 ? (
        <View style={screenStyles.centered}>
          <Ionicons name="checkmark-circle-outline" size={52} color="#22c55e" />
          <Text style={[screenStyles.allClearTitle, { color: colors.foreground }]}>All clear</Text>
          <Text style={[screenStyles.allClearSub, { color: colors.mutedForeground }]}>
            No players have outstanding fee or SIHA issues
          </Text>
        </View>
      ) : (
        <FlatList
          data={nonCompliant}
          keyExtractor={m => String(m.id)}
          renderItem={({ item }) => <ComplianceRow item={item} canEditBalance={canEditBalance} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomTabPad,
          }}
          onRefresh={refetch}
          refreshing={isLoading}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 10, marginBottom: 2 },
  goldBar: { height: 3, width: 28, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 6 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  headerLogo: { width: 66, height: 32 },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 16, color: 'rgba(255,255,255,0.65)' },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  allClearTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  allClearSub: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
