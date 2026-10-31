# Gestor Académico Universitario XK

[![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub%20Pages-00f0ff?style=flat&logo=github)](https://xekred.github.io/gestor-universitario/)
[![Database](https://img.shields.io/badge/Backend-Supabase%20PostgreSQL-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![Design](https://img.shields.io/badge/Design-Dark%20Cyan%20Cyber-00e5a0?style=flat)](https://xekred.github.io/dolar-bcv-monitor/)
[![Architecture](https://img.shields.io/badge/Architecture-Vanilla%20JS%20Modular-5865F2?style=flat)]()
[![Platform](https://img.shields.io/badge/Platform-PWA%20Mobile--First-ff9f43?style=flat)]()

Aplicación web progresiva (PWA) de alto rendimiento para la gestión integral de horarios universitarios por bloques de 45 minutos, calendario interactivo, línea de tiempo de evaluaciones (Roadmap), calculadora de calificaciones por corte (Escala 0–20 pts), control de entregas por estudiante, personalización visual y suscripción académica multi-sección con detector de choques de horario.

Sincronizada en tiempo real mediante **Supabase (PostgreSQL, Supabase Auth y Realtime)** con seguridad por políticas de nivel de fila (RLS) y soporte offline híbrido automático vía `localStorage`.

Inspirado en la estética visual cyber-dark y diseño moderno de [dolar-bcv-monitor](https://xekred.github.io/dolar-bcv-monitor/).

---

## Características Principales

### 1. Horario Semanal Matricial (Bloques de 45 Minutos)
- **Bloques Académicos:**
  - Formación matutina obligatoria (07:00 a 07:45).
  - Bloques matutinos (07:45 a 13:00) y vespertinos (13:00 a 17:30).
- **Rowspan Dinámico:** Renderizado inteligente de asignaturas continuas (2, 3, 4 o 6 bloques).
- **Indicador en Tiempo Real:** Detección del día y bloque actual con iluminación en cian neón y etiqueta `[HOY]`.
- **Modal de Detalle por Asignatura:** Aula, docente, código de materia, desglose de bloques semanales y evaluaciones vinculadas.

### 2. Detección Activa de Choques de Horario (Multi-Sección)
- **Suscripción por Código:** Cada materia cuenta con un código único (`subject_code`, ej. `AUD-08S`, `TEL-08S`).
- **Inscripción Externa:** Los alumnos pueden inscribir materias de otras secciones o turnos (ej. `RED-08N`, `BD2-07D`, `SEG-08N`).
- **Alerta Visual de Cruce:** Si dos materias activas coinciden en el mismo día y bloque, la celda se transforma en una alerta destacada con borde rojo pulsante, etiqueta `[CHOQUE DE HORARIO]` y visualización dividida con acceso independiente a los detalles de cada asignatura.

### 3. Personalización Visual y Académica (Por Usuario)
Panel de Preferencias guardado exclusivamente en el dispositivo del estudiante:
- **Temas de Color:**
  - `Oscuro BCV` (por defecto, estética cyber dark).
  - `Negro OLED` (fondo `#000000` optimizado para pantallas AMOLED).
  - `Claro Alto Contraste` (modo diurno de alta legibilidad).
- **Colores de Acento:** Selección entre 5 tonos sobrios (Cyan Neón, Verde Esmeralda, Ámbar Solar, Púrpura Profundo y Carmesí).
- **Personalización por Materia:** Selector individual de color para sobrescribir el color asignado por el profesor.
- **Densidad de Interfaz:** Modo `Compacto` (mayor densidad de información) o `Estándar`.
- **Vista Inicial:** Elección de la pestaña con la que abre la aplicación (Dashboard, Horario, Línea de Tiempo o Mis Notas).
- **Control de Carga Académica:** Interruptores individuales para ocultar o mostrar materias en el horario personal.

### 4. Estándar de Diseño: Cero Emojis Decorativos
- Sistema iconográfico basado íntegramente en SVG vectoriales minimalistas (**Lucide Icons**, `stroke-width: 1.75`).
- Etiquetas tipográficas estructuradas (`[ALTA]`, `[MEDIA]`, `[BAJA]`, `[HOY]`, `[CORTE 1]`, `[ENTREGADO]`, `[POND.]`).
- Puntos de estado generados con CSS nativo (`.priority-dot.high`, etc.).
- Formato sobrio y profesional para mensajería en WhatsApp y Telegram utilizando viñetas (`•`), guiones (`—`) y negritas.

### 5. Dashboard Académico & Alertas Inteligentes
- **Banner Superior de Entregas Inminentes:** Se activa de forma automática cuando hay evaluaciones que vencen "Hoy", "Mañana" o en menos de 48 horas, con contador regresivo de horas y enlace directo a las directrices.
- **Indicador [¡NUEVA!]:** Badge animado en color pulsante sobre actividades creadas recientemente por el Administrador que el estudiante aún no ha abierto.
- **Próxima Clase en Vivo:** Cuenta regresiva y aula del bloque siguiente.
- **Resumen Estadístico:** Total de materias, asignaturas cursadas, entregas pendientes y promedio acumulado.

### 6. Calendario Interactivo & Línea de Tiempo (Roadmap)
- **Calendario Mensual:** Cuadrícula con pills de colores de materias, indicadores de prioridad y panel deslizable del día seleccionado.
- **Línea de Tiempo Agrupada por Mes:** Roadmap cronológico con filtros combinables por Materia, Corte, Nivel de Prioridad y Modalidad.
- **Directrices Enriquecidas:** Modal con pautas completas del profesor, modalidad (Individual o Grupal con límite de integrantes), formato de entrega (PDF, GitHub, Diapositivas, Aula, Drive) y enlaces directos a recursos.

### 7. Panel Personal del Estudiante (`localStorage` Independiente)
Cada estudiante que acceda a la web desde su teléfono móvil o computadora tiene su progreso guardado exclusivamente en su navegador:
- **Check de Entrega:** Permite marcar actividades como `[ENTREGADO]` o `[PENDIENTE]` en la línea de tiempo y en las tarjetas de detalle, actualizando su barra de progreso individual.
- **Calculadora de Notas Universitaria (0–20 pts):**
  - Registro de calificaciones obtenidas por cada actividad o por corte general (1er, 2do, 3er y 4to Corte).
  - **Proyección de Aprobación Automática:** Basada en la escala de calificación venezolana (mínimo aprobatorio de 9.5 redondeable a 10). Indica exactamente cuántos puntos necesita promediar en el porcentaje restante para aprobar o advierte si está en riesgo o reprobado.
- **Respaldo Personal (JSON):** Botones para exportar e importar datos (`mis_notas_xk.json`) para migrar entre navegadores o dispositivos sin perder el progreso.

### 8. Difusión y Notificaciones (WhatsApp + Telegram + Web Notifications)
- **Web Notifications API:** Botón de avisos en la cabecera para activar notificaciones de escritorio y navegador que alertan sobre clases y entregas inminentes.
- **Difusión por WhatsApp:** Formato tipográfico limpio para el horario diario, horario semanal y ficha de evaluación individual.
- **Difusión por Telegram:** Envío automático mediante Bot API al canal o grupo de la sección universitaria, o compartir mediante enlace directo.

### 9. Panel de Administración & Supabase Auth
- **Acceso Discreto:** Botón de administración con indicador de estado (Modo Supabase / Modo Local).
- **Autenticación Dual:**
  - **Supabase Auth:** Inicio de sesión seguro con Email y Contraseña o Magic Link. La sesión persiste permanentemente en el navegador (`persistSession: true`, `autoRefreshToken: true`).
  - **PIN de Emergencia Offline:** Acceso local de respaldo (`1234` por defecto) cuando no hay conexión a Supabase.
- **4 Módulos Administrativos:**
  1. **Horario & Materias:** CRUD de asignaturas, códigos de materia, colores, aulas, docentes y constructor visual de bloques de clase.
  2. **Actividades Globales:** Creación de evaluaciones con sugerencia automática de fechas según los días de clase de la materia, validación de ponderación (advertencia si supera el 100%) y difusión a WhatsApp y Telegram.
  3. **Configuración de Sección:** Edición de Carrera, Semestre, Sección y cambio de PIN de emergencia.
  4. **Sistema & Supabase:** Configuración de Project URL y Anon Key, estado de sesión activa, cierre de sesión, descarga de copia de seguridad general y restauración en JSON.

---

## Estructura del Código

```
/gestor-universitario
├── index.html          # Interfaz SPA (Dashboard, Horario, Calendario, Línea de Tiempo, Mis Notas, Modales)
├── css/
│   └── styles.css      # Sistema de diseño Cyber Dark Cyan (Glassmorphism, Temas OLED/Light, Densidad)
├── js/
│   ├── app.js          # Controlador principal de vistas, reloj, filtros y suscripción reactiva a DB
│   ├── preferences.js  # Sistema de temas, densidad, acento, suscripciones y carga académica
│   ├── db.js           # Capa de datos híbrida (Supabase PostgreSQL + Realtime + Fallback localStorage)
│   ├── schedule.js     # Renderizado matricial por bloques de 45 min y detector de choques de horario
│   ├── activities.js   # Evaluaciones, modalidades A/B, calendario mensual y directrices
│   ├── student.js      # Control personal del alumno, calculadora de notas 0-20 y backup JSON
│   ├── admin.js        # Panel de administración, Supabase Auth y gestión de sección/backup
│   └── notify.js       # Notificaciones Toast, Web Notifications, Bot Telegram y difusión WhatsApp
├── supabase/
│   └── schema.sql      # Script SQL DDL con tablas, RLS, Realtime y datos semilla para Supabase
└── README.md           # Documentación técnica de configuración y despliegue
```

---

## Despliegue en GitHub Pages

1. Sube este repositorio a tu cuenta de GitHub (ej. `gestor-universitario`).
2. En GitHub, ve a **Settings** > **Pages**.
3. En **Source**, selecciona `Deploy from a branch`.
4. Elige la rama `main` (o `master`) y el directorio `/ (root)`.
5. Haz clic en **Save**. En pocos segundos tu aplicación estará disponible en:
   `https://<tu-usuario>.github.io/gestor-universitario/`

> **Nota:** La aplicación no requiere servidor NodeJS ni proceso de compilación (`build`); funciona inmediatamente en cualquier navegador gracias a su arquitectura cliente con datos semilla preconfigurados para **Ingeniería de Sistemas (Sección 08S-2623-D1)**.

---

## Configuración de Supabase (PostgreSQL + Auth + Realtime)

Con Supabase, toda la sección universitaria ve las materias y actividades en tiempo real con seguridad estricta a nivel de base de datos (Row Level Security): los estudiantes anónimos solo pueden leer, y únicamente el Administrador autenticado puede crear, modificar o eliminar registros.

### Paso 1: Crear Proyecto en Supabase
1. Ingresa a [supabase.com](https://supabase.com/) e inicia sesión con tu cuenta de GitHub o correo.
2. Haz clic en **New Project**.
3. Asigna un nombre al proyecto (ej. `gestor-universitario-08s`), una contraseña segura para la base de datos y selecciona la región más cercana.

### Paso 2: Ejecutar el Esquema SQL
1. En el panel lateral de tu proyecto Supabase, entra en **SQL Editor**.
2. Haz clic en **New Query**.
3. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repositorio, copia todo su contenido y pégalo en el editor SQL.
4. Presiona el botón **Run** (o `Ctrl+Enter`).
5. Esto creará:
   - Tabla `sections`: Datos de carrera, semestre y sección.
   - Tabla `subjects`: Materias, códigos, aulas, profesores, colores y bloques de horario (`schedule_blocks`).
   - Tabla `activities`: Evaluaciones, cortes, ponderaciones, prioridades, fechas y directrices.
   - **Políticas RLS:** Lectura pública (`SELECT`) para rol `anon`, escritura protegida (`INSERT`, `UPDATE`, `DELETE`) para el administrador autenticado.
   - Publicación en tiempo real (`supabase_realtime`) para sincronización instantánea vía WebSockets.
   - Datos semilla iniciales completos para la sección `08S-2623-D1`.

### Paso 3: Crear el Usuario Administrador en Supabase Auth
1. En el panel lateral de Supabase, ve a **Authentication** > **Users**.
2. Haz clic en **Add user** > **Create user**.
3. Ingresa tu correo electrónico de administrador y una contraseña segura.
4. Marca la casilla **Auto Confirm User?** (para no requerir confirmación por correo) y haz clic en **Create user**.

### Paso 4: Conectar la Aplicación Web con Supabase
1. En el panel lateral de Supabase, ve a **Project Settings** (ícono de engranaje) > **API**.
2. Copia los siguientes valores:
   - **Project URL** (ej. `https://xyzcompany.supabase.co`).
   - **Project API Keys** > `anon` `public` (clave pública JWT).
3. Abre tu aplicación web (`index.html`) en el navegador.
4. Haz clic en el botón **`Admin`** en la barra superior o inferior e ingresa con el PIN de emergencia (`1234`).
5. En el panel Admin, ve a la pestaña **`Sistema & Supabase`**.
6. Pega tu **Project URL** y tu **Anon Key** en los campos correspondientes.
7. Haz clic en **Guardar y Conectar con Supabase**.
8. Una vez conectada, pulsa **Iniciar Sesión como Administrador** e introduce el correo y la contraseña que creaste en el Paso 3.
9. ¡Listo! La sesión permanecerá activa de forma persistente en tu navegador. Cada vez que agregues o edites materias o evaluaciones, todos los estudiantes verán las actualizaciones en vivo de forma instantánea.

---

## Configuración del Bot de Telegram (Opcional)

Para enviar anuncios y alertas directas al canal o grupo de Telegram de la sección:

### Paso 1: Crear el Bot
1. Abre Telegram y busca a [@BotFather](https://t.me/BotFather).
2. Envía el comando `/newbot`.
3. Asigna un nombre (ej. `Avisos Sección 08S`) y un usuario (ej. `AvisosSeccion08S_bot`).
4. BotFather te responderá con tu **HTTP API Token** (ej. `7123456789:AAFlkjw-abcdef123456`). Cópialo.

### Paso 2: Agregar el Bot al Grupo o Canal
1. Abre tu grupo o canal de Telegram de la sección universitaria.
2. Ve a la información del grupo > **Miembros / Administradores** > **Agregar miembro**.
3. Busca tu bot por su `@nombre_de_usuario` y agrégalo.
4. Asígnale permisos de Administrador para que pueda enviar mensajes.

### Paso 3: Obtener el Chat ID
- **Para un Canal público:** El Chat ID es simplemente `@el_nombre_de_tu_canal` (ej. `@sistemas_08s_avisos`).
- **Para un Grupo privado:**
  1. Envía un mensaje de prueba al grupo (ej. `Hola bot`).
  2. Abre en tu navegador la siguiente URL sustituyendo tu token:
     `https://api.telegram.org/bot<TU_BOT_TOKEN>/getUpdates`
  3. En la respuesta JSON, busca el objeto `"chat":{"id": -100xxxxxxxxxx}`.
  4. Alternativamente, reenvía un mensaje del grupo al bot [@userinfobot](https://t.me/userinfobot) para ver el ID directamente.

### Paso 4: Guardar en el Gestor
1. En el gestor, entra a **Admin** > pestaña **Sistema & Supabase** > **Integración con Bot de Telegram**.
2. Pega el **Bot Token** y el **Chat ID**.
3. Presiona **Guardar Config Telegram**.

---

## Privacidad y Respaldo de Notas del Alumno

- **Aislamiento Total:** El horario y las actividades provienen de la base de datos comunitaria de la sección en Supabase, pero los datos personales del estudiante (cuáles actividades ya entregó, sus calificaciones numéricas y si ya vio una actividad nueva) se almacenan estrictamente en el `localStorage` de su navegador.
- **Exportación / Importación:**
  - En la pestaña **Mis Notas**, el alumno puede hacer clic en **Exportar Notas** para descargar un archivo JSON.
  - Al cambiar de dispositivo o limpiar el caché del navegador, basta con pulsar **Importar Notas** y seleccionar el archivo para restaurar todo su rendimiento instantáneamente.

---

<p align="center">
  <b>Desarrollado por XekRed Dev</b><br>
  <i>Ingeniería de Sistemas · VIII Semestre · Sección 08S-2623-D1</i>
</p>
