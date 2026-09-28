import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, ActivityIndicator,
  TouchableOpacity, ScrollView, RefreshControl,
  Modal, KeyboardAvoidingView, TextInput, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';

const LOGO = require('@/assets/images/club-logo.png');
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { useParentAuth } from '@/context/ParentAuthContext';
import { useParentRequest } from '@/hooks/useParentRequest';
import { useGetParentChildren, useGetParentChildAttendance, useParentPatchChild, getBaseUrl } from '@workspace/api-client-react';
import type { MemberDetail } from '@workspace/api-client-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDob(dob: string): string {
  const [y, m, d] = dob.split('-');
  const month = MONTHS[parseInt(m, 10) - 1];
  return month ? `${parseInt(d, 10)} ${month} ${y}` : dob;
}

// ─── Child selector ───────────────────────────────────────────────────────────

function ChildSelector({
  children, selectedId, onSelect,
}: { children: MemberDetail[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const colors = useColors();
  if (children.length <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
      {children.map((c) => {
        const active = c.id === (selectedId ?? children[0]?.id);
        return (
          <TouchableOpacity
            key={c.id}
            style={[pill.base, { backgroundColor: active ? colors.secondary : colors.muted }]}
            onPress={() => { Haptics.selectionAsync(); onSelect(c.id); }}
            activeOpacity={0.8}
          >
            <Text style={[pill.text, { color: active ? colors.secondaryForeground : colors.mutedForeground }]}>
              {c.playerName.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const pill = StyleSheet.create({
  base: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  text: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});

// ─── Attendance bar ───────────────────────────────────────────────────────────

function AttendanceBar({ attended, total }: { attended: number; total: number }) {
  const colors = useColors();
  const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
  const absent = total - attended;
  return (
    <View style={[ab.wrap, { borderColor: colors.border }]}>
      <View style={[ab.track, { backgroundColor: colors.muted }]}>
        <View style={[ab.fill, { backgroundColor: colors.secondary, width: `${rate}%` as any }]} />
      </View>
      <View style={ab.stats}>
        <View style={ab.item}>
          <Text style={[ab.num, { color: colors.secondary }]}>{attended}</Text>
          <Text style={[ab.lbl, { color: colors.mutedForeground }]}>attended</Text>
        </View>
        <View style={[ab.div, { backgroundColor: colors.border }]} />
        <View style={ab.item}>
          <Text style={[ab.num, { color: colors.foreground }]}>{absent}</Text>
          <Text style={[ab.lbl, { color: colors.mutedForeground }]}>missed</Text>
        </View>
        <View style={[ab.div, { backgroundColor: colors.border }]} />
        <View style={ab.item}>
          <Text style={[ab.num, { color: colors.foreground }]}>{rate}%</Text>
          <Text style={[ab.lbl, { color: colors.mutedForeground }]}>rate</Text>
        </View>
      </View>
    </View>
  );
}
const ab = StyleSheet.create({
  wrap:  { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  fill:  { height: '100%', borderRadius: 4 },
  stats: { flexDirection: 'row', alignItems: 'center' },
  item:  { flex: 1, alignItems: 'center' },
  div:   { width: 1, height: 36 },
  num:   { fontFamily: 'Inter_700Bold', fontSize: 24 },
  lbl:   { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});

// ─── Edit medical modal ───────────────────────────────────────────────────────

function EditMedicalModal({
  visible, initialNotes, initialMedication, onClose, onSave, saving,
}: {
  visible: boolean; initialNotes: string; initialMedication: string;
  onClose: () => void; onSave: (notes: string, medication: string) => void; saving: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState(initialNotes);
  const [medication, setMedication] = useState(initialMedication);

  useEffect(() => {
    if (visible) { setNotes(initialNotes); setMedication(initialMedication); }
  }, [visible, initialNotes, initialMedication]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[em.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} disabled={saving}>
            <Text style={[em.cancel, { color: saving ? colors.mutedForeground : colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[em.title, { color: colors.foreground }]}>Medical information</Text>
          <TouchableOpacity onPress={() => onSave(notes, medication)} hitSlop={12} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[em.save, { color: colors.primary }]}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[em.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <View style={[em.infoBanner, { backgroundColor: '#fff8e1', borderColor: '#fbbf24' }]}>
            <Ionicons name="information-circle-outline" size={18} color="#d97706" />
            <Text style={em.infoText}>This information is shared with coaches before every session. Keep it accurate and up to date.</Text>
          </View>
          <Text style={[em.label, { color: colors.foreground }]}>Medical notes</Text>
          <Text style={[em.hint, { color: colors.mutedForeground }]}>Conditions, allergies, or anything coaches should be aware of.</Text>
          <TextInput
            style={[em.input, em.multiline, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            value={notes} onChangeText={setNotes} multiline numberOfLines={4}
            placeholder="e.g. Asthma — inhaler in kit bag" placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top" editable={!saving}
          />
          <Text style={[em.label, { color: colors.foreground, marginTop: 20 }]}>Medication</Text>
          <Text style={[em.hint, { color: colors.mutedForeground }]}>Current medications or treatments.</Text>
          <TextInput
            style={[em.input, em.multiline, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            value={medication} onChangeText={setMedication} multiline numberOfLines={3}
            placeholder="e.g. Ventolin 100mcg before exercise" placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top" editable={!saving}
          />
          <Text style={[em.clearHint, { color: colors.mutedForeground }]}>
            Leave both fields blank to remove medical information from your child&apos;s record.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const em = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:       { fontFamily: 'Inter_700Bold', fontSize: 16 },
  cancel:      { fontFamily: 'Inter_400Regular', fontSize: 16 },
  save:        { fontFamily: 'Inter_700Bold', fontSize: 16 },
  body:        { padding: 16 },
  infoBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 20 },
  infoText:    { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#92400e', lineHeight: 18 },
  label:       { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  hint:        { fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  input:       { borderRadius: 10, borderWidth: 1, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  multiline:   { minHeight: 100 },
  clearHint:   { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 24, lineHeight: 18 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChildScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { token, selectedChildId, setSelectedChildId, clearSession } = useParentAuth();

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await clearSession();
    router.replace('/');
  };
  const parentRequest = useParentRequest();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  const mountedRef = useRef(true);
  const pollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollTimersRef.current.forEach(clearTimeout);
      pollTimersRef.current = [];
    };
  }, []);

  const topPad    = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const tabBarH   = Platform.OS === 'web' ? 84 : 80;

  const { data: children, isLoading: childrenLoading, refetch } = useGetParentChildren(
    {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { request: parentRequest, query: { enabled: !!token } as any },
  );

  const child = children
    ? (selectedChildId ? children.find(c => c.id === selectedChildId) ?? children[0] : children[0])
    : undefined;

  const { data: attendance, isLoading: attLoading, refetch: refetchAtt } = useGetParentChildAttendance(
    child?.id ?? 0,
    {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { request: parentRequest, query: { enabled: !!child && !!token } as any },
  );

  const patchChild = useParentPatchChild({ request: parentRequest });
  const isLoading  = childrenLoading || attLoading;
  const hasMedical = !!(child?.playerMedicalnotes || child?.playerMedication);
  const initials   = child?.playerName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  const feesBalance = (child as { feesBalance?: number | null } | undefined)?.feesBalance ?? 0;
  const feesPence = Math.round(feesBalance * 100);

  // Stripe records the payment asynchronously via webhook, so poll a few times
  // after a successful return to catch the balance update.
  const pollFees = useCallback(() => {
    refetch();
    for (const delay of [2000, 5000, 10000]) {
      const t = setTimeout(() => { if (mountedRef.current) refetch(); }, delay);
      pollTimersRef.current.push(t);
    }
  }, [refetch]);

  // ── Player photo ───────────────────────────────────────────────────────────
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const childId = child?.id;

  const fetchPhotoUrl = useCallback(async () => {
    if (!childId || !token) { setPhotoUrl(null); return; }
    try {
      const base = getBaseUrl() ?? '';
      const res = await fetch(`${base}/api/parent/me/children/${childId}/photo-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setPhotoUrl(json?.url ?? null);
      } else {
        setPhotoUrl(null);
      }
    } catch {
      setPhotoUrl(null);
    }
  }, [childId, token]);

  useEffect(() => {
    setPhotoUrl(null);
    fetchPhotoUrl();
  }, [fetchPhotoUrl]);

  const handlePickPhoto = async () => {
    if (!childId || !token || photoUploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to set your player\'s photo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];

    setPhotoUploading(true);
    try {
      const contentType = asset.mimeType ?? 'image/jpeg';
      const base = getBaseUrl() ?? '';

      const reqRes = await fetch(`${base}/api/parent/me/children/${childId}/photo/request-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType }),
      });
      const reqJson = await reqRes.json();
      if (!reqRes.ok) throw new Error(reqJson?.error ?? 'Upload failed');
      const { uploadUrl, objectPath } = reqJson as { uploadUrl: string; objectPath: string };

      const blob = await (await fetch(asset.uri)).blob();
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!putRes.ok) throw new Error('Upload failed');

      const confirmRes = await fetch(`${base}/api/parent/me/children/${childId}/photo/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ objectPath }),
      });
      if (!confirmRes.ok) throw new Error('Upload failed');

      await fetchPhotoUrl();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Photo upload failed', 'Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePayFees = async () => {
    if (!child || !token || payBusy || feesPence < 50) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPayBusy(true);
    try {
      const base = getBaseUrl() ?? '';
      const successUrl = `${base}/api/pay-return?status=success`;
      const cancelUrl = `${base}/api/pay-return?status=cancel`;
      const res = await fetch(`${base}/api/parent/me/payment/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          childId: child.id,
          amountPence: feesPence,
          successUrl,
          cancelUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Payment failed');
      const result = await WebBrowser.openAuthSessionAsync(json.checkoutUrl, 'kjihc-mobile://paid');
      if (result.type === 'success' && result.url.includes('status=success')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thank you!', 'Your payment was received.');
        pollFees();
      } else {
        refetch();
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPayBusy(false);
    }
  };

  const handleSaveMedical = (notes: string, medication: string) => {
    if (!child || !token) return;
    patchChild.mutate(
      { id: child.id, data: { token, playerMedicalnotes: notes, playerMedication: medication } },
      {
        onSuccess: () => {
          setEditModalVisible(false);
          setSavedSuccess(true);
          refetch();
          setTimeout(() => setSavedSuccess(false), 4000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#001f3d', '#003366']} style={[s.header, { paddingTop: topPad + 4 }]}>
        <View style={s.headerRow}>
          <View>
            <View style={s.goldAccent} />
            <Text style={s.headerTitle}>My Child</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={LOGO} style={s.headerLogo} contentFit="contain" />
            <TouchableOpacity
              onPress={handleSignOut}
              activeOpacity={0.7}
              style={s.headerSignOut}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {childrenLoading && !children ? (
        <View style={s.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : !child ? (
        <View style={s.centered}>
          <Ionicons name="person-outline" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No children found</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Contact the club to register your child.</Text>
          <TouchableOpacity
            style={[s.signOutBtn, { borderColor: colors.border, marginTop: 8 }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
            <Text style={[s.signOutText, { color: colors.destructive }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + tabBarH + 8, paddingTop: 16 }}
            refreshControl={<RefreshControl refreshing={!!isLoading} onRefresh={() => { refetch(); refetchAtt(); }} tintColor={colors.primary} />}
          >
            {children && children.length > 1 && (
              <>
                <Text style={[s.sectionTitle, { color: colors.foreground, marginTop: 0 }]}>Select child</Text>
                <ChildSelector children={children} selectedId={child.id} onSelect={setSelectedChildId} />
              </>
            )}

            {/* Profile card */}
            <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={s.avatarWrap}
                onPress={handlePickPhoto}
                disabled={photoUploading}
                activeOpacity={0.8}
              >
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={s.avatar} contentFit="cover" />
                ) : (
                  <View style={[s.avatar, s.avatarCenter, { backgroundColor: colors.primary }]}>
                    <Text style={[s.avatarText, { color: '#7eb4d8' }]}>{initials}</Text>
                  </View>
                )}
                {photoUploading && (
                  <View style={[s.avatar, s.avatarCenter, s.avatarOverlay]}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <View style={[s.cameraBadge, { borderColor: colors.card }]}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={s.profileInfo}>
                <Text style={[s.playerName, { color: colors.foreground }]}>{child.playerName}</Text>
                <View style={[s.ageGroupBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[s.ageGroupText, { color: colors.secondaryForeground }]}>
                    {child.ageGroup.toUpperCase()}
                    {child.addAgeGroup ? ` · ${child.addAgeGroup.toUpperCase()}` : ''}
                  </Text>
                </View>
                {child.playerDob && (
                  <Text style={[s.dob, { color: colors.mutedForeground }]}>Born {formatDob(child.playerDob)}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[s.editBtn, { backgroundColor: colors.muted }]}
                onPress={() => router.push(`/(parent)/${child.id}`)}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {savedSuccess && (
              <View style={[s.successBanner, { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                <Text style={s.successText}>Medical information updated.</Text>
              </View>
            )}

            {/* Outstanding fees */}
            {feesPence >= 50 && (
              <View style={[s.feesCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                <View style={s.feesTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="card-outline" size={18} color="#b91c1c" />
                    <Text style={s.feesLabel}>Outstanding fees</Text>
                  </View>
                  <Text style={s.feesAmount}>£{feesBalance.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={[s.feesPayBtn, payBusy && { opacity: 0.6 }]}
                  onPress={handlePayFees}
                  disabled={payBusy}
                  activeOpacity={0.85}
                >
                  {payBusy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={16} color="#fff" />
                      <Text style={s.feesPayBtnText}>Pay fees by card £{feesBalance.toFixed(2)}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={s.feesNote}>Payment can take a few seconds to appear.</Text>
              </View>
            )}

            {/* Medical */}
            <View style={s.sectionRow}>
              <Text style={[s.sectionTitle, { color: colors.foreground, marginBottom: 0, marginTop: 0 }]}>Medical information</Text>
              <TouchableOpacity
                style={[s.editBtnSm, { backgroundColor: colors.secondary }]}
                onPress={() => { Haptics.selectionAsync(); setEditModalVisible(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.secondaryForeground} />
                <Text style={[s.editBtnSmText, { color: colors.secondaryForeground }]}>Edit</Text>
              </TouchableOpacity>
            </View>

            {hasMedical ? (
              <View style={[s.medicalCard, { backgroundColor: '#fff8e1', borderColor: '#fbbf24' }]}>
                <Ionicons name="medical-outline" size={18} color="#d97706" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  {child.playerMedicalnotes ? (
                    <View>
                      <Text style={s.medicalLabel}>Medical notes</Text>
                      <Text style={s.medicalText}>{child.playerMedicalnotes}</Text>
                    </View>
                  ) : null}
                  {child.playerMedication ? (
                    <View>
                      <Text style={s.medicalLabel}>Medication</Text>
                      <Text style={s.medicalText}>{child.playerMedication}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={[s.medicalEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="medical-outline" size={18} color={colors.mutedForeground} />
                <Text style={[s.medicalEmptyText, { color: colors.mutedForeground }]}>
                  No medical information on file. Tap Edit to add notes or medication.
                </Text>
              </View>
            )}

            {/* Attendance */}
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Attendance</Text>
            {attendance ? (
              <>
                <Text style={[s.seasonLabel, { color: colors.mutedForeground }]}>{attendance.currentSeason} season</Text>
                <AttendanceBar attended={attendance.attended} total={attendance.total} />
                {attendance.total === 0 && (
                  <Text style={[s.noSessions, { color: colors.mutedForeground }]}>No sessions recorded yet this season.</Text>
                )}
              </>
            ) : attLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : null}

            {/* Contact */}
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Contact details</Text>
            <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {child.playerParent && (
                <View style={s.infoRow}>
                  <Ionicons name="person-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[s.infoText, { color: colors.foreground }]}>{child.playerParent}</Text>
                </View>
              )}
              {child.playerContactTel && (
                <View style={s.infoRow}>
                  <Ionicons name="call-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[s.infoText, { color: colors.foreground }]}>{child.playerContactTel}</Text>
                </View>
              )}
            </View>

            {/* Switch to staff portal */}
            {!!isSignedIn && (
              <TouchableOpacity
                style={[s.switchBtn]}
                onPress={() => router.replace('/(staff)')}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                <Text style={s.switchBtnText}>Switch to Club Official</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}

            {/* Sign out */}
            <TouchableOpacity
              style={[s.signOutBtn, { borderColor: colors.border }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
              <Text style={[s.signOutText, { color: colors.destructive }]}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>

          <EditMedicalModal
            visible={editModalVisible}
            initialNotes={child.playerMedicalnotes ?? ''}
            initialMedication={child.playerMedication ?? ''}
            onClose={() => setEditModalVisible(false)}
            onSave={handleSaveMedical}
            saving={patchChild.isPending}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1 },
  header:        { paddingHorizontal: 20, paddingBottom: 16 },
  goldAccent:    { height: 3, width: 40, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 14 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLogo:    { width: 72, height: 34 },
  headerSignOut: { padding: 4 },
  headerTitle:   { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff' },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle:    { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center' },
  emptyText:     { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  profileCard:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 16, gap: 14, marginBottom: 12 },
  avatarWrap:    { width: 76, height: 76, borderRadius: 38 },
  avatar:        { width: 76, height: 76, borderRadius: 38 },
  avatarCenter:  { alignItems: 'center', justifyContent: 'center' },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  avatarText:    { fontFamily: 'Inter_700Bold', fontSize: 26 },
  cameraBadge:   { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, borderWidth: 2, backgroundColor: '#001f3d', alignItems: 'center', justifyContent: 'center' },
  profileInfo:   { flex: 1, gap: 6 },
  playerName:    { fontFamily: 'Inter_700Bold', fontSize: 18 },
  ageGroupBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ageGroupText:  { fontFamily: 'Inter_700Bold', fontSize: 11 },
  dob:           { fontFamily: 'Inter_400Regular', fontSize: 12 },
  editBtn:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  successBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#6ee7b7', backgroundColor: '#d1fae5', padding: 12, marginBottom: 12 },
  successText:   { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#065f46', lineHeight: 18 },
  feesCard:      { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12 },
  feesTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feesLabel:     { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#b91c1c' },
  feesAmount:    { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#b91c1c' },
  feesPayBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13, backgroundColor: '#001f3d' },
  feesPayBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
  feesNote:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#b91c1c', textAlign: 'center' },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 16 },
  sectionTitle:  { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 8, marginTop: 16 },
  editBtnSm:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnSmText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  medicalCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  medicalLabel:  { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#d97706', marginBottom: 2 },
  medicalText:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#92400e', lineHeight: 18 },
  medicalEmpty:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  medicalEmptyText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  seasonLabel:   { fontFamily: 'Inter_400Regular', fontSize: 13 },
  noSessions:    { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', marginTop: 12 },
  infoCard:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText:      { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginTop: 24, backgroundColor: '#001f3d' },
  switchBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
  signOutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 13, marginTop: 12 },
  signOutText:   { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
