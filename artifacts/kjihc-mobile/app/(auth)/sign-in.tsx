import React, { useCallback, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth, useSignIn } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { LinearGradient } from 'expo-linear-gradient';
import { CLUB_LOGO } from '@/constants/branding';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { signIn, errors, fetchStatus } = useSignIn();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [mfaCode, setMfaCode] = React.useState('');

  useEffect(() => {
    if (isSignedIn) router.replace('/(staff)');
  }, [isSignedIn]);

  const handleEmailSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl('/');
          if (url.startsWith('http')) {
            // web — useEffect above handles the redirect
          } else {
            router.replace(url as Href);
          }
        },
      });
    } else if (signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        f => f.strategy === 'email_code'
      );
      if (emailCodeFactor) await signIn.mfa.sendEmailCode();
    }
  };

  const handleMFAVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code: mfaCode });
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl('/');
          if (!url.startsWith('http')) router.replace(url as Href);
        },
      });
    }
  };


  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── MFA challenge ────────────────────────────────────────────────────────────
  if (signIn.status === 'needs_client_trust') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Branded top band */}
        <LinearGradient colors={['#001f3d', '#003060']} style={[styles.mfaBand, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity style={styles.backBtnLight} onPress={() => signIn.reset()}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <View style={styles.bandMark}>
            <Image source={CLUB_LOGO} style={styles.bandLogo} resizeMode="contain" />
            <Text style={styles.bandClub}>KJIHC</Text>
          </View>
        </LinearGradient>

        <View style={styles.mfaBody}>
          <Text style={[styles.mfaTitle, { color: colors.foreground }]}>Verify your identity</Text>
          <Text style={[styles.mfaSub, { color: colors.mutedForeground }]}>
            Enter the code sent to your email
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={mfaCode}
            onChangeText={setMfaCode}
            placeholder="6-digit code"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            autoFocus
          />
          {errors.fields.code && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {errors.fields.code.message}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!mfaCode || fetchStatus === 'fetching') ? 0.5 : 1 }]}
            onPress={handleMFAVerify}
            disabled={!mfaCode || fetchStatus === 'fetching'}
          >
            {fetchStatus === 'fetching'
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signIn.mfa.sendEmailCode()}>
            <Text style={[styles.linkText, { color: colors.secondary }]}>Resend code</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main sign-in ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding">
      {/* KJIHC branded header band */}
      <LinearGradient colors={['#001f3d', '#003060']} style={[styles.headerBand, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity style={styles.backBtnLight} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <View style={styles.bandMark}>
          <Image source={CLUB_LOGO} style={styles.bandLogo} resizeMode="contain" />
          <Text style={styles.bandClub}>KJIHC</Text>
        </View>

        <Text style={styles.bandTitle}>Staff &amp; Coach Sign-In</Text>
        <View style={styles.goldAccent} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Email / password form */}
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@kjihc.org"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          {errors.fields.identifier && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {errors.fields.identifier.message}
            </Text>
          )}

          <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
          <View style={[styles.passwordWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.foreground }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleEmailSignIn}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {errors.fields.password && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {errors.fields.password.message}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: '#001f3d' },
            (!email || !password || fetchStatus === 'fetching') && styles.btnDisabled,
          ]}
          onPress={handleEmailSignIn}
          disabled={!email || !password || fetchStatus === 'fetching'}
          activeOpacity={0.8}
        >
          {fetchStatus === 'fetching' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Sign in</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

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
  bandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bandLogo: {
    width: 84,
    height: 40,
  },
  bandClub: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#fff',
    letterSpacing: 4,
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

  // ── MFA ──────────────────────────────────────────────────────────────────
  mfaBand: { paddingHorizontal: 20, paddingBottom: 24, alignItems: 'center' },
  mfaBody: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 12 },
  mfaTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, textAlign: 'center' },
  mfaSub: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center' },

  // ── Form ─────────────────────────────────────────────────────────────────
  scrollContent: { paddingHorizontal: 24, paddingTop: 28 },
  ssoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, paddingVertical: 14, gap: 12, marginBottom: 20,
  },
  msIcon: { width: 22, height: 22 },
  msGrid: { width: 22, height: 22, flexWrap: 'wrap', flexDirection: 'row', gap: 2 },
  msSquare: { width: 10, height: 10 },
  ssoBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  form: { gap: 4, marginBottom: 20 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
  },
  passwordInput: { flex: 1, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 15 },
  eyeBtn: { padding: 4 },
  primaryBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  btnDisabled: { opacity: 0.45 },
  linkText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginTop: 8 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});
