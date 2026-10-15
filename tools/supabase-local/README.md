# Supabase de prueba local (solo desarrollo)

Para probar la app completa sin una cuenta de Supabase: un servidor chico que imita
las partes de Supabase que usa Fluxus (acceso y datos) sobre un Postgres local, con
las mismas tablas, funciones y reglas de seguridad de `supabase/migrations/`.

**Nunca se usa en la versión publicada.**

```sh
node tools/supabase-local/reset-db.mjs   # crea la base fluxus_dev desde cero (con admin@gmail.com / admin)
node tools/supabase-local/server.mjs     # Supabase de prueba en http://localhost:54321
```

Los correos de "Olvidé mi contraseña" no se envían: el enlace se anota en `/tmp/fluxus-correos.log`.

## Probar la app en un navegador

```sh
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_KEY=local \
  npx expo export --platform web --output-dir /tmp/fluxus-web
node tools/supabase-local/serve-web.mjs /tmp/fluxus-web   # http://localhost:8081
node tools/e2e/acceso.mjs /tmp/fotos                      # recorre el acceso y saca fotos
```
