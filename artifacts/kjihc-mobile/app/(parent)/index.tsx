import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';

const LOGO = require('../../assets/images/club-logo.png');
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRequestParentLink, useVerifyParentToken } from '@workspace/api-client-react';
import { useParentAuth } from '@/context/ParentAuthContext';

export default function ParentLoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setSession, token: existingToken, isLoaded } = useParentAuth();
  const params = useLocalSearchParams<{ token?: string }>();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);

  const { mutateAsync: requestLink } = useRequestParentLink();
  const { mutateAsync: verifyToken } = useVerifyParentToken();
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // If already have a valid session, go straight to the tab portal
  useEffect(() => {
    if (isLoaded && existingToken) {
      router.replace('/(parent)/(tabs)/events');
    }
  }, [isLoaded, existingToken]);

  // Auto-verify when a token arrives via URL params (web fallback or deep link)
  useEffect(() => {
    const urlToken = params.token;
    if (!urlToken || existingToken || autoVerifying) return;
    setAutoVerifying(true);
    setToken(urlToken);
    setLinkSent(true);
    verifyToken({ data: { token: urlToken } })
      .then(async (result) => {
        await setSession(urlToken, result.email);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(parent)/(tabs)/events');
      })
      .catch(() => {
        setAutoVerifying(false);
        // token invalid/expired — leave on screen so user can request a new one
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  const handleRequestLink = async () => {
    if (!email.trim()) return;
    setRequestLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await requestLink({ data: { email: email.trim() } });
      setLinkSent(true);
    } catch {
      Alert.alert('Error', 'Could not send magic link. Please check your email and try again.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleVerifyToken = async () => {
    if (!token.trim()) return;
    setVerifyLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await verifyToken({ data: { token: token.trim() } });
      await setSession(token.trim(), result.email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(parent)/(tabs)/events');
    } catch {
      Alert.alert('Invalid link', 'This login link has expired or is invalid. Request a new one.');
      setToken('');
    } finally {
      setVerifyLoading(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Full-screen spinner while auto-verifying a URL token
  if (autoVerifying) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: '#001f3d' }]}>
        <Image source={LOGO} style={styles.splashLogo} contentFit="contain" />
        <ActivityIndicator color="#f6a800" size="large" style={{ marginTop: 32 }} />
        <Text style={styles.splashText}>Signing you in…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding">
      {/* KJIHC branded header band */}
      <LinearGradient colors={['#001f3d', '#003060']} style={[styles.headerBand, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          style={styles.backBtnLight}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <Image source={LOGO} style={styles.headerLogo} contentFit="contain" />

        <Text style={styles.bandTitle}>Parent Portal</Text>
        <View style={styles.goldAccent} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 24, paddingBottom: bottomPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Request magic link */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Request a login link</Text>
          </View>
          <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
            Enter the email address registered with the club. We&apos;ll send a secure login link.
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder="parent@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.secondary }, (!email.trim() || requestLoading) && styles.btnDisabled]}
            onPress={handleRequestLink}
            disabled={!email.trim() || requestLoading}
            activeOpacity={0.8}
          >
            {requestLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="mail" size={18} color="#fff" />
                <Text style={styles.btnText}>Send login link</Text>
              </>
            )}
          </TouchableOpacity>

          {linkSent && (
            <View style={[styles.sentBanner, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={[styles.sentText, { color: '#16a34a' }]}>
                Link sent! Check your email and copy the token from the link.
              </Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>then</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Step 2: Enter token */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Enter your token</Text>
          </View>
          <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
            Paste the token from the link in your email (the part after &quot;token=&quot;).
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, fontFamily: 'Inter_400Regular', fontSize: 13 }]}
            value={token}
            onChangeText={setToken}
            placeholder="Paste your login token here"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, (!token.trim() || verifyLoading) && styles.btnDisabled]}
            onPress={handleVerifyToken}
            disabled={!token.trim() || verifyLoading}
            activeOpacity={0.8}
          >
            {verifyLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in" size={18} color="#fff" />
                <Text style={styles.btnText}>Access portal</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Auto-verify splash ────────────────────────────────────────────────────
  centered:    { alignItems: 'center', justifyContent: 'center' },
  splashLogo:  { width: 220, height: 105 },
  splashText:  { fontFamily: 'Inter_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 16 },

  // ── Branded header band ───────────────────────────────────────────────────
  headerBand: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  backBtnLight: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 16,
  },
  headerLogo: {
    width: 180,
    height: 86,
    marginBottom: 10,
  },
  bandTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  goldAccent: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#f6a800',
  },

  // ── Form ─────────────────────────────────────────────────────────────────
  content: { paddingHorizontal: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 8 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#fff' },
  stepTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  stepDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginBottom: 14 },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 12, marginBottom: 12, fontSize: 15,
  },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
  btnDisabled: { opacity: 0.45 },
  sentBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 12,
  },
  sentText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
});
