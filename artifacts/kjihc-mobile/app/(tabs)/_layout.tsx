import { Redirect } from 'expo-router';
// The old scaffold tabs group — redirect to landing
export default function OldTabsLayout() {
  return <Redirect href="/" />;
}
