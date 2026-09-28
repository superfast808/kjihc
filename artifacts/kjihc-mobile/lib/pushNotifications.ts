/**
 * Parent push-notification registration.
 *
 * The API already sends Expo pushes for: new events in the child's age group,
 * direct/group messages, noticeboard announcements, and fee/SIHA compliance
 * changes. This module registers the device token so those pushes arrive.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getBaseUrl } from '@workspace/api-client-react';

const PUSH_TOKEN_KEY = 'kjihc_expo_push_token';

// Show notifications while the app is foregrounded too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Club notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f6a800',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const tokenResp = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return tokenResp.data ?? null;
}

/** Register this device for parent pushes. Call after login / on app start. */
export async function registerParentPushToken(sessionToken: string): Promise<void> {
  try {
    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) return;

    const base = getBaseUrl() ?? '';
    const res = await fetch(`${base}/api/parent/device-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ expoPushToken }),
    });
    if (res.ok) await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
  } catch {
    // Non-fatal — user just won't get pushes on this device yet.
  }
}

/** Remove this device from parent pushes. Call before clearing the session. */
export async function unregisterParentPushToken(sessionToken: string): Promise<void> {
  try {
    const expoPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!expoPushToken) return;

    const base = getBaseUrl() ?? '';
    await fetch(`${base}/api/parent/device-token`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ expoPushToken }),
    });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // Non-fatal.
  }
}
