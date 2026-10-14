# Fluxus · Especificación para Claude Code

Oct 14, 2026 · @Leonardo Quiroga

## Resumen

Fluxus es una app Android para controlar el dinero del hogar: cuánto tenés, cuánto entra, cuánto sale y cuánto tenés por pagar. Esta especificación describe la versión 1 tal como quedó en el prototipo navegable, para construirla en Claude Code sin adivinar nada.

**Cómo usarlo en Claude Code:** pasale este documento completo y el archivo del prototipo (`gastos-hogar.html`). El prototipo es la referencia visual y de comportamiento; si algo del texto y del prototipo no coincide, manda este documento.

**Para quién es:** una sola persona por perfil, que carga y gestiona sus propios datos. No hay roles ni cuentas compartidas en la versión 1.

**Lo que la hace distinta:**

- Ninguna cuenta de dinero puede quedar en negativo; la app lo impide siempre.
- Las tarjetas de crédito y deudas viven aparte, en "Por pagar", y no se cuentan dos veces.
- Un gasto se puede pagar entre varias cuentas y queda como un solo gasto.
- Todo movimiento se puede editar o eliminar, y los saldos se corrigen solos.
- El tono es amable: "Por pagar" en vez de "Deuda", mensajes de aliento, sin alarmas.

## Tecnología y alcance

La recomendación es React Native con Expo para la app y Supabase como backend, con Android como única plataforma de la versión 1. Expo deja abierta la puerta a iOS más adelante sin reescribir.

| Pieza | Elección | Para qué |
| --- | --- | --- |
| App | React Native + Expo (TypeScript) | Una sola base de código, compilación para Android con EAS Build |
| Login | Supabase Auth (correo y contraseña) | Crear perfil, iniciar sesión, recuperar contraseña por correo |
| Datos | Supabase Postgres con Row Level Security | Cada persona ve solo sus datos; respaldo en la nube |
| Lógica de saldos | Funciones de Postgres (RPC) en una transacción | Registrar, editar y eliminar movimientos sin que los saldos queden desparejos |
| Gráficos | react-native-svg | La dona, las barras de categorías y la evolución |
| Formato de moneda | Intl.NumberFormat | Puntos, comas y decimales según la moneda |

**Entra en la versión 1:** login, configuración inicial, Inicio, registrar gastos e ingresos (con pago dividido), Por pagar, Cuentas, Movimientos con filtros y edición, Informe, estilo oscuro y logo.

**Queda afuera por ahora:** modo claro, varias monedas por perfil, presupuestos, perfiles compartidos, iOS.

**Montos:** guardar siempre como enteros en la unidad mínima de la moneda (centavos; en CLP y COP, unidades) para evitar errores de redondeo.

## Modelo de datos

Cinco tablas alcanzan: perfiles, cuentas, categorías, movimientos y las partes de cada gasto. Todas llevan `user_id` y una regla de Row Level Security que solo deja ver y cambiar las filas propias.

| Tabla | Campos | Notas |
| --- | --- | --- |
| profiles | user\_id, name, currency, onboarding\_step, hide\_owe\_tip, created\_at | `currency`: ARS, USD, CLP, UYU, MXN, COP, PEN o EUR. `onboarding_step`: intro, moneda, banco, efectivo, otras, done |
| accounts | id, user\_id, name, kind, owe\_type, amount, deleted\_at, created\_at | `kind`: dinero o pagar. `owe_type` (solo pagar): tarjeta, cuotas, persona, otro. `amount` en unidad mínima: saldo en dinero, lo que se debe en pagar. Nombre único entre las cuentas activas del usuario |
| categories | id, user\_id, name, sort\_order | Se crean con las 6 iniciales. `sort_order` fija el color de cada categoría en los gráficos |
| movements | id, user\_id, type, amount, delta, date, description, category\_id, account\_id, from\_account\_id, to\_account\_id, created\_at | `type`: ingreso, gasto, pago, transfer, nuevo\_pagar, ajuste\_pagar. `delta` solo en ajuste\_pagar (con signo) |
| movement\_parts | movement\_id, account\_id, amount | Solo para gastos: una fila por cada cuenta con la que se pagó. La suma de las partes es igual al monto del gasto |

**Categorías iniciales:** Alimentación, Salud, Educación, Servicios, Solidaridad, Ocio / Recreación.

**Qué campos usa cada tipo de movimiento:**

- ingreso: account\_id (cuenta de dinero que recibe).
- gasto: category\_id + movement\_parts (cuentas de dinero o tarjetas).
- pago: from\_account\_id (dinero) y to\_account\_id (algo por pagar).
- transfer: from\_account\_id y to\_account\_id (ambas de dinero).
- nuevo\_pagar: to\_account\_id (se anotó una deuda con monto inicial).
- ajuste\_pagar: to\_account\_id + delta (se corrigió lo que se debe, por ejemplo intereses).

**Cuentas eliminadas:** no se borran; se marcan con `deleted_at` para que su historial siga visible.

## Reglas de saldos

La regla madre: ninguna cuenta puede quedar con saldo negativo, y cada cambio de saldo nace de un movimiento registrado. Toda operación se valida y se aplica dentro de una sola transacción en el servidor.

**Efecto de cada movimiento al registrarse** (al eliminarlo, se aplica al revés):

| Movimiento | Cuenta de dinero | Por pagar | ¿Cuenta en Informe? |
| --- | --- | --- | --- |
| Ingreso | Sube la cuenta elegida | Sin cambio | Sí, como ingreso |
| Gasto con dinero | Baja cada cuenta por su parte | Sin cambio | Sí, como gasto |
| Gasto con tarjeta | Sin cambio | Sube la tarjeta por su parte | Sí, en el mes de la compra |
| Pago de tarjeta o deuda | Baja la cuenta de origen | Baja lo que se debe | No, para no duplicar |
| Transferencia | Baja una cuenta, sube la otra | Sin cambio | No |
| Anotar por pagar | Sin cambio | Sube | No |
| Actualizar monto por pagar | Sin cambio | Sube o baja | No |

**Validaciones:**

1. Gasto: si el monto supera el saldo de la cuenta de dinero elegida, se avisa cuánto hay y cuánto falta, y se ofrece dividir el pago. Ninguna parte de dinero puede superar el saldo de su cuenta; las tarjetas no tienen tope en la versión 1.
2. Pago dividido: cada fila con cuenta elegida y monto mayor a cero, sin repetir cuentas, y la suma igual al total.
3. Pago de una deuda: no puede superar lo que se debe ni el saldo de la cuenta de origen.
4. Transferencia: dos cuentas distintas y monto menor o igual al saldo de origen.
5. Editar un movimiento: se revierte el original, se aplica el nuevo y, si alguna cuenta queda en negativo, se rechaza todo con un mensaje que nombra la cuenta.
6. Eliminar un movimiento: se revierte; si deja una cuenta en negativo (porque ese dinero ya se usó), no se permite y se explica por qué.
7. Movimientos que tocan una cuenta eliminada no se pueden editar ni eliminar.

**Ajustar saldo de una cuenta de dinero:** no se edita el número directo. Si baja, se registra un gasto (con categoría obligatoria y descripción "Ajuste de saldo" por defecto); si sube, un ingreso.

**Eliminar una cuenta:** con saldo cero, se elimina. Con dinero, hay que elegir otra cuenta (o crear una) y se registra una transferencia "Cierre de …" antes de eliminarla. Con deuda pendiente, primero se registra el pago. Nunca se puede eliminar la última cuenta de dinero.

## Pantallas y flujos

La app tiene una bienvenida, el acceso, una configuración inicial que se hace una sola vez y cinco secciones con barra de navegación abajo: Inicio, Cuentas, Movimientos e Informe (más el panel Por pagar desde Inicio). Los textos entre comillas son los definitivos.

### Bienvenida y acceso

- Bienvenida: logo, "FLUXUS", "Tu dinero, en movimiento y en orden." y dos botones: "Iniciar sesión" y "Crear nuevo perfil".
- Iniciar sesión: correo y contraseña (con botón para mostrarla), enlace "Olvidé mi contraseña" y botón "Ingresar". Error: "El correo o la contraseña no coinciden. Revisalos e intentá de nuevo."
- Olvidé mi contraseña: campo de correo y "Enviar enlace". Siempre responde "Si hay un perfil con ese correo, vas a recibir el enlace" (no revela si existe).
- Crear nuevo perfil: "Tu nombre" (con la nota "Así te vamos a saludar en la app"), correo, contraseña y repetir contraseña. Mientras se escribe: "Contraseñas incorrectas" en rojo o "Contraseñas correctas" en verde. El botón "Crear usuario" está gris y se activa en turquesa solo con nombre, correo válido y contraseñas iguales. Al crearlo, vuelve a Iniciar sesión con el correo cargado y el aviso "Perfil creado. Ya podés iniciar sesión."

### Configuración inicial (una sola vez)

Se retoma donde quedó si se cierra la app a mitad. Barra de progreso de 4 tramos y botón para volver en cada paso.

1. Bienvenida: "Hola, \[nombre\]. Armemos la foto completa de tu dinero". Dos bloques: "Lo que tenés" (se carga ahora en 3 pasos) y "Lo que tenés por pagar" (se anota después desde Inicio, recomendado). Botón "Empezar".
2. Moneda: "¿En qué moneda manejás tu dinero?" con las 8 monedas y un ejemplo de formato de cada una.
3. Paso 1: "Para empezar, necesitamos saber con qué dinero contás hoy. Ingresá el monto disponible en tu cuenta bancaria principal. Cada detalle suma." Cuenta ("Banco Principal", editable) y monto.
4. Paso 2: "Ahora vamos a sumar tu dinero en efectivo. Contá con calma lo que tenés en casa y cargalo aquí." Cuenta "Efectivo" y monto.
5. Paso 3: "¿Tenés dinero en otra cuenta, billetera virtual o ahorro?" Sí abre nombre + monto y vuelve a preguntar; No termina.
6. Cierre: tarjeta con el total, "Muy bien. Este es tu punto de partida. Tomar conciencia de tu dinero es el primer paso para ordenarlo y hacerlo crecer.", la lista de cuentas y "Continuar" a Inicio.

El monto 0 es válido. Debajo de cada monto se muestra cómo se va a guardar ("Se va a guardar $ 1.234,56").

### Inicio

- Encabezado: "Hola, \[nombre\]", la fecha, y un círculo con la inicial que abre el menú (cambiar mi nombre, cerrar sesión).
- Tarjeta de dinero disponible: total de las cuentas de dinero y "Suma de tus N cuentas". Si hay algo por pagar: barra turquesa con la parte libre, "Te queda libre" y "Por pagar".
- Si lo que se debe supera el dinero: nota suave, sin rojo: "Hoy lo que tenés por pagar es más que tu dinero disponible. Verlo claro es el primer paso para ordenarlo."
- Si no anotó nada por pagar: tarjeta "Sumá lo que tenés por pagar" con "Anotar" y "Ahora no".
- Ingresos del mes a la izquierda (flecha arriba, verde) y Gastos del mes a la derecha (flecha abajo, rojo), con el monto en gris.
- Botones del mismo tamaño, uno debajo del otro: "Registrar gastos", "Registrar ingresos" y uno más chico "Por pagar · $ total".
- Últimos 5 movimientos; tocar uno abre su detalle.

### Registrar gasto

Monto total, categoría (con "+ Nueva categoría"), fecha (hoy por defecto, no futura), "Pagado con" y descripción opcional. Debajo de "Pagado con", siempre visible: "Dividir el pago entre varias cuentas".

Al dividir: filas de cuenta + monto, "+ Agregar otra cuenta" (la fila nueva trae lo que falta), quitar filas si hay más de 2, y una línea que dice "Repartido $ X de $ Y · falta $ Z" hasta llegar a "✓ Repartido el total". "Pagar con una sola cuenta" vuelve al modo simple. Si la cuenta elegida no alcanza, el aviso ofrece "Dividir el pago con otra cuenta" y arma las dos filas solas. El botón "Registrar gasto" se activa solo con todo válido.

### Registrar ingreso

Monto, cuenta donde entra (con "+ Crear cuenta"), fecha y descripción opcional.

### Por pagar

Resumen (total por pagar, dinero disponible, te queda libre), la lista con el tipo de cada una, "Anotar algo por pagar" (tipo: tarjeta de crédito, cuotas o préstamo, a una persona, otro; nombre; cuánto debés hoy, puede ser 0) y "Registrar un pago" (qué pagás, monto con atajo "Pagar el total", desde qué cuenta, fecha). Nota: los gastos con tarjeta se registran como gasto eligiendo la tarjeta en "Pagado con".

### Cuentas

- Tarjetas en dos grupos con su total: "Tu dinero" y "Por pagar". Cada tarjeta muestra nombre, monto y cantidad de movimientos (o el tipo de deuda).
- "+ Nueva cuenta" (monto inicial opcional) y "Transferir entre cuentas".
- Detalle de una cuenta: saldo, acciones (cambiar nombre, ajustar saldo o actualizar monto, transferir, registrar un pago, eliminar) y sus movimientos del más reciente al más antiguo: ingresos en verde, gastos en rojo, fecha en gris.
- Tras ajustar: "Se ha actualizado el monto total de \[cuenta\]. El monto actual es $ xxxx."
- Eliminar con dinero: "La cuenta \[cuenta\] que desea eliminar tiene $ xxxx. Es necesario mover ese dinero a otra cuenta antes de eliminarla." con desplegable de destino y "Mover y eliminar".

### Movimientos

- Todos los movimientos, del más reciente al más antiguo, agrupados por día ("Hoy · martes 14 de octubre").
- Filtros: búsqueda (descripción, categoría o cuenta), mes (este mes, mes pasado, meses anteriores, todos), cuenta (dinero, por pagar, eliminadas), tipo (Todo, Gastos, Ingresos, Pagos y transferencias) y categoría. "Limpiar filtros" cuando hay alguno activo. Por defecto: este mes, todo.
- Arriba, total de ingresos y gastos de lo filtrado. Con una cuenta elegida, cada movimiento muestra el monto que afectó a esa cuenta.
- Detalle de un movimiento: monto, fecha, categoría, cuentas (con el monto de cada parte si es dividido), descripción y fecha de registro. "Editar" (solo ingresos y gastos, en el mismo formulario precargado) y "Eliminar" con confirmación que explica qué va a pasar ("Vuelven $ 10.000 a Efectivo").

### Informe

Un selector de mes arriba controla todo.

1. Dona "¿En qué gastaste más en \[mes\]?": las 5 categorías con más gasto y "Otras categorías", total en el centro. Tocar un color o una fila la destaca y muestra su monto y porcentaje en el centro.
2. Resumen del mes: ingresos, gastos y "Te quedó" (o "Gastaste de más").
3. Todas las categorías: barras con monto y porcentaje; tocar una abre Movimientos filtrado por esa categoría y mes.
4. Comparar meses: dos selectores (por defecto el mes anterior y el del informe). Cada categoría con "monto antes → monto después" y la diferencia: ▲ en rojo si se gastó más, ▼ en verde si se gastó menos, más la fila Total.
5. Evolución de una categoría: barras de los últimos 6 meses, tocar una muestra su monto, y el promedio de los meses con gasto.

## Estilo, logo y moneda

Fluxus es siempre oscura (estilo "Azul medianoche"): fondo azul marino, acento turquesa y una regla fija de color: turquesa es la marca, verde es lo que entra, rojo coral es lo que sale. El modo claro queda para una versión posterior.

| Rol | Color |
| --- | --- |
| Fondo | #0B1226 |
| Tarjetas y campos | #111A38 |
| Tarjeta destacada (dinero disponible) | #16224A, borde #263770 |
| Bordes y separadores | #1F2C5A |
| Texto principal | #EAF0FF |
| Texto secundario y fechas | #8D9BC4 |
| Acento de marca, botón principal, barra "libre" | #4FE3D4 (texto encima #0B1226) |
| Ingresos | #4ADE9A |
| Gastos | #FF6F91 |
| Avisos (saldo insuficiente) | #F5C26B sobre #33291A |
| Botón desactivado | #24305A, texto #6F7DA8 |

**Colores de categorías en gráficos**, fijos por el orden de la categoría (no por su puesto en el mes): #3987E5, #D95926, #199E70, #C98500, #D55181, #008300, #9085E9, #E66767; a partir de la novena y "Otras categorías", #566176.

**Tipografía:** Sora en toda la app (400, 500, 600, 700, 800). Los números con cifras tabulares para que se alineen.

**Formas:** esquinas de 12 a 18 px en tarjetas y botones, áreas táctiles de 44 px como mínimo, botones principales de 52 a 56 px de alto.

**Logo:** dos cintas que suben y terminan en una flecha, en un solo color turquesa sobre el fondo oscuro, y el nombre "FLUXUS" en mayúsculas, Sora 800. El vector está en el lienzo "Fluxus · Logo" (versión original azul sobre blanco, versión turquesa e ícono de la app). Usarlo también como ícono adaptativo de Android.

**Moneda:** se elige una vez en la configuración y define todo el formato con `Intl.NumberFormat`.

| Moneda | Formato | Decimales |
| --- | --- | --- |
| ARS · Peso argentino | $ 1.234,56 (es-AR) | 2 |
| USD · Dólar estadounidense | $1,234.56 (en-US) | 2 |
| CLP · Peso chileno | $1.235 (es-CL) | 0 |
| UYU · Peso uruguayo | es-UY | 2 |
| MXN · Peso mexicano | es-MX | 2 |
| COP · Peso colombiano | es-CO | 0 |
| PEN · Sol peruano | es-PE | 2 |
| EUR · Euro | es-ES | 2 |

Al escribir montos se acepta el separador decimal de la moneda y también el otro si va seguido de 1 o 2 cifras al final (en ARS, "1500.5" se lee como 1.500,50), porque muchos teclados de Android solo muestran el punto.

## Orden de construcción

Construir en siete etapas, cada una probada en un celular Android antes de pasar a la siguiente. Las reglas de saldos van primero porque todo lo demás depende de ellas.

1. **Base:** proyecto Expo con TypeScript, proyecto Supabase, tablas y reglas de seguridad, y las funciones del servidor que registran, editan y eliminan movimientos. Con pruebas automáticas de cada regla de la sección "Reglas de saldos".
2. **Acceso:** bienvenida, crear perfil, iniciar sesión, recuperar contraseña por correo.
3. **Configuración inicial:** los seis pasos, retomando donde quedó.
4. **Inicio y registro:** Inicio, registrar gasto (con pago dividido), registrar ingreso, Por pagar.
5. **Cuentas:** tarjetas, detalle, nueva cuenta, cambiar nombre, ajustar, transferir, eliminar.
6. **Movimientos:** lista, filtros, detalle, editar, eliminar.
7. **Informe, estilo final y logo:** los cinco bloques del informe, colores, tipografía e ícono de la app.

**Casos de prueba que no pueden fallar:**

- Cine de $ 25.000: $ 10.000 en efectivo y $ 15.000 con la Visa. El efectivo baja $ 10.000, lo que se debe en la Visa sube $ 15.000 y el informe suma $ 25.000 en Ocio.
- Gasto mayor que el saldo de la cuenta elegida: no deja registrarlo sin dividir.
- Eliminar un ingreso cuyo dinero ya se gastó: lo impide y nombra la cuenta.
- Pagar el resumen de la Visa desde el banco: baja el banco y la deuda, y el gasto del mes no cambia.
- Eliminar una cuenta con dinero: el dinero llega a la cuenta elegida y el historial de la cuenta eliminada sigue visible.
- Montos en CLP sin decimales y en ARS con coma decimal.

**Usuario de prueba:** admin@gmail.com / admin solo en el entorno de desarrollo; nunca en la versión publicada.

## Publicación y pendientes

Para publicar en Google Play hace falta una cuenta de desarrollador y, si es una cuenta personal creada después del 13 de noviembre de 2023, una prueba cerrada con al menos 12 personas durante 14 días seguidos antes de poder pedir el acceso a producción ([Google Play Console](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Conviene ir sumando a esas 12 personas desde la etapa 4.

- [ ] Crear la cuenta de Google Play Console (pago único de 25 USD).
- [ ] Escribir y publicar la política de privacidad (qué datos se guardan, dónde y cómo borrarlos).
- [ ] Completar la sección de seguridad de datos de Play Console.
- [ ] Ofrecer "Eliminar mi cuenta" dentro de la app, que borre el perfil y todos sus datos.
- [ ] Configurar el envío de correos de recuperación de contraseña con un remitente propio.
- [ ] Capturas de pantalla, ícono de 512 px y descripción para la ficha de la tienda.
- [ ] Prueba cerrada con 12 personas durante 14 días.
- [ ] Quitar el usuario de prueba admin antes de publicar.

**Ideas para después de la versión 1:** modo claro, presupuesto mensual por categoría, recordatorio a la noche para anotar gastos, exportar movimientos a planilla, versión para iOS.

## Fuentes

- [Requisitos de prueba para cuentas personales nuevas de Google Play Console](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
