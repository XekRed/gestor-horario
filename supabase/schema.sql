-- =============================================================
-- GESTOR ACADÉMICO UNIVERSITARIO XK — ESQUEMA POSTGRESQL (SUPABASE)
-- Jerarquía de Roles (Owner / Section Admins), RLS Estricto,
-- Catálogo de Materias, Preparación para Profesores y Realtime
-- =============================================================

-- 1. Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ═════════════════════════════════════════════════════════════
-- 2. TABLA: sections (Catálogo de Secciones Académicas)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.sections (
    id text primary key default '08S-2623-D1',
    career text not null default 'INGENIERÍA DE SISTEMAS',
    semester text not null default 'VIII',
    section_code text unique not null default '08S-2623-D1',
    period text default '2026-I (Diurno)',
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 3. TABLA: professors (Portal y Gestión de Docentes - Fase Futura)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.professors (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text unique,
    department text default 'Ingeniería de Sistemas',
    phone text,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 4. TABLAS DE SEGURIDAD Y ROLES: staff_users & section_admins
-- ═════════════════════════════════════════════════════════════

-- 4.1. staff_users: Registro de usuarios con rol de staff ('owner' o 'admin')
create table if not exists public.staff_users (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    email text unique not null,
    role text not null default 'admin' check (role in ('owner', 'admin')),
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4.2. section_admins: Permisos granulares de administración por sección
-- Un 'admin' solo puede editar en secciones donde tenga asignación explícita
create table if not exists public.section_admins (
    id uuid primary key default gen_random_uuid(),
    staff_user_id uuid references public.staff_users(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    email text not null,
    section_code text not null references public.sections(section_code) on update cascade on delete cascade,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    constraint unique_admin_section unique(email, section_code)
);

-- ═════════════════════════════════════════════════════════════
-- 5. TABLA: subjects (Materias con Código de Inscripción Único)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.subjects (
    id text primary key,
    subject_code text unique not null,
    section_code text not null references public.sections(section_code) on update cascade on delete cascade,
    name text not null,
    short_name text,
    classroom text,
    professor text,
    professor_id uuid references public.professors(id) on delete set null,
    color text not null default '#00f0ff',
    schedule_blocks jsonb not null default '[]'::jsonb,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 6. TABLA: activities (Evaluaciones y Eventos Especiales)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.activities (
    id text primary key,
    subject_id text references public.subjects(id) on delete set null,
    section_code text not null references public.sections(section_code) on update cascade on delete cascade,
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
-- 7. TABLA: students (Ficha del Estudiante Sincronizada por Cédula)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.students (
    ci text primary key,
    full_name text not null,
    career text not null default 'INGENIERÍA DE SISTEMAS',
    section_code text not null default '08S-2623-D1',
    pin text default null,
    preferences jsonb default '{}'::jsonb,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ═════════════════════════════════════════════════════════════
-- 8. TABLA: student_enrollments (Materias Inscritas por Estudiante)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.student_enrollments (
    id uuid primary key default gen_random_uuid(),
    student_ci text not null references public.students(ci) on delete cascade,
    subject_id text not null,
    subject_code text not null,
    section_code text not null default '08S-2623-D1',
    enrolled_at timestamptz default timezone('utc'::text, now()) not null,
    constraint unique_student_subject unique(student_ci, subject_id)
);

-- ═════════════════════════════════════════════════════════════
-- 9. TABLA: student_grades (Calificaciones & Puente para Profesores)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.student_grades (
    id uuid primary key default gen_random_uuid(),
    student_ci text not null,
    subject_id text references public.subjects(id) on delete cascade,
    activity_id text references public.activities(id) on delete cascade,
    section_code text not null references public.sections(section_code) on update cascade on delete cascade,
    score numeric default 0,
    score_mode text default 'percentage' check (score_mode in ('percentage', 'scale20', 'scale5')),
    official_professor_percentage numeric default null,
    is_official_locked boolean default false,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    constraint unique_student_act unique(student_ci, activity_id)
);

-- ═════════════════════════════════════════════════════════════
-- 8. FUNCIONES DE SEGURIDAD (SECURITY DEFINER)
-- ═════════════════════════════════════════════════════════════

-- 8.1. Verifica si el usuario conectado tiene rol 'owner' (Dueño Global)
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_users
    where (
      (auth.uid() is not null and (id = auth.uid() or user_id = auth.uid()))
      or (auth.jwt() ->> 'email' is not null and lower(email) = lower(auth.jwt() ->> 'email'))
    )
    and role = 'owner'
  );
$$;

-- 8.2. Verifica si el usuario conectado tiene permiso para gestionar una sección dada
create or replace function public.can_manage_section(sec_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_owner()
    or exists (
      select 1 from public.section_admins
      where (
        (auth.uid() is not null and user_id = auth.uid())
        or (auth.jwt() ->> 'email' is not null and lower(email) = lower(auth.jwt() ->> 'email'))
      )
      and section_code = sec_code
    )
  );
$$;

-- 8.3. Sincronización automática de user_id cuando un usuario registrado inicia sesión
create or replace function public.handle_staff_auth_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.staff_users
  set user_id = new.id
  where lower(email) = lower(new.email);

  update public.section_admins
  set user_id = new.id
  where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_staff on auth.users;
create trigger on_auth_user_created_sync_staff
  after insert or update on auth.users
  for each row execute function public.handle_staff_auth_sync();

-- ═════════════════════════════════════════════════════════════
-- 9. ROW LEVEL SECURITY (RLS) ESTRICTO
-- ═════════════════════════════════════════════════════════════
alter table public.sections enable row level security;
alter table public.professors enable row level security;
alter table public.staff_users enable row level security;
alter table public.section_admins enable row level security;
alter table public.subjects enable row level security;
alter table public.activities enable row level security;
alter table public.student_grades enable row level security;

-- 9.1. Políticas de Lectura Pública (Estudiantes leen libremente)
drop policy if exists "Lectura publica - sections" on public.sections;
create policy "Lectura publica - sections"
  on public.sections for select to anon, authenticated using (true);

drop policy if exists "Lectura publica - professors" on public.professors;
create policy "Lectura publica - professors"
  on public.professors for select to anon, authenticated using (true);

drop policy if exists "Lectura publica - subjects" on public.subjects;
create policy "Lectura publica - subjects"
  on public.subjects for select to anon, authenticated using (true);

drop policy if exists "Lectura publica - activities" on public.activities;
create policy "Lectura publica - activities"
  on public.activities for select to anon, authenticated using (true);

drop policy if exists "Lectura publica - student_grades" on public.student_grades;
create policy "Lectura publica - student_grades"
  on public.student_grades for select to anon, authenticated using (true);

-- 9.2. Políticas de Seguridad de Staff
drop policy if exists "Lectura de staff para authenticated" on public.staff_users;
create policy "Lectura de staff para authenticated"
  on public.staff_users for select to authenticated
  using (public.is_owner() or (lower(auth.jwt() ->> 'email') = lower(email)));

drop policy if exists "Gestion total de staff para owner" on public.staff_users;
create policy "Gestion total de staff para owner"
  on public.staff_users for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "Lectura de section_admins para authenticated" on public.section_admins;
create policy "Lectura de section_admins para authenticated"
  on public.section_admins for select to authenticated
  using (public.is_owner() or (lower(auth.jwt() ->> 'email') = lower(email)));

drop policy if exists "Gestion de section_admins para owner" on public.section_admins;
create policy "Gestion de section_admins para owner"
  on public.section_admins for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 9.3. Políticas Granulares por Sección (Owner o Admin de la sección respectiva)
drop policy if exists "Modificacion de sections solo owner" on public.sections;
create policy "Modificacion de sections solo owner"
  on public.sections for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "Gestion de subjects por seccion" on public.subjects;
create policy "Gestion de subjects por seccion"
  on public.subjects for all to authenticated
  using (public.can_manage_section(section_code))
  with check (public.can_manage_section(section_code));

drop policy if exists "Gestion de activities por seccion" on public.activities;
create policy "Gestion de activities por seccion"
  on public.activities for all to authenticated
  using (public.can_manage_section(section_code))
  with check (public.can_manage_section(section_code));

drop policy if exists "Gestion de professors" on public.professors;
create policy "Gestion de professors"
  on public.professors for all to authenticated
  using (public.is_owner() or public.can_manage_section('08S-2623-D1'))
  with check (public.is_owner() or public.can_manage_section('08S-2623-D1'));

drop policy if exists "Gestion de student_grades" on public.student_grades;
create policy "Gestion de student_grades"
  on public.student_grades for all to anon, authenticated
  using (
    public.can_manage_section(section_code)
    or (auth.role() = 'anon' and is_official_locked = false)
    or (auth.role() = 'authenticated' and is_official_locked = false)
  )
  with check (
    public.can_manage_section(section_code)
    or (auth.role() = 'anon' and is_official_locked = false)
    or (auth.role() = 'authenticated' and is_official_locked = false)
  );

-- 9.4. Políticas de Acceso Estudiantil (Identificación y Matrícula)
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;

drop policy if exists "Acceso total a students" on public.students;
create policy "Acceso total a students"
  on public.students for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Acceso total a student_enrollments" on public.student_enrollments;
create policy "Acceso total a student_enrollments"
  on public.student_enrollments for all to anon, authenticated
  using (true)
  with check (true);

-- ═════════════════════════════════════════════════════════════
-- 10. ACTIVACIÓN DE SUPABASE REALTIME
-- ═════════════════════════════════════════════════════════════
do $$
begin
    begin
        execute 'alter publication supabase_realtime add table public.sections';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.subjects';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.activities';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.staff_users';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.section_admins';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.student_grades';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.students';
    exception when others then null;
    end;
    begin
        execute 'alter publication supabase_realtime add table public.student_enrollments';
    exception when others then null;
    end;
end $$;

-- ═════════════════════════════════════════════════════════════
-- 11. DATOS SEMILLA INICIALES
-- ═════════════════════════════════════════════════════════════

-- 11.1. Rol Owner (Dueño Principal del Sistema)
insert into public.staff_users (email, role)
values ('danidmartinez321@gmail.com', 'owner')
on conflict (email) do update set role = 'owner';

-- Vincular user_id si ya existe en auth.users
update public.staff_users s
set user_id = u.id
from auth.users u
where lower(s.email) = lower(u.email);

-- 11.2. Sección Oficial 08S-2623-D1
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
    section_code = excluded.section_code,
    period = excluded.period,
    updated_at = now();

-- Asignar permiso inicial al owner sobre la sección 08S-2623-D1
insert into public.section_admins (email, section_code)
values ('danidmartinez321@gmail.com', '08S-2623-D1')
on conflict do nothing;

-- 11.3. Profesores Registrados (Oficiales según Horario UNEFA VIII Sistemas)
insert into public.professors (id, name, email, department)
values
    ('11111111-1111-1111-1111-111111111101', 'Bellamelis Dominguez Ochoa', 'bellamelis.dominguez@unefa.edu.ve', 'Auditoría de Sistemas'),
    ('11111111-1111-1111-1111-111111111102', 'Maille Mireli Altuve Diaz', 'maille.altuve@unefa.edu.ve', 'Teleprocesos'),
    ('11111111-1111-1111-1111-111111111103', 'Rafael Alfonso Lopez Urriola', 'rafael.lopez@unefa.edu.ve', 'Planificación y Proyectos'),
    ('11111111-1111-1111-1111-111111111104', 'Johan Javier Goyo Colmenarez', 'johan.goyo@unefa.edu.ve', 'Teoría de Decisiones'),
    ('11111111-1111-1111-1111-111111111105', 'Antonio Jose Fuentes Verastegui', 'antonio.fuentes@unefa.edu.ve', 'Defensa Integral'),
    ('11111111-1111-1111-1111-111111111106', 'Victor Julio Dominguez Ochoa', 'victor.dominguez@unefa.edu.ve', 'Inteligencia Artificial'),
    ('11111111-1111-1111-1111-111111111107', 'Meibis Carolina Garcia Herrera', 'meibis.garcia@unefa.edu.ve', 'Marco Legal'),
    ('11111111-1111-1111-1111-111111111108', 'Yokasta Castro Osal', 'yokasta.castro@unefa.edu.ve', 'Cultura y Comunicación')
on conflict (email) do nothing;

-- 11.4. Materias Oficiales de la Sección (Códigos Pensum Estandarizados y Bloques Exactos)
insert into public.subjects (id, subject_code, section_code, name, short_name, classroom, professor, professor_id, color, schedule_blocks)
values
(
    'teoria',
    'MAT-31314',
    '08S-2623-D1',
    'TEORÍA DE DECISIONES',
    'TDEC',
    'YSSF-010',
    'Johan Javier Goyo Colmenarez',
    '11111111-1111-1111-1111-111111111104',
    '#ff2e5f',
    '[{"day": 3, "startBlock": 1, "span": 5}]'::jsonb
),
(
    'marco',
    'CJU-37314',
    '08S-2623-D1',
    'MARCO LEGAL PARA EL EJER. DE LA INGENIERÍA',
    'MLEG',
    'YSSF-010',
    'Meibis Carolina Garcia Herrera',
    '11111111-1111-1111-1111-111111111107',
    '#fd79a8',
    '[{"day": 4, "startBlock": 7, "span": 4}]'::jsonb
),
(
    'teleprocesos',
    'TTC-31154',
    '08S-2623-D1',
    'TELEPROCESOS',
    'TEL',
    'YSSF-027',
    'Maille Mireli Altuve Diaz',
    '11111111-1111-1111-1111-111111111102',
    '#00e5a0',
    '[{"day": 0, "startBlock": 7, "span": 6}]'::jsonb
),
(
    'ia',
    'ESI-31153',
    '08S-2623-D1',
    'INTELIGENCIA ARTIFICIAL (ET)',
    'IA',
    'YSSF-010',
    'Victor Julio Dominguez Ochoa',
    '11111111-1111-1111-1111-111111111106',
    '#f9ca24',
    '[{"day": 4, "startBlock": 2, "span": 4}]'::jsonb
),
(
    'planificacion',
    'ENT-31123',
    '08S-2623-D1',
    'PLANIFICACIÓN Y EVALUACIÓN DE PROYECTOS (ENT)',
    'PEP',
    'YSSF-010',
    'Rafael Alfonso Lopez Urriola',
    '11111111-1111-1111-1111-111111111103',
    '#5865F2',
    '[{"day": 2, "startBlock": 3, "span": 3}]'::jsonb
),
(
    'defensa',
    'DIN-31183',
    '08S-2623-D1',
    'DEFENSA INTEGRAL DE LA NACIÓN VIII',
    'DIN8',
    'YSSF-010',
    'Antonio Jose Fuentes Verastegui',
    '11111111-1111-1111-1111-111111111105',
    '#00bfa5',
    '[{"day": 3, "startBlock": 7, "span": 4}]'::jsonb
),
(
    'auditoria',
    'SYC-32814',
    '08S-2623-D1',
    'AUDITORÍA DE SISTEMAS',
    'AUD',
    'YSSF-010',
    'Bellamelis Dominguez Ochoa',
    '11111111-1111-1111-1111-111111111101',
    '#ff9f43',
    '[{"day": 0, "startBlock": 3, "span": 3}, {"day": 2, "startBlock": 1, "span": 2}]'::jsonb
),
(
    'cultura',
    'ACT-13010',
    '08S-2623-D1',
    'CULTURA Y COMUNICACIÓN',
    'CCOM',
    'YSSF-010',
    'Yokasta Castro Osal',
    '11111111-1111-1111-1111-111111111108',
    '#9b59b6',
    '[{"day": 0, "startBlock": 1, "span": 2}]'::jsonb
)
on conflict (id) do update set
    subject_code = excluded.subject_code,
    name = excluded.name,
    short_name = excluded.short_name,
    classroom = excluded.classroom,
    professor = excluded.professor,
    professor_id = excluded.professor_id,
    color = excluded.color,
    schedule_blocks = excluded.schedule_blocks;
