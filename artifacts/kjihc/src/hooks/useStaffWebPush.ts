import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushState = "unsupported" | "denied" | "granted" | "default" | "loading";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useStaffWebPush() {
  const { getToken } = useAuth();
  const [state, setState] = useState<PushState>("loading");
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [sw, setSw] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setState("denied"); return; }

    navigator.serviceWorker
      .register(`${BASE}/sw.js`, { scope: BASE || "/" })
      .then((reg) => {
        setSw(reg);
        return reg.pushManager.getSubscription();
      })
      .then((sub) => setState(sub ? "granted" : "default"))
      .catch(() => setState("default"));
  }, []);

  useEffect(() => {
    if (!vapidKey) {
      fetch(`${BASE}/api/staff/vapid-public-key`)
        .then((r) => r.json())
        .then((d) => setVapidKey(d.publicKey))
        .catch(() => {});
    }
  }, [vapidKey]);

  const subscribe = useCallback(async () => {
    if (!sw || !vapidKey) return;
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm as PushState); return; }

      const subscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      const token = await getToken();
      await fetch(`${BASE}/api/staff/web-push-subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });

      setState("granted");
    } catch {
      setState("default");
    }
  }, [sw, vapidKey, getToken]);

  const unsubscribe = useCallback(async () => {
    if (!sw) return;
    setState("loading");
    try {
      const sub = await sw.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const token = await getToken();
        await fetch(`${BASE}/api/staff/web-push-subscribe`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("default");
    } catch {
      setState("default");
    }
  }, [sw, getToken]);

  return { state, subscribe, unsubscribe };
}
