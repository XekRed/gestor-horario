/* =============================================================
   schedule.js — Renderizado del Horario y Modal de Materias
   Soporte para Códigos de Materia, Suscripciones Multi-Sección,
   Colores Personalizados y Detección Activa de Choques de Horario
   ============================================================= */

const Schedule = (() => {

    /* ── BLOQUES DE TIEMPO DE 45 MINUTOS ──────────────────────── */
    const MORNING_BLOCKS = [
        { id: 'form',  label: 'FORMACIÓN',   start: '07:00', end: '07:45', isFormacion: true },
        { id: 'b1',    label: '7:45',         start: '7:45',  end: '8:30'  },
        { id: 'b2',    label: '8:30',         start: '8:30',  end: '9:15'  },
        { id: 'b3',    label: '9:15',         start: '9:15',  end: '10:00' },
        { id: 'b4',    label: '10:00',        start: '10:00', end: '10:45' },
        { id: 'b5',    label: '10:45',        start: '10:45', end: '11:30' },
        { id: 'b6',    label: '11:30',        start: '11:30', end: '12:15' },
        { id: 'b7',    label: '12:15',        start: '12:15', end: '13:00' },
    ];
    const AFTERNOON_BLOCKS = [
        { id: 'b8',    label: '13:00',        start: '13:00', end: '13:45' },
        { id: 'b9',    label: '13:45',        start: '13:45', end: '14:30' },
        { id: 'b10',   label: '14:30',        start: '14:30', end: '15:15' },
        { id: 'b11',   label: '15:15',        start: '15:15', end: '16:00' },
        { id: 'b12',   label: '16:00',        start: '16:00', end: '16:45' },
        { id: 'b13',   label: '16:45',        start: '16:45', end: '17:30' },
    ];
    const ALL_BLOCKS = [...MORNING_BLOCKS, ...AFTERNOON_BLOCKS];
    // Índices: 0=FORMACIÓN, 1-7=MAÑANA, 8-13=TARDE

    /* ── DÍAS DE LA SEMANA ────────────────────────────────────── */
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    // Índice de día: 0=Lun, 1=Mar, 2=Mié, 3=Jue, 4=Vie, 5=Sáb

    /* ── MATERIAS SEMILLA CON CÓDIGOS OFICIALES ───────────────── */
    const SEED_SUBJECTS = [
        {
            id: 'civico',
            name: 'CÍVICO',
            shortName: 'CIV',
            code: 'CIV-08S',
            room: null,
            teacher: '',
            color: '#00f0ff',
            slots: [
                { day: 0, startBlock: 1, span: 1 }  // Lun 7:45-8:30
            ]
        },
        {
            id: 'cultura',
            name: 'CULTURA Y COMUNICACIÓN',
            shortName: 'CCOM',
            code: 'CCOM-08S',
            room: 'YSSF-010',
            teacher: '',
            color: '#9b59b6',
            slots: [
                { day: 0, startBlock: 2, span: 2 }  // Lun 8:30-10:00
            ]
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
                { day: 0, startBlock: 4, span: 3 },  // Lun 10:00-12:15
                { day: 2, startBlock: 1, span: 3 }   // Mié 7:45-10:00
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
            slots: [
                { day: 0, startBlock: 8, span: 6 }  // Lun 13:00-17:30
            ]
        },
        {
            id: 'planificacion',
            name: 'PLANIFICACIÓN Y EVALUACIÓN DE PROYECTOS (ENT)',
            shortName: 'PEP',
            code: 'PEP-08S',
            room: 'YSSF-010',
            teacher: 'Prof. Luis Rondón',
            color: '#5865F2',
            slots: [
                { day: 2, startBlock: 4, span: 3 }  // Mié 10:00-12:15
            ]
        },
        {
            id: 'teoria',
            name: 'TEORÍA DE DECISIONES',
            shortName: 'TDEC',
            code: 'TDEC-08S',
            room: 'YSSF-010',
            teacher: 'Prof. Ana Díaz',
            color: '#ff2e5f',
            slots: [
                { day: 3, startBlock: 2, span: 5 }  // Jue 8:30-12:15
            ]
        },
        {
            id: 'defensa',
            name: 'DEFENSA INTEGRAL DE LA NACIÓN VIII',
            shortName: 'DIN8',
            code: 'DIN8-08S',
            room: null,
            teacher: 'Cap. Rodríguez',
            color: '#00bfa5',
            slots: [
                { day: 3, startBlock: 8, span: 4 }  // Jue 13:00-16:00
            ]
        },
        {
            id: 'ia',
            name: 'INTELIGENCIA ARTIFICIAL (ET)',
            shortName: 'IA',
            code: 'IA-08S',
            room: 'YSSF-010',
            teacher: 'Ing. José Martínez',
            color: '#f9ca24',
            slots: [
                { day: 4, startBlock: 3, span: 4 }  // Vie 9:15-12:15
            ]
        },
        {
            id: 'marco',
            name: 'MARCO LEGAL PARA EL EJER. DE LA INGENIERÍA',
            shortName: 'MLEG',
            code: 'MLEG-08S',
            room: 'YSSF-010',
            teacher: 'Abg. Rosa Flores',
            color: '#fd79a8',
            slots: [
                { day: 4, startBlock: 8, span: 4 }  // Vie 13:00-16:00
            ]
        },
    ];

    /* ── ESTADO LOCAL ─────────────────────────────────────────── */
    let subjects = [];
    let currentSubjectId = null;

    /* ── INICIALIZACIÓN ───────────────────────────────────────── */
    function init() {
        subjects = loadSubjects();
        renderTable();
        renderLegend();
        populateSubjectSelects();

        if (typeof DB !== 'undefined') {
            DB.subscribe('subjects', (updated) => {
                if (updated && Array.isArray(updated) && updated.length > 0) {
                    subjects = updated;
                    renderTable();
                    renderLegend();
                    populateSubjectSelects();
                }
            });
        }
    }

    /* ── CARGA Y ALMACENAMIENTO DE DATOS ─────────────────────── */
    function loadSubjects() {
        if (typeof DB !== 'undefined') {
            const list = DB.get('subjects');
            if (list && list.length > 0) return list;
        }
        const stored = localStorage.getItem('gx_subjects');
        if (stored) return JSON.parse(stored);
        localStorage.setItem('gx_subjects', JSON.stringify(SEED_SUBJECTS));
        return SEED_SUBJECTS;
    }

    function saveSubjects() {
        if (typeof DB !== 'undefined') {
            DB.save('subjects', subjects);
        } else {
            localStorage.setItem('gx_subjects', JSON.stringify(subjects));
        }
    }

    function getSubjects() {
        return subjects;
    }

    function getSubjectById(id) {
        const found = subjects.find(s => s.id === id);
        if (found) return found;
        if (typeof Prefs !== 'undefined') {
            const ext = Prefs.getSubscribedSubjects().find(s => s.id === id);
            if (ext) return ext;
        }
        return null;
    }

    /* ── MATERIAS ACTIVAS (FILTRADAS + SUSCRIPCIONES) ─────────── */
    function getActiveSubjects() {
        let active = subjects.slice();

        if (typeof Prefs !== 'undefined') {
            // Excluir materias que el usuario decidió ocultar en su horario
            active = active.filter(s => !Prefs.isSubjectHidden(s.id));

            // Agregar materias externas a las que se suscribió
            const subs = Prefs.getSubscribedSubjects();
            subs.forEach(sub => {
                if (!active.some(s => s.id === sub.id)) {
                    active.push(sub);
                }
            });
        }
        return active;
    }

    /* ── CONSTRUCTOR DE GRILLA CON DETECCIÓN DE CHOQUES ───────── */
    // Genera matriz 14x6 donde cada celda define si es vacía, materia única o choque de horario
    function buildGrid() {
        const rows = ALL_BLOCKS.length; // 14
        const cols = DAYS.length;       // 6
        const active = getActiveSubjects();

        // 1. Matriz de cobertura temporal
        const coverage = [];
        for (let r = 0; r < rows; r++) {
            coverage[r] = [];
            for (let c = 0; c < cols; c++) {
                coverage[r][c] = [];
            }
        }

        // Llenar cobertura
        active.forEach(subj => {
            (subj.slots || []).forEach(slot => {
                const { day, startBlock, span } = slot;
                if (day < 0 || day >= cols) return;
                for (let k = 0; k < span; k++) {
                    const b = startBlock + k;
                    if (b >= 0 && b < rows) {
                        coverage[b][day].push({
                            subject: subj,
                            slot,
                            isStart: (k === 0)
                        });
                    }
                }
            });
        });

        // 2. Construir matriz visual con spans y conflictos
        const grid = [];
        for (let r = 0; r < rows; r++) {
            grid[r] = [];
            for (let c = 0; c < cols; c++) {
                grid[r][c] = { type: 'empty', span: 1, skip: false, subject: null, subjects: [] };
            }
        }

        for (let c = 0; c < cols; c++) {
            let r = 0;
            while (r < rows) {
                const cov = coverage[r][c];

                if (cov.length === 0) {
                    grid[r][c] = { type: 'empty', span: 1, skip: false };
                    r++;
                } else if (cov.length > 1) {
                    // [ALERTA] CHOQUE DE HORARIO DETECTADO
                    const uniqueSubjects = [];
                    cov.forEach(item => {
                        if (!uniqueSubjects.some(s => s.id === item.subject.id)) {
                            uniqueSubjects.push(item.subject);
                        }
                    });
                    grid[r][c] = {
                        type: 'conflict',
                        span: 1,
                        skip: false,
                        subjects: uniqueSubjects
                    };
                    r++;
                } else {
                    // Materia individual
                    const item = cov[0];
                    if (item.isStart) {
                        // Verificar si alguno de los siguientes bloques de esta materia tiene choque
                        let canSpan = true;
                        let safeSpan = 1;
                        for (let k = 1; k < item.slot.span; k++) {
                            const nextR = r + k;
                            if (nextR >= rows || coverage[nextR][c].length > 1) {
                                canSpan = false;
                                break;
                            }
                            safeSpan++;
                        }

                        if (canSpan) {
                            grid[r][c] = {
                                type: 'subject',
                                subject: item.subject,
                                span: item.slot.span,
                                skip: false
                            };
                            for (let k = 1; k < item.slot.span; k++) {
                                if (r + k < rows) {
                                    grid[r + k][c] = { type: 'skip', skip: true };
                                }
                            }
                            r += item.slot.span;
                        } else {
                            // Bloque segmentado por choque parcial
                            grid[r][c] = {
                                type: 'subject',
                                subject: item.subject,
                                span: 1,
                                skip: false
                            };
                            r++;
                        }
                    } else {
                        // Continuación no cubierta por rowspan
                        grid[r][c] = {
                            type: 'subject',
                            subject: item.subject,
                            span: 1,
                            skip: false
                        };
                        r++;
                    }
                }
            }
        }

        return grid;
    }

    /* ── RENDERIZADO DE LA TABLA DEL HORARIO ──────────────────── */
    function renderTable() {
        const table = document.getElementById('scheduleTable');
        if (!table) return;

        const today = new Date().getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
        const todayCol = (today >= 1 && today <= 6) ? (today - 1) : -1;

        const grid = buildGrid();
        const activities = getActivities();

        let html = '';

        /* ── CABECERA DE DÍAS ── */
        html += '<thead><tr>';
        html += '<th class="th-time">Hora</th>';
        for (let d = 0; d < DAYS.length; d++) {
            const isToday = (d === todayCol);
            html += `<th${isToday ? ' class="th-today"' : ''}>
                ${DAYS[d]}${isToday ? ' <span style="color:var(--cyan);font-size:0.6rem;font-weight:800;">[HOY]</span>' : ''}
            </th>`;
        }
        html += '</tr></thead>';

        /* ── CUERPO DE LA TABLA ── */
        html += '<tbody>';

        /* Turno Mañana */
        html += `<tr class="shift-row"><td colspan="${DAYS.length + 1}">TURNO MAÑANA</td></tr>`;

        for (let b = 0; b < MORNING_BLOCKS.length; b++) {
            const block = MORNING_BLOCKS[b];
            html += '<tr>';

            /* Celda de hora */
            if (block.isFormacion) {
                html += `<td class="sch-time-cell" style="color:var(--cyan);letter-spacing:1px;font-size:0.62rem;font-weight:700;">FORMACIÓN</td>`;
            } else {
                html += `<td class="sch-time-cell">
                    <span class="time-main">${block.start}</span>
                    <span class="time-end">${block.end}</span>
                </td>`;
            }

            /* Celdas de los días */
            for (let d = 0; d < DAYS.length; d++) {
                const cell = grid[b][d];
                if (cell.skip) continue;

                if (cell.type === 'conflict') {
                    // [ALERTA] Renderizado de choque de horario
                    html += `<td class="sch-conflict-cell" title="Choque de horario detectado">
                        <div class="sch-conflict-alert">[CHOQUE DE HORARIO]</div>
                        <div class="sch-conflict-split">
                            ${cell.subjects.map(s => {
                                const subjCol = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(s.id, s.color) : s.color;
                                return `
                                <div class="sch-conflict-item" style="border-left-color:${subjCol};"
                                     onclick="Schedule.openModal('${s.id}')" title="Ver detalles de ${s.name}">
                                    <span class="subj-name">${s.shortName || s.name}</span>
                                    <span class="subj-code">${s.code || ''} ${s.room ? '· ' + s.room : ''}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </td>`;
                } else if (cell.type === 'subject' && cell.subject) {
                    const subj = cell.subject;
                    const displayColor = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(subj.id, subj.color) : subj.color;
                    const hasPending = hasActivities(subj.id, activities);
                    const bgColor = hexToRgba(displayColor, 0.18);
                    const borderColor = hexToRgba(displayColor, 0.55);

                    html += `<td class="sch-subj-cell"
                        rowspan="${cell.span}"
                        style="background:${bgColor};border-left:3px solid ${displayColor};border-color:${borderColor};"
                        onclick="Schedule.openModal('${subj.id}')"
                        title="${subj.name} (${subj.code || 'Sin código'})">
                        ${hasPending ? '<span class="sch-subj-badge" title="Tiene evaluaciones o entregas pendientes"></span>' : ''}
                        <div class="sch-subj-inner">
                            <span class="sch-subj-name">${subj.name}</span>
                            ${subj.code ? `<span class="mono" style="font-size:0.6rem;color:var(--cyan);opacity:0.9;">${subj.code}</span>` : ''}
                            ${subj.room ? `<span class="sch-subj-room">${subj.room}</span>` : ''}
                        </div>
                    </td>`;
                } else {
                    const isForm = block.isFormacion;
                    html += `<td class="${isForm ? 'sch-form-cell' : 'sch-empty-cell'}">${isForm ? '—' : ''}</td>`;
                }
            }
            html += '</tr>';
        }

        /* Turno Tarde */
        html += `<tr class="shift-row"><td colspan="${DAYS.length + 1}">TURNO TARDE</td></tr>`;

        for (let b = 0; b < AFTERNOON_BLOCKS.length; b++) {
            const absIdx = MORNING_BLOCKS.length + b;
            const block = AFTERNOON_BLOCKS[b];
            html += '<tr>';
            html += `<td class="sch-time-cell">
                <span class="time-main">${block.start}</span>
                <span class="time-end">${block.end}</span>
            </td>`;

            for (let d = 0; d < DAYS.length; d++) {
                const cell = grid[absIdx][d];
                if (cell.skip) continue;

                if (cell.type === 'conflict') {
                    // [ALERTA] Choque en turno tarde
                    html += `<td class="sch-conflict-cell" title="Choque de horario detectado">
                        <div class="sch-conflict-alert">[CHOQUE DE HORARIO]</div>
                        <div class="sch-conflict-split">
                            ${cell.subjects.map(s => {
                                const subjCol = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(s.id, s.color) : s.color;
                                return `
                                <div class="sch-conflict-item" style="border-left-color:${subjCol};"
                                     onclick="Schedule.openModal('${s.id}')" title="Ver detalles de ${s.name}">
                                    <span class="subj-name">${s.shortName || s.name}</span>
                                    <span class="subj-code">${s.code || ''} ${s.room ? '· ' + s.room : ''}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </td>`;
                } else if (cell.type === 'subject' && cell.subject) {
                    const subj = cell.subject;
                    const displayColor = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(subj.id, subj.color) : subj.color;
                    const hasPending = hasActivities(subj.id, activities);
                    const bgColor = hexToRgba(displayColor, 0.18);
                    const borderColor = hexToRgba(displayColor, 0.55);

                    html += `<td class="sch-subj-cell"
                        rowspan="${cell.span}"
                        style="background:${bgColor};border-left:3px solid ${displayColor};border-color:${borderColor};"
                        onclick="Schedule.openModal('${subj.id}')"
                        title="${subj.name} (${subj.code || 'Sin código'})">
                        ${hasPending ? '<span class="sch-subj-badge" title="Tiene evaluaciones pendientes"></span>' : ''}
                        <div class="sch-subj-inner">
                            <span class="sch-subj-name">${subj.name}</span>
                            ${subj.code ? `<span class="mono" style="font-size:0.6rem;color:var(--cyan);opacity:0.9;">${subj.code}</span>` : ''}
                            ${subj.room ? `<span class="sch-subj-room">${subj.room}</span>` : ''}
                        </div>
                    </td>`;
                } else {
                    html += `<td class="sch-empty-cell"></td>`;
                }
            }
            html += '</tr>';
        }

        html += '</tbody>';
        table.innerHTML = html;
    }

    /* ── LEYENDA INFERIOR DE MATERIAS ─────────────────────────── */
    function renderLegend() {
        const el = document.getElementById('scheduleLegend');
        if (!el) return;
        const active = getActiveSubjects();
        el.innerHTML = active.map(s => {
            const displayColor = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(s.id, s.color) : s.color;
            return `
            <div class="legend-item" onclick="Schedule.openModal('${s.id}')" style="cursor:pointer;" title="${s.name}">
                <span class="legend-dot" style="background:${displayColor}"></span>
                <span>${s.shortName || s.name.slice(0, 8)}</span>
            </div>`;
        }).join('');
    }

    /* ── SELECTORES DE MATERIA EN FORMULARIOS ─────────────────── */
    function populateSubjectSelects() {
        const selects = [
            document.getElementById('actSubject'),
            document.getElementById('tlFilterMateria'),
        ];
        const active = getActiveSubjects();

        selects.forEach(sel => {
            if (!sel) return;
            const first = sel.querySelector('option');
            sel.innerHTML = '';
            if (first) {
                sel.appendChild(first);
            } else {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Todas las materias';
                sel.appendChild(opt);
            }
            active.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.code ? `[${s.code}] ${s.name}` : s.name;
                sel.appendChild(opt);
            });
        });
    }

    /* ── MODAL DE DETALLE DE ASIGNATURA ───────────────────────── */
    function openModal(subjectId) {
        const subj = getSubjectById(subjectId);
        if (!subj) return;
        currentSubjectId = subjectId;

        const displayColor = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(subj.id, subj.color) : subj.color;

        document.getElementById('modalColorDot').style.background = displayColor;
        document.getElementById('modalSubjectName').textContent = subj.name;
        document.getElementById('modalRoom').textContent = subj.room || 'Aula N/A';
        document.getElementById('modalCode').textContent = subj.code || '—';
        document.getElementById('modalTeacher').textContent = subj.teacher || 'Por confirmar';

        const totalBlocks = (subj.slots || []).reduce((acc, sl) => acc + sl.span, 0);
        const totalMins = totalBlocks * 45;
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        document.getElementById('modalHours').textContent = `${hrs}h ${mins > 0 ? mins + 'min' : ''} / sem`;

        const schedList = document.getElementById('modalScheduleList');
        if (schedList) {
            schedList.innerHTML = (subj.slots || []).map(slot => {
                const startBlock = ALL_BLOCKS[slot.startBlock];
                const endBlock   = ALL_BLOCKS[slot.startBlock + slot.span - 1];
                if (!startBlock || !endBlock) return '';
                return `
                <div class="modal-slot-item">
                    <span class="slot-day" style="color:${displayColor}">${DAYS[slot.day]}</span>
                    <span class="slot-time">${startBlock.start || ''} – ${endBlock.end || ''}</span>
                    <span class="mono" style="font-size:0.62rem;color:var(--text-3)">${slot.span * 45} min</span>
                </div>`;
            }).join('');
        }

        const acts = getActivities().filter(a => a.subjectId === subjectId);
        const actContainer = document.getElementById('modalActivities');
        if (actContainer) {
            if (acts.length === 0) {
                actContainer.innerHTML = '<p class="empty-msg">Sin actividades registradas</p>';
            } else {
                actContainer.innerHTML = acts.map(a => {
                    const daysLeft = getDaysLeft(a.date);
                    const urgency  = getUrgencyClass(daysLeft);
                    return `
                    <div class="modal-act-item">
                        <span class="act-type-dot" style="background:${typeColor(a.type)}"></span>
                        <span class="act-title" style="flex:1">${a.title}</span>
                        <span class="act-date">${formatDate(a.date)}</span>
                        ${daysLeft !== null ? `<span class="act-urgency ${urgency}">${daysLeft <= 0 ? 'HOY' : daysLeft + 'd'}</span>` : ''}
                    </div>`;
                }).join('');
            }
        }

        document.getElementById('modalSubject')?.classList.add('open');
    }

    function closeModal(event, force = false) {
        if (force || (event && event.target.id === 'modalSubject')) {
            document.getElementById('modalSubject')?.classList.remove('open');
            currentSubjectId = null;
        }
    }

    /* ── CLASES DEL DÍA ACTUAL ────────────────────────────────── */
    function getTodayClasses() {
        const today = new Date().getDay();
        const col = (today >= 1 && today <= 6) ? (today - 1) : -1;
        if (col < 0) return [];

        const active = getActiveSubjects();
        const result = [];
        for (const subj of active) {
            for (const slot of (subj.slots || [])) {
                if (slot.day === col) {
                    const startBlock = ALL_BLOCKS[slot.startBlock];
                    const endBlock   = ALL_BLOCKS[slot.startBlock + slot.span - 1];
                    if (startBlock && endBlock) {
                        const displayColor = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(subj.id, subj.color) : subj.color;
                        result.push({
                            subjectId: subj.id,
                            name: subj.name,
                            shortName: subj.shortName || subj.name.slice(0, 4),
                            code: subj.code || '',
                            color: displayColor,
                            room: subj.room,
                            start: startBlock.start || '',
                            end: endBlock.end || '',
                        });
                    }
                }
            }
        }
        result.sort((a, b) => a.start.localeCompare(b.start));
        return result;
    }

    /* ── PRÓXIMA CLASE DEL DÍA ────────────────────────────────── */
    function getNextClass() {
        const now = new Date();
        const day = now.getDay();
        const col = (day >= 1 && day <= 6) ? (day - 1) : -1;
        if (col < 0) return null;

        const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const active = getActiveSubjects();
        let best = null;

        for (const subj of active) {
            for (const slot of (subj.slots || [])) {
                if (slot.day !== col) continue;
                const startBlock = ALL_BLOCKS[slot.startBlock];
                if (!startBlock || !startBlock.start) continue;

                const [h, m] = startBlock.start.split(':').map(Number);
                const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (startStr > nowStr) {
                    if (!best || startStr < best.start) {
                        const displayColor = (typeof Prefs !== 'undefined') ? Prefs.getSubjectColor(subj.id, subj.color) : subj.color;
                        best = { name: subj.name, color: displayColor, start: startStr };
                    }
                }
            }
        }
        return best;
    }

    /* ── UTILIDADES DE FORMATO Y ESTILO ───────────────────────── */
    function hexToRgba(hex, alpha) {
        if (!hex) return `rgba(0, 240, 255, ${alpha})`;
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16) || 0;
        const g = parseInt(hex.slice(2, 4), 16) || 0;
        const b = parseInt(hex.slice(4, 6), 16) || 0;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function typeColor(type) {
        const map = { exam: '#ff2e5f', assignment: '#ff9f43', project: '#5865F2', quiz: '#f9ca24', event: '#00e5a0' };
        return map[type] || '#80cbc4';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }

    function getDaysLeft(dateStr) {
        if (!dateStr) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const d = new Date(dateStr + 'T00:00:00');
        return Math.round((d - now) / 86400000);
    }

    function getUrgencyClass(days) {
        if (days === null) return '';
        if (days <= 1) return 'urgency-red';
        if (days <= 5) return 'urgency-orange';
        return 'urgency-green';
    }

    function hasActivities(subjId, activities) {
        return activities.some(a => a.subjectId === subjId);
    }

    function getActivities() {
        const stored = localStorage.getItem('gx_activities');
        return stored ? JSON.parse(stored) : [];
    }

    /* ── EXPORTACIÓN PÚBLICA ──────────────────────────────────── */
    return {
        init,
        renderTable,
        renderLegend,
        openModal,
        closeModal,
        getSubjects,
        getActiveSubjects,
        getSubjectById,
        getTodayClasses,
        getNextClass,
        populateSubjectSelects,
        get currentSubjectId() { return currentSubjectId; },
        DAYS,
        ALL_BLOCKS,
    };

})();

window.Schedule = Schedule;
