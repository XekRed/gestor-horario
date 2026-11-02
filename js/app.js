/* =============================================================
   app.js — Controlador Principal: Tabs, Clock, Dashboard,
             Calendario, Timeline, Notas, Partículas, Toasts
   ============================================================= */

const App = (() => {

    /* ── STATE ──────────────────────────────────────────────── */
    let currentTab   = 'dashboard';
    let calView      = 'calendar';    // 'calendar' | 'timeline'
    let calYear      = 0;
    let calMonth     = 0;             // 0-11
    let selectedCalDay = null;
    let activityEditId = null;

    /* ── CONSTANTS ──────────────────────────────────────────── */
    const MONTHS_ES = [
        'Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];
    const DAYS_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const TYPE_LABELS = {
        exam: 'Examen', assignment: 'Tarea',
        project: 'Proyecto', quiz: 'Quiz', event: 'Evento'
    };
    const TYPE_COLORS = {
        exam:'#ff2e5f', assignment:'#ff9f43',
        project:'#5865F2', quiz:'#f9ca24', event:'#00e5a0'
    };

    /* ── INIT ───────────────────────────────────────────────── */
    async function init() {
        // Init DB
        if (typeof DB !== 'undefined') {
            await DB.init();

            // Sincronizaciones en tiempo real
            DB.subscribe('activities', () => {
                renderDashboard();
                renderCalendar();
                renderTimeline();
                if (typeof Notify !== 'undefined' && typeof Notify.checkMorningTodayBanner === 'function') {
                    Notify.checkMorningTodayBanner();
                }
            });

            DB.subscribe('subjects', () => {
                if (typeof Schedule !== 'undefined') Schedule.init();
                renderDashboard();
            });

            DB.subscribe('settings', () => {
                loadSettings();
            });
        }

        // Load settings
        loadSettings();

        // Init sub-modules
        if (typeof Prefs !== 'undefined') Prefs.init();
        if (typeof Student !== 'undefined') {
            Student.updateHeaderProfile();
        }
        Schedule.init();

        // Clock
        updateClock();
        setInterval(updateClock, 1000);

        // Tab nav
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Calendar nav
        const now = new Date();
        calYear  = now.getFullYear();
        calMonth = now.getMonth();
        document.getElementById('calPrev')?.addEventListener('click', () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); });
        document.getElementById('calNext')?.addEventListener('click', () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); });

        // Timeline filters
        document.getElementById('tlFilterMateria')?.addEventListener('change', renderTimeline);
        document.getElementById('tlFilterCorte')?.addEventListener('change', renderTimeline);

        // Activity modal buttons
        document.getElementById('btnSaveActivity')?.addEventListener('click', saveActivity);
        document.getElementById('btnAddTlActivity')?.addEventListener('click', () => openNewActivity());

        // Grades
        document.getElementById('btnAddGrade')?.addEventListener('click', openGradeModal);

        // Particles
        spawnParticles();

        // Initial render
        renderDashboard();
        renderCalendar();
        renderTimeline();
        renderGrades();
        if (typeof Prefs !== 'undefined') switchTab(Prefs.getDefaultTab());
        if (window.lucide) lucide.createIcons();

        // Si no tiene perfil activo guardado, abrir ventana de bienvenida e identificación
        if (typeof Student !== 'undefined' && !Student.hasActiveProfile()) {
            setTimeout(() => Student.openIdentificationModal(), 300);
        }
    }

    /* ── SETTINGS ───────────────────────────────────────────── */
    function loadSettings() {
        const s = getSettings();
        const metaC = document.getElementById('metaCarrera');
        const metaS = document.getElementById('metaSemestre');
        const metaSec = document.getElementById('metaSeccion');
        const footerSemester = document.getElementById('footerSemester');

        if (metaC && s.carrera) metaC.textContent = s.carrera;
        if (metaS && s.semestre) metaS.textContent = s.semestre;
        if (metaSec && s.seccion) metaSec.textContent = s.seccion;
        if (footerSemester && s.seccion) {
            footerSemester.textContent = `${s.semestre || 'VIII'} Semestre · ISII · ${s.seccion}`;
        }
    }

    function getSettings() {
        if (typeof DB !== 'undefined') return DB.getSettings();
        const d = localStorage.getItem('gx_settings');
        return d ? JSON.parse(d) : {
            carrera: 'INGENIERÍA DE SISTEMAS',
            semestre: 'VIII',
            seccion: '08S-2623-D1',
        };
    }

    /* ── CLOCK ──────────────────────────────────────────────── */
    function updateClock() {
        const now = new Date();
        const hh  = String(now.getHours()).padStart(2,'0');
        const mm  = String(now.getMinutes()).padStart(2,'0');
        const ss  = String(now.getSeconds()).padStart(2,'0');
        document.getElementById('clockTime').textContent = `${hh}:${mm}:${ss}`;

        const dayName = DAYS_ES[now.getDay()];
        const dd  = String(now.getDate()).padStart(2,'0');
        const mo  = String(now.getMonth()+1).padStart(2,'0');
        const yr  = now.getFullYear();
        document.getElementById('clockDate').textContent  = `${dd}/${mo}/${yr}`;
        document.getElementById('dayBadge').textContent   = `HOY: ${dayName.toUpperCase()}`;
        document.getElementById('todayLabel').textContent = `${dayName} ${dd}/${mo}`;
    }

    /* ── TABS ───────────────────────────────────────────────── */
    function switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
        currentTab = tab;

        if (tab === 'dashboard') renderDashboard();
        if (tab === 'schedule')  Schedule.renderTable();
        if (tab === 'calendar')  {
            if (typeof Activities !== 'undefined') {
                Activities.renderCalendar();
                Activities.renderTimeline();
            }
        }
        if (tab === 'grades')    renderGrades();
    }

    /* ── CAL VIEW TOGGLE ────────────────────────────────────── */
    function switchCalView(view) {
        calView = view;
        document.getElementById('calendarView').style.display   = view === 'calendar'  ? '' : 'none';
        document.getElementById('timelineView').style.display   = view === 'timeline'  ? '' : 'none';
        document.getElementById('btnCalView').classList.toggle('active', view === 'calendar');
        document.getElementById('btnTlView').classList.toggle('active', view === 'timeline');
        if (typeof Activities !== 'undefined') {
            if (view === 'timeline') Activities.renderTimeline();
            if (view === 'calendar') Activities.renderCalendar();
        }
    }

    /* ════════════════════════════════════════════════════════
       DASHBOARD
    ════════════════════════════════════════════════════════ */
    function renderDashboard() {
        const subjects   = Schedule.getSubjects();
        const allActivities = getActivities();
        const enrolledIds = subjects.map(s => s.id);
        const activities = allActivities.filter(a => a.modality === 'special' || !a.subjectId || enrolledIds.includes(a.subjectId));
        const now        = new Date(); now.setHours(0,0,0,0);

        /* Today's classes */
        const todayClasses = Schedule.getTodayClasses();
        const todayStrip   = document.getElementById('todayStrip');
        if (todayClasses.length === 0) {
            todayStrip.innerHTML = '<p class="empty-msg">No hay clases programadas para hoy</p>';
        } else {
            todayStrip.innerHTML = todayClasses.map(c =>
                `<div class="today-class-pill" onclick="Schedule.openModal('${c.subjectId}')">
                    <span class="pill-dot" style="background:${c.color}"></span>
                    <span class="pill-name">${c.name}</span>
                    <span class="pill-time">${c.start}–${c.end}</span>
                    ${c.room ? `<span class="pill-time">${c.room}</span>` : ''}
                </div>`
            ).join('');
        }

        /* Next class */
        const next = Schedule.getNextClass();
        document.getElementById('statProxima').textContent = next ? next.start : 'N/A';

        /* Pending activities */
        const pending = activities.filter(a => {
            if (!a.date) return false;
            const d = new Date(a.date + 'T00:00:00');
            return d >= now;
        }).sort((a,b) => a.date.localeCompare(b.date));
        document.getElementById('statPendientes').textContent = pending.length;

        /* Alert strip for imminent activities (< 48h / Hoy / Mañana) */
        const alertEl = document.getElementById('alertStrip');
        if (alertEl) {
            const nowTime = Date.now();
            const urgent = pending.find(a => {
                if (!a.date) return false;
                const dt = new Date(`${a.date}T${a.time || '23:59'}:00`).getTime();
                const diffHours = (dt - nowTime) / (3600 * 1000);
                return diffHours >= -12 && diffHours <= 48; // Menos de 48 horas o venciendo hoy
            }) || pending.find(a => a.priority === 'high');

            if (urgent) {
                const dt = new Date(`${urgent.date}T${urgent.time || '23:59'}:00`).getTime();
                const diffHours = Math.max(0, Math.round((dt - nowTime) / (3600 * 1000)));
                const dl = getDaysLeft(urgent.date);
                let urgentText = '';
                if (dl <= 0) {
                    urgentText = `[VENCE HOY!] (Quedan aprox. ${diffHours}h)`;
                } else if (dl === 1) {
                    urgentText = `[VENCE MAÑANA!] (Quedan aprox. ${diffHours}h)`;
                } else {
                    urgentText = `Vence en ${diffHours} horas`;
                }

                alertEl.style.display = 'flex';
                alertEl.innerHTML = `
                    <span class="alert-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>
                    <div style="flex:1;min-width:0;">
                        <span class="alert-text"><b>Entrega Próxima:</b> ${urgent.title} — <span style="color:var(--yellow);font-weight:700;">${urgentText}</span></span>
                        <div style="font-size:0.68rem;color:var(--text-2);margin-top:2px;">Fecha: <b>${urgent.date}</b> ${urgent.time ? `a las ${urgent.time}` : ''} ${urgent.weight ? `· Ponderación: <b>${urgent.weight}%</b>` : ''}</div>
                    </div>
                    <button class="btn-ghost btn-sm" onclick="Activities.openDetailModal('${urgent.id}')" style="margin-left:auto;padding:5px 12px;font-size:0.75rem;background:rgba(0,240,255,0.12);border-color:var(--cyan);color:var(--cyan);">Ver Directrices</button>
                `;
            } else {
                alertEl.style.display = 'none';
            }
        }

        /* Upcoming activities */
        const upEl = document.getElementById('upcomingActivities');
        if (pending.length === 0) {
            upEl.innerHTML = '<p class="empty-msg">Sin entregas próximas</p>';
        } else {
            upEl.innerHTML = pending.slice(0, 6).map(a => {
                const subj = subjects.find(s => s.id === a.subjectId);
                const daysLeft = getDaysLeft(a.date);
                const urgency  = getUrgencyClass(daysLeft);
                const isNew = typeof Student !== 'undefined' && Student.isActivityNew(a);
                const isDone = typeof Student !== 'undefined' ? Student.isDelivered(a.id) : false;
                const priorityClass = a.priority === 'high' ? 'priority-high' : (a.priority === 'medium' ? 'priority-medium' : 'priority-low');
                const priorityLabel = a.priority === 'high' ? '[ALTA]' : (a.priority === 'medium' ? '[MEDIA]' : '[BAJA]');

                return `<div class="activity-item" style="cursor:pointer;" onclick="Activities.openDetailModal('${a.id}')">
                    <span class="act-type-dot" style="background:${subj ? subj.color : (a.modality === 'special' ? '#00e5a0' : '#00f0ff')}"></span>
                    <div style="flex:1;min-width:0">
                        <div class="act-title">
                            ${isDone ? `<span style="text-decoration:line-through;color:var(--text-3);">${a.title}</span>` : a.title}
                            ${isNew ? '<span class="badge-new-pulse">¡NUEVA!</span>' : ''}
                        </div>
                        <div style="font-size:0.65rem;color:var(--text-3);display:flex;gap:6px;align-items:center;margin-top:2px;">
                            ${subj ? `<span>${subj.name}</span>` : '<span>Evento Especial</span>'}
                            <span class="tl-priority-badge ${priorityClass}" style="font-size:0.55rem;padding:1px 4px;">${priorityLabel} ${a.priority || 'media'}</span>
                            ${a.weight ? `<span style="color:var(--yellow)">[POND.] ${a.weight}%</span>` : ''}
                        </div>
                    </div>
                    <span class="act-date">${formatDate(a.date)}</span>
                    ${daysLeft !== null ? `<span class="act-urgency ${urgency}">${daysLeft <= 0 ? 'HOY' : daysLeft + 'd'}</span>` : ''}
                </div>`;
            }).join('');
        }

        /* Stats */
        document.getElementById('statMaterias').textContent = subjects.length;

        /* Average grade from Student module */
        if (typeof Student !== 'undefined') {
            const mode = Student.getGradeMode ? Student.getGradeMode() : 'percentage';
            let sum = 0, count = 0;
            subjects.forEach(s => {
                const m = Student.calculateSubjectMetrics(s.id);
                if (m.evaluatedWeight > 0) {
                    sum += m.totalAcumulado;
                    count++;
                }
            });
            if (count > 0) {
                const avgPct = sum / count;
                if (mode === 'scale20') {
                    document.getElementById('statPromedio').textContent = `${(avgPct * 0.20).toFixed(1)} / 20`;
                } else if (mode === 'scale5') {
                    document.getElementById('statPromedio').textContent = `${(avgPct * 0.05).toFixed(1)} / 5`;
                } else {
                    document.getElementById('statPromedio').textContent = `${avgPct.toFixed(1)}%`;
                }
            } else {
                document.getElementById('statPromedio').textContent = '—';
            }
        } else {
            const grades = getGrades();
            if (grades.length > 0) {
                const avgs = grades.map(g => computeAverage(g));
                const totalAvg = avgs.filter(a => a !== null).reduce((s,v) => s+v, 0);
                const count    = avgs.filter(a => a !== null).length;
                document.getElementById('statPromedio').textContent = count > 0 ? (totalAvg/count).toFixed(1) : '—';
            }
        }
    }

    /* ════════════════════════════════════════════════════════
       ACTIVITIES — CRUD
    ════════════════════════════════════════════════════════ */
    function getActivities() {
        if (typeof DB !== 'undefined') return DB.get('activities') || [];
        const d = localStorage.getItem('gx_activities');
        return d ? JSON.parse(d) : [];
    }

    function saveActivities(arr) {
        if (typeof DB !== 'undefined') {
            DB.save('activities', arr);
        } else {
            localStorage.setItem('gx_activities', JSON.stringify(arr));
        }
    }

    function openNewActivity(subjectId = null) {
        if (typeof Activities !== 'undefined') {
            Activities.openModal(null, subjectId);
        }
    }

    function closeActivityModal(event, force = false) {
        if (typeof Activities !== 'undefined') {
            Activities.closeModal(event, force);
        }
    }

    function saveActivity() {
        const title  = document.getElementById('actTitle').value.trim();
        const type   = document.getElementById('actType').value;
        const subjId = document.getElementById('actSubject').value;
        const corte  = document.getElementById('actCorte').value;
        const date   = document.getElementById('actDate').value;
        const time   = document.getElementById('actTime').value;
        const desc   = document.getElementById('actDesc').value.trim();
        const weight = document.getElementById('actWeight').value;

        if (!title)  return showToast('El título es obligatorio', 'error');
        if (!date)   return showToast('La fecha es obligatoria', 'error');

        const activity = {
            id: activityEditId || (typeof DB !== 'undefined' ? DB.generateId() : Date.now().toString()),
            title, type, subjectId: subjId, corte, date, time, desc,
            weight: weight ? parseFloat(weight) : null,
            createdAt: new Date().toISOString(),
        };

        if (typeof DB !== 'undefined') {
            DB.saveOne('activities', activity);
        } else {
            const activities = getActivities();
            if (activityEditId) {
                const idx = activities.findIndex(a => a.id === activityEditId);
                if (idx >= 0) activities[idx] = activity;
            } else {
                activities.push(activity);
            }
            saveActivities(activities);
        }

        closeActivityModal(null, true);
        showToast('Actividad guardada', 'success');

        // Re-render affected views
        if (currentTab === 'dashboard')  renderDashboard();
        if (currentTab === 'calendar')   { renderCalendar(); if(calView==='timeline') renderTimeline(); }
        if (currentTab === 'schedule')   Schedule.renderTable();
    }

    /* ════════════════════════════════════════════════════════
       CALENDAR
    ════════════════════════════════════════════════════════ */
    function renderCalendar() {
        const label = document.getElementById('calMonthLabel');
        if (label) label.textContent = `${MONTHS_ES[calMonth]} ${calYear}`;

        const activities = getActivities();
        const grid       = document.getElementById('calendarGrid');
        if (!grid) return;

        // First day of month (adjust Mon=0)
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const offset   = firstDay === 0 ? 6 : firstDay - 1; // Mon-first offset
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);

        let html = '';

        // Blanks
        for (let i = 0; i < offset; i++) {
            html += `<div class="cal-day other-month"><span class="cal-day-num"></span></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayDate = new Date(calYear, calMonth, day);
            const isToday = dayDate.getTime() === today.getTime();
            const isSel   = selectedCalDay === dateStr;

            // Get events for this day
            const dayActs = activities.filter(a => a.date === dateStr);
            const dots = dayActs.map(a =>
                `<span class="cal-dot" style="background:${TYPE_COLORS[a.type]||'#80cbc4'}"></span>`
            ).join('');

            html += `<div class="cal-day${isToday ? ' today' : ''}${isSel ? ' selected' : ''}"
                onclick="App._calDayClick('${dateStr}', this)">
                <span class="cal-day-num">${day}</span>
                <div class="cal-events-dots">${dots}</div>
            </div>`;
        }

        grid.innerHTML = html;

        if (selectedCalDay) renderCalDayPanel(selectedCalDay);
    }

    function _calDayClick(dateStr, el) {
        selectedCalDay = dateStr;
        document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
        if (el) el.classList.add('selected');
        renderCalDayPanel(dateStr);
    }

    function renderCalDayPanel(dateStr) {
        const panel = document.getElementById('calEventsPanel');
        const acts  = getActivities().filter(a => a.date === dateStr);
        const [y,m,d] = dateStr.split('-').map(Number);
        const dayDate = new Date(y, m-1, d);
        const dayName = DAYS_ES[dayDate.getDay()];
        const subjects = Schedule.getSubjects();

        if (acts.length === 0) {
            panel.innerHTML = `<p class="empty-msg">${dayName} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')} — Sin eventos</p>`;
        } else {
            panel.innerHTML = `
                <div class="card-label" style="margin-bottom:10px">${dayName.toUpperCase()} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}</div>
                ${acts.map(a => {
                    const subj = subjects.find(s => s.id === a.subjectId);
                    return `<div class="cal-event-item">
                        <span class="act-type-dot" style="background:${TYPE_COLORS[a.type]||'#80cbc4'};width:10px;height:10px;border-radius:50%;flex-shrink:0"></span>
                        <div style="flex:1">
                            <div style="font-size:0.84rem;font-weight:700">${a.title}</div>
                            ${subj ? `<div style="font-size:0.65rem;color:var(--text-3)">${subj.name}</div>` : ''}
                            ${a.desc ? `<div style="font-size:0.72rem;color:var(--text-2);margin-top:3px">${a.desc}</div>` : ''}
                        </div>
                        <span class="tl-tag type-${a.type}" style="font-size:0.58rem">${TYPE_LABELS[a.type] || a.type}</span>
                    </div>`;
                }).join('')}`;
        }
    }

    /* ════════════════════════════════════════════════════════
       TIMELINE
    ════════════════════════════════════════════════════════ */
    function renderTimeline() {
        const wrap     = document.getElementById('timelineWrap');
        if (!wrap) return;
        const subjects  = Schedule.getSubjects();
        const subjFilter = document.getElementById('tlFilterMateria')?.value || 'all';
        const corteFilter = document.getElementById('tlFilterCorte')?.value || 'all';

        let acts = getActivities();
        if (subjFilter !== 'all') acts = acts.filter(a => a.subjectId === subjFilter);
        if (corteFilter !== 'all') acts = acts.filter(a => a.corte === corteFilter);
        acts = acts.sort((a,b) => (a.date||'').localeCompare(b.date||''));

        if (acts.length === 0) {
            wrap.innerHTML = '<p class="empty-msg" style="text-align:center;padding:40px">Sin actividades que mostrar</p>';
            return;
        }

        // Group by month
        let html = '';
        let lastMonth = '';
        acts.forEach(a => {
            if (!a.date) return;
            const [y,m] = a.date.split('-').map(Number);
            const monthKey = `${MONTHS_ES[m-1]} ${y}`;
            if (monthKey !== lastMonth) {
                html += `<div class="tl-month-sep">${monthKey}</div>`;
                lastMonth = monthKey;
            }
            const subj     = subjects.find(s => s.id === a.subjectId);
            const daysLeft = getDaysLeft(a.date);
            const urgency  = getUrgencyClass(daysLeft);
            const [yr,mo,dd] = a.date.split('-').map(Number);

            const isDone = typeof Student !== 'undefined' ? Student.isDelivered(a.id) : false;

            html += `<div class="tl-item ${isDone ? 'tl-item-done' : ''}">
                <div class="tl-card" style="${isDone ? 'opacity:0.75;border-color:rgba(0,229,160,0.3);' : ''}">
                    <div class="tl-card-header">
                        <span class="tl-title">${isDone ? '<span style="text-decoration:line-through;color:var(--text-3);">' + a.title + '</span>' : a.title}</span>
                        <span class="tl-date">${String(dd).padStart(2,'0')}/${String(mo).padStart(2,'0')}${a.time ? ' ' + a.time : ''}</span>
                    </div>
                    <div class="tl-meta">
                        <span class="tl-tag type-${a.type}">${TYPE_LABELS[a.type]||a.type}</span>
                        ${subj ? `<span style="font-size:0.65rem;color:${subj.color};font-weight:700">${subj.name}</span>` : ''}
                        ${a.corte ? `<span class="tl-tag" style="color:var(--text-3);border-color:var(--border)">${a.corte}° Corte</span>` : ''}
                        ${daysLeft !== null ? `<span class="act-urgency ${urgency}">${daysLeft <= 0 ? 'PASÓ' : daysLeft + 'd restantes'}</span>` : ''}
                        <button class="btn-ghost btn-sm" onclick="App.toggleActivityDone('${a.id}')" style="margin-left:auto;padding:2px 8px;font-size:0.7rem;" title="Marcar como entregada / pendiente">
                            ${isDone ? '[ENTREGADO]' : '[PENDIENTE]'}
                        </button>
                    </div>
                    ${a.desc ? `<div class="tl-desc">${a.desc}</div>` : ''}
                </div>
            </div>`;
        });
        wrap.innerHTML = html;
    }

    /* ════════════════════════════════════════════════════════
       GRADES
    ════════════════════════════════════════════════════════ */
    function getGrades() {
        const d = localStorage.getItem('gx_grades');
        return d ? JSON.parse(d) : [];
    }

    function saveGrades(arr) {
        localStorage.setItem('gx_grades', JSON.stringify(arr));
    }

    function computeAverage(g) {
        // Weighted average: each corte has its own weight %
        const entries = g.entries || [];
        if (entries.length === 0) return null;
        let sumW = 0, sumWV = 0;
        entries.forEach(e => {
            const w = parseFloat(e.weight) || 0;
            const v = parseFloat(e.grade) ?? null;
            if (v !== null) { sumWV += w * v; sumW += w; }
        });
        return sumW > 0 ? (sumWV / sumW) : null;
    }

    function gradeColor(avg) {
        if (avg === null) return 'var(--text-3)';
        if (avg >= 16) return 'var(--green)';
        if (avg >= 12) return 'var(--cyan)';
        if (avg >= 9)  return 'var(--orange)';
        return 'var(--red)';
    }

    function renderGrades() {
        if (typeof Student !== 'undefined') {
            Student.renderGradesTab();
            return;
        }

        const grades   = getGrades();
        const subjects = Schedule.getSubjects();
        const grid     = document.getElementById('gradesGrid');
        const summBar  = document.getElementById('gradesSummaryBar');
        if (!grid) return;

        if (grades.length === 0) {
            grid.innerHTML = '<p class="empty-msg" style="text-align:center;padding:40px">Sin calificaciones registradas aún</p>';
            if (summBar) summBar.innerHTML = '';
            return;
        }

        let html = '';
        let summHtml = '';
        grades.forEach(g => {
            const subj = subjects.find(s => s.id === g.subjectId);
            const avg  = computeAverage(g);
            const color = subj ? subj.color : 'var(--cyan)';
            const avgStr = avg !== null ? avg.toFixed(1) : '—';
            const progPct = avg !== null ? Math.min(avg / 20 * 100, 100) : 0;

            summHtml += `<div class="grade-summary-chip">
                <span class="gsub">${subj ? subj.shortName || subj.name.slice(0,10) : g.subjectId}</span>
                <span class="gval" style="color:${gradeColor(avg)}">${avgStr}</span>
            </div>`;

            const rows = (g.entries || []).map(e =>
                `<div class="corte-row">
                    <span class="corte-label">${e.corte}° Corte</span>
                    <span class="corte-weight">${e.weight}%</span>
                    <span class="corte-val" style="color:${gradeColor(parseFloat(e.grade))}">
                        ${e.grade !== '' && e.grade !== null ? parseFloat(e.grade).toFixed(1) + ' / 20' : '—'}
                    </span>
                </div>`
            ).join('');

            html += `<div class="grade-card">
                <div class="grade-card-header">
                    <span class="grade-color-bar" style="background:${color}"></span>
                    <span class="grade-subj-name">${subj ? subj.name : g.subjectId}</span>
                    <span class="grade-avg-badge" style="color:${gradeColor(avg)}">${avgStr}</span>
                </div>
                <div class="grade-card-body">
                    ${rows}
                    <div class="grade-progress">
                        <div class="progress-bar-wrap">
                            <div class="progress-bar-fill" style="width:${progPct}%;background:${color}"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        });

        grid.innerHTML = html;
        if (summBar) summBar.innerHTML = summHtml;
    }

    function openGradeModal() {
        const subjects = Schedule.getSubjects();
        if (subjects.length === 0) return showToast('Primero carga las materias en el Horario', 'error');

        // Build simple inline modal-like prompt with a dedicated form
        // For now, use a quick dialog approach
        const subjectOptions = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        const existing = document.getElementById('gradeFormInline');
        if (existing) { existing.remove(); return; }

        const form = document.createElement('div');
        form.id = 'gradeFormInline';
        form.className = 'card';
        form.style.cssText = 'margin-bottom:20px;animation:fadeUp 0.3s ease both;';
        form.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <span style="font-weight:700;color:var(--cyan)">Registrar Notas por Corte</span>
                <button onclick="document.getElementById('gradeFormInline').remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:1rem">&times;</button>
            </div>
            <div class="form-grid" style="margin-bottom:12px">
                <div class="form-field full-span">
                    <label class="form-label">Materia</label>
                    <select class="form-select" id="gradeSubject">${subjectOptions}</select>
                </div>
            </div>
            <div id="gradeCorteRows">
                ${[1,2,3,4].map(c => `
                    <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:10px;align-items:center;margin-bottom:8px">
                        <span style="font-size:0.75rem;color:var(--text-2);font-weight:600;white-space:nowrap">${c}° Corte</span>
                        <div><label class="form-label">Nota (0-20)</label>
                             <input type="number" class="form-input" id="gradeVal${c}" min="0" max="20" step="0.1" placeholder="Ej: 14.5"></div>
                        <div><label class="form-label">Ponderación %</label>
                             <input type="number" class="form-input" id="gradeW${c}" min="0" max="100" step="1" placeholder="Ej: 25"></div>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                <button class="btn-ghost" onclick="document.getElementById('gradeFormInline').remove()">Cancelar</button>
                <button class="btn-primary" onclick="App._saveGradeInline()">Guardar Notas</button>
            </div>
        `;
        const gradesSection = document.getElementById('panel-grades');
        gradesSection.insertBefore(form, gradesSection.querySelector('.grades-summary-bar') || gradesSection.firstChild);
    }

    function _saveGradeInline() {
        const subjId = document.getElementById('gradeSubject')?.value;
        if (!subjId) return showToast('Selecciona una materia', 'error');

        const entries = [1,2,3,4].map(c => ({
            corte: c,
            grade: document.getElementById(`gradeVal${c}`)?.value ?? '',
            weight: document.getElementById(`gradeW${c}`)?.value || 0,
        }));

        const grades = getGrades();
        const existing = grades.find(g => g.subjectId === subjId);
        if (existing) {
            existing.entries = entries;
        } else {
            grades.push({ id: Date.now().toString(), subjectId: subjId, entries });
        }
        saveGrades(grades);
        document.getElementById('gradeFormInline')?.remove();
        renderGrades();
        showToast('Notas guardadas', 'success');
    }

    function toggleActivityDone(id) {
        if (typeof Student !== 'undefined') {
            const nowDone = Student.toggleDelivered(id);
            renderTimeline();
            showToast(nowDone ? 'Actividad marcada como entregada' : 'Actividad marcada como pendiente', 'info');
        }
    }

    /* ════════════════════════════════════════════════════════
       TOAST
    ════════════════════════════════════════════════════════ */
    function showToast(msg, type = 'info') {
        if (typeof Notify !== 'undefined') {
            Notify.toast(msg, type);
            return;
        }
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    /* ════════════════════════════════════════════════════════
       PARTICLES
    ════════════════════════════════════════════════════════ */
    function spawnParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        for (let i = 0; i < 22; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 4 + 1;
            const left = Math.random() * 100;
            const dur  = Math.random() * 14 + 8;
            const del  = Math.random() * 10;
            const col  = Math.random() > 0.5 ? '#00f0ff' : '#00e5a0';
            p.style.cssText = `
                width:${size}px;height:${size}px;
                left:${left}%;
                animation-duration:${dur}s;
                animation-delay:-${del}s;
                background:${col};
                box-shadow:0 0 ${size*2}px ${col};
            `;
            container.appendChild(p);
        }
    }

    /* ════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════ */
    function getDaysLeft(dateStr) {
        if (!dateStr) return null;
        const now = new Date(); now.setHours(0,0,0,0);
        const d   = new Date(dateStr + 'T00:00:00');
        return Math.round((d - now) / 86400000);
    }

    function getUrgencyClass(days) {
        if (days === null) return '';
        if (days <= 1) return 'urgency-red';
        if (days <= 5) return 'urgency-orange';
        return 'urgency-green';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const [y,m,d] = dateStr.split('-').map(Number);
        return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
    }

    /* Timeline filter handlers moved to init() */

    /* ── PUBLIC API ─────────────────────────────────────────── */
    return {
        init,
        switchTab,
        switchCalView,
        openNewActivity,
        closeActivityModal,
        renderDashboard,
        renderTimeline,
        renderGrades,
        showToast,
        getActivities,
        toggleActivityDone,
        _calDayClick,
        _saveGradeInline,
    };

})();

window.App = App;

/* ─── Bootstrap ────────────────────────────────────────────── */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
