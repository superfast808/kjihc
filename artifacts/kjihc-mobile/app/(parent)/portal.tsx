import { Redirect } from 'expo-router';

// Portal is now the full tab-based parent section.
// This file keeps old links working by redirecting straight to the events tab.
export default function ParentPortalRedirect() {
  return <Redirect href="/(parent)/(tabs)/events" />;
}
