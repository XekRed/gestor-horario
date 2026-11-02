/* =============================================================
   db.js — Capa de Datos Híbrida con Supabase (PostgreSQL + Auth + Realtime)
   Fallback automático a localStorage para funcionamiento offline
   Datos personales del estudiante protegidos en localStorage
   ============================================================= */

const DB = (() => {

    /* ── KEYS localStorage ───────────────────────────────────── */
    const LS = {
        subjects:       'gx_subjects',
        activities:     'gx_activities',
        settings:       'gx_settings',
        grades:         'gx_grades',
        supabaseConfig: 'gx_supabase_config',
        pin:            'gx_pin',
        adminSession:   'gx_admin_auth_user'
    };

    /* ── ESTADO INTERNO ──────────────────────────────────────── */
    const OWNER_EMAIL  = 'danidmartinez321@gmail.com';
    let _mode          = 'local';    // 'local' | 'supabase'
    let _supabase      = null;       // cliente Supabase oficial
    let _adminUser     = null;       // usuario administrador autenticado
    let _adminUnlocked = false;      // estado de sesión del administrador
    let _userRole      = null;       // 'owner' | 'admin' | null
    let _adminSections = [];         // ['08S-2623-D1', ...]
    let _realtimeChan  = null;       // canal de suscripción realtime
    let _cbs           = {};         // col → [callbacks de reactividad]
    let _cache         = {};         // col → datos en memoria sincronizados

    /* ══════════════════════════════════════════════════════════
       DATOS SEMILLA POR DEFECTO (Horario VIII Semestre ISII)
    ═══════════════════════════════════════════════════════════ */
    const SEED_SUBJECTS = [
        {
            id: 'civico',
            name: 'CÍVICO',
            shortName: 'CIV',
            code: 'CIV-08S',
            room: '',
            teacher: '',
            color: '#00f0ff',
            slots: [{ day: 0, startBlock: 1, span: 1 }]
        },
        {
            id: 'cultura',
            name: 'CULTURA Y COMUNICACIÓN',
            shortName: 'CCOM',
            code: 'CCOM-08S',
            room: 'YSSF-010',
            teacher: '',
            color: '#9b59b6',
            slots: [{ day: 0, startBlock: 2, span: 2 }]
        },
        {
            id: 'auditoria',
            name: 'AUDITORÍA DE SISTEMAS',
            shortName: 'AUD',
            code: 'AUD-08S',
            room: 'YSSF-010',
            teacher: 'Ing. Carlos Pérez',
            color: '#ff9f43',
            slots: [
                { day: 0, startBlock: 4, span: 3 },
                { day: 2, startBlock: 1, span: 3 }
            ]
        },
        {
            id: 'teleprocesos',
            name: 'TELEPROCESOS',
            shortName: 'TEL',
            code: 'TEL-08S',
            room: 'YSSF-027',
            teacher: 'Ing. María Gómez',
            color: '#00e5a0',
            slots: [{ day: 0, startBlock: 8, span: 6 }]
        },
        {
            id: 'planificacion',
            name: 'PLANIFICACIÓN Y EVALUACIÓN DE PROYECTOS (ENT)',
            shortName: 'PEP',
            code: 'PEP-08S',
            room: 'YSSF-010',
            teacher: 'Prof. Luis Rondón',
            color: '#5865F2',
            slots: [{ day: 2, startBlock: 4, span: 3 }]
        },
        {
            id: 'teoria',
            name: 'TEORÍA DE DECISIONES',
            shortName: 'TDEC',
            code: 'TDEC-08S',
            room: 'YSSF-010',
            teacher: 'Prof. Ana Díaz',
            color: '#ff2e5f',
            slots: [{ day: 3, startBlock: 2, span: 5 }]
        },
        {
            id: 'defensa',
            name: 'DEFENSA INTEGRAL DE LA NACIÓN VIII',
            shortName: 'DIN8',
            code: 'DIN8-08S',
            room: '',
            teacher: 'Cap. Rodríguez',
            color: '#00bfa5',
            slots: [{ day: 3, startBlock: 8, span: 4 }]
        },
        {
            id: 'ia',
            name: 'INTELIGENCIA ARTIFICIAL (ET)',
            shortName: 'IA',
            code: 'IA-08S',
            room: 'YSSF-010',
            teacher: 'Ing. José Martínez',
            color: '#f9ca24',
            slots: [{ day: 4, startBlock: 3, span: 4 }]
        },
        {
            id: 'marco',
            name: 'MARCO LEGAL PARA EL EJER. DE LA INGENIERÍA',
            shortName: 'MLEG',
            code: 'MLEG-08S',
            room: 'YSSF-010',
            teacher: 'Abg. Rosa Flores',
            color: '#fd79a8',
            slots: [{ day: 4, startBlock: 8, span: 4 }]
        },
    ];

    const DEFAULT_SETTINGS = {
        carrera:  'INGENIERÍA DE SISTEMAS',
        semestre: 'VIII',
        seccion:  '08S-2623-D1',
        periodo:  '2026-I (Diurno)'
    };

    /* ══════════════════════════════════════════════════════════
       MAPEO DE MODELOS (PostgreSQL Supabase ⇄ App Frontend)
    ═══════════════════════════════════════════════════════════ */
    function _parseScheduleBlocks(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        if (typeof val === 'object') {
            if (Array.isArray(val.slots)) return val.slots;
            if (Array.isArray(val.blocks)) return val.blocks;
        }
        return [];
    }

    function _toClientSubject(row) {
        return {
            id:        row.id,
            code:      row.subject_code || row.code,
            section:   row.section_code || row.section || '08S-2623-D1',
            name:      row.name,
            shortName: row.short_name || row.shortName || (row.name ? row.name.slice(0, 4) : 'MAT'),
            room:      row.classroom || row.room || '',
            teacher:   row.professor || row.teacher || '',
            color:     row.color || '#00f0ff',
            slots:     _parseScheduleBlocks(row.schedule_blocks || row.slots)
        };
    }

    function _toDbSubject(item) {
        const settings = getSettings();
        return {
            id:              item.id,
            subject_code:    item.code || `${(item.shortName || item.name.slice(0, 4)).toUpperCase().replace(/\s+/g, '')}-08S`,
            section_code:    settings.seccion || '08S-2623-D1',
            name:            item.name,
            short_name:      item.shortName || item.name.slice(0, 4),
            classroom:       item.room || '',
            professor:       item.teacher || '',
            color:           item.color || '#00f0ff',
            schedule_blocks: Array.isArray(item.slots) ? item.slots : []
        };
    }

    function _toClientActivity(row) {
        const g = (typeof row.guidelines === 'object' && row.guidelines !== null) ? row.guidelines : {};
        let dateStr = '';
        let timeStr = '';
        if (row.due_date) {
            const dt = new Date(row.due_date);
            dateStr = dt.toISOString().split('T')[0];
            timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        }
        const priorityMap = { alta: 'high', baja: 'low', media: 'medium' };
        const clientPriority = priorityMap[row.priority] || row.priority || 'medium';

        return {
            id:         row.id,
            subjectId:  row.subject_id,
            modality:   row.is_special_event ? 'special' : 'subject',
            title:      row.title,
            corte:      row.cut ? String(row.cut) : null,
            weight:     row.percentage !== null && row.percentage !== undefined ? Number(row.percentage) : 0,
            priority:   clientPriority,
            date:       dateStr,
            time:       timeStr,
            guidelines: g,
            desc:       g.instructions || ''
        };
    }

    function _toDbActivity(act) {
        const settings = getSettings();
        const datePart = act.date || new Date().toISOString().split('T')[0];
        const timePart = act.time || '23:59';
        const dueIso = new Date(`${datePart}T${timePart}:00`).toISOString();

        const priorityMap = { high: 'alta', low: 'baja', medium: 'media' };
        const dbPriority = priorityMap[act.priority] || act.priority || 'media';

        return {
            id:               act.id,
            subject_id:       act.subjectId || null,
            section_code:     settings.seccion || '08S-2623-D1',
            is_special_event: (act.modality === 'special' || !act.subjectId),
            title:            act.title,
            cut:              act.corte ? parseInt(act.corte, 10) : null,
            percentage:       act.weight !== null && act.weight !== undefined ? parseFloat(act.weight) : 0,
            priority:         dbPriority,
            due_date:         dueIso,
            guidelines:       act.guidelines || { instructions: act.desc || '' }
        };
    }

    /* ══════════════════════════════════════════════════════════
       CONFIGURACIÓN DE SUPABASE
    ═══════════════════════════════════════════════════════════ */
    function _cleanUrl(url) {
        if (!url) return '';
        return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    }

    function getSupabaseConfig() {
        const raw = localStorage.getItem(LS.supabaseConfig);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.url && parsed.anonKey) {
                    return {
                        url: _cleanUrl(parsed.url),
                        anonKey: parsed.anonKey.trim()
                    };
                }
            } catch (e) {}
        }
        // Fallback a configuración global en js/config.js (para todos los estudiantes)
        if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.supabaseUrl && window.APP_CONFIG.supabaseAnonKey) {
            return {
                url: _cleanUrl(window.APP_CONFIG.supabaseUrl),
                anonKey: window.APP_CONFIG.supabaseAnonKey.trim()
            };
        }
        return null;
    }

    function saveSupabaseConfig(cfg) {
        if (!cfg) {
            localStorage.removeItem(LS.supabaseConfig);
        } else {
            localStorage.setItem(LS.supabaseConfig, JSON.stringify(cfg));
        }
    }

    /* ══════════════════════════════════════════════════════════
       INICIALIZACIÓN DEL CLIENTE
    ═══════════════════════════════════════════════════════════ */
    async function init() {
        // 1. Cargar semillas locales inmediatas para evitar parpadeos
        if (!localStorage.getItem(LS.subjects)) {
            localStorage.setItem(LS.subjects, JSON.stringify(SEED_SUBJECTS));
        }
        if (!localStorage.getItem(LS.settings)) {
            localStorage.setItem(LS.settings, JSON.stringify(DEFAULT_SETTINGS));
        }

        _cache['subjects']   = _readLS('subjects');
        _cache['activities'] = _readLS('activities');
        _cache['settings']   = getSettings();

        // 2. Intentar inicializar cliente Supabase
        const cfg = getSupabaseConfig();
        const hasSupabaseLib = (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function');

        if (cfg && cfg.url && cfg.anonKey && hasSupabaseLib) {
            try {
                _supabase = window.supabase.createClient(cfg.url, cfg.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage
                    }
                });

                _mode = 'supabase';
                console.log('[DB] Cliente Supabase inicializado con éxito');

                // Verificar sesión permanente activa
                await _checkSession();

                // Escuchar cambios de estado en Auth
                _supabase.auth.onAuthStateChange(async (event, session) => {
                    if (session && session.user) {
                        _adminUser = session.user;
                        _adminUnlocked = true;
                        localStorage.setItem(LS.adminSession, JSON.stringify(session.user));
                        await _fetchUserPermissions();
                    } else {
                        _adminUser = null;
                        _adminUnlocked = false;
                        _userRole = null;
                        _adminSections = [];
                        localStorage.removeItem(LS.adminSession);
                    }
                    _notifyAdminStateChange();
                });

                // Descarga inicial de datos desde Supabase
                await _syncFromSupabase('sections');
                await _syncFromSupabase('subjects');
                await _syncFromSupabase('activities');

                // Conectar canal Realtime
                _setupRealtime();

            } catch (err) {
                console.warn('[DB] No se pudo conectar a Supabase, usando fallback local:', err);
                _mode = 'local';
            }
        } else {
            _mode = 'local';
            // Restaurar sesión admin local si existía
            if (localStorage.getItem(LS.adminSession) || sessionStorage.getItem('gx_admin_unlocked') === 'true') {
                _adminUnlocked = true;
            }
        }

        return _mode;
    }

    async function _checkSession() {
        if (!_supabase) return;
        try {
            const { data, error } = await _supabase.auth.getSession();
            if (data && data.session && data.session.user) {
                _adminUser = data.session.user;
                _adminUnlocked = true;
                localStorage.setItem(LS.adminSession, JSON.stringify(data.session.user));
                await _fetchUserPermissions();
            } else {
                _adminUser = null;
                _adminUnlocked = false;
                _userRole = null;
                _adminSections = [];
                localStorage.removeItem(LS.adminSession);
            }
        } catch (e) {
            console.error('[DB] Error comprobando sesión:', e);
        }
    }

    async function _fetchUserPermissions() {
        if (!_adminUser) {
            _userRole = _adminUnlocked ? 'admin' : null;
            _adminSections = ['08S-2623-D1'];
            return;
        }
        const email = (_adminUser.email || '').toLowerCase().trim();
        if (email === OWNER_EMAIL.toLowerCase()) {
            _userRole = 'owner';
            _adminSections = ['*'];
        } else {
            _userRole = 'admin';
        }

        if (_supabase) {
            try {
                const { data: staff } = await _supabase
                    .from('staff_users')
                    .select('role')
                    .eq('email', email)
                    .maybeSingle();
                if (staff && staff.role) {
                    _userRole = staff.role;
                }
                const { data: secs } = await _supabase
                    .from('section_admins')
                    .select('section_code')
                    .eq('email', email);
                if (secs && secs.length > 0) {
                    _adminSections = secs.map(s => s.section_code);
                }
            } catch (e) {
                console.warn('[DB] Error cargando permisos de staff:', e);
            }
        }
    }

    function _notifyAdminStateChange() {
        if (typeof Admin !== 'undefined' && Admin.updateModeBadge) {
            Admin.updateModeBadge();
        }
        // Disparar re-renderizado para mostrar/ocultar botones de edición
        if (typeof Activities !== 'undefined' && Activities.renderTimeline) {
            Activities.renderTimeline();
        }
    }

    /* ══════════════════════════════════════════════════════════
       DESCARGA Y SINCRONIZACIÓN DESDE SUPABASE
    ═══════════════════════════════════════════════════════════ */
    async function _syncFromSupabase(tableName) {
        if (!_supabase) return;
        try {
            if (tableName === 'sections') {
                const { data, error } = await _supabase
                    .from('sections')
                    .select('*')
                    .order('updated_at', { ascending: true });

                if (data && !error && data.length > 0) {
                    _cache['sections'] = data;
                    localStorage.setItem('gx_sections_catalog', JSON.stringify(data));
                    const currentSecCode = getSettings().seccion || '08S-2623-D1';
                    const activeSec = data.find(s => s.section_code === currentSecCode) || data[0];
                    const settingsObj = {
                        carrera:  activeSec.career || 'INGENIERÍA DE SISTEMAS',
                        semestre: activeSec.semester || 'VIII',
                        seccion:  activeSec.section_code || '08S-2623-D1',
                        periodo:  activeSec.period || '2026-I (Diurno)'
                    };
                    _cache['settings'] = settingsObj;
                    localStorage.setItem(LS.settings, JSON.stringify(settingsObj));
                    _notify('settings', settingsObj);
                }
            } else if (tableName === 'subjects') {
                const { data, error } = await _supabase
                    .from('subjects')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (data && !error && data.length > 0) {
                    const mapped = data.map(_toClientSubject);
                    _cache['subjects'] = mapped;
                    _localBackup('subjects', mapped);
                    _notify('subjects', mapped);
                }
            } else if (tableName === 'activities') {
                const { data, error } = await _supabase
                    .from('activities')
                    .select('*')
                    .order('due_date', { ascending: true });

                if (data && !error) {
                    const mapped = data.map(_toClientActivity);
                    _cache['activities'] = mapped;
                    _localBackup('activities', mapped);
                    _notify('activities', mapped);
                }
            }
        } catch (err) {
            console.error(`[DB] Error sincronizando ${tableName} desde Supabase:`, err);
        }
    }

    /* ══════════════════════════════════════════════════════════
       SUPABASE REALTIME (Websocket Postgres Changes)
    ═══════════════════════════════════════════════════════════ */
    function _setupRealtime() {
        if (!_supabase) return;
        if (_realtimeChan) {
            _supabase.removeChannel(_realtimeChan);
        }

        _realtimeChan = _supabase.channel('public-academic-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => {
                _syncFromSupabase('subjects');
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
                _syncFromSupabase('activities');
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => {
                _syncFromSupabase('sections');
            })
            .subscribe((status) => {
                console.log('[DB Realtime]', status);
            });
    }

    /* ══════════════════════════════════════════════════════════
       SUSCRIPCIÓN REACTIVA DE VISTAS
    ═══════════════════════════════════════════════════════════ */
    function subscribe(collection, callback) {
        if (!_cbs[collection]) _cbs[collection] = [];
        _cbs[collection].push(callback);

        // Disparo inicial inmediato con datos de caché
        const currentData = get(collection);
        if (currentData !== undefined) {
            try { callback(currentData); } catch (e) { console.error(e); }
        }
    }

    function _notify(collection, data) {
        (_cbs[collection] || []).forEach(cb => {
            try { cb(data); } catch (e) { console.error(e); }
        });
    }

    /* ══════════════════════════════════════════════════════════
       LECTURA Y ESCRITURA DE DATOS
    ═══════════════════════════════════════════════════════════ */
    function get(collection) {
        if (collection === 'settings') return getSettings();
        if (_cache[collection] !== undefined) return _cache[collection];
        const data = _readLS(collection);
        _cache[collection] = data;
        return data;
    }

    function _readLS(collection) {
        const key = LS[collection];
        if (!key) return [];
        const s = localStorage.getItem(key);
        if (s) {
            try { return JSON.parse(s); } catch { return []; }
        }
        if (collection === 'subjects') return [...SEED_SUBJECTS];
        return [];
    }

    function _localBackup(collection, items) {
        const key = LS[collection];
        if (key) localStorage.setItem(key, JSON.stringify(items));
    }

    async function save(collection, items) {
        _cache[collection] = items;
        _localBackup(collection, items);
        _notify(collection, items);

        if (_mode === 'supabase' && _supabase) {
            try {
                if (collection === 'subjects') {
                    const rows = items.map(_toDbSubject);
                    await _supabase.from('subjects').upsert(rows);
                } else if (collection === 'activities') {
                    const rows = items.map(_toDbActivity);
                    await _supabase.from('activities').upsert(rows);
                }
            } catch (e) {
                console.error(`[DB] Error en save(${collection}) Supabase:`, e);
            }
        }
    }

    async function saveOne(collection, item) {
        const items = [...get(collection)];
        const idx   = items.findIndex(i => i.id === item.id);
        if (idx >= 0) items[idx] = item;
        else          items.push(item);

        _cache[collection] = items;
        _localBackup(collection, items);
        _notify(collection, items);

        if (_mode === 'supabase' && _supabase) {
            try {
                if (collection === 'subjects') {
                    const dbRow = _toDbSubject(item);
                    const { error } = await _supabase.from('subjects').upsert(dbRow);
                    if (error) throw error;
                } else if (collection === 'activities') {
                    const dbRow = _toDbActivity(item);
                    const { error } = await _supabase.from('activities').upsert(dbRow);
                    if (error) throw error;
                }
            } catch (e) {
                console.error(`[DB] Error en saveOne(${collection}) Supabase:`, e);
                throw e;
            }
        }
    }

    async function removeOne(collection, id) {
        const items = get(collection).filter(i => i.id !== id);
        _cache[collection] = items;
        _localBackup(collection, items);
        _notify(collection, items);

        if (_mode === 'supabase' && _supabase) {
            try {
                const table = (collection === 'subjects') ? 'subjects' : 'activities';
                const { error } = await _supabase.from(table).delete().eq('id', id);
                if (error) throw error;
            } catch (e) {
                console.error(`[DB] Error en removeOne(${collection}) Supabase:`, e);
                throw e;
            }
        }
    }

    /* ══════════════════════════════════════════════════════════
       SETTINGS (Sección Académica)
    ═══════════════════════════════════════════════════════════ */
    function getSettings() {
        if (_cache['settings']) return _cache['settings'];
        const s = localStorage.getItem(LS.settings);
        const obj = s ? JSON.parse(s) : { ...DEFAULT_SETTINGS };
        _cache['settings'] = obj;
        return obj;
    }

    async function saveSettings(obj) {
        _cache['settings'] = obj;
        localStorage.setItem(LS.settings, JSON.stringify(obj));
        _notify('settings', obj);

        if (_mode === 'supabase' && _supabase) {
            try {
                const row = {
                    id:           obj.seccion || '08S-2623-D1',
                    career:       obj.carrera,
                    semester:     obj.semestre,
                    section_code: obj.seccion,
                    period:       obj.periodo,
                    updated_at:   new Date().toISOString()
                };
                await _supabase.from('sections').upsert(row);
            } catch (e) {
                console.error('[DB] Error guardando settings en Supabase:', e);
            }
        }
    }

    /* ══════════════════════════════════════════════════════════
       CATÁLOGO DE SECCIONES (DINÁMICO PARA ONBOARDING Y ADMIN)
    ═══════════════════════════════════════════════════════════ */
    function getSections() {
        if (_cache['sections'] && Array.isArray(_cache['sections']) && _cache['sections'].length > 0) {
            return _cache['sections'];
        }
        try {
            const raw = localStorage.getItem('gx_sections_catalog');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    _cache['sections'] = parsed;
                    return parsed;
                }
            }
        } catch (e) {}

        const defaultSections = [
            {
                id: '08S-2623-D1',
                career: 'INGENIERÍA DE SISTEMAS',
                semester: 'VIII',
                section_code: '08S-2623-D1',
                period: '2026-I (Diurno)'
            }
        ];
        _cache['sections'] = defaultSections;
        localStorage.setItem('gx_sections_catalog', JSON.stringify(defaultSections));
        return defaultSections;
    }

    async function saveSection(sectionData) {
        if (!sectionData || !sectionData.section_code) return null;
        const code = sectionData.section_code.trim().toUpperCase();
        const cleanSec = {
            id: code,
            career: (sectionData.career || 'INGENIERÍA DE SISTEMAS').trim().toUpperCase(),
            semester: (sectionData.semester || 'VIII').trim().toUpperCase(),
            section_code: code,
            period: (sectionData.period || '2026-I (Diurno)').trim(),
            updated_at: new Date().toISOString()
        };

        const current = [...getSections()];
        const idx = current.findIndex(s => s.section_code === code);
        if (idx >= 0) {
            current[idx] = cleanSec;
        } else {
            current.push(cleanSec);
        }
        _cache['sections'] = current;
        localStorage.setItem('gx_sections_catalog', JSON.stringify(current));

        if (_supabase) {
            try {
                await _supabase.from('sections').upsert(cleanSec, { onConflict: 'section_code' });
            } catch (e) {
                console.warn('[DB] Error guardando sección en Supabase:', e);
            }
        }
        return cleanSec;
    }

    async function deleteSection(sectionCode) {
        if (!sectionCode) return false;
        const code = sectionCode.trim().toUpperCase();
        let current = getSections().filter(s => s.section_code !== code);
        if (current.length === 0) {
            current = [{
                id: '08S-2623-D1',
                career: 'INGENIERÍA DE SISTEMAS',
                semester: 'VIII',
                section_code: '08S-2623-D1',
                period: '2026-I (Diurno)'
            }];
        }
        _cache['sections'] = current;
        localStorage.setItem('gx_sections_catalog', JSON.stringify(current));

        if (_supabase) {
            try {
                await _supabase.from('sections').delete().eq('section_code', code);
            } catch (e) {
                console.warn('[DB] Error eliminando sección en Supabase:', e);
            }
        }
        return true;
    }

    /* ══════════════════════════════════════════════════════════
       AUTENTICACIÓN ADMINISTRADOR (Supabase Auth + Sesión Permanente)
    ═══════════════════════════════════════════════════════════ */
    async function loginWithPassword(email, password) {
        if (_supabase) {
            try {
                const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    return { success: false, error: error.message };
                }
                _adminUser = data.user;
                _adminUnlocked = true;
                localStorage.setItem(LS.adminSession, JSON.stringify(data.user));
                _notifyAdminStateChange();
                return { success: true, user: data.user };
            } catch (e) {
                return { success: false, error: e.message };
            }
        } else {
            // Modo local: comprobación con PIN
            return { success: false, error: 'Supabase no está configurado aún. Usa el PIN de emergencia (1234).' };
        }
    }

    async function loginWithMagicLink(email) {
        if (!_supabase) {
            return { success: false, error: 'Supabase no está configurado.' };
        }
        try {
            const { error } = await _supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: window.location.href }
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async function logoutAdmin() {
        if (_supabase) {
            try {
                await _supabase.auth.signOut();
            } catch (e) {}
        }
        _adminUser = null;
        _adminUnlocked = false;
        localStorage.removeItem(LS.adminSession);
        sessionStorage.removeItem('gx_admin_unlocked');
        _notifyAdminStateChange();
        return { success: true };
    }

    function unlockAdmin(user = null) {
        _adminUnlocked = true;
        if (user) {
            _adminUser = user;
            localStorage.setItem(LS.adminSession, JSON.stringify(user));
        } else {
            sessionStorage.setItem('gx_admin_unlocked', 'true');
        }
        _notifyAdminStateChange();
    }

    function lockAdmin() {
        logoutAdmin();
    }

    function isAdminUnlocked() {
        if (_adminUnlocked) return true;
        if (localStorage.getItem(LS.adminSession)) {
            try {
                _adminUser = JSON.parse(localStorage.getItem(LS.adminSession));
                _adminUnlocked = true;
                return true;
            } catch (e) {}
        }
        if (sessionStorage.getItem('gx_admin_unlocked') === 'true') {
            _adminUnlocked = true;
            return true;
        }
        return false;
    }

    function getAdminUser() {
        return _adminUser;
    }

    function isOwner() {
        if (!isAdminUnlocked()) return false;
        const email = (_adminUser?.email || '').toLowerCase().trim();
        if (email === OWNER_EMAIL.toLowerCase()) return true;
        return _userRole === 'owner';
    }

    function getUserRole() {
        if (!isAdminUnlocked()) return null;
        if (isOwner()) return 'owner';
        return _userRole || 'admin';
    }

    function canManageSection(secCode) {
        if (!isAdminUnlocked()) return false;
        if (isOwner()) return true;
        if (!_supabase || _mode === 'local') return true;
        const code = secCode || getSettings().seccion || '08S-2623-D1';
        return _adminSections.includes('*') || _adminSections.includes(code);
    }

    async function getStaffUsers() {
        if (_supabase) {
            try {
                const { data, error } = await _supabase.from('staff_users').select('*').order('created_at', { ascending: false });
                if (!error && data) return data;
            } catch (e) {}
        }
        return [
            { id: '1', email: OWNER_EMAIL, role: 'owner', created_at: new Date().toISOString() }
        ];
    }

    async function getSectionAdmins() {
        if (_supabase) {
            try {
                const { data, error } = await _supabase.from('section_admins').select('*').order('created_at', { ascending: false });
                if (!error && data) return data;
            } catch (e) {}
        }
        return [
            { id: '1', email: OWNER_EMAIL, section_code: '08S-2623-D1', created_at: new Date().toISOString() }
        ];
    }

    async function addSectionAdmin(email, sectionCode) {
        const cleanEmail = email.toLowerCase().trim();
        const cleanSec = sectionCode.trim();
        if (_supabase) {
            await _supabase.from('staff_users').upsert({ email: cleanEmail, role: 'admin' }, { onConflict: 'email' });
            const { data, error } = await _supabase.from('section_admins').insert({
                email: cleanEmail,
                section_code: cleanSec
            }).select();
            if (error) throw error;
            return data;
        } else {
            return [{ id: 'loc_' + Date.now(), email: cleanEmail, section_code: cleanSec }];
        }
    }

    async function removeSectionAdmin(id) {
        if (_supabase) {
            const { error } = await _supabase.from('section_admins').delete().eq('id', id);
            if (error) throw error;
            return true;
        }
        return true;
    }

    /* ══════════════════════════════════════════════════════════
       GESTIÓN DE ESTUDIANTES Y MATRÍCULA (SUPABASE / LOCAL)
    ═══════════════════════════════════════════════════════════ */
    async function getStudentByCi(ci) {
        if (!ci) return null;
        const cleanCi = ci.trim().toUpperCase();
        if (_supabase) {
            try {
                const { data, error } = await _supabase
                    .from('students')
                    .select('*')
                    .eq('ci', cleanCi)
                    .maybeSingle();
                if (!error && data) return data;
            } catch (e) {
                console.warn('[DB] Error consultando estudiante en Supabase:', e);
            }
        }
        // Fallback local
        const local = localStorage.getItem('gx_student_profile');
        if (local) {
            try {
                const parsed = JSON.parse(local);
                if (parsed.ci && parsed.ci.toUpperCase() === cleanCi) return parsed;
            } catch (e) {}
        }
        return null;
    }

    async function saveStudent(studentData) {
        if (!studentData || !studentData.ci) return null;
        const cleanCi = studentData.ci.trim().toUpperCase();
        const payload = {
            ci: cleanCi,
            full_name: (studentData.fullName || studentData.full_name || '').trim(),
            career: studentData.career || 'INGENIERÍA DE SISTEMAS',
            section_code: studentData.sectionCode || studentData.section_code || '08S-2623-D1',
            pin: studentData.pin || null,
            preferences: studentData.preferences || {},
            updated_at: new Date().toISOString()
        };

        if (_supabase) {
            try {
                const { data, error } = await _supabase
                    .from('students')
                    .upsert(payload, { onConflict: 'ci' })
                    .select()
                    .maybeSingle();
                if (error) console.warn('[DB] Error guardando estudiante en Supabase:', error);
                else if (data) return data;
            } catch (e) {
                console.warn('[DB] Fallback al guardar estudiante:', e);
            }
        }
        return payload;
    }

    async function getStudentEnrollments(studentCi) {
        if (!studentCi) return [];
        const cleanCi = studentCi.trim().toUpperCase();
        if (_supabase) {
            try {
                const { data, error } = await _supabase
                    .from('student_enrollments')
                    .select('*')
                    .eq('student_ci', cleanCi);
                if (!error && data) return data;
            } catch (e) {
                console.warn('[DB] Error consultando inscripciones en Supabase:', e);
            }
        }
        const local = localStorage.getItem('gx_student_enrolled_ids');
        return local ? JSON.parse(local) : [];
    }

    async function enrollStudentSubject(studentCi, subject) {
        if (!studentCi || !subject) return false;
        const cleanCi = studentCi.trim().toUpperCase();
        const settings = getSettings();
        const payload = {
            student_ci: cleanCi,
            subject_id: subject.id,
            subject_code: subject.code || subject.shortName || subject.id,
            section_code: subject.section || settings.seccion || '08S-2623-D1',
            enrolled_at: new Date().toISOString()
        };

        if (_supabase) {
            try {
                await _supabase
                    .from('student_enrollments')
                    .upsert(payload, { onConflict: 'student_ci,subject_id' });
            } catch (e) {
                console.warn('[DB] Error inscribiendo materia en Supabase:', e);
            }
        }
        return true;
    }

    async function unenrollStudentSubject(studentCi, subjectId) {
        if (!studentCi || !subjectId) return false;
        const cleanCi = studentCi.trim().toUpperCase();
        if (_supabase) {
            try {
                await _supabase
                    .from('student_enrollments')
                    .delete()
                    .eq('student_ci', cleanCi)
                    .eq('subject_id', subjectId);
            } catch (e) {
                console.warn('[DB] Error retirando materia en Supabase:', e);
            }
        }
        return true;
    }

    /* ── PIN DE EMERGENCIA (MODO LOCAL) ── */
    function getPin()      { return localStorage.getItem(LS.pin) || '1234'; }
    function savePin(pin)  { localStorage.setItem(LS.pin, String(pin)); }
    function checkPin(pin) { return String(pin) === getPin(); }

    /* ══════════════════════════════════════════════════════════
       UTILIDADES DE RESPALDO Y ESTADO
    ═══════════════════════════════════════════════════════════ */
    function getMode()     { return _mode; }
    function isSupabase()  { return _mode === 'supabase'; }
    function generateId()  {
        return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function clearAllData() {
        Object.values(LS).forEach(k => localStorage.removeItem(k));
        Object.keys(_cache).forEach(k => delete _cache[k]);
        localStorage.setItem(LS.subjects, JSON.stringify(SEED_SUBJECTS));
        localStorage.setItem(LS.settings, JSON.stringify(DEFAULT_SETTINGS));
        _cache['subjects']   = [...SEED_SUBJECTS];
        _cache['activities'] = [];
        _cache['grades']     = [];
    }

    function exportData() {
        return JSON.stringify({
            subjects:   get('subjects'),
            activities: get('activities'),
            settings:   getSettings(),
            exportedAt: new Date().toISOString(),
        }, null, 2);
    }

    function importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.subjects)   save('subjects',   data.subjects);
            if (data.activities) save('activities', data.activities);
            if (data.settings)   saveSettings(data.settings);
            return true;
        } catch (e) {
            console.error('[DB] importData error:', e);
            return false;
        }
    }

    /* ══════════════════════════════════════════════════════════
       API PÚBLICA
    ═══════════════════════════════════════════════════════════ */
    return {
        init,
        subscribe,
        get,
        save,
        saveOne,
        removeOne,
        getSettings,
        saveSettings,
        getSections,
        saveSection,
        deleteSection,
        loginWithPassword,
        loginWithMagicLink,
        logoutAdmin,
        unlockAdmin,
        lockAdmin,
        isAdminUnlocked,
        getAdminUser,
        isOwner,
        getUserRole,
        canManageSection,
        getStaffUsers,
        getSectionAdmins,
        addSectionAdmin,
        removeSectionAdmin,
        getStudentByCi,
        saveStudent,
        getStudentEnrollments,
        enrollStudentSubject,
        unenrollStudentSubject,
        getPin,
        savePin,
        checkPin,
        getSupabaseConfig,
        saveSupabaseConfig,
        getMode,
        isSupabase,
        generateId,
        clearAllData,
        exportData,
        importData,
        get SEED_SUBJECTS() { return SEED_SUBJECTS; }
    };

})();

window.DB = DB;
