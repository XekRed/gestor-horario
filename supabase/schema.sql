-- =============================================================
-- GESTOR ACADÉMICO UNIVERSITARIO XK
-- Esquema PostgreSQL + Row Level Security (RLS) + Supabase Realtime
-- =============================================================

-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- ═════════════════════════════════════════════════════════════
-- 1. TABLA: sections (Datos de la Sección Universitaria)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.sections (
    id text primary key default '08S-2623-D1',
    career text not null default 'INGENIERÍA DE SISTEMAS',
    semester text not null default 'VIII',
    section_code text not null default '08S-2623-D1',
    period text default '2026-I (Diurno)',
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 2. TABLA: subjects (Asignaturas y Bloques Horarios)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.subjects (
    id text primary key,
    subject_code text unique not null,
    section_code text not null default '08S-2623-D1',
    name text not null,
    short_name text,
    classroom text,
    professor text,
    color text not null default '#00f0ff',
    schedule_blocks jsonb not null default '[]'::jsonb,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 3. TABLA: activities (Evaluaciones y Eventos Especiales)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.activities (
    id text primary key,
    subject_id text references public.subjects(id) on delete set null,
    section_code text not null default '08S-2623-D1',
    is_special_event boolean default false not null,
    title text not null,
    cut int check (cut between 1 and 4),
    percentage numeric default 0,
    priority text default 'media' check (priority in ('alta', 'media', 'baja', 'high', 'medium', 'low')),
    due_date timestamptz not null,
    guidelines jsonb default '{}'::jsonb,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS) ESTRICTO
-- ═════════════════════════════════════════════════════════════
-- Habilitar RLS en todas las tablas
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.activities enable row level security;

-- 4.1. POLÍTICAS DE LECTURA PÚBLICA (Cualquier estudiante anónimo puede ver)
create policy "Lectura publica para estudiantes - sections"
    on public.sections
    for select
    to anon, authenticated
    using (true);

create policy "Lectura publica para estudiantes - subjects"
    on public.subjects
    for select
    to anon, authenticated
    using (true);

create policy "Lectura publica para estudiantes - activities"
    on public.activities
    for select
    to anon, authenticated
    using (true);

-- 4.2. POLÍTICAS DE ESCRITURA EXCLUSIVA PARA EL ADMINISTRADOR
-- Solo usuarios autenticados mediante Supabase Auth pueden insertar, modificar o eliminar.
-- (Opcional: Si deseas limitar a un correo específico, cambia `true` por `auth.jwt() ->> 'email' = 'tu_correo@gmail.com'`)
create policy "Escritura exclusiva para Administrador - sections"
    on public.sections
    for all
    to authenticated
    using (true)
    with check (true);

create policy "Escritura exclusiva para Administrador - subjects"
    on public.subjects
    for all
    to authenticated
    using (true)
    with check (true);

create policy "Escritura exclusiva para Administrador - activities"
    on public.activities
    for all
    to authenticated
    using (true)
    with check (true);

-- ═════════════════════════════════════════════════════════════
-- 5. ACTIVACIÓN DE SUPABASE REALTIME
-- ═════════════════════════════════════════════════════════════
-- Permite que los cambios se transmitan inmediatamente vía websocket a todos los alumnos conectados
do $$
begin
    begin
        alter publication supabase_realtime add table public.sections;
    exception when others then null;
    end;
    begin
        alter publication supabase_realtime add table public.subjects;
    exception when others then null;
    end;
    begin
        alter publication supabase_realtime add table public.activities;
    exception when others then null;
    end;
end $$;

-- ═════════════════════════════════════════════════════════════
-- 6. DATOS SEMILLA INICIALES (Sección 08S-2623-D1)
-- ═════════════════════════════════════════════════════════════

-- 6.1. Sección Oficial
insert into public.sections (id, career, semester, section_code, period)
values (
    '08S-2623-D1',
    'INGENIERÍA DE SISTEMAS',
    'VIII',
    '08S-2623-D1',
    '2026-I (Diurno)'
)
on conflict (id) do update set
    career = excluded.career,
    semester = excluded.semester,
    period = excluded.period,
    updated_at = now();

-- 6.2. 9 Materias Oficiales de la Sección
insert into public.subjects (id, subject_code, section_code, name, short_name, classroom, professor, color, schedule_blocks)
values
(
    'civico',
    'CIV-08S',
    '08S-2623-D1',
    'CÍVICO',
    'CIV',
    null,
    '',
    '#00f0ff',
    '[{"day": 0, "startBlock": 1, "span": 1}]'::jsonb
),
(
    'cultura',
    'C&C-08S',
    '08S-2623-D1',
    'CULTURA Y COMUNICACIÓN',
    'C&C',
    'YSSF-010',
    '',
    '#9b59b6',
    '[{"day": 0, "startBlock": 2, "span": 2}]'::jsonb
),
(
    'auditoria',
    'AUD-08S',
    '08S-2623-D1',
    'AUDITORÍA DE SISTEMAS',
    'AUD',
    'YSSF-010',
    'Ing. Carlos Pérez',
    '#ff9f43',
    '[{"day": 0, "startBlock": 4, "span": 3}, {"day": 2, "startBlock": 1, "span": 3}]'::jsonb
),
(
    'teleprocesos',
    'TEL-08S',
    '08S-2623-D1',
    'TELEPROCESOS',
    'TEL',
    'YSSF-027',
    'Ing. María Gómez',
    '#00e5a0',
    '[{"day": 0, "startBlock": 8, "span": 6}]'::jsonb
),
(
    'planificacion',
    'PEP-08S',
    '08S-2623-D1',
    'PLANIFICACIÓN Y EVALUACIÓN DE PROYECTOS (ENT)',
    'PEP',
    'YSSF-010',
    'Prof. Luis Rondón',
    '#5865F2',
    '[{"day": 2, "startBlock": 4, "span": 3}]'::jsonb
),
(
    'teoria',
    'TD-08S',
    '08S-2623-D1',
    'TEORÍA DE DECISIONES',
    'TD',
    'YSSF-010',
    'Prof. Ana Díaz',
    '#ff2e5f',
    '[{"day": 3, "startBlock": 2, "span": 5}]'::jsonb
),
(
    'defensa',
    'DIN-08S',
    '08S-2623-D1',
    'DEFENSA INTEGRAL DE LA NACIÓN VIII',
    'DIN',
    null,
    'Cap. Rodríguez',
    '#00bfa5',
    '[{"day": 3, "startBlock": 8, "span": 4}]'::jsonb
),
(
    'ia',
    'IA-08S',
    '08S-2623-D1',
    'INTELIGENCIA ARTIFICIAL (ET)',
    'IA',
    'YSSF-010',
    'Ing. José Martínez',
    '#f9ca24',
    '[{"day": 4, "startBlock": 3, "span": 4}]'::jsonb
),
(
    'marco',
    'MLE-08S',
    '08S-2623-D1',
    'MARCO LEGAL PARA EL EJER. DE LA INGENIERÍA',
    'MLE',
    'YSSF-010',
    'Abg. Rosa Flores',
    '#fd79a8',
    '[{"day": 4, "startBlock": 8, "span": 4}]'::jsonb
)
on conflict (id) do update set
    subject_code = excluded.subject_code,
    name = excluded.name,
    short_name = excluded.short_name,
    classroom = excluded.classroom,
    professor = excluded.professor,
    color = excluded.color,
    schedule_blocks = excluded.schedule_blocks;

-- 6.3. Actividades y Evaluaciones Semilla
insert into public.activities (id, subject_id, section_code, is_special_event, title, cut, percentage, priority, due_date, guidelines)
values
(
    'act_aud_1',
    'auditoria',
    '08S-2623-D1',
    false,
    'Taller Práctico: Marco COBIT y Controles',
    1,
    20,
    'alta',
    (now() + interval '3 days'),
    '{"mode": "group", "groupMax": 3, "deliveryFormat": "pdf", "resourceLink": "https://drive.google.com", "instructions": "Desarrollar matriz de riesgos y controles aplicables según el framework COBIT 2019."}'::jsonb
),
(
    'act_tel_1',
    'teleprocesos',
    '08S-2623-D1',
    false,
    'Exposición: Protocolos de Capa de Transporte',
    1,
    15,
    'media',
    (now() + interval '5 days'),
    '{"mode": "individual", "deliveryFormat": "slides", "resourceLink": "", "instructions": "Presentación de 10 minutos sobre TCP vs UDP en tiempo real."}'::jsonb
),
(
    'act_ia_1',
    'ia',
    '08S-2623-D1',
    false,
    'Práctica 1: Redes Neuronales en Python',
    1,
    25,
    'alta',
    (now() + interval '7 days'),
    '{"mode": "individual", "deliveryFormat": "github", "resourceLink": "https://github.com", "instructions": "Subir repositorio con el clasificador implementado y archivo de requisitos."}'::jsonb
),
(
    'act_esp_1',
    null,
    '08S-2623-D1',
    true,
    'Entrega de Avance de Servicio Comunitario',
    null,
    0,
    'alta',
    (now() + interval '10 days'),
    '{"mode": "group", "groupMax": 4, "deliveryFormat": "pdf", "resourceLink": "", "instructions": "Consignar carpeta física con firmas del tutor institucional y bitácora de horas."}'::jsonb
)
on conflict (id) do nothing;

