import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { useParentAuth } from '@/context/ParentAuthContext';
import { UnreadProvider, useUnread } from '@/context/UnreadContext';

const NAVY     = '#001f3d';
const GOLD     = '#f6a800';
const INACTIVE = 'rgba(255,255,255,0.45)';

function TabsContent() {
  const { unreadCount } = useUnread();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: NAVY,
          borderTopWidth: 0,
          elevation: 0,
          position: 'absolute',
          ...(isWeb
            ? { bottom: 0, left: 0, right: 0, height: 64, paddingBottom: 10, zIndex: 100 }
            : { height: (isIOS ? 84 : 56) + insets.bottom, paddingBottom: insets.bottom }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginBottom: isIOS ? 0 : 4,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,31,61,0.85)' }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <SymbolView name={(focused ? 'calendar.fill' : 'calendar') as any} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: GOLD, color: NAVY, fontSize: 10, fontWeight: '700' },
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <SymbolView name={(focused ? 'message.fill' : 'message') as any} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="child"
        options={{
          title: 'My Child',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <SymbolView name={(focused ? 'person.circle.fill' : 'person.circle') as any} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: 'Club Info',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <SymbolView name={(focused ? 'info.circle.fill' : 'info.circle') as any} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? 'information-circle' : 'information-circle-outline'} size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function ParentTabLayout() {
  const { token, isLoaded } = useParentAuth();

  // Redirect to login if not authenticated
  if (isLoaded && !token) return <Redirect href="/(parent)" />;

  return (
    <UnreadProvider>
      <TabsContent />
    </UnreadProvider>
  );
}
