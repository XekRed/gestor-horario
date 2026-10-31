/* =============================================================
   admin.js — Panel de Administración con Supabase Auth Permanente
   Soporte para Gestión de Materias, Bloques Horarios, Actividades,
   Configuración de Sección y Supabase PostgreSQL + Realtime
   ============================================================= */

const Admin = (() => {

    /* ── ESTADO INTERNO ──────────────────────────────────────── */
    let _activeTab = 'subjects';
    let _currentPinInput = '';
    let _editingSubjectId = null;
    let _onPinSuccessCallback = null;

    /* ── DÍAS Y BLOQUES DE REFERENCIA ────────────────────────── */
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const BLOCK_LABELS = [
        'Formación (07:00)',
        'Bloque 1 (07:45 - 08:30)',
        'Bloque 2 (08:30 - 09:15)',
        'Bloque 3 (09:15 - 10:00)',
        'Bloque 4 (10:00 - 10:45)',
        'Bloque 5 (10:45 - 11:30)',
        'Bloque 6 (11:30 - 12:15)',
        'Bloque 7 (12:15 - 13:00)',
        'Bloque 8 (13:00 - 13:45)',
        'Bloque 9 (13:45 - 14:30)',
        'Bloque 10 (14:30 - 15:15)',
        'Bloque 11 (15:15 - 16:00)',
        'Bloque 12 (16:00 - 16:45)',
        'Bloque 13 (16:45 - 17:30)',
    ];

    /* ══════════════════════════════════════════════════════════
       GESTIÓN DE AUTENTICACIÓN (SUPABASE AUTH + SESIÓN PERMANENTE)
    ═══════════════════════════════════════════════════════════ */
    function openPinModal(onSuccessCallback = null) {
        _onPinSuccessCallback = typeof onSuccessCallback === 'function' ? onSuccessCallback : null;

        // Si ya está desbloqueado de forma permanente (Supabase Auth activo o sesión local), proceder directo
        if (DB.isAdminUnlocked()) {
            if (_onPinSuccessCallback) {
                const cb = _onPinSuccessCallback;
                _onPinSuccessCallback = null;
                cb();
            } else {
                openAdminPanel();
            }
            return;
        }

        _currentPinInput = '';
        const pinInput = document.getElementById('adminPinInput');
        if (pinInput) pinInput.value = '';

        const authErr = document.getElementById('adminAuthError');
        if (authErr) authErr.style.display = 'none';

        const pinErr = document.getElementById('pinErrorMsg');
        if (pinErr) pinErr.style.display = 'none';

        // Por defecto mostrar Supabase Auth si está configurado, o PIN si es local
        if (DB.isSupabase()) {
            switchAuthMode('supabase');
        } else {
            switchAuthMode('supabase'); // Permite probar login o cambiar a PIN
        }

        const modal = document.getElementById('modalAdminPin');
        if (modal) {
            modal.classList.add('open');
            const emailInput = document.getElementById('adminAuthEmail');
            setTimeout(() => emailInput?.focus(), 150);
        }
    }

    function closePinModal(event, force = false) {
        if (force || (event && event.target.id === 'modalAdminPin')) {
            document.getElementById('modalAdminPin')?.classList.remove('open');
            _onPinSuccessCallback = null;
        }
    }

    function switchAuthMode(mode) {
        const supabaseSection = document.getElementById('authModeSupabase');
        const pinSection = document.getElementById('authModePin');
        const btnSb = document.getElementById('btnTabAuthSupabase');
        const btnPin = document.getElementById('btnTabAuthPin');

        if (mode === 'supabase') {
            if (supabaseSection) supabaseSection.style.display = 'block';
            if (pinSection) pinSection.style.display = 'none';
            if (btnSb) {
                btnSb.style.background = 'var(--cyan)';
                btnSb.style.color = 'var(--bg-darkest)';
                btnSb.style.fontWeight = '700';
            }
            if (btnPin) {
                btnPin.style.background = 'transparent';
                btnPin.style.color = 'var(--text-2)';
                btnPin.style.fontWeight = '600';
            }
        } else {
            if (supabaseSection) supabaseSection.style.display = 'none';
            if (pinSection) pinSection.style.display = 'block';
            if (btnPin) {
                btnPin.style.background = 'var(--cyan)';
                btnPin.style.color = 'var(--bg-darkest)';
                btnPin.style.fontWeight = '700';
            }
            if (btnSb) {
                btnSb.style.background = 'transparent';
                btnSb.style.color = 'var(--text-2)';
                btnSb.style.fontWeight = '600';
            }
        }
    }

    async function submitAuthLogin() {
        const emailInput = document.getElementById('adminAuthEmail');
        const passInput  = document.getElementById('adminAuthPassword');
        const errEl      = document.getElementById('adminAuthError');
        const btn        = document.getElementById('btnAdminLogin');

        const email    = emailInput?.value.trim();
        const password = passInput?.value;

        if (errEl) errEl.style.display = 'none';

        if (!email || !password) {
            if (errEl) {
                errEl.textContent = 'Ingresa tu correo y contraseña de Administrador.';
                errEl.style.display = 'block';
            }
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Autenticando...';
        }

        try {
            const res = await DB.loginWithPassword(email, password);
            if (res.success) {
                closePinModal(null, true);
                Notify.toast(`Bienvenido Administrador (${res.user.email}). Sesión permanente guardada.`, 'success', 3500);
                updateModeBadge();

                if (_onPinSuccessCallback) {
                    const cb = _onPinSuccessCallback;
                    _onPinSuccessCallback = null;
                    cb();
                } else {
                    openAdminPanel();
                }
            } else {
                if (errEl) {
                    errEl.textContent = res.error || 'Credenciales no válidas.';
                    errEl.style.display = 'block';
                }
            }
        } catch (e) {
            if (errEl) {
                errEl.textContent = e.message || 'Error de conexión.';
                errEl.style.display = 'block';
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Iniciar Sesión Permanente';
            }
        }
    }

    async function submitMagicLink() {
        const emailInput = document.getElementById('adminAuthEmail');
        const errEl      = document.getElementById('adminAuthError');
        const email      = emailInput?.value.trim();

        if (errEl) errEl.style.display = 'none';

        if (!email) {
            if (errEl) {
                errEl.textContent = 'Ingresa tu correo para recibir el enlace mágico.';
                errEl.style.display = 'block';
            }
            return;
        }

        try {
            const res = await DB.loginWithMagicLink(email);
            if (res.success) {
                Notify.toast('Enlace mágico enviado. Revisa tu bandeja de entrada en este dispositivo.', 'info', 5000);
            } else {
                if (errEl) {
                    errEl.textContent = res.error;
                    errEl.style.display = 'block';
                }
            }
        } catch (e) {
            if (errEl) {
                errEl.textContent = e.message;
                errEl.style.display = 'block';
            }
        }
    }

    /* ── TECLADO PIN DE EMERGENCIA (MODO LOCAL) ── */
    function keypadPress(digit) {
        if (_currentPinInput.length >= 8) return;
        _currentPinInput += digit;
        const input = document.getElementById('adminPinInput');
        if (input) input.value = _currentPinInput;
        document.getElementById('pinErrorMsg').style.display = 'none';

        if (_currentPinInput.length === 4 && DB.checkPin(_currentPinInput)) {
            submitPin();
        }
    }

    function keypadClear() {
        _currentPinInput = '';
        const input = document.getElementById('adminPinInput');
        if (input) input.value = '';
        document.getElementById('pinErrorMsg').style.display = 'none';
    }

    function submitPin() {
        const input = document.getElementById('adminPinInput');
        const pin = input ? input.value : _currentPinInput;

        if (DB.checkPin(pin)) {
            DB.unlockAdmin();
            closePinModal(null, true);
            Notify.toast('Acceso local concedido como Administrador', 'success');

            if (_onPinSuccessCallback) {
                const cb = _onPinSuccessCallback;
                _onPinSuccessCallback = null;
                cb();
            } else {
                openAdminPanel();
            }
        } else {
            const err = document.getElementById('pinErrorMsg');
            if (err) {
                err.textContent = 'PIN incorrecto. Intenta de nuevo.';
                err.style.display = 'block';
            }
            const box = document.getElementById('modalAdminPinBox');
            if (box) {
                box.classList.add('shake');
                setTimeout(() => box.classList.remove('shake'), 400);
            }
            keypadClear();
        }
    }

    async function lockSession() {
        await DB.logoutAdmin();
        closeAdminPanel(null, true);
        updateModeBadge();
        Notify.toast('Sesión de administración cerrada', 'info');
    }

    /* ══════════════════════════════════════════════════════════
       PANEL DE ADMINISTRACIÓN
    ═══════════════════════════════════════════════════════════ */
    function openAdminPanel() {
        const modal = document.getElementById('modalAdminPanel');
        if (!modal) return;
        modal.classList.add('open');
        updateModeBadge();
        switchTab(_activeTab);
    }

    function closeAdminPanel(event, force = false) {
        if (force || (event && event.target.id === 'modalAdminPanel')) {
            document.getElementById('modalAdminPanel')?.classList.remove('open');
        }
    }

    function switchTab(tabKey) {
        _activeTab = tabKey;
        document.querySelectorAll('.admin-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.atab === tabKey);
        });
        document.querySelectorAll('.admin-tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `atab-${tabKey}`);
        });

        if (tabKey === 'subjects')   renderAdminSubjects();
        if (tabKey === 'activities') renderAdminActivities();
        if (tabKey === 'section')    renderSectionSettings();
        if (tabKey === 'system')     renderSystemConfig();
    }

    function updateModeBadge() {
        const badge = document.getElementById('adminStatusBadge');
        const fabDot = document.getElementById('adminModeDot');
        const fab = document.getElementById('btnOpenAdmin');
        if (!badge) return;

        const isSb = DB.isSupabase();
        const isUnlocked = DB.isAdminUnlocked();
        const user = DB.getAdminUser();

        if (isSb) {
            badge.className = 'admin-badge-mode mode-supabase';
            badge.textContent = isUnlocked ? `Supabase (Admin: ${user?.email || 'Activo'})` : 'Supabase Realtime (Lectura)';
            if (fabDot) fabDot.className = 'admin-fab-status online';
            if (fab) fab.title = isUnlocked ? `Panel Admin (Sesión Permanente: ${user?.email || 'Admin'})` : 'Iniciar Sesión Admin';
        } else {
            badge.className = 'admin-badge-mode mode-local';
            badge.textContent = isUnlocked ? 'Modo Local (Admin Activo)' : 'Modo Local (Offline)';
            if (fabDot) fabDot.className = isUnlocked ? 'admin-fab-status online' : 'admin-fab-status local';
            if (fab) fab.title = isUnlocked ? 'Panel Admin (Sesión Activa)' : 'Acceso de Administrador (PIN)';
        }

        const headerText = document.getElementById('btnHeaderAdminText');
        const headerDot = document.getElementById('headerAdminModeDot');
        if (headerText) {
            headerText.textContent = isUnlocked ? 'Admin (Activo)' : 'Admin';
        }
        if (headerDot) {
            headerDot.style.background = isUnlocked ? 'var(--green)' : (isSb ? 'var(--cyan)' : 'var(--orange)');
            headerDot.style.boxShadow = `0 0 6px ${isUnlocked ? 'var(--green)' : 'var(--cyan)'}`;
        }
    }

    /* ══════════════════════════════════════════════════════════
       TAB 1: HORARIO & MATERIAS
    ═══════════════════════════════════════════════════════════ */
    function renderAdminSubjects() {
        const container = document.getElementById('adminSubjectsList');
        if (!container) return;

        const subjects = DB.get('subjects') || [];
        if (subjects.length === 0) {
            container.innerHTML = '<p class="empty-msg" style="padding:20px;text-align:center;">No hay materias registradas</p>';
            return;
        }

        container.innerHTML = subjects.map(s => {
            const slotsText = (s.slots || []).map(sl => {
                const dayName = DAYS[sl.day] || 'Día ?';
                return `<span class="slot-tag mono">${dayName} (${sl.span} blq)</span>`;
            }).join(' ') || '<span class="empty-msg">Sin horario</span>';

            return `
            <div class="admin-card-row">
                <div class="admin-subj-info">
                    <span class="admin-color-square" style="background:${s.color}"></span>
                    <div style="flex:1;min-width:0;">
                        <div class="admin-subj-title">${s.name} ${s.shortName ? `<span class="mono" style="opacity:0.7">(${s.shortName})</span>` : ''}</div>
                        <div class="admin-subj-meta">
                            ${s.room ? `<span>Aula: <b>${s.room}</b></span>` : ''}
                            ${s.teacher ? `<span>Docente: <b>${s.teacher}</b></span>` : ''}
                            ${s.code ? `<span>Código: <b>${s.code}</b></span>` : ''}
                        </div>
                        <div class="admin-slots-container">${slotsText}</div>
                    </div>
                </div>
                <div class="admin-row-btns">
                    <button class="btn-ghost btn-sm" onclick="Admin.editSubject('${s.id}')">Editar</button>
                    <button class="btn-ghost btn-sm text-danger" onclick="Admin.deleteSubject('${s.id}')">Eliminar</button>
                </div>
            </div>`;
        }).join('');
    }

    function openNewSubject() {
        _editingSubjectId = null;
        document.getElementById('subjModalTitle').textContent = 'Nueva Materia';
        document.getElementById('editSubjName').value = '';
        document.getElementById('editSubjShort').value = '';
        document.getElementById('editSubjCode').value = '';
        document.getElementById('editSubjRoom').value = '';
        document.getElementById('editSubjTeacher').value = '';
        document.getElementById('editSubjColor').value = '#00f0ff';

        const slotsCont = document.getElementById('editSubjSlotsList');
        slotsCont.innerHTML = '';
        addSlotRow(0, 1, 1);

        document.getElementById('modalEditSubject').classList.add('open');
    }

    function editSubject(subjectId) {
        const s = (DB.get('subjects') || []).find(sub => sub.id === subjectId);
        if (!s) return;

        _editingSubjectId = s.id;
        document.getElementById('subjModalTitle').textContent = `Editar Materia: ${s.shortName || s.name}`;
        document.getElementById('editSubjName').value = s.name || '';
        document.getElementById('editSubjShort').value = s.shortName || '';
        document.getElementById('editSubjCode').value = s.code || '';
        document.getElementById('editSubjRoom').value = s.room || '';
        document.getElementById('editSubjTeacher').value = s.teacher || '';
        document.getElementById('editSubjColor').value = s.color || '#00f0ff';

        const slotsCont = document.getElementById('editSubjSlotsList');
        slotsCont.innerHTML = '';
        if (s.slots && s.slots.length > 0) {
            s.slots.forEach(slot => addSlotRow(slot.day, slot.startBlock, slot.span));
        } else {
            addSlotRow(0, 1, 1);
        }

        document.getElementById('modalEditSubject').classList.add('open');
    }

    function closeSubjectModal(event, force = false) {
        if (force || (event && event.target.id === 'modalEditSubject')) {
            document.getElementById('modalEditSubject')?.classList.remove('open');
        }
    }

    function addSlotRow(day = 0, startBlock = 1, span = 1) {
        const slotsCont = document.getElementById('editSubjSlotsList');
        if (!slotsCont) return;

        const row = document.createElement('div');
        row.className = 'slot-builder-row';

        let dayOpts = DAYS.map((d, idx) => `<option value="${idx}" ${idx === day ? 'selected' : ''}>${d}</option>`).join('');
        let blockOpts = BLOCK_LABELS.map((b, idx) => `<option value="${idx}" ${idx === startBlock ? 'selected' : ''}>${b}</option>`).join('');

        row.innerHTML = `
            <select class="form-select slot-day" style="font-size:0.75rem;">${dayOpts}</select>
            <select class="form-select slot-block" style="font-size:0.75rem;">${blockOpts}</select>
            <input type="number" class="form-input slot-span" min="1" max="6" value="${span}" title="Número de bloques contiguos de 45 min" style="width:65px;font-size:0.75rem;">
            <button type="button" class="btn-ghost btn-sm text-danger" onclick="this.parentElement.remove()" style="padding:4px 8px;">&times;</button>
        `;
        slotsCont.appendChild(row);
    }

    async function saveSubject() {
        const name = document.getElementById('editSubjName').value.trim();
        if (!name) return Notify.toast('El nombre de la materia es requerido', 'error');

        const shortName = document.getElementById('editSubjShort').value.trim() || name.slice(0, 4).toUpperCase();
        const codeInput = document.getElementById('editSubjCode').value.trim();
        const settings = DB.getSettings() || {};
        const seccionPrefix = (settings.seccion || '08S').split('-')[0] || '08S';
        const code = codeInput ? codeInput.toUpperCase() : `${shortName.toUpperCase().replace(/\s+/g, '')}-${seccionPrefix}`;
        const room = document.getElementById('editSubjRoom').value.trim();
        const teacher = document.getElementById('editSubjTeacher').value.trim();
        const color = document.getElementById('editSubjColor').value || '#00f0ff';

        const slots = [];
        const rows = document.querySelectorAll('.slot-builder-row');
        rows.forEach(r => {
            const day = parseInt(r.querySelector('.slot-day').value, 10);
            const startBlock = parseInt(r.querySelector('.slot-block').value, 10);
            const span = parseInt(r.querySelector('.slot-span').value, 10);
            slots.push({ day, startBlock, span });
        });

        const subjectData = {
            id: _editingSubjectId || DB.generateId(),
            name,
            shortName,
            code,
            room,
            teacher,
            color,
            slots
        };

        try {
            await DB.saveOne('subjects', subjectData);
            closeSubjectModal(null, true);
            renderAdminSubjects();
            Notify.toast('Materia guardada y sincronizada', 'success');

            if (typeof Schedule !== 'undefined') {
                Schedule.init();
            }
            if (typeof App !== 'undefined') {
                App.renderDashboard();
            }
        } catch (e) {
            Notify.toast('Error al guardar materia en base de datos: ' + e.message, 'error');
        }
    }

    async function deleteSubject(subjectId) {
        if (!confirm('¿Estás seguro de eliminar esta asignatura del horario?')) return;
        try {
            await DB.removeOne('subjects', subjectId);
            renderAdminSubjects();
            Notify.toast('Materia eliminada', 'info');
            if (typeof Schedule !== 'undefined') Schedule.init();
            if (typeof App !== 'undefined') App.renderDashboard();
        } catch (e) {
            Notify.toast('Error eliminando materia: ' + e.message, 'error');
        }
    }

    /* ══════════════════════════════════════════════════════════
       TAB 2: ACTIVIDADES GLOBALES
    ═══════════════════════════════════════════════════════════ */
    function renderAdminActivities() {
        const container = document.getElementById('adminActivitiesList');
        if (!container) return;

        const acts = DB.get('activities') || [];
        const subjects = DB.get('subjects') || [];

        if (acts.length === 0) {
            container.innerHTML = '<p class="empty-msg" style="padding:20px;text-align:center;">No hay actividades registradas</p>';
            return;
        }

        acts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        container.innerHTML = acts.map(a => {
            const subj = subjects.find(s => s.id === a.subjectId);
            const subjName = subj ? subj.name : 'Evento Especial';
            const subjColor = subj ? subj.color : 'var(--green)';

            return `
            <div class="admin-card-row">
                <div class="admin-subj-info">
                    <span class="admin-color-square" style="background:${subjColor}"></span>
                    <div style="flex:1;min-width:0;">
                        <div class="admin-subj-title">${a.title}</div>
                        <div class="admin-subj-meta">
                            <span style="color:${subjColor};font-weight:600;">${subjName}</span>
                            <span>Fecha: <b>${a.date || 'Sin fecha'}</b> ${a.time ? `a las ${a.time}` : ''}</span>
                            ${a.corte ? `<span>Corte <b>${a.corte}</b></span>` : ''}
                            ${a.weight ? `<span>Ponderación: <b>${a.weight}%</b></span>` : ''}
                            <span class="tl-priority-badge priority-${a.priority || 'medium'}" style="font-size:0.58rem;padding:1px 5px;">${(a.priority || 'media').toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                <div class="admin-row-btns">
                    <button class="btn-ghost btn-sm" onclick="Activities.openModal('${a.id}')" title="Editar">Editar</button>
                    <button class="btn-ghost btn-sm" onclick="Activities.shareActivityWhatsApp('${a.id}')" title="Compartir en WhatsApp">WhatsApp</button>
                    <button class="btn-ghost btn-sm" onclick="Notify.shareActivityTelegram('${a.id}')" title="Notificar por Telegram">Telegram</button>
                    <button class="btn-ghost btn-sm text-danger" onclick="Activities.remove('${a.id}')" title="Eliminar">Eliminar</button>
                </div>
            </div>`;
        }).join('');
    }

    async function deleteActivity(id) {
        if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;
        try {
            await DB.removeOne('activities', id);
            renderAdminActivities();
            Notify.toast('Actividad eliminada', 'info');
        } catch (e) {
            Notify.toast('Error eliminando actividad: ' + e.message, 'error');
        }
    }

    function shareActivityWhatsApp(id) {
        if (typeof Activities !== 'undefined') Activities.shareActivityWhatsApp(id);
    }

    /* ══════════════════════════════════════════════════════════
       TAB 3: CONFIGURACIÓN SECCIÓN
    ═══════════════════════════════════════════════════════════ */
    function renderSectionSettings() {
        const s = DB.getSettings();
        document.getElementById('setCarrera').value  = s.carrera || 'INGENIERÍA DE SISTEMAS';
        document.getElementById('setSemestre').value = s.semestre || 'VIII';
        document.getElementById('setSeccion').value  = s.seccion || '08S-2623-D1';
        document.getElementById('setPeriodo').value  = s.periodo || '2026-I (Diurno)';
    }

    async function saveSectionSettings() {
        const carrera  = document.getElementById('setCarrera').value.trim();
        const semestre = document.getElementById('setSemestre').value.trim();
        const seccion  = document.getElementById('setSeccion').value.trim();
        const periodo  = document.getElementById('setPeriodo').value.trim();

        if (!carrera || !seccion) {
            return Notify.toast('La carrera y la sección son obligatorias', 'error');
        }

        const newSettings = { carrera, semestre, seccion, periodo };
        try {
            await DB.saveSettings(newSettings);
            Notify.toast('Datos de sección actualizados con éxito', 'success');
            if (typeof App !== 'undefined' && App.loadSettings) App.loadSettings();
        } catch (e) {
            Notify.toast('Error actualizando sección: ' + e.message, 'error');
        }
    }

    function changePin() {
        const oldPin = document.getElementById('inputOldPin').value.trim();
        const newPin = document.getElementById('inputNewPin').value.trim();

        if (!DB.checkPin(oldPin)) {
            return Notify.toast('El PIN actual es incorrecto', 'error');
        }
        if (!newPin || newPin.length < 4) {
            return Notify.toast('El nuevo PIN debe tener al menos 4 dígitos', 'error');
        }

        DB.savePin(newPin);
        document.getElementById('inputOldPin').value = '';
        document.getElementById('inputNewPin').value = '';
        Notify.toast('PIN de seguridad actualizado con éxito', 'success');
    }

    /* ══════════════════════════════════════════════════════════
       TAB 4: SISTEMA & SUPABASE
    ═══════════════════════════════════════════════════════════ */
    function renderSystemConfig() {
        const cfg = DB.getSupabaseConfig() || {};
        const urlInput = document.getElementById('sbProjectUrl');
        const keyInput = document.getElementById('sbAnonKey');
        const statusSpan = document.getElementById('sbConnectionStatus');
        const accountDisplay = document.getElementById('sbAdminAccountDisplay');

        if (urlInput) urlInput.value = cfg.url || '';
        if (keyInput) keyInput.value = cfg.anonKey || '';

        if (statusSpan) {
            if (DB.isSupabase()) {
                statusSpan.innerHTML = '<span style="color:var(--green);font-weight:700;">[CONECTADO] Supabase PostgreSQL + Realtime Activo</span>';
            } else {
                statusSpan.innerHTML = '<span style="color:var(--orange);">Modo Local (localStorage)</span>';
            }
        }

        if (accountDisplay) {
            const adminUser = DB.getAdminUser();
            if (adminUser && adminUser.email) {
                accountDisplay.innerHTML = `Administrador Autenticado: <span class="mono" style="color:var(--cyan);">${adminUser.email}</span> (Sesión Permanente)`;
            } else if (DB.isAdminUnlocked()) {
                accountDisplay.innerHTML = 'Acceso de Administrador Activo (Modo Local / PIN)';
            } else {
                accountDisplay.innerHTML = '<span style="color:var(--text-3);">Sin sesión activa. Inicia sesión en el botón Admin para obtener permisos de escritura.</span>';
            }
        }

        // Telegram
        const tg = Notify.getTelegramConfig() || {};
        if (document.getElementById('tgBotToken')) document.getElementById('tgBotToken').value = tg.botToken || '';
        if (document.getElementById('tgChatId')) document.getElementById('tgChatId').value = tg.chatId || '';
    }

    async function saveSupabaseSettings() {
        const url = (document.getElementById('sbProjectUrl')?.value || '').trim();
        const anonKey = (document.getElementById('sbAnonKey')?.value || '').trim();

        if (!url || !anonKey) {
            DB.saveSupabaseConfig(null);
            Notify.toast('Credenciales de Supabase eliminadas. Funcionando en Modo Local.', 'info');
            updateModeBadge();
            renderSystemConfig();
            return;
        }

        DB.saveSupabaseConfig({ url, anonKey });
        Notify.toast('Conectando con Supabase...', 'info');

        try {
            await DB.init();
            updateModeBadge();
            renderSystemConfig();
            Notify.toast('Conexión con Supabase establecida con éxito', 'success');
        } catch (e) {
            Notify.toast('Error conectando con Supabase: ' + e.message, 'error');
        }
    }

    function saveTelegramSettings() {
        const botToken = document.getElementById('tgBotToken').value.trim();
        const chatId = document.getElementById('tgChatId').value.trim();
        Notify.saveTelegramConfig({ botToken, chatId, active: !!(botToken && chatId) });
        Notify.toast('Configuración de Telegram guardada', 'success');
    }

    function exportBackup() {
        const jsonStr = DB.exportData();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_gestor_xk_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Notify.toast('Copia de seguridad descargada', 'success');
    }

    function importBackup(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const ok = DB.importData(e.target.result);
            if (ok) {
                Notify.toast('Copia de seguridad restaurada con éxito', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                Notify.toast('Archivo JSON inválido o corrupto', 'error');
            }
        };
        reader.readAsText(file);
    }

    function factoryReset() {
        if (!confirm('¿Estás seguro de restablecer todos los datos al estado inicial?')) return;
        DB.clearAllData();
        Notify.toast('Datos restablecidos a valores iniciales', 'info');
        setTimeout(() => window.location.reload(), 800);
    }

    /* ── INICIALIZACIÓN ──────────────────────────────────────── */
    function init() {
        // Escuchar Enter en contraseña de Auth
        document.getElementById('adminAuthPassword')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitAuthLogin();
        });

        // Escuchar Enter en input de PIN
        document.getElementById('adminPinInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitPin();
        });

        // Trigger del FAB de Admin
        document.getElementById('btnOpenAdmin')?.addEventListener('click', () => {
            if (DB.isAdminUnlocked()) {
                openAdminPanel();
            } else {
                openPinModal();
            }
        });

        updateModeBadge();
    }

    /* ── API PÚBLICA ─────────────────────────────────────────── */
    return {
        init,
        openPinModal,
        closePinModal,
        switchAuthMode,
        submitAuthLogin,
        submitMagicLink,
        keypadPress,
        keypadClear,
        submitPin,
        lockSession,
        openAdminPanel,
        closeAdminPanel,
        switchTab,
        updateModeBadge,
        // Tab 1
        renderAdminSubjects,
        openNewSubject,
        editSubject,
        closeSubjectModal,
        addSlotRow,
        saveSubject,
        deleteSubject,
        // Tab 2
        renderAdminActivities,
        deleteActivity,
        shareActivityWhatsApp,
        // Tab 3
        renderSectionSettings,
        saveSectionSettings,
        changePin,
        // Tab 4
        renderSystemConfig,
        saveSupabaseSettings,
        saveTelegramSettings,
        exportBackup,
        importBackup,
        factoryReset
    };

})();

window.Admin = Admin;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Admin.init());
} else {
    Admin.init();
}
