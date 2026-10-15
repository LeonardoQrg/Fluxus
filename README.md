# Fluxus

App Android para controlar el dinero del hogar: cuánto tenés, cuánto entra, cuánto sale y cuánto tenés por pagar.

- Especificación: [`docs/especificacion.md`](docs/especificacion.md)
- Prototipo navegable: [`docs/gastos-hogar.html`](docs/gastos-hogar.html) (abrilo en el navegador)

## Cómo está organizado

| Carpeta / archivo | Qué hay |
| --- | --- |
| `src/app/` | Las pantallas (cada archivo es una pantalla) |
| `src/components/` | Piezas visuales comunes: botones, campos, avisos |
| `src/lib/auth.tsx` | Sesión y perfil de la persona |
| `src/lib/money.ts` | Formato de montos y monedas |
| `src/lib/supabase.ts` | Conexión con Supabase |
| `src/theme.ts` | Colores |
| `supabase/migrations/` | La base de datos: tablas, seguridad y reglas de saldos |
| `tests/` | Pruebas automáticas de las reglas de saldos |
| `tools/supabase-local/` | Supabase de prueba para desarrollar sin cuenta (ver su README) |

## Estado

- [x] Etapa 1 · Base: proyecto Expo, tablas, seguridad, funciones del servidor y pruebas
- [x] Etapa 2 · Acceso: bienvenida, crear perfil, iniciar sesión, recuperar contraseña
- [ ] Etapa 3 · Configuración inicial
- [ ] Etapa 4 · Inicio y registro
- [ ] Etapa 5 · Cuentas
- [ ] Etapa 6 · Movimientos
- [ ] Etapa 7 · Informe, estilo final y logo

## Poner en marcha

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` como `.env` y completar la URL y la clave pública de Supabase.
3. Aplicar la base de datos en Supabase: abrir **SQL Editor** y correr, en orden, los archivos de
   `supabase/migrations/`.
4. Iniciar la app: `npx expo start` y escanear el código QR con **Expo Go** en el celular.

## Pruebas

Las pruebas usan un Postgres local (por defecto `postgres://postgres:postgres@localhost:5432/postgres`,
se cambia con `DATABASE_URL`). Crean una base `fluxus_test` desde cero en cada corrida.

```sh
npm test          # todas las pruebas
npm run typecheck # revisa los tipos de TypeScript
```

En GitHub corren solas en cada cambio (`.github/workflows/pruebas.yml`).

## Cómo funcionan los saldos

Los montos se guardan como enteros en la unidad mínima de la moneda (centavos; en CLP y COP, unidades).

La app **no** puede cambiar saldos directamente. Todo pasa por funciones del servidor que validan y
aplican el cambio en una sola transacción: si algo queda mal (por ejemplo, una cuenta en negativo),
no se guarda nada.

| Función | Para qué |
| --- | --- |
| `register_movement` | Registrar ingreso, gasto (con pago dividido), pago, transferencia, deuda nueva o ajuste de deuda |
| `update_movement` | Editar un ingreso o gasto |
| `delete_movement` | Eliminar un movimiento |
| `create_account` | Crear una cuenta de dinero o algo por pagar |
| `rename_account` | Cambiar el nombre |
| `adjust_account` | Ajustar el saldo (registra el gasto, ingreso o ajuste que corresponda) |
| `delete_account` | Eliminar una cuenta (moviendo su dinero si tiene) |

Los errores llegan con `message` (texto para mostrar), `details` (código, por ejemplo `saldo_negativo`)
y `hint` (id de la cuenta involucrada).

El informe se lee de las vistas `report_month` (ingresos y gastos por mes) y `report_category_month`
(gastos por categoría y mes).
