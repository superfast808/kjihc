import React from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView,
  TouchableOpacity, Linking, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { CLUB_LOGO } from '@/constants/branding';
const LOGO = CLUB_LOGO;
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useParentAuth } from '@/context/ParentAuthContext';
import { useListFees } from '@workspace/api-client-react';

const CLUB_INFO = {
  name:           'Kilmarnock Junior Ice Hockey Club',
  venue:          'Galleon Centre',
  address:        'Titchfield Street, Kilmarnock, KA1 1QU',
  email:          'chairperson@kjihc.org',
  facebook:       'https://www.facebook.com/kjihcuk',
  facebookHandle: '/KJIHC',
};

function InfoRow({ icon, label, value, onPress }: {
  icon: string; label: string; value: string; onPress?: () => void;
}) {
  const colors = useColors();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Wrap style={s.infoRow} {...(onPress ? { onPress, activeOpacity: 0.7 } : {} as any)}>
      <View style={[s.infoIcon, { backgroundColor: colors.muted }]}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[s.infoValue, { color: onPress ? colors.secondary : colors.foreground }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />}
    </Wrap>
  );
}

export default function InfoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clearSession } = useParentAuth();

  const handleSignOut = async () => {
    await clearSession();
    router.replace('/');
  };

  const topPad  = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const tabBarH = Platform.OS === 'web' ? 84 : 80;

  const { data: fees, isLoading: feesLoading } = useListFees();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#001f3d', '#003366']} style={[s.header, { paddingTop: topPad + 12 }]}>
        <View style={s.headerRow}>
          <View>
            <View style={s.goldAccent} />
            <Text style={s.headerTitle}>Club Info</Text>
          </View>
          <Image source={LOGO} style={s.headerLogo} contentFit="contain" />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + tabBarH + 8, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Club identity */}
        <View style={[s.clubCard, { backgroundColor: colors.primary }]}>
          <View style={[s.clubLogo, { backgroundColor: colors.secondary }]}>
            <Text style={[s.clubLogoText, { color: colors.primary }]}>KJIHC</Text>
          </View>
          <Text style={s.clubName}>{CLUB_INFO.name}</Text>
          <Text style={s.clubSub}>Est. 1996 · Kilmarnock, Scotland</Text>
        </View>

        {/* Contact */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Contact</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow
            icon="location-outline" label="Home rink"
            value={`${CLUB_INFO.venue}, ${CLUB_INFO.address}`}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(CLUB_INFO.venue + ', ' + CLUB_INFO.address)}`)}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <InfoRow
            icon="mail-outline" label="Email" value={CLUB_INFO.email}
            onPress={() => Linking.openURL(`mailto:${CLUB_INFO.email}`)}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <InfoRow
            icon="logo-facebook" label="Facebook" value={CLUB_INFO.facebookHandle}
            onPress={() => Linking.openURL(CLUB_INFO.facebook)}
          />
        </View>

        {/* Membership fees */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Membership fees</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {feesLoading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
          ) : fees && fees.length > 0 ? (
            fees.map((fee, i) => (
              <View key={fee.id}>
                {i > 0 && <View style={[s.separator, { backgroundColor: colors.border }]} />}
                <View style={s.feeRow}>
                  <Text style={[s.feeGroup, { color: colors.foreground }]}>{fee.feeGroup.toUpperCase()}</Text>
                  <Text style={[s.feeAmount, { color: colors.secondary }]}>£{fee.feeAmount}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[s.noFees, { color: colors.mutedForeground }]}>Contact the club for fee information.</Text>
          )}
        </View>

        {/* Standing order */}
        <View style={[s.card, { backgroundColor: '#fff8e1', borderColor: '#fbbf24' }]}>
          <View style={s.infoRow}>
            <View style={[s.infoIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="card-outline" size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.infoLabel, { color: '#b45309' }]}>Standing order payments</Text>
              <Text style={[s.standingOrderText, { color: '#78350f' }]}>
                Fees are paid monthly by standing order. Contact the club treasurer for bank account details and reference instructions.
              </Text>
            </View>
          </View>
        </View>

        {/* SIHA */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>SIHA Registration</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.infoRow}>
            <View style={[s.infoIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Scottish Ice Hockey Association</Text>
              <Text style={[s.sihaText, { color: colors.foreground }]}>
                All players must be registered with SIHA before competing. Your club administrator will contact you when registration is due.
              </Text>
            </View>
          </View>
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <InfoRow
            icon="globe-outline" label="SIHA website" value="www.siha-uk.co.uk"
            onPress={() => Linking.openURL('https://www.siha-uk.co.uk')}
          />
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[s2.signOutBtn, { borderColor: colors.border }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
          <Text style={[s2.signOutText, { color: colors.destructive }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:         { flex: 1 },
  header:            { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLogo:        { width: 84, height: 40 },
  goldAccent:        { height: 3, width: 40, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 14 },
  headerTitle:       { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff' },
  clubCard:          { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  clubLogo:          { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  clubLogoText:      { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: 1 },
  clubName:          { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#fff', textAlign: 'center', lineHeight: 24 },
  clubSub:           { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  sectionTitle:      { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 10, marginTop: 4 },
  card:              { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  infoRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon:          { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel:         { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 3 },
  infoValue:         { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 19 },
  separator:         { height: 1, marginVertical: 12 },
  feeRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  feeGroup:          { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  feeAmount:         { fontFamily: 'Inter_700Bold', fontSize: 16 },
  noFees:            { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', padding: 8 },
  standingOrderText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  sihaText:          { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
});

const s2 = StyleSheet.create({
  signOutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 13, marginTop: 20 },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
