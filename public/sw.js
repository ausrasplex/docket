// Docket's service worker: only shows reminders (Web Push) and opens Docket when one is tapped.
// No caching or offline pages.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", (e) => {
  let msg = { title: "Docket", body: "", url: "/" }
  try {
    msg = { ...msg, ...e.data.json() }
  } catch {}
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: msg.url },
    }),
  )
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
