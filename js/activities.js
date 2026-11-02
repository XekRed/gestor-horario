/* =============================================================
   activities.js — Módulo de Evaluaciones, Eventos Especiales,
                  Línea de Tiempo (Roadmap) y Calendario Mensual
   ============================================================= */

const Activities = (() => {

    /* ── ESTADO INTERNO ──────────────────────────────────────── */
    let _activeModality = 'subject'; // 'subject' | 'special'
    let _editingActivityId = null;
    let _selectedCalDate = null;

    /* ── CONSTANTES Y LABELS ─────────────────────────────────── */
    const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const MONTHS_ES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const PRIORITIES = {
        high:   { label: 'Alta Prioridad', badgeClass: 'priority-high', icon: '[ALTA]' },
        medium: { label: 'Media Prioridad', badgeClass: 'priority-medium', icon: '[MEDIA]' },
        low:    { label: 'Baja Prioridad', badgeClass: 'priority-low', icon: '[BAJA]' },
    };

    const FORMATS = {
        pdf:       { label: 'Informe PDF / Doc', icon: '[PDF]' },
        github:    { label: 'Código / Repositorio GitHub', icon: '[GIT]' },
        slides:    { label: 'Diapositivas / Exposición', icon: '[SLIDES]' },
        in_person: { label: 'Físico / Presencial en Aula', icon: '[AULA]' },
        link:      { label: 'Enlace Web / Drive', icon: '[LINK]' },
        other:     { label: 'Otro Formato', icon: '[OTRO]' },
    };

    const TYPE_LABELS = {
        exam: 'Examen / Evaluación',
        assignment: 'Tarea / Trabajo',
        project: 'Proyecto',
        quiz: 'Quiz',
        event: 'Evento Especial'
    };

    /* ══════════════════════════════════════════════════════════
       DATOS SEMILLA — MUESTRA REALISTA INICIAL
    ═══════════════════════════════════════════════════════════ */
    function seedSampleActivitiesIfEmpty() {
        if (typeof DB === 'undefined') return;
        const current = DB.get('activities');
        if (current && current.length > 0) return;

        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();

        function makeDate(dayOffset) {
            const dt = new Date(y, m, d + dayOffset);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }

        const seeds = [
            {
                id: 'seed-act-1',
                modality: 'subject',
                subjectId: 'auditoria',
                title: 'Parcial I: Normas y Estándares COBIT / ITIL',
                type: 'exam',
                corte: '1',
                weight: 20,
                priority: 'high',
                date: makeDate(3),
                time: '10:00',
                guidelines: {
                    mode: 'individual',
                    groupMax: null,
                    deliveryFormat: 'pdf',
                    resourceLink: 'https://drive.google.com/',
                    instructions: 'Evaluación teórico-práctica individual. Incluye análisis de caso de estudio en empresa financiera y matriz de riesgos de auditoría según estándar COBIT 2019.'
                },
                createdAt: new Date().toISOString()
            },
            {
                id: 'seed-act-2',
                modality: 'subject',
                subjectId: 'teleprocesos',
                title: 'Laboratorio Práctico: Simulación de Topología WAN en Packet Tracer',
                type: 'project',
                corte: '1',
                weight: 25,
                priority: 'high',
                date: makeDate(7),
                time: '13:00',
                guidelines: {
                    mode: 'group',
                    groupMax: 3,
                    deliveryFormat: 'github',
                    resourceLink: 'https://github.com/',
                    instructions: 'Diseño e interconexión de red empresarial con enrutamiento OSPFv2, VLANs y NAT dinámico. Subir archivo .pkt comprimido junto con informe explicativo de la tabla de enrutamiento.'
                },
                createdAt: new Date().toISOString()
            },
            {
                id: 'seed-act-3',
                modality: 'subject',
                subjectId: 'teoria',
                title: 'Taller de Árboles de Decisión y Criterio de Bayes',
                type: 'assignment',
                corte: '1',
                weight: 15,
                priority: 'medium',
                date: makeDate(12),
                time: '08:30',
                guidelines: {
                    mode: 'group',
                    groupMax: 2,
                    deliveryFormat: 'pdf',
                    resourceLink: '',
                    instructions: 'Resolución detallada de la guía de 5 ejercicios prácticos bajo condiciones de incertidumbre y riesgo. Justificar el valor esperado de la información perfecta (VEIP).'
                },
                createdAt: new Date().toISOString()
            },
            {
                id: 'seed-act-4',
                modality: 'special',
                subjectId: null,
                title: 'Acto Cívico e Izada de Bandera Universitaria',
                type: 'event',
                corte: null,
                weight: null,
                priority: 'low',
                date: makeDate(1),
                time: '07:00',
                guidelines: {
                    mode: 'individual',
                    groupMax: null,
                    deliveryFormat: 'in_person',
                    resourceLink: '',
                    instructions: 'Asistencia obligatoria con uniforme reglamentario o vestimenta formal en el patio central de la universidad para el acto cívico de inicio de mes.'
                },
                createdAt: new Date().toISOString()
            },
            {
                id: 'seed-act-5',
                modality: 'special',
                subjectId: null,
                title: 'Entrega de Informe Final de Servicio Comunitario (Fase II)',
                type: 'assignment',
                corte: null,
                weight: null,
                priority: 'medium',
                date: makeDate(16),
                time: '23:59',
                guidelines: {
                    mode: 'group',
                    groupMax: 4,
                    deliveryFormat: 'pdf',
                    resourceLink: 'https://drive.google.com/',
                    instructions: 'Subir acta de culminación firmada por la comunidad, registro de 120 horas cumplidas, memoria fotográfica y reporte de impacto del software educativo implementado.'
                },
                createdAt: new Date().toISOString()
            }
        ];

        DB.save('activities', seeds);
    }

    /* ══════════════════════════════════════════════════════════
       GESTIÓN DEL MODAL DE CREACIÓN / EDICIÓN
    ═══════════════════════════════════════════════════════════ */
    function openModal(activityId = null, defaultSubjectId = null) {
        // SEGURIDAD: Solo el Administrador puede crear o editar
        if (typeof DB !== 'undefined' && !DB.isAdminUnlocked()) {
            if (typeof Notify !== 'undefined') {
                Notify.toast('Ingresa el PIN de Administrador (1234) para programar actividades', 'info');
            }
            if (typeof Admin !== 'undefined') {
                Admin.openPinModal(() => {
                    openModal(activityId, defaultSubjectId);
                });
            }
            return;
        }

        _editingActivityId = activityId;
        populateSubjectSelect();

        const titleEl = document.getElementById('actModalHeaderTitle');
        const editIdEl = document.getElementById('actEditId');
        if (editIdEl) editIdEl.value = activityId || '';

        if (activityId) {
            titleEl.textContent = 'Editar Actividad / Evento';
            loadActivityIntoForm(activityId);
        } else {
            titleEl.textContent = 'Nueva Actividad / Evento';
            resetForm(defaultSubjectId);
        }

        const modal = document.getElementById('modalActivity');
        if (modal) modal.classList.add('open');
    }

    function closeModal(event, force = false) {
        if (force || (event && event.target.id === 'modalActivity')) {
            document.getElementById('modalActivity')?.classList.remove('open');
            _editingActivityId = null;
        }
    }

    function setModality(mode) {
        _activeModality = mode;
        const btnSubj = document.getElementById('btnModeSubject');
        const btnSpec = document.getElementById('btnModeSpecial');
        const fieldsA = document.getElementById('fieldsModalidadA');
        const chipsPreset = document.getElementById('quickTitleChips');

        if (mode === 'subject') {
            btnSubj?.classList.add('active');
            btnSpec?.classList.remove('active');
            if (fieldsA) fieldsA.style.display = 'block';
            if (chipsPreset) chipsPreset.style.display = 'flex';
            document.getElementById('actType').value = 'exam';
        } else {
            btnSpec?.classList.add('active');
            btnSubj?.classList.remove('active');
            if (fieldsA) fieldsA.style.display = 'none';
            if (chipsPreset) chipsPreset.style.display = 'none';
            document.getElementById('actType').value = 'event';
        }
    }

    function populateSubjectSelect() {
        const sel = document.getElementById('actSubject');
        if (!sel) return;
        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : (DB ? DB.get('subjects') : []);
        
        sel.innerHTML = '<option value="">— Selecciona una Materia —</option>' +
            subjects.map(s => `<option value="${s.id}">${s.name} ${s.shortName ? `(${s.shortName})` : ''}</option>`).join('');

        // Populate also the timeline filter select
        const tlSel = document.getElementById('tlFilterMateria');
        if (tlSel && tlSel.options.length <= 1) {
            tlSel.innerHTML = '<option value="all">Todas las materias</option>' +
                subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    }

    function onSubjectChange() {
        const subjId = document.getElementById('actSubject').value;
        const suggestionsWrap = document.getElementById('actSlotSuggestionsWrap');
        const suggestionsList = document.getElementById('actSlotSuggestions');

        if (!subjId) {
            if (suggestionsWrap) suggestionsWrap.style.display = 'none';
            updateWeightAlert();
            return;
        }

        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const subj = subjects.find(s => s.id === subjId);

        if (!subj || !subj.slots || subj.slots.length === 0) {
            if (suggestionsWrap) suggestionsWrap.style.display = 'none';
            updateWeightAlert();
            return;
        }

        const allBlocks = typeof Schedule !== 'undefined' ? Schedule.ALL_BLOCKS : [];
        const chipsHtml = subj.slots.map(slot => {
            const dayName = DAYS_ES[slot.day + 1] || 'Día';
            const startBlk = allBlocks[slot.startBlock] || { start: '08:00' };
            const endBlk = allBlocks[slot.startBlock + slot.span - 1] || startBlk;
            const timeLabel = `${startBlk.start} - ${endBlk.end}`;

            // Calcular próxima fecha para ese día de la semana
            const targetDay = slot.day + 1; // Lun=1, Mar=2...
            const now = new Date();
            const currentDay = now.getDay();
            let diffDays = targetDay - currentDay;
            if (diffDays <= 0) diffDays += 7; // Próxima semana
            const nextDate = new Date(now.setDate(now.getDate() + diffDays));
            const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;

            return `<button type="button" class="slot-chip" onclick="Activities.applySlotSuggestion('${dateStr}', '${startBlk.start}')">
                ${dayName} (${timeLabel}) ${subj.room ? `· ${subj.room}` : ''}
            </button>`;
        }).join('');

        suggestionsList.innerHTML = chipsHtml;
        suggestionsWrap.style.display = 'block';

        updateWeightAlert();
    }

    function applySlotSuggestion(dateStr, timeStr) {
        document.getElementById('actDate').value = dateStr;
        document.getElementById('actTime').value = timeStr;
        if (typeof Notify !== 'undefined') {
            Notify.toast(`Fecha (${dateStr}) y hora (${timeStr}) aplicadas desde el horario`, 'info');
        }
    }

    function setPresetTitle(title) {
        const input = document.getElementById('actTitle');
        if (input) {
            input.value = title;
            input.focus();
        }
    }

    function toggleGroupField() {
        const mode = document.getElementById('actMode').value;
        const wrap = document.getElementById('actGroupMaxWrap');
        if (wrap) wrap.style.display = mode === 'group' ? 'block' : 'none';
    }

    function updateWeightAlert() {
        const notice = document.getElementById('actWeightNotice');
        if (!notice || _activeModality !== 'subject') {
            if (notice) notice.innerHTML = '';
            return;
        }

        const subjId = document.getElementById('actSubject')?.value;
        const corte = document.getElementById('actCorte')?.value || '1';
        const inputWeight = parseFloat(document.getElementById('actWeight')?.value) || 0;
        if (!subjId) { notice.innerHTML = ''; return; }

        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const existingSubjectWeights = allActs
            .filter(a => a.subjectId === subjId && a.id !== _editingActivityId)
            .reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0);

        const existingCorteWeights = allActs
            .filter(a => a.subjectId === subjId && String(a.corte) === String(corte) && a.id !== _editingActivityId)
            .reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0);

        const newTotal = existingSubjectWeights + inputWeight;
        const newCorteTotal = existingCorteWeights + inputWeight;

        if (newTotal > 100 || newCorteTotal > 25) {
            notice.className = 'weight-notice-text extra';
            notice.innerHTML = `[ACTIVIDAD EXTRA] Corte ${corte}: <b>${newCorteTotal}%</b> (Nominal: 25%) · Total Asignatura: <b>${newTotal}%</b>. Las actividades extra están permitidas; el acumulado final por estudiante se limitará al 100%.`;
        } else if (newTotal === 100) {
            notice.className = 'weight-notice-text safe';
            notice.innerHTML = `[COMPLETA] Corte ${corte}: <b>${newCorteTotal}% / 25%</b> · Total Asignatura: <b>100%</b> (Asignatura completa)`;
        } else {
            notice.className = 'weight-notice-text warning';
            notice.innerHTML = `Corte ${corte}: <b>${newCorteTotal}% / 25%</b> · Total Asignatura: <b>${newTotal}% / 100%</b> (Disponible: ${Math.max(0, 100 - newTotal)}%)`;
        }
    }

    function resetForm(defaultSubjectId = null) {
        setModality('subject');
        document.getElementById('actTitle').value = '';

        // Auto-seleccionar materia si defaultSubjectId o la primera disponible
        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const subjSel = document.getElementById('actSubject');
        if (defaultSubjectId) {
            subjSel.value = defaultSubjectId;
        } else if (subjects.length > 0) {
            subjSel.value = subjects[0].id;
        } else {
            subjSel.value = '';
        }

        document.getElementById('actCorte').value = '1';
        document.getElementById('actWeight').value = '20';
        document.getElementById('actPriority').value = 'medium';
        document.getElementById('actType').value = 'exam';

        // Prellenar fecha con HOY por defecto
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        document.getElementById('actDate').value = `${yyyy}-${mm}-${dd}`;
        document.getElementById('actTime').value = '08:00';

        document.getElementById('actMode').value = 'individual';
        document.getElementById('actGroupMax').value = '';
        document.getElementById('actFormat').value = 'pdf';
        document.getElementById('actResourceLink').value = '';
        document.getElementById('actDesc').value = '';

        toggleGroupField();
        onSubjectChange();
    }

    function loadActivityIntoForm(id) {
        const a = (typeof DB !== 'undefined' ? DB.get('activities') : []).find(act => act.id === id);
        if (!a) return;

        setModality(a.modality || (a.subjectId ? 'subject' : 'special'));
        document.getElementById('actTitle').value = a.title || '';
        document.getElementById('actSubject').value = a.subjectId || '';
        document.getElementById('actCorte').value = a.corte || '1';
        document.getElementById('actWeight').value = a.weight || '';
        document.getElementById('actPriority').value = a.priority || 'medium';
        document.getElementById('actType').value = a.type || 'exam';
        document.getElementById('actDate').value = a.date || '';
        document.getElementById('actTime').value = a.time || '';

        const g = a.guidelines || {};
        document.getElementById('actMode').value = g.mode || 'individual';
        document.getElementById('actGroupMax').value = g.groupMax || '';
        document.getElementById('actFormat').value = g.deliveryFormat || 'pdf';
        document.getElementById('actResourceLink').value = g.resourceLink || '';
        document.getElementById('actDesc').value = g.instructions || a.desc || '';

        toggleGroupField();
        onSubjectChange();
    }

    async function saveFromForm(notifyChannel = null) {
        // SEGURIDAD: Solo el Administrador puede guardar
        if (typeof DB !== 'undefined' && !DB.isAdminUnlocked()) {
            if (typeof Notify !== 'undefined') {
                Notify.toast('Inicia sesión como Administrador para confirmar y guardar', 'warning');
            }
            if (typeof Admin !== 'undefined') {
                Admin.openPinModal(() => {
                    saveFromForm(notifyChannel);
                });
            }
            return;
        }

        const title = document.getElementById('actTitle').value.trim();
        const date = document.getElementById('actDate').value;
        const time = document.getElementById('actTime').value;
        const priority = document.getElementById('actPriority').value;
        const type = document.getElementById('actType').value;
        const mode = document.getElementById('actMode').value;
        const groupMax = mode === 'group' ? (parseInt(document.getElementById('actGroupMax').value, 10) || null) : null;
        const format = document.getElementById('actFormat').value;
        const resourceLink = document.getElementById('actResourceLink').value.trim();
        const instructions = document.getElementById('actDesc').value.trim();

        if (!title) return Notify.toast('El título es obligatorio', 'error');
        if (!date) return Notify.toast('La fecha límite es obligatoria', 'error');

        let subjectId = null;
        let corte = null;
        let weight = null;

        if (_activeModality === 'subject') {
            subjectId = document.getElementById('actSubject').value;
            corte = document.getElementById('actCorte').value;
            weight = parseFloat(document.getElementById('actWeight').value) || 0;

            if (!subjectId) return Notify.toast('Selecciona una materia para la evaluación', 'error');
            if (weight <= 0) return Notify.toast('Indica una ponderación válida (% de la nota)', 'error');
        }

        const activityData = {
            id: _editingActivityId || DB.generateId(),
            modality: _activeModality,
            subjectId: subjectId,
            title: title,
            type: type,
            corte: corte,
            weight: weight,
            priority: priority,
            date: date,
            time: time,
            guidelines: {
                mode: mode,
                groupMax: groupMax,
                deliveryFormat: format,
                resourceLink: resourceLink,
                instructions: instructions
            },
            updatedAt: new Date().toISOString()
        };

        try {
            await DB.saveOne('activities', activityData);
            closeModal(null, true);

            Notify.toast('Actividad guardada y sincronizada', 'success');

            // Difusión inmediata si fue solicitada
            if (notifyChannel === 'whatsapp') {
                setTimeout(() => Notify.shareActivityWhatsApp(activityData.id), 300);
            } else if (notifyChannel === 'telegram') {
                setTimeout(() => Notify.shareActivityTelegram(activityData.id), 300);
            }

            // Re-render
            renderTimeline();
            renderCalendar();
            if (typeof App !== 'undefined') App.renderDashboard();
            if (typeof Admin !== 'undefined') Admin.renderAdminActivities();
        } catch (err) {
            console.error('[Activities] Error al guardar actividad:', err);
            Notify.toast('Error al guardar: ' + (err.message || 'Verifica permisos de Administrador'), 'error');
        }
    }

    async function remove(id) {
        if (typeof DB !== 'undefined' && !DB.isAdminUnlocked()) {
            return Notify.toast('Solo el Administrador puede eliminar actividades', 'warning');
        }
        if (!confirm('¿Eliminar esta actividad para toda la sección?')) return;
        try {
            await DB.removeOne('activities', id);
            Notify.toast('Actividad eliminada', 'info');
            renderTimeline();
            renderCalendar();
            if (typeof App !== 'undefined') App.renderDashboard();
            if (typeof Admin !== 'undefined') Admin.renderAdminActivities();
        } catch (err) {
            console.error('[Activities] Error al eliminar actividad:', err);
            Notify.toast('Error al eliminar: ' + (err.message || 'Verifica permisos'), 'error');
        }
    }

    /* ══════════════════════════════════════════════════════════
       MODAL DE DETALLE Y DIRECTRICES (ESTUDIANTE / ADMIN)
    ═══════════════════════════════════════════════════════════ */
    function openDetailModal(id) {
        const a = (typeof DB !== 'undefined' ? DB.get('activities') : []).find(act => act.id === id);
        if (!a) return;

        // Marcar como vista por el estudiante
        if (typeof Student !== 'undefined') {
            Student.markActivitySeen(a.id);
        }

        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const subj = subjects.find(s => s.id === a.subjectId);
        const g = a.guidelines || {};
        const priorityObj = PRIORITIES[a.priority] || PRIORITIES.medium;
        const formatObj = FORMATS[g.deliveryFormat] || FORMATS.pdf;
        const isDelivered = typeof Student !== 'undefined' ? Student.isDelivered(a.id) : false;
        const isAdmin = typeof DB !== 'undefined' && DB.isAdminUnlocked();

        // Cuenta regresiva
        const daysLeft = getDaysLeft(a.date);
        let daysBadge = '';
        if (daysLeft !== null) {
            if (daysLeft < 0) daysBadge = '<span class="act-urgency urgency-red">Venció hace ' + Math.abs(daysLeft) + 'd</span>';
            else if (daysLeft === 0) daysBadge = '<span class="act-urgency urgency-red">¡VENCE HOY!</span>';
            else if (daysLeft <= 2) daysBadge = `<span class="act-urgency urgency-orange">Faltan ${daysLeft} día(s)</span>`;
            else daysBadge = `<span class="act-urgency urgency-green">Faltan ${daysLeft} días</span>`;
        }

        const dot = document.getElementById('detailColorDot');
        if (dot) dot.style.background = subj ? subj.color : (a.modality === 'special' ? 'var(--green)' : 'var(--cyan)');

        const subTitle = document.getElementById('detailSubjectName');
        if (subTitle) subTitle.textContent = subj ? subj.name : 'Evento Especial / Fuera de Materia';

        const body = document.getElementById('detailModalBody');
        body.innerHTML = `
            <div style="margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                    <span class="tl-priority-badge ${priorityObj.badgeClass}">${priorityObj.icon} ${priorityObj.label}</span>
                    <span class="tl-tag type-${a.type}">${TYPE_LABELS[a.type] || a.type}</span>
                    ${a.corte ? `<span class="tl-tag" style="color:var(--text-2);border-color:var(--border)">Corte ${a.corte}</span>` : ''}
                    ${a.weight ? `<span class="tl-tag" style="color:var(--yellow);border-color:rgba(249,202,36,0.3)">• Ponderación: <b>${a.weight}%</b></span>` : ''}
                </div>
                <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-1);margin-top:6px;">${a.title}</h2>
            </div>

            <div class="detail-meta-grid">
                <div class="detail-meta-box">
                    <div class="detail-meta-label">Fecha y Hora Límite</div>
                    <div class="detail-meta-val mono">${formatDateES(a.date)} ${a.time ? `· ${a.time}` : ''}</div>
                    <div style="margin-top:4px;">${daysBadge}</div>
                </div>

                <div class="detail-meta-box">
                    <div class="detail-meta-label">Modalidad y Formato</div>
                    <div class="detail-meta-val">
                        ${g.mode === 'group' ? `Grupal (Máx. ${g.groupMax || 'N'} integrantes)` : 'Individual'}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-2);margin-top:4px;">
                        ${formatObj.icon} Formato: <b>${formatObj.label}</b>
                    </div>
                </div>
            </div>

            <div class="detail-guidelines-box">
                <div class="detail-meta-label" style="color:var(--cyan);">Pautas del Profesor y Criterios</div>
                <div style="font-size:0.84rem;color:var(--text-1);line-height:1.5;white-space:pre-wrap;margin-top:6px;">${g.instructions || a.desc || 'No se registraron pautas adicionales.'}</div>
                ${g.resourceLink ? `
                    <div style="margin-top:12px;">
                        <a href="${g.resourceLink}" target="_blank" rel="noopener noreferrer" class="resource-link-btn">
                            Abrir Enunciado / Material en Drive
                        </a>
                    </div>
                ` : ''}
            </div>

            <div style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <button class="btn-ghost" onclick="Activities.toggleDeliveredFromDetail('${a.id}')" style="font-weight:700;">
                    ${isDelivered ? 'Marcar como Pendiente' : 'Marcar como Entregado'}
                </button>

                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-ghost btn-sm" onclick="Activities.shareActivityWhatsApp('${a.id}')" title="Compartir en WhatsApp">
                        WhatsApp
                    </button>
                    <button class="btn-ghost btn-sm" onclick="Notify.shareActivityTelegram('${a.id}')" title="Notificar por Telegram">
                        Telegram
                    </button>
                    ${isAdmin ? `
                        <button class="btn-ghost btn-sm" onclick="Activities.closeDetailModal(null,true); Activities.openModal('${a.id}')">
                            Editar
                        </button>
                        <button class="btn-ghost btn-sm text-danger" onclick="Activities.closeDetailModal(null,true); Activities.remove('${a.id}')">
                            Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        document.getElementById('modalActivityDetail')?.classList.add('open');
    }

    function closeDetailModal(event, force = false) {
        if (force || (event && event.target.id === 'modalActivityDetail')) {
            document.getElementById('modalActivityDetail')?.classList.remove('open');
        }
    }

    function toggleDeliveredFromDetail(id) {
        if (typeof Student !== 'undefined') {
            const isNowDone = Student.toggleDelivered(id);
            Notify.toast(isNowDone ? 'Marcada como entregada' : 'Marcada como pendiente', 'info');
            openDetailModal(id);
            renderTimeline();
            renderCalendar();
        }
    }

    function shareActivityWhatsApp(id) {
        const a = (typeof DB !== 'undefined' ? DB.get('activities') : []).find(act => act.id === id);
        if (!a) return;
        const subj = typeof Schedule !== 'undefined' ? Schedule.getSubjectById(a.subjectId) : null;
        const g = a.guidelines || {};
        const priorityObj = PRIORITIES[a.priority] || PRIORITIES.medium;
        const settings = typeof DB !== 'undefined' ? DB.getSettings() : { carrera: 'INGENIERÍA DE SISTEMAS', seccion: '08S-2623-D1' };

        let msg = `*— AVISO DE EVALUACIÓN / ACTIVIDAD —*\n`;
        msg += `*${settings.carrera}* | Secc. *${settings.seccion}*\n\n`;
        msg += `*${a.title}*\n`;
        if (subj) msg += `• *Materia:* ${subj.name} ${subj.room ? `(Aula: ${subj.room})` : ''}\n`;
        msg += `• *Fecha límite:* ${formatDateES(a.date)} ${a.time ? `a las ${a.time}` : ''}\n`;
        if (a.corte) msg += `• *Corte:* ${a.corte}° Corte | • *Ponderación:* ${a.weight || 0}%\n`;
        msg += `• *Prioridad:* ${priorityObj.label}\n`;
        msg += `• *Modalidad:* ${g.mode === 'group' ? `Grupal (Máx. ${g.groupMax || 'N'} personas)` : 'Individual'}\n`;
        if (g.instructions || a.desc) msg += `\n• *Directrices:* ${g.instructions || a.desc}\n`;
        if (g.resourceLink) msg += `• *Material de Apoyo:* ${g.resourceLink}\n`;
        msg += `\n_Gestor Académico XK_`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    }

    /* ══════════════════════════════════════════════════════════
       RENDERIZADO: LÍNEA DE TIEMPO (ROADMAP CRONOLÓGICO)
    ═══════════════════════════════════════════════════════════ */
    function renderTimeline() {
        const wrap = document.getElementById('timelineWrap');
        if (!wrap) return;

        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const isAdmin = typeof DB !== 'undefined' && DB.isAdminUnlocked();
        const enrolledIds = (typeof Student !== 'undefined') ? Student.getEnrolledSubjectIds() : [];

        // Filtros
        const subjFilter = document.getElementById('tlFilterMateria')?.value || 'all';
        const corteFilter = document.getElementById('tlFilterCorte')?.value || 'all';
        const priorityFilter = document.getElementById('tlFilterPriority')?.value || 'all';
        const modalidadFilter = document.getElementById('tlFilterModalidad')?.value || 'all';

        let filtered = activities.filter(a => {
            if (!isAdmin && a.modality !== 'special' && a.subjectId && !enrolledIds.includes(a.subjectId)) return false;
            if (subjFilter !== 'all' && a.subjectId !== subjFilter) return false;
            if (corteFilter !== 'all' && String(a.corte) !== String(corteFilter)) return false;
            if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false;
            if (modalidadFilter === 'evaluations' && (a.modality === 'special' || !a.subjectId)) return false;
            if (modalidadFilter === 'events' && a.modality !== 'special' && a.subjectId) return false;
            return true;
        });

        // Ordenar cronológicamente
        filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        if (filtered.length === 0) {
            wrap.innerHTML = '<p class="empty-msg" style="text-align:center;padding:50px 20px;">Sin actividades registradas que coincidan con los filtros seleccionados.</p>';
            return;
        }

        let html = '';
        let lastMonth = '';

        filtered.forEach(a => {
            if (!a.date) return;
            const [y, m, d] = a.date.split('-').map(Number);
            const monthKey = `${MONTHS_ES[m - 1]} ${y}`;

            if (monthKey !== lastMonth) {
                html += `<div class="tl-month-sep">${monthKey}</div>`;
                lastMonth = monthKey;
            }

            const subj = subjects.find(s => s.id === a.subjectId);
            const daysLeft = getDaysLeft(a.date);
            const urgency = getUrgencyClass(daysLeft);
            const isDone = typeof Student !== 'undefined' ? Student.isDelivered(a.id) : false;
            const isNew = typeof Student !== 'undefined' && Student.isActivityNew(a);
            const priorityObj = PRIORITIES[a.priority] || PRIORITIES.medium;
            const g = a.guidelines || {};
            const formatObj = FORMATS[g.deliveryFormat] || FORMATS.pdf;

            let countdownText = 'Pasó';
            if (daysLeft !== null) {
                if (daysLeft === 0) countdownText = '¡HOY!';
                else if (daysLeft > 0) countdownText = `${daysLeft}d restantes`;
                else countdownText = `Pasó hace ${Math.abs(daysLeft)}d`;
            }

            html += `
            <div class="tl-item tl-item-priority-${a.priority || 'medium'} ${isDone ? 'tl-item-done' : ''}">
                <div class="tl-card tl-card-clickable" style="${isDone ? 'opacity:0.75;border-color:rgba(0,229,160,0.3);' : ''}">
                    <div class="tl-card-header">
                        <span class="tl-title" onclick="Activities.openDetailModal('${a.id}')">
                            ${isDone ? `<span style="text-decoration:line-through;color:var(--text-3);">${a.title}</span>` : a.title}
                            ${isNew ? '<span class="badge-new-pulse">¡NUEVA!</span>' : ''}
                        </span>
                        <span class="tl-date">${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}${a.time ? ' ' + a.time : ''}</span>
                    </div>

                    <div class="tl-meta">
                        <span class="tl-priority-badge ${priorityObj.badgeClass}">${priorityObj.icon} ${priorityObj.label}</span>
                        ${subj ? `<span style="font-size:0.68rem;color:${subj.color};font-weight:700">${subj.name}</span>` : '<span style="font-size:0.68rem;color:var(--green);font-weight:700">Evento Especial</span>'}
                        ${a.corte ? `<span class="tl-tag" style="color:var(--text-3);border-color:var(--border)">Corte ${a.corte}</span>` : ''}
                        ${a.weight ? `<span class="tl-tag" style="color:var(--yellow);border-color:rgba(249,202,36,0.3)">[POND.] ${a.weight}%</span>` : ''}
                        ${daysLeft !== null ? `<span class="act-urgency ${urgency}">${countdownText}</span>` : ''}
                    </div>

                    <div class="tl-guidelines-snippet">
                        <span class="tl-chip">${g.mode === 'group' ? `Grupal (Máx ${g.groupMax || 'N'})` : 'Individual'}</span>
                        <span class="tl-chip">${formatObj.icon} ${formatObj.label}</span>
                        ${g.resourceLink ? `<span class="tl-chip" style="color:var(--cyan)">Material Adjunto</span>` : ''}
                    </div>

                    ${(g.instructions || a.desc) ? `<div class="tl-desc">${g.instructions || a.desc}</div>` : ''}

                    <div class="tl-bottom-bar">
                        <button class="btn-ghost btn-sm" onclick="Activities.openDetailModal('${a.id}')" style="padding:4px 10px;font-size:0.72rem;">
                            Ver Pautas Completas
                        </button>

                        <div style="display:flex;gap:6px;align-items:center;">
                            <button class="btn-ghost btn-sm" onclick="Activities.toggleDelivered('${a.id}')" style="padding:4px 10px;font-size:0.72rem;">
                                ${isDone ? '[ENTREGADO]' : '[PENDIENTE]'}
                            </button>
                            ${isAdmin ? `
                                <button class="btn-ghost btn-sm" onclick="Activities.openModal('${a.id}')" title="Editar">Editar</button>
                                <button class="btn-ghost btn-sm text-danger" onclick="Activities.remove('${a.id}')" title="Eliminar">Eliminar</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        });

        wrap.innerHTML = html;
    }

    function toggleDelivered(id) {
        if (typeof Student !== 'undefined') {
            const isNowDone = Student.toggleDelivered(id);
            Notify.toast(isNowDone ? 'Actividad marcada como entregada' : 'Actividad marcada como pendiente', 'info');
            renderTimeline();
            renderCalendar();
            if (typeof App !== 'undefined') App.renderDashboard();
        }
    }

    /* ══════════════════════════════════════════════════════════
       RENDERIZADO: CALENDARIO MENSUAL INTERACTIVO
    ═══════════════════════════════════════════════════════════ */
    let _calYear = new Date().getFullYear();
    let _calMonth = new Date().getMonth();

    function renderCalendar() {
        const label = document.getElementById('calMonthLabel');
        if (label) label.textContent = `${MONTHS_ES[_calMonth]} ${_calYear}`;

        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const isAdmin = typeof DB !== 'undefined' && DB.isAdminUnlocked();
        const enrolledIds = (typeof Student !== 'undefined') ? Student.getEnrolledSubjectIds() : [];
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;

        // Primer día del mes (Ajuste Mon=0)
        const firstDay = new Date(_calYear, _calMonth, 1).getDay();
        const offset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
        const today = new Date(); today.setHours(0, 0, 0, 0);

        let html = '';

        // Días en blanco
        for (let i = 0; i < offset; i++) {
            html += `<div class="cal-day other-month"><span class="cal-day-num"></span></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayDate = new Date(_calYear, _calMonth, day);
            const isToday = dayDate.getTime() === today.getTime();
            const isSel = _selectedCalDate === dateStr;

            const dayActs = activities.filter(a => {
                if (a.date !== dateStr) return false;
                if (!isAdmin && a.modality !== 'special' && a.subjectId && !enrolledIds.includes(a.subjectId)) return false;
                return true;
            });

            const pills = dayActs.slice(0, 3).map(a => {
                const subj = subjects.find(s => s.id === a.subjectId);
                const color = subj ? subj.color : (a.modality === 'special' ? '#00e5a0' : '#00f0ff');
                const titleText = subj ? (subj.shortName || subj.name.slice(0,4)) : a.title.slice(0, 8);
                const isHigh = a.priority === 'high';
                return `<div class="cal-pill ${isHigh ? 'has-high-priority' : ''}" style="background:${color}" title="${a.title}">
                    <span class="priority-dot high"></span>${titleText}
                </div>`;
            }).join('');

            const overflow = dayActs.length > 3 ? `<span style="font-size:0.55rem;color:var(--cyan);font-weight:700;">+${dayActs.length - 3}</span>` : '';

            html += `
            <div class="cal-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}" onclick="Activities.onCalDayClick('${dateStr}', this)">
                <span class="cal-day-num">${day}</span>
                <div class="cal-pill-container">${pills}${overflow}</div>
            </div>`;
        }

        grid.innerHTML = html;

        if (_selectedCalDate) {
            renderCalDayPanel(_selectedCalDate);
        }
    }

    function onCalDayClick(dateStr, el) {
        _selectedCalDate = dateStr;
        document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
        if (el) el.classList.add('selected');
        renderCalDayPanel(dateStr);
    }

    function renderCalDayPanel(dateStr) {
        const panel = document.getElementById('calEventsPanel');
        if (!panel) return;

        const isAdmin = typeof DB !== 'undefined' && DB.isAdminUnlocked();
        const enrolledIds = (typeof Student !== 'undefined') ? Student.getEnrolledSubjectIds() : [];
        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const acts = allActs.filter(a => {
            if (a.date !== dateStr) return false;
            if (!isAdmin && a.modality !== 'special' && a.subjectId && !enrolledIds.includes(a.subjectId)) return false;
            return true;
        });
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        const dayName = DAYS_ES[dayDate.getDay()];
        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];

        if (acts.length === 0) {
            panel.innerHTML = `
                <div class="cal-events-header">
                    <span style="font-size:0.86rem;font-weight:700;color:var(--text-1);">${dayName.toUpperCase()} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}</span>
                    <button class="btn-ghost btn-sm" onclick="Activities.openModal(null, null)">Añadir Actividad</button>
                </div>
                <p class="empty-msg" style="text-align:center;padding:16px;">Sin evaluaciones ni eventos programados para este día.</p>
            `;
            return;
        }

        panel.innerHTML = `
            <div class="cal-events-header">
                <span style="font-size:0.86rem;font-weight:700;color:var(--text-1);">${dayName.toUpperCase()} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}</span>
                <div style="display:flex;gap:6px;">
                    <button class="btn-ghost btn-sm" onclick="Activities.shareDayWhatsApp('${dateStr}')">WhatsApp</button>
                    <button class="btn-primary btn-sm" onclick="Activities.openModal(null, null)">Añadir</button>
                </div>
            </div>
            ${acts.map(a => {
                const subj = subjects.find(s => s.id === a.subjectId);
                const g = a.guidelines || {};
                const priorityObj = PRIORITIES[a.priority] || PRIORITIES.medium;
                const isDone = typeof Student !== 'undefined' ? Student.isDelivered(a.id) : false;

                return `
                <div class="cal-event-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span class="tl-priority-badge ${priorityObj.badgeClass}">${priorityObj.icon} ${priorityObj.label}</span>
                        <span class="mono" style="font-size:0.75rem;color:var(--text-3);">${a.time ? `${a.time}` : 'Todo el día'}</span>
                    </div>

                    <div style="font-size:0.92rem;font-weight:700;color:var(--text-1);cursor:pointer;" onclick="Activities.openDetailModal('${a.id}')">
                        ${isDone ? `<span style="text-decoration:line-through;color:var(--text-3);">${a.title}</span>` : a.title}
                    </div>

                    <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px;">
                        ${subj ? `<b>${subj.name}</b>` : 'Evento Especial'}
                        ${a.corte ? `· Corte ${a.corte}` : ''}
                        ${a.weight ? `· <b>${a.weight}%</b>` : ''}
                    </div>

                    ${(g.instructions || a.desc) ? `<div style="font-size:0.75rem;color:var(--text-2);margin-top:6px;line-height:1.4;">${g.instructions || a.desc}</div>` : ''}

                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05);">
                        <button class="btn-ghost btn-sm" onclick="Activities.openDetailModal('${a.id}')">Ver Pautas</button>
                        <button class="btn-ghost btn-sm" onclick="Activities.toggleDelivered('${a.id}')">
                            ${isDone ? '[ENTREGADO]' : '[PENDIENTE]'}
                        </button>
                    </div>
                </div>`;
            }).join('')}
        `;
    }

    function shareDayWhatsApp(dateStr) {
        const acts = (typeof DB !== 'undefined' ? DB.get('activities') : []).filter(a => a.date === dateStr);
        if (acts.length === 0) return;
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        const dayName = DAYS_ES[dayDate.getDay()];
        const settings = typeof DB !== 'undefined' ? DB.getSettings() : { carrera: 'INGENIERÍA DE SISTEMAS', seccion: '08S-2623-D1' };

        let msg = `*— ACTIVIDADES PROGRAMADAS — ${dayName.toUpperCase()} (${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y})*\n`;
        msg += `*${settings.carrera}* | Secc. *${settings.seccion}*\n\n`;

        acts.forEach((a, i) => {
            const subj = typeof Schedule !== 'undefined' ? Schedule.getSubjectById(a.subjectId) : null;
            msg += `${i + 1}. *${a.title}*\n`;
            if (subj) msg += `   • Materia: ${subj.name}\n`;
            if (a.time) msg += `   • Hora: ${a.time}\n`;
            if (a.weight) msg += `   • Ponderación: ${a.weight}%\n`;
            const g = a.guidelines || {};
            if (g.instructions || a.desc) msg += `   • Pauta: ${g.instructions || a.desc}\n`;
            msg += `\n`;
        });

        msg += `_Gestor Académico XK_`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function calPrevMonth() {
        _calMonth--;
        if (_calMonth < 0) { _calMonth = 11; _calYear--; }
        renderCalendar();
    }

    function calNextMonth() {
        _calMonth++;
        if (_calMonth > 11) { _calMonth = 0; _calYear++; }
        renderCalendar();
    }

    /* ══════════════════════════════════════════════════════════
       HELPERS DE FECHA
    ═══════════════════════════════════════════════════════════ */
    function getDaysLeft(dateStr) {
        if (!dateStr) return null;
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const target = new Date(dateStr + 'T00:00:00');
        return Math.round((target - now) / 86400000);
    }

    function getUrgencyClass(days) {
        if (days === null) return '';
        if (days <= 1) return 'urgency-red';
        if (days <= 5) return 'urgency-orange';
        return 'urgency-green';
    }

    function formatDateES(dateStr) {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }

    /* ══════════════════════════════════════════════════════════
       INICIALIZACIÓN
    ═══════════════════════════════════════════════════════════ */
    function init() {
        seedSampleActivitiesIfEmpty();

        // Nav del calendario
        document.getElementById('calPrev')?.addEventListener('click', calPrevMonth);
        document.getElementById('calNext')?.addEventListener('click', calNextMonth);

        // Renderizado inicial
        renderTimeline();
        renderCalendar();
    }

    /* ── API PÚBLICA ─────────────────────────────────────────── */
    return {
        init,
        openModal,
        closeModal,
        openDetailModal,
        closeDetailModal,
        setModality,
        onSubjectChange,
        applySlotSuggestion,
        setPresetTitle,
        toggleGroupField,
        updateWeightAlert,
        saveFromForm,
        remove,
        renderTimeline,
        renderCalendar,
        onCalDayClick,
        toggleDelivered,
        toggleDeliveredFromDetail,
        shareActivityWhatsApp,
        shareDayWhatsApp,
        getDaysLeft,
        getUrgencyClass,
        formatDateES,
        get PRIORITIES() { return PRIORITIES; }
    };

})();

window.Activities = Activities;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Activities.init();
    });
} else {
    Activities.init();
}
