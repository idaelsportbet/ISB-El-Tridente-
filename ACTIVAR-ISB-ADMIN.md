# ISB Admin

Aplicación instalable para publicar un pick en uno o varios paquetes a la vez.
Cambios preparados localmente. La cuenta autorizada es idaelvargasbusiness@gmail.com,
verificada en el servidor con Supabase Auth y correo confirmado. No están desplegados.

## Activación

1. Subir los archivos de este paquete al repositorio de la web conservando `api/`.
2. Confirmar que idaelvargasbusiness@gmail.com tiene una cuenta registrada en la web
   y el correo confirmado en Supabase Auth.
3. Opcional: fijar `ADMIN_USER_ID` en Vercel con el UUID de esa misma cuenta. Si se
   configura, ese identificador tiene prioridad sobre la comprobación del correo.
   Solo se admite una cuenta. No se acepta una dirección de correo como UUID.
4. Comprobar que `SUPABASE_SECRET_KEY` está configurada como clave de servidor de
   ese proyecto, con acceso al servicio de Auth y escritura en `public.picks`.
   Nunca poner esa clave en HTML, JavaScript del navegador ni en GitHub.
5. Ejecutar `admin-protection.sql` en Supabase. Impide escribir directamente en
   `picks` desde cuentas comunes incluso si había políticas permisivas.
   Conserva las políticas de lectura existentes: comprobar que los clientes con
   compra activa siguen pudiendo leer los picks de su paquete, y los demás no.
6. Volver a desplegar el proyecto en Vercel después de configurar las variables.
7. Iniciar sesión con el usuario autorizado. En Mi cuenta aparecerá
   «ADMINISTRAR PICKS». También puede abrir `/admin`.
8. Android: usar el botón de instalación cuando esté disponible, o la opción
   del navegador. iPhone: Safari → Compartir → Añadir a pantalla de inicio.

## Uso

Escribir título y análisis, elegir fecha y marcar todos los paquetes destinatarios.
El enlace HTTPS de imagen es opcional. Pulsar «PUBLICAR PICK» una vez.
Luego «PUBLICAR OTRO PICK» permite empezar una nueva publicación.
Para cada paquete se muestra el pick más reciente de esa fecha.
La fecha predeterminada y la consulta del cliente usan America/Chicago.
No se envían mensajes de WhatsApp, correo ni notificaciones push.
La aplicación necesita internet y no guarda respuestas privadas en caché.

## Verificaciones realizadas

14 comprobaciones locales con servicios simulados: sesión ausente, sesión vencida,
cuenta ajena, administrador permitido, paquetes inválidos, fechas inválidas,
enlaces inseguros, publicación conjunta sin duplicar paquetes, fallos de escritura
y bloqueo sin conexión configurada; correo autorizado confirmado, correo sin confirmar
y cuenta con correo diferente. Scripts HTML verificados.
No se publicaron picks en producción y no se comprobó el esquema real de Supabase.
Es necesario probar una publicación controlada tras el despliegue.

## Alcance

Este paquete incluye correcciones de navegación y contacto, renovación de acceso,
fecha de los picks y visualización segura de texto. No cambia los cobros de Stripe.
La revisión de métodos de pago, importes en USD y renovación de suscripciones
permanece pendiente.
