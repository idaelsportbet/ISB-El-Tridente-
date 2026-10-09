// El panel necesita conexión. No se guardan sesiones, picks ni respuestas privadas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ISB Admin</title><body style="background:#090c0b;color:#fff;font:18px system-ui;padding:30px"><h1>Sin conexión</h1><p>Conéctate a internet para abrir tu cuenta y publicar picks.</p><button onclick="location.reload()">Volver a intentar</button></body></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
});
