import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { NAVY, GOLD } from '@/constants/branding';

export default function StaffLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const safeAreaInsets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  // Register synchronously in the render pass so that any child screen's query
  // hooks already have a working token getter on their first mount.
  setAuthTokenGetter(() => getToken());

  // Also keep the registration current when getToken reference changes.
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // KJIHC brand: navy bar, gold active tab, ice-blue inactive
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : NAVY,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: 'rgba(246,168,0,0.35)',
          elevation: 0,
          paddingBottom: safeAreaInsets.bottom,
          ...(isWeb ? { height: 64 } : { height: 56 + safeAreaInsets.bottom }),
        },
        tabBarBackground: () =>
          isIOS ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: NAVY }]}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={{ height: 2, backgroundColor: 'rgba(246,168,0,0.5)' }} />
            </View>
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: NAVY }]}>
              <View style={{ height: 2, backgroundColor: 'rgba(246,168,0,0.5)' }} />
            </View>
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar" tintColor={color} size={22} />
            ) : (
              <Feather name="calendar" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'Players',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.3.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="users" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="compliance"
        options={{
          title: 'Compliance',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="exclamationmark.shield.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="shield" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar.badge.plus" tintColor={color} size={22} />
            ) : (
              <Feather name="calendar" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="message-square" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
