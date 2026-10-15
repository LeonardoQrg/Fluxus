# Ficha de Fluxus en Google Play

Textos y respuestas listas para copiar y pegar en Play Console. Las imágenes están en `assets/store/`.

## Datos principales

| Campo | Qué poner |
| --- | --- |
| Nombre de la app (máx. 30) | **Fluxus** |
| Descripción breve (máx. 80) | **Controlá tu dinero: cuánto tenés, cuánto entra, cuánto sale y cuánto debés.** |
| Categoría | **Finanzas** |
| Tipo | Aplicación (no juego) · Gratuita |
| Ícono (512 × 512) | `assets/store/icono-512.png` |
| Imagen de portada (1024 × 500) | `assets/store/portada-1024x500.png` |
| Capturas de teléfono (1170 × 2340) | `assets/store/captura-1-inicio.png` … `captura-5-informe.png` |
| Política de privacidad | `https://leonardoqrg.github.io/Fluxus/privacidad.html` |
| Cómo eliminar la cuenta (web) | `https://leonardoqrg.github.io/Fluxus/eliminar-cuenta.html` |
| Correo de contacto | el que elijas mostrar públicamente |

## Descripción completa

```
Fluxus te ayuda a ordenar el dinero de tu hogar, sin complicaciones y sin presiones.

VER TODO EN UN VISTAZO
Tu dinero disponible, lo que ya tenés comprometido y cuánto te queda libre de verdad.

REGISTRAR EN SEGUNDOS
• Anotá gastos e ingresos en pocos toques.
• Pagá un gasto con varias cuentas a la vez: queda como un solo gasto.
• Elegí la categoría y la fecha; si te olvidaste de anotar algo, cargalo con su día.

NINGUNA CUENTA EN NEGATIVO
Fluxus no te deja gastar más de lo que hay en una cuenta. Si no alcanza, te avisa cuánto falta y te ayuda a dividir el pago.

TARJETAS Y DEUDAS APARTE
Lo que tenés por pagar (tarjetas de crédito, cuotas, préstamos) vive en su propio lugar y nunca se cuenta dos veces. Cuando pagás el resumen de la tarjeta, no se duplica el gasto.

CUENTAS A TU MEDIDA
Banco, efectivo, billeteras virtuales, ahorros. Transferí entre cuentas, ajustá saldos y cerrá cuentas sin perder tu historial.

INFORMES CLAROS
• ¿En qué gastaste más este mes? Un gráfico simple por categoría.
• Compará dos meses y mirá en qué subiste o bajaste.
• Seguí la evolución de una categoría en los últimos 6 meses.

TODO SE PUEDE CORREGIR
Editá o eliminá cualquier movimiento y los saldos se corrigen solos.

PARA TODA LATINOAMÉRICA Y EUROPA
Pesos argentinos, chilenos, colombianos, mexicanos y uruguayos, dólares, soles y euros, con el formato de números de cada país.

TUS DATOS, TUYOS
Sin publicidad. No vendemos ni compartimos tu información. Podés eliminar tu cuenta y todos tus datos desde la app cuando quieras.

Fluxus: tu dinero, en movimiento y en orden.
```

## Formularios de Play Console (respuestas)

### Contenido de la app
| Pregunta | Respuesta |
| --- | --- |
| ¿La app contiene anuncios? | No |
| Acceso a la app | **Hay partes restringidas** → ofrecer una cuenta de prueba para el revisor (ver "Pendientes") |
| Público objetivo | 18 años o más |
| ¿Es una app de noticias / COVID-19 / gubernamental? | No |
| ¿Es una app financiera? | Sí, pero **no ofrece préstamos, billeteras ni transferencias de dinero reales**: solo es un registro personal de gastos. Marcar "Gestión de finanzas personales / seguimiento", no "Servicios bancarios" ni "Préstamos". |
| Cuestionario de clasificación (IARC) | Sin violencia, sin contenido sexual, sin lenguaje fuerte, sin sustancias, sin juegos de azar, sin contenido generado por usuarios visible a otros. Resultado esperado: apta para todos. |

### Seguridad de los datos
| Pregunta | Respuesta |
| --- | --- |
| ¿Recopila o comparte datos del usuario? | Sí, recopila. **No comparte** con terceros (Supabase actúa como proveedor de servicio por cuenta nuestra). |
| ¿Datos cifrados en tránsito? | Sí |
| ¿Se puede pedir la eliminación de los datos? | Sí (en la app y en la dirección web de arriba) |
| Tipos de datos recopilados | **Información personal** → Nombre, Dirección de correo electrónico · **Información financiera** → Otra información financiera (cuentas, saldos y movimientos que escribe la persona) |
| ¿Para qué? | Funcionalidad de la app · Administración de la cuenta |
| ¿Es obligatorio? | Sí (sin ellos la app no funciona) |
| Otros tipos de datos (ubicación, contactos, fotos, mensajes, historial de navegación, identificadores de dispositivo, etc.) | No se recopilan |

## Pendientes antes de enviar a revisión

- [ ] Cuenta de prueba para el revisor de Google (correo y contraseña) creada en el proyecto de Supabase real, con algunos datos cargados. Se borra después de la aprobación.
- [ ] Elegir el correo de contacto público y reemplazar `CORREO_DE_CONTACTO` en `sitio/privacidad.html` y `sitio/eliminar-cuenta.html`.
- [ ] Activar GitHub Pages (Settings → Pages → Source: GitHub Actions).
- [ ] Prueba cerrada: 12 personas, 14 días seguidos.
