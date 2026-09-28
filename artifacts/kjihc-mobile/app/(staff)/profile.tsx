import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useGetMyStaffProfile, customFetch } from '@workspace/api-client-react';
import { useParentAuth } from '@/context/ParentAuthContext';
import * as Haptics from 'expo-haptics';

// ─── SMTP settings types ──────────────────────────────────────────────────────

interface SettingRow { key: string; value: string; label: string | null }

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] as const;
type SmtpKey = typeof SMTP_KEYS[number];

const SMTP_LABELS: Record<SmtpKey, string> = {
  smtp_host: 'SMTP Host',
  smtp_port: 'Port',
  smtp_user: 'Username',
  smtp_pass: 'Password',
  smtp_from: 'From Address',
};

const SMTP_PLACEHOLDERS: Record<SmtpKey, string> = {
  smtp_host: 'e.g. smtp.sendgrid.net',
  smtp_port: '587',
  smtp_user: 'e.g. apikey',
  smtp_pass: '••••••••',
  smtp_from: 'KJIHC <noreply@kjihc.org>',
};

// ─── SMTP Modal ───────────────────────────────────────────────────────────────

function SmtpSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<SmtpKey, string>>({
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '',
  });
  const [showPass, setShowPass] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows: SettingRow[] = await customFetch('/api/settings');
      const next: Record<SmtpKey, string> = { smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '' };
      for (const k of SMTP_KEYS) {
        const row = rows.find(r => r.key === k);
        if (row) next[k] = row.value ?? '';
      }
      setValues(next);
    } catch {
      Alert.alert('Error', 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const save = async () => {
    setSaving(true);
    try {
      for (const k of SMTP_KEYS) {
        // Skip sending back the masked placeholder
        if (k === 'smtp_pass' && values[k] === '__SET__') continue;
        await customFetch(`/api/settings/${k}`, {
          method: 'PUT',
          body: JSON.stringify({ value: values[k] }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'SMTP settings updated. Test by sending a login link to a parent.');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save settings. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[smtpStyles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <LinearGradient colors={['#001f3d', '#003366']} style={[smtpStyles.header, { paddingTop: topPad + 16 }]}>
          <View style={smtpStyles.headerRow}>
            <TouchableOpacity onPress={onClose} style={smtpStyles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={smtpStyles.headerTitle}>Email (SMTP) Settings</Text>
            <View style={{ width: 34 }} />
          </View>
          <View style={smtpStyles.goldBar} />
        </LinearGradient>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[smtpStyles.hint, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
              Settings saved here override the environment variables. Use any SMTP service — SendGrid, Brevo, Mailgun, or your own server.
            </Text>

            {SMTP_KEYS.map(k => (
              <View key={k} style={{ marginBottom: 16 }}>
                <Text style={[smtpStyles.fieldLabel, { color: colors.mutedForeground }]}>{SMTP_LABELS[k].toUpperCase()}</Text>
                <View style={[smtpStyles.fieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[smtpStyles.fieldInput, { color: colors.foreground, flex: 1 }]}
                    value={k === 'smtp_pass' && values[k] === '__SET__' ? '' : values[k]}
                    onChangeText={t => setValues(v => ({ ...v, [k]: t }))}
                    placeholder={k === 'smtp_pass' && values[k] === '__SET__' ? '(already set — type to change)' : SMTP_PLACEHOLDERS[k]}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={k === 'smtp_port' ? 'number-pad' : 'default'}
                    secureTextEntry={k === 'smtp_pass' && !showPass}
                  />
                  {k === 'smtp_pass' && (
                    <TouchableOpacity onPress={() => setShowPass(s => !s)} style={{ paddingHorizontal: 12 }}>
                      <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[smtpStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={smtpStyles.saveBtnText}>Save Settings</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Main profile screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: profile, isLoading } = useGetMyStaffProfile();
  const { token: parentToken } = useParentAuth();
  const [smtpOpen, setSmtpOpen] = useState(false);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomTabPad = Platform.OS === 'web' ? 84 : insets.bottom + 100;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.emailAddresses?.[0]?.emailAddress?.slice(0, 2).toUpperCase() ?? '??';

  const accessLabel = profile?.isSuperUser
    ? 'Superuser — full access'
    : profile?.allowedGroups?.length
    ? `Access: ${profile.allowedGroups.join(', ')}`
    : 'Restricted access';

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomTabPad }}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>

        {/* Avatar card */}
        <View style={[styles.avatarCard, { backgroundColor: colors.primary }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{user?.fullName ?? profile?.staffName ?? 'Staff member'}</Text>
          <Text style={styles.avatarEmail}>{user?.primaryEmailAddress?.emailAddress ?? profile?.staffEmail}</Text>
          {isLoading ? (
            <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.accessBadge}>
              <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.accessBadgeText}>{accessLabel}</Text>
            </View>
          )}
        </View>

        {/* Profile details */}
        {profile && !isLoading && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ProfileRow icon="person" label="Name" value={profile.staffName} colors={colors} />
            <ProfileRow icon="mail" label="Email" value={profile.staffEmail} colors={colors} />
            <ProfileRow
              icon="shield"
              label="Access level"
              value={profile.isSuperUser ? 'Superuser' : profile.staffLevel}
              colors={colors}
            />
          </View>
        )}

        {/* Club settings — superuser only */}
        {profile?.isSuperUser && (
          <>
            <View style={[styles.sectionHeader, { paddingHorizontal: 20, marginBottom: 4, marginTop: 8 }]}>
              <Ionicons name="settings-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionHeaderLabel, { color: colors.mutedForeground }]}>CLUB SETTINGS</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => setSmtpOpen(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.settingsIcon, { backgroundColor: '#001f3d15' }]}>
                  <Ionicons name="mail-outline" size={18} color="#001f3d" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingsRowLabel, { color: colors.foreground }]}>Email (SMTP)</Text>
                  <Text style={[styles.settingsRowSub, { color: colors.mutedForeground }]}>Server, credentials &amp; from address</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* About */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutSectionHeader}>
            <Ionicons name="information-circle" size={16} color={colors.mutedForeground} />
            <Text style={[styles.sectionHeaderText, { color: colors.mutedForeground }]}>ABOUT</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>KJIHC Club Management</Text>
            <Text style={[styles.aboutValue, { color: colors.mutedForeground }]}>Mobile v1.0</Text>
          </View>
        </View>

        {/* Switch to parent portal */}
        {!!parentToken && (
          <>
            <View style={[styles.sectionHeader, { paddingHorizontal: 20, marginBottom: 4, marginTop: 8 }]}>
              <Ionicons name="swap-horizontal-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionHeaderLabel, { color: colors.mutedForeground }]}>SWITCH PORTAL</Text>
            </View>
            <TouchableOpacity
              style={[styles.switchBtn, { backgroundColor: '#001f3d', borderColor: '#003060' }]}
              onPress={() => router.replace('/(parent)/(tabs)/events')}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={20} color="#fff" />
              <Text style={styles.switchBtnText}>Switch to Parent Portal</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <SmtpSettingsModal visible={smtpOpen} onClose={() => setSmtpOpen(false)} />
    </>
  );
}

function ProfileRow({
  icon, label, value, colors,
}: {
  icon: string; label: string; value: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.profileRow}>
      <Ionicons name={icon as any} size={18} color={colors.mutedForeground} />
      <View style={styles.profileRowText}>
        <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.profileValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, paddingHorizontal: 16, marginBottom: 20 },
  avatarCard: { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 32, color: '#fff' },
  avatarName: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#fff' },
  avatarEmail: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  accessBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 4,
  },
  accessBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  section: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 14,
    borderWidth: 1, overflow: 'hidden',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeaderLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  aboutSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  sectionHeaderText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  aboutLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  aboutValue: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  profileRowText: { flex: 1 },
  profileLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 1 },
  profileValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsRowLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  settingsRowSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginHorizontal: 16, marginTop: 0, borderRadius: 14,
    borderWidth: 1, paddingVertical: 15, paddingHorizontal: 16,
  },
  switchBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 4, borderRadius: 14,
    borderWidth: 1, paddingVertical: 15,
  },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});

const smtpStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  goldBar: { height: 3, backgroundColor: '#f6a800', marginHorizontal: -20 },
  hint: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19,
    borderRadius: 10, padding: 14, marginBottom: 24,
  },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5, marginBottom: 6 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
  },
  fieldInput: { fontFamily: 'Inter_400Regular', fontSize: 15, paddingVertical: 13 },
  saveBtn: {
    backgroundColor: '#001f3d', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
});
