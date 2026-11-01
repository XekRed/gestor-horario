/* =============================================================
   preferences.js — Personalización Visual y Académica
   Temas, Acento, Densidad, Pestaña Inicial, Materias Suscritas
   y Detección de Choques de Horario (Multi-Sección)
   Datos guardados en localStorage (independiente por dispositivo)
   ============================================================= */

const Prefs = (() => {

    const LS_KEY  = 'gx_prefs';
    const LS_SUBJ = 'gx_student_subjects';

    /* ── CATÁLOGO EXTERNO DE OTRAS SECCIONES ─────────────────── */
    // Permite suscribirse a asignaturas de otros semestres o turnos
    const EXTERNAL_CATALOG = [
        {
            id: 'ext_redes',
            name: 'REDES DE COMPUTADORAS',
            shortName: 'RED',
            code: 'RED-08N',
            section: '08S-2623-N1',
            room: 'YSSF-015',
            teacher: 'Prof. Marcos Rivas',
            color: '#ff4757',
            slots: [
                { day: 2, startBlock: 4, span: 3 } // Mié 10:00-12:15 -> Choque con Planificación (PEP)
            ]
        },
        {
            id: 'ext_bd2',
            name: 'BASES DE DATOS II',
            shortName: 'BD2',
            code: 'BD2-07D',
            section: '07S-2623-D1',
            room: 'LAB-02',
            teacher: 'Ing. Elena Gómez',
            color: '#e056fd',
            slots: [
                { day: 0, startBlock: 8, span: 3 } // Lun 13:00-15:15 -> Choque con Teleprocesos (TEL)
            ]
        },
        {
            id: 'ext_seguridad',
            name: 'SEGURIDAD INFORMÁTICA',
            shortName: 'SEG',
            code: 'SEG-08N',
            section: '08S-2623-N1',
            room: 'YSSF-020',
            teacher: 'Ing. Roberto Silva',
            color: '#1dd1a1',
            slots: [
                { day: 1, startBlock: 1, span: 3 } // Mar 7:45-10:00 -> Martes libre (Sin choque)
            ]
        },
        {
            id: 'ext_etica',
            name: 'ÉTICA PROFESIONAL',
            shortName: 'ETI',
            code: 'ETI-08D',
            section: '08S-2623-D2',
            room: 'YSSF-008',
            teacher: 'Lic. Ana Morales',
            color: '#feca57',
            slots: [
                { day: 3, startBlock: 2, span: 3 } // Jue 8:30-10:45 -> Choque con Teoría de Decisiones (TD)
            ]
        }
    ];

    /* ── CONFIGURACIÓN POR DEFECTO ───────────────────────────── */
    const DEFAULTS = {
        theme:           'dark_bcv',   // 'dark_bcv' | 'oled' | 'light_hc'
        accent:          'cyan',       // 'cyan' | 'green' | 'orange' | 'purple' | 'red'
        density:         'standard',   // 'standard' | 'compact'
        defaultTab:      'dashboard',  // 'dashboard' | 'schedule' | 'calendar' | 'grades'
        gradeMode:       'percentage', // 'percentage' | 'scale20' | 'scale5'
        securityEnabled: false,        // boolean
        studentCi:       '',           // ej. 'V-28123456'
        studentPin:      '',           // 4 dígitos numéricos
        subjectColors:   {}            // { [subjectId]: '#hexcolor' }
    };

    const ACCENT_COLORS = {
        cyan:   { main: '#00f0ff', glow: 'rgba(0,240,255,0.30)', subtle: 'rgba(0,240,255,0.08)', dark: '#004d54', dim: '#007a82' },
        green:  { main: '#00e5a0', glow: 'rgba(0,229,160,0.30)', subtle: 'rgba(0,229,160,0.08)', dark: '#00523a', dim: '#007a55' },
        orange: { main: '#ff9f43', glow: 'rgba(255,159,67,0.30)', subtle: 'rgba(255,159,67,0.08)', dark: '#6b3800', dim: '#a05800' },
        purple: { main: '#9b59b6', glow: 'rgba(155,89,182,0.30)', subtle: 'rgba(155,89,182,0.08)', dark: '#3d1a5a', dim: '#6a2fa0' },
        red:    { main: '#ff2e5f', glow: 'rgba(255,46,95,0.30)', subtle: 'rgba(255,46,95,0.08)', dark: '#5a0020', dim: '#a01040' },
    };

    /* ── LOAD / SAVE ─────────────────────────────────────────── */
    function load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            const saved = raw ? JSON.parse(raw) : {};
            return Object.assign({}, DEFAULTS, saved);
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function save(prefs) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(prefs));
        } catch (e) {}
    }

    function loadSubjects() {
        try {
            const raw = localStorage.getItem(LS_SUBJ);
            return raw ? JSON.parse(raw) : { hidden: [], subscribed: [] };
        } catch (e) {
            return { hidden: [], subscribed: [] };
        }
    }

    function saveSubjects(data) {
        try {
            localStorage.setItem(LS_SUBJ, JSON.stringify(data));
        } catch (e) {}
    }

    /* ── APLICACIÓN DE ESTILOS ───────────────────────────────── */
    function applyTheme(theme) {
        const root = document.documentElement;
        root.removeAttribute('data-theme');
        if (theme !== 'dark_bcv') {
            root.setAttribute('data-theme', theme);
        }
    }

    function applyAccent(accent) {
        const col = ACCENT_COLORS[accent] || ACCENT_COLORS.cyan;
        const root = document.documentElement;
        root.style.setProperty('--cyan',        col.main);
        root.style.setProperty('--cyan-bright', col.main);
        root.style.setProperty('--cyan-glow',   col.glow);
        root.style.setProperty('--cyan-subtle', col.subtle);
        root.style.setProperty('--cyan-dark',   col.dark);
        root.style.setProperty('--cyan-dim',    col.dim);
        root.style.setProperty('--grad-cyan',   `linear-gradient(135deg, ${col.main}, ${col.dim})`);
    }

    function applyDensity(density) {
        document.body.classList.toggle('ui-compact', density === 'compact');
    }

    function applyAll() {
        const p = load();
        applyTheme(p.theme);
        applyAccent(p.accent);
        applyDensity(p.density);
    }

    /* ── INICIALIZACIÓN Y MODAL ──────────────────────────────── */
    function init() {
        applyAll();
        _bindPanelEvents();
    }

    function openPanel() {
        const modal = document.getElementById('modalPreferences');
        if (!modal) return;
        _populatePanel();
        modal.classList.add('open');
    }

    function closePanel(event, force = false) {
        if (force || (event && event.target.id === 'modalPreferences')) {
            document.getElementById('modalPreferences')?.classList.remove('open');
        }
    }

    function _populatePanel() {
        const p = load();
        const s = loadSubjects();

        // Theme buttons
        document.querySelectorAll('.pref-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === p.theme);
        });

        // Accent buttons
        document.querySelectorAll('.pref-accent-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.accent === p.accent);
        });

        // Density radio
        document.querySelectorAll('input[name="prefDensity"]').forEach(r => {
            r.checked = (r.value === p.density);
        });

        // Default tab selector
        const tabSel = document.getElementById('prefDefaultTab');
        if (tabSel) tabSel.value = p.defaultTab || 'dashboard';

        // Grade Mode selector
        const gradeSel = document.getElementById('prefGradeMode');
        if (gradeSel) gradeSel.value = p.gradeMode || 'percentage';

        // Security Profile (Optional)
        const secToggle = document.getElementById('prefSecurityToggle');
        const secFields = document.getElementById('prefSecurityFields');
        const secStatus = document.getElementById('prefSecurityStatusText');
        const secCi = document.getElementById('prefStudentCi');
        const secPin = document.getElementById('prefStudentPin');

        if (secToggle) {
            secToggle.checked = Boolean(p.securityEnabled);
            if (secStatus) {
                secStatus.textContent = p.securityEnabled
                    ? (p.studentPin ? `Activado (Cédula: ${p.studentCi || 'Protegida'})` : 'Configuración Incompleta')
                    : 'Desactivado (Acceso Libre)';
            }
        }
        if (secFields) {
            secFields.style.display = p.securityEnabled ? 'flex' : 'none';
        }
        if (secCi) secCi.value = p.studentCi || '';
        if (secPin) {
            secPin.value = '';
            secPin.placeholder = p.studentPin ? '•••• (PIN Configurado)' : 'PIN (4 dígitos)';
        }

        // Subject visibility list & external subscriptions
        _renderSubjectVisibility(s);
    }

    function _renderSubjectVisibility(subjectState) {
        const container = document.getElementById('prefSubjectList');
        if (!container) return;

        const subjects = typeof DB !== 'undefined' ? (DB.get('subjects') || []) : [];
        if (subjects.length === 0) {
            container.innerHTML = '<p class="empty-msg" style="font-size:0.78rem;padding:8px 0;">No hay materias registradas en la sección.</p>';
            return;
        }

        const prefs = load();
        container.innerHTML = subjects.map(s => {
            const isHidden = (subjectState.hidden || []).includes(s.id);
            const customColor = (prefs.subjectColors || {})[s.id] || s.color || '#00f0ff';
            const codeTag = s.code ? `[${s.code}] ` : '';
            return `
            <div class="pref-subject-row" data-sid="${s.id}">
                <input type="color" class="pref-subject-color" value="${customColor}"
                    title="Color personal para ${s.name || s.shortName}"
                    onchange="Prefs.setSubjectColor('${s.id}', this.value)">
                <span class="pref-subject-name" style="flex:1">
                    <span class="mono" style="color:var(--cyan);font-size:0.7rem;">${codeTag}</span>${s.name}
                </span>
                <label class="pref-toggle-wrap" title="${isHidden ? 'Materia oculta en tu horario' : 'Materia visible en tu horario'}">
                    <input type="checkbox" class="pref-subj-toggle" data-sid="${s.id}" ${isHidden ? '' : 'checked'}>
                    <span class="pref-toggle-slider"></span>
                </label>
            </div>`;
        }).join('');

        // Listeners para los toggles de visibilidad
        container.querySelectorAll('.pref-subj-toggle').forEach(chk => {
            chk.addEventListener('change', () => {
                const sid = chk.dataset.sid;
                const state = loadSubjects();
                state.hidden = state.hidden || [];
                if (chk.checked) {
                    state.hidden = state.hidden.filter(id => id !== sid);
                } else {
                    if (!state.hidden.includes(sid)) state.hidden.push(sid);
                }
                saveSubjects(state);
                _notifySubjectChange();
            });
        });

        // Suscripciones externas
        const subList = document.getElementById('prefSubscribedList');
        if (subList) {
            const subState = loadSubjects();
            if (!subState.subscribed || subState.subscribed.length === 0) {
                subList.innerHTML = '<p class="empty-msg" style="font-size:0.76rem;padding:6px 0;">Sin materias externas suscritas actualmente.</p>';
            } else {
                subList.innerHTML = subState.subscribed.map(sub => `
                    <div class="pref-subscribed-row">
                        <div style="flex:1;">
                            <span class="mono" style="font-size:0.75rem;font-weight:700;color:var(--cyan);">${sub.code}</span>
                            <span style="font-size:0.75rem;color:var(--text-1);margin-left:6px;">${sub.name}</span>
                            <span style="display:block;font-size:0.65rem;color:var(--text-3);">${sub.section || 'Externa'} · ${sub.room || 'Aula N/A'}</span>
                        </div>
                        <button class="btn-ghost btn-sm" style="padding:3px 8px;font-size:0.7rem;color:var(--red);"
                            onclick="Prefs.unsubscribe('${sub.code}')">Remover</button>
                    </div>`).join('');
            }
        }
    }

    function _bindPanelEvents() {
        // Theme buttons
        document.querySelectorAll('.pref-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = load();
                p.theme = btn.dataset.theme;
                save(p);
                applyTheme(p.theme);
                document.querySelectorAll('.pref-theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === p.theme));
                if (typeof Notify !== 'undefined') Notify.toast('Tema visual actualizado', 'success', 1800);
            });
        });

        // Accent buttons
        document.querySelectorAll('.pref-accent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = load();
                p.accent = btn.dataset.accent;
                save(p);
                applyAccent(p.accent);
                document.querySelectorAll('.pref-accent-btn').forEach(b => b.classList.toggle('active', b.dataset.accent === p.accent));
                if (typeof Notify !== 'undefined') Notify.toast('Acento de color aplicado', 'success', 1800);
            });
        });

        // Density radio
        document.querySelectorAll('input[name="prefDensity"]').forEach(r => {
            r.addEventListener('change', () => {
                const p = load();
                p.density = r.value;
                save(p);
                applyDensity(p.density);
                if (typeof Notify !== 'undefined') Notify.toast(`Densidad ${p.density === 'compact' ? 'Compacta' : 'Estándar'} activada`, 'info', 1800);
            });
        });

        // Default tab select
        document.getElementById('prefDefaultTab')?.addEventListener('change', (e) => {
            const p = load();
            p.defaultTab = e.target.value;
            save(p);
            if (typeof Notify !== 'undefined') Notify.toast('Vista inicial guardada', 'info', 1500);
        });

        // Grade Mode select
        document.getElementById('prefGradeMode')?.addEventListener('change', (e) => {
            setGradeMode(e.target.value);
            if (typeof Notify !== 'undefined') {
                const names = { percentage: 'Porcentaje % (0–100%)', scale20: 'Escala 0–20 Puntos', scale5: 'Escala 0–5 Puntos' };
                Notify.toast(`Modo de notas: ${names[e.target.value] || e.target.value}`, 'success', 2000);
            }
        });

        // Security Profile Toggle & Save
        const secToggle = document.getElementById('prefSecurityToggle');
        const secFields = document.getElementById('prefSecurityFields');
        const secStatus = document.getElementById('prefSecurityStatusText');

        if (secToggle) {
            secToggle.addEventListener('change', () => {
                if (secFields) secFields.style.display = secToggle.checked ? 'flex' : 'none';
                if (!secToggle.checked) {
                    // Desactivar seguridad
                    const p = load();
                    p.securityEnabled = false;
                    save(p);
                    if (secStatus) secStatus.textContent = 'Desactivado (Acceso Libre)';
                    if (typeof Notify !== 'undefined') Notify.toast('Seguridad de perfil desactivada', 'info', 2000);
                } else {
                    if (secStatus) secStatus.textContent = 'Pendiente de guardar PIN';
                }
            });
        }

        document.getElementById('btnSaveSecurityProfile')?.addEventListener('click', () => {
            const ci = document.getElementById('prefStudentCi')?.value.trim();
            const pin = document.getElementById('prefStudentPin')?.value.trim();
            const p = load();

            if (!pin && !p.studentPin) {
                if (typeof Notify !== 'undefined') Notify.toast('Ingresa un PIN numérico de 4 dígitos', 'warning', 2500);
                return;
            }

            if (pin && (pin.length !== 4 || isNaN(Number(pin)))) {
                if (typeof Notify !== 'undefined') Notify.toast('El PIN debe tener exactamente 4 números', 'warning', 2500);
                return;
            }

            p.securityEnabled = true;
            if (ci) p.studentCi = ci;
            if (pin) p.studentPin = pin;
            save(p);

            if (secStatus) secStatus.textContent = `Activado (Cédula: ${p.studentCi || 'Protegida'})`;
            const secPinInput = document.getElementById('prefStudentPin');
            if (secPinInput) {
                secPinInput.value = '';
                secPinInput.placeholder = '•••• (PIN Configurado)';
            }
            if (typeof Notify !== 'undefined') Notify.toast('Seguridad de perfil y PIN guardados con éxito', 'success', 2500);
        });

        // Subscribe by code button & enter key
        const subInput = document.getElementById('inputSubscribeCode');
        const subBtn = document.getElementById('btnSubscribeCode');

        if (subBtn && subInput) {
            subBtn.addEventListener('click', () => {
                const code = subInput.value.trim().toUpperCase();
                if (!code) return;
                subscribeByCode(code);
                subInput.value = '';
            });
            subInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    subBtn.click();
                }
            });
        }
    }

    function _notifySubjectChange() {
        if (typeof Schedule !== 'undefined' && Schedule.renderTable) {
            Schedule.renderTable();
            Schedule.renderLegend();
        }
        if (typeof App !== 'undefined' && App.renderDashboard) {
            App.renderDashboard();
        }
    }

    /* ── PUBLIC API: COLORES Y VISIBILIDAD ───────────────────── */
    function setSubjectColor(subjectId, color) {
        const p = load();
        p.subjectColors = p.subjectColors || {};
        p.subjectColors[subjectId] = color;
        save(p);
        _notifySubjectChange();
    }

    function getSubjectColor(subjectId, fallbackColor) {
        const p = load();
        return (p.subjectColors && p.subjectColors[subjectId]) ? p.subjectColors[subjectId] : (fallbackColor || '#00f0ff');
    }

    function isSubjectHidden(subjectId) {
        const state = loadSubjects();
        return (state.hidden || []).includes(subjectId);
    }

    function getSubscribedSubjects() {
        return loadSubjects().subscribed || [];
    }

    /* ── PUBLIC API: SUSCRIPCIÓN MULTI-SECCIÓN ───────────────── */
    function subscribeByCode(code) {
        if (!code) return;
        const normalized = code.trim().toUpperCase();
        const state = loadSubjects();
        state.subscribed = state.subscribed || [];

        // Comprobar si ya está suscrito
        if (state.subscribed.some(s => (s.code || '').toUpperCase() === normalized)) {
            if (typeof Notify !== 'undefined') Notify.toast(`Ya estás suscrito al código [${normalized}]`, 'warning');
            return;
        }

        // 1. Buscar en el catálogo externo de otras secciones
        let match = EXTERNAL_CATALOG.find(ext => ext.code.toUpperCase() === normalized);

        // 2. Si no está en catálogo externo, buscar en materias de la base de datos local
        if (!match && typeof DB !== 'undefined') {
            const localSubjects = DB.get('subjects') || [];
            match = localSubjects.find(s => (s.code || '').toUpperCase() === normalized);
        }

        if (!match) {
            if (typeof Notify !== 'undefined') {
                Notify.toast(`Código [${normalized}] no encontrado. Prueba: RED-08N, BD2-07D o SEG-08N`, 'error', 4500);
            }
            return;
        }

        // Clonar y registrar suscripción
        const newSub = {
            id: match.id,
            name: match.name,
            shortName: match.shortName || match.name.slice(0, 4),
            code: match.code,
            section: match.section || '08S-2623-D1',
            room: match.room || null,
            teacher: match.teacher || '',
            color: match.color || '#ff4757',
            slots: match.slots || []
        };

        state.subscribed.push(newSub);
        saveSubjects(state);
        _renderSubjectVisibility(state);
        _notifySubjectChange();

        if (typeof Notify !== 'undefined') {
            Notify.toast(`Suscripción exitosa a [${newSub.code}] ${newSub.name}`, 'success');
        }
    }

    function unsubscribe(code) {
        const normalized = code.trim().toUpperCase();
        const state = loadSubjects();
        state.subscribed = (state.subscribed || []).filter(s => (s.code || '').toUpperCase() !== normalized);
        saveSubjects(state);
        _renderSubjectVisibility(state);
        _notifySubjectChange();
        if (typeof Notify !== 'undefined') {
            Notify.toast(`Suscripción removida [${normalized}]`, 'info');
        }
    }

    function getDefaultTab() {
        return load().defaultTab || 'dashboard';
    }

    function getGradeMode() {
        return load().gradeMode || 'percentage';
    }

    function setGradeMode(mode) {
        const p = load();
        p.gradeMode = mode;
        save(p);
        if (typeof Student !== 'undefined' && Student.renderGradesTab) {
            Student.renderGradesTab();
        }
    }

    function isSecurityEnabled() {
        const p = load();
        return Boolean(p.securityEnabled && p.studentPin);
    }

    function getStudentCi() {
        return load().studentCi || '';
    }

    function checkStudentPin(pin) {
        const p = load();
        if (!p.studentPin) return true;
        return String(pin).trim() === String(p.studentPin).trim();
    }

    function getExternalCatalog() {
        return EXTERNAL_CATALOG;
    }

    /* ── PUBLIC EXPORT ───────────────────────────────────────── */
    return {
        init,
        openPanel,
        closePanel,
        applyAll,
        setSubjectColor,
        getSubjectColor,
        isSubjectHidden,
        getSubscribedSubjects,
        subscribeByCode,
        unsubscribe,
        getDefaultTab,
        getGradeMode,
        setGradeMode,
        isSecurityEnabled,
        getStudentCi,
        checkStudentPin,
        getExternalCatalog
    };

})();

window.Prefs = Prefs;
