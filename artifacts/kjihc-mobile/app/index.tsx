import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useParentAuth } from '@/context/ParentAuthContext';

// ── Brand constants ──────────────────────────────────────────────────────────
const NAVY    = '#001f3d';
const ICE     = '#7eb4d8';
const ICE_DIM = 'rgba(126,180,216,0.35)';
const RED     = '#e8321a';
const WHITE   = '#ffffff';

const LOGO = require('../assets/images/club-logo.png');

// ── Landing screen ────────────────────────────────────────────────────────────
export default function LandingScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const { token: parentToken, isLoaded: parentLoaded } = useParentAuth();

  useEffect(() => {
    if (!clerkLoaded || !parentLoaded) return;
    if (isSignedIn)   router.replace('/(staff)');
    else if (parentToken) router.replace('/(parent)/(tabs)/events');
  }, [isSignedIn, clerkLoaded, parentLoaded, parentToken]);

  if (!clerkLoaded || !parentLoaded) {
    return (
      <View style={[s.loading, { backgroundColor: NAVY }]}>
        <ActivityIndicator color={ICE} size="large" />
      </View>
    );
  }

  const topPad    = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <LinearGradient
      colors={[NAVY, '#002a52', '#003060']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={s.root}
    >
      {/* Decorative ice diamonds */}
      <View style={[s.diamond, { width: 220, height: 220, borderRadius: 14, opacity: 0.055, top: 40 + topPad, right: -55 }]} />
      <View style={[s.diamond, { width: 110, height: 110, borderRadius: 10, opacity: 0.07,  top: 210, left: -28 }]} />
      <View style={[s.diamond, { width: 160, height: 160, borderRadius: 11, opacity: 0.04,  bottom: 160, right: 10 }]} />
      <View style={[s.diamond, { width: 70,  height: 70,  borderRadius: 7,  opacity: 0.06,  bottom: 90,  left: 30 }]} />

      <View style={[s.inner, { paddingTop: topPad + 40, paddingBottom: bottomPad + 28 }]}>

        {/* Hero: real club logo + wordmark */}
        <View style={s.hero}>
          <Image
            source={LOGO}
            style={s.logoImage}
            contentFit="contain"
            transition={200}
          />

          <Text style={s.wordmark}>KJIHC</Text>
          <Text style={s.fullName}>Kilmarnock Junior Ice Hockey Club</Text>

          {/* Ice-blue rule */}
          <View style={s.rule}>
            <View style={[s.ruleLine, { backgroundColor: ICE_DIM }]} />
            <View style={[s.ruleDot,  { backgroundColor: ICE }]} />
            <View style={[s.ruleLine, { backgroundColor: ICE_DIM }]} />
          </View>
        </View>

        {/* Entry cards */}
        <View style={s.cards}>

          {/* Staff & Coaches */}
          <TouchableOpacity
            style={s.primaryCard}
            onPress={() => router.push('/(auth)/sign-in')}
            activeOpacity={0.78}
          >
            <LinearGradient
              colors={['rgba(232,50,26,0.18)', 'rgba(232,50,26,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.cardGradient}
            >
              <View style={[s.iconWrap, { backgroundColor: 'rgba(232,50,26,0.2)', borderColor: 'rgba(232,50,26,0.35)' }]}>
                <Ionicons name="shield-checkmark" size={26} color={RED} />
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>Staff &amp; Coaches</Text>
                <Text style={s.cardDesc}>Sign in with your club account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Parent Portal */}
          <TouchableOpacity
            style={s.secondaryCard}
            onPress={() => router.push('/(parent)')}
            activeOpacity={0.78}
          >
            <View style={[s.iconWrap, { backgroundColor: 'rgba(126,180,216,0.15)', borderColor: 'rgba(126,180,216,0.3)' }]}>
              <Ionicons name="people" size={26} color={ICE} />
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>Parent Portal</Text>
              <Text style={s.cardDesc}>View and update your child&apos;s details</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

        </View>

        {/* Footer */}
        <Text style={s.footer}>© Kilmarnock Junior Ice Hockey Club</Text>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root:    { flex: 1 },
  diamond: {
    position: 'absolute',
    backgroundColor: ICE,
    transform: [{ rotate: '45deg' }],
  },

  inner: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero
  hero: { alignItems: 'center', marginBottom: 36 },

  logoImage: {
    width: 260,
    height: 124,  // preserves 3000:1432 ratio at 260px wide
  },

  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontSize: 44,
    color: WHITE,
    letterSpacing: 8,
    marginTop: 12,
  },
  fullName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  ruleLine: { width: 36, height: 1 },
  ruleDot:  { width: 4, height: 4, borderRadius: 2 },

  // ── Cards
  cards: { width: '100%', gap: 12 },

  primaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232,50,26,0.3)',
    overflow: 'hidden',
  },
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },

  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(126,180,216,0.22)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    padding: 16,
    gap: 14,
  },

  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody:  { flex: 1 },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: WHITE,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.48)',
  },

  // ── Footer
  footer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    marginTop: 32,
    letterSpacing: 0.4,
  },
});
