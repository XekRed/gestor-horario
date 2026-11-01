/* =============================================================
   student.js — Panel Personal del Estudiante
   Almacenamiento 100% independiente en localStorage por dispositivo.
   Checklist de entregas, seguimiento de notas por corte (0-20),
   proyecciones de aprobación y respaldo de datos personales en JSON.
   ============================================================= */

const Student = (() => {

    /* ── KEYS LOCALSTORAGE ───────────────────────────────────── */
    const LS = {
        profile:   'gx_student_profile',
        enrolled:  'gx_student_enrolled_ids',
        delivered: 'gx_student_delivered',
        grades:    'gx_student_grades',
        seen:      'gx_student_seen_activities',
    };

    /* ══════════════════════════════════════════════════════════
       1. CHECKLIST DE ENTREGAS Y PROGRESO PERSONAL
    ═══════════════════════════════════════════════════════════ */
    function getDeliveredMap() {
        const d = localStorage.getItem(LS.delivered);
        return d ? JSON.parse(d) : {};
    }

    function isDelivered(activityId) {
        const map = getDeliveredMap();
        return !!map[activityId];
    }

    function toggleDelivered(activityId) {
        const map = getDeliveredMap();
        map[activityId] = !map[activityId];
        localStorage.setItem(LS.delivered, JSON.stringify(map));

        // Marcar como vista
        markActivitySeen(activityId);

        // Actualizar vistas afectadas
        renderStudentSummary();
        if (typeof App !== 'undefined') App.renderDashboard();
        return map[activityId];
    }

    function getProgress() {
        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const deliveredMap = getDeliveredMap();
        const total = allActs.length;
        const delivered = allActs.filter(a => deliveredMap[a.id]).length;
        const percentage = total > 0 ? Math.round((delivered / total) * 100) : 0;

        return { total, delivered, percentage };
    }

    /* ══════════════════════════════════════════════════════════
       2. ACTIVIDADES NO VISTAS ("¡NUEVA!")
    ═══════════════════════════════════════════════════════════ */
    function getSeenActivities() {
        const d = localStorage.getItem(LS.seen);
        return d ? JSON.parse(d) : [];
    }

    function isActivityNew(activity) {
        if (!activity || !activity.id) return false;
        const seen = getSeenActivities();
        if (seen.includes(activity.id)) return false;

        // Considerar nueva si fue creada en los últimos 4 días (96h)
        if (activity.createdAt) {
            const created = new Date(activity.createdAt).getTime();
            const now = Date.now();
            return (now - created) < (96 * 3600 * 1000);
        }
        return false;
    }

    function markActivitySeen(activityId) {
        const seen = getSeenActivities();
        if (!seen.includes(activityId)) {
            seen.push(activityId);
            localStorage.setItem(LS.seen, JSON.stringify(seen));
        }
    }

    /* ══════════════════════════════════════════════════════════
       3. REGISTRO Y CALCULADORA DE NOTAS (ESCALA 0–20 PTS)
    ═══════════════════════════════════════════════════════════ */
    // Estructura: { [activityId]: numericGrade, subjects: { [subjId]: { corte1: grade, ... } } }
    function getGradesStore() {
        const d = localStorage.getItem(LS.grades);
        return d ? JSON.parse(d) : { activities: {}, customCortes: {} };
    }

    function saveGradesStore(store) {
        localStorage.setItem(LS.grades, JSON.stringify(store));
    }

    let _isUnlockedThisSession = false;

    function getGradeMode() {
        return (typeof Prefs !== 'undefined' && Prefs.getGradeMode) ? Prefs.getGradeMode() : 'percentage';
    }

    function to20(val, mode) {
        if (val === null || val === undefined || isNaN(val) || val === '') return null;
        const num = parseFloat(val);
        if (mode === 'percentage') return (num / 100) * 20;
        if (mode === 'scale5') return num * 4;
        return num; // scale20
    }

    function from20(val20, mode) {
        if (val20 === null || val20 === undefined || isNaN(val20)) return '';
        if (mode === 'percentage') return Math.round((val20 / 20) * 100);
        if (mode === 'scale5') return (val20 / 4).toFixed(1);
        return parseFloat(val20).toFixed(1);
    }

    function getModeConfig(mode) {
        if (mode === 'percentage') {
            return { max: 100, step: 1, tag: '%', placeholder: '0-100%', title: 'Nota en Porcentaje (0–100%)' };
        }
        if (mode === 'scale5') {
            return { max: 5, step: 0.1, tag: '/ 5', placeholder: '0-5', title: 'Nota sobre 5 pts' };
        }
        return { max: 20, step: 0.1, tag: '/ 20', placeholder: '0-20', title: 'Nota sobre 20 pts' };
    }

    function getActivityGrade(activityId) {
        const store = getGradesStore();
        return store.activities ? store.activities[activityId] : null;
    }

    function setActivityGrade(activityId, grade) {
        const store = getGradesStore();
        if (!store.activities) store.activities = {};

        const mode = getGradeMode();
        const num = parseFloat(grade);
        if (isNaN(num) || grade === '' || grade === null) {
            delete store.activities[activityId];
        } else {
            const base20 = to20(num, mode);
            store.activities[activityId] = Math.max(0, Math.min(20, parseFloat(base20.toFixed(2))));
        }

        saveGradesStore(store);
        renderGradesTab();
        if (typeof App !== 'undefined') App.renderDashboard();
    }

    function getCustomCorteGrade(subjectId, corteNum) {
        const store = getGradesStore();
        return (store.customCortes && store.customCortes[subjectId]) ? store.customCortes[subjectId][corteNum] : null;
    }

    function setCustomCorteGrade(subjectId, corteNum, grade) {
        const store = getGradesStore();
        if (!store.customCortes) store.customCortes = {};
        if (!store.customCortes[subjectId]) store.customCortes[subjectId] = {};

        const mode = getGradeMode();
        const num = parseFloat(grade);
        if (isNaN(num) || grade === '' || grade === null) {
            delete store.customCortes[subjectId][corteNum];
        } else {
            const base20 = to20(num, mode);
            store.customCortes[subjectId][corteNum] = Math.max(0, Math.min(20, parseFloat(base20.toFixed(2))));
        }

        saveGradesStore(store);
        renderGradesTab();
        if (typeof App !== 'undefined') App.renderDashboard();
    }

    /* ── CÁLCULO PONDERADO POR MATERIA ── */
    function calculateSubjectMetrics(subjectId) {
        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const subjActs = allActs.filter(a => a.subjectId === subjectId);
        const gradesStore = getGradesStore();

        let evaluatedWeight = 0;
        let pointsAccumulated = 0;
        let totalAssignedWeight = 0;

        // Caso 1: Asignatura con actividades programadas por el Admin
        if (subjActs.length > 0) {
            subjActs.forEach(a => {
                const w = parseFloat(a.weight) || 0;
                totalAssignedWeight += w;
                const g = gradesStore.activities ? gradesStore.activities[a.id] : null;

                if (g !== null && g !== undefined && !isNaN(g)) {
                    evaluatedWeight += w;
                    pointsAccumulated += (parseFloat(g) * (w / 100));
                }
            });
        } else {
            // Caso 2: Sin actividades específicas del admin, usa cortes manuales (25% c/u)
            const custom = (gradesStore.customCortes && gradesStore.customCortes[subjectId]) || {};
            [1, 2, 3, 4].forEach(c => {
                totalAssignedWeight += 25;
                const g = custom[c];
                if (g !== null && g !== undefined && !isNaN(g)) {
                    evaluatedWeight += 25;
                    pointsAccumulated += (parseFloat(g) * 0.25);
                }
            });
        }

        const remainingWeight = Math.max(0, 100 - evaluatedWeight);
        const passingThreshold = 9.5; // Redondea a 10 en la escala venezolana
        const neededPoints = Math.max(0, passingThreshold - pointsAccumulated);

        let pointsNeededAverage = null;
        let status = 'in_progress'; // 'passed' | 'in_progress' | 'at_risk' | 'failed'

        if (pointsAccumulated >= passingThreshold) {
            status = 'passed';
            pointsNeededAverage = 0;
        } else if (remainingWeight <= 0) {
            status = 'failed';
        } else {
            const req = (neededPoints / (remainingWeight / 100));
            if (req > 20) {
                status = 'failed'; // Imposible alcanzar 9.5 incluso con 20 en todo lo restante
            } else if (req > 14) {
                status = 'at_risk';
                pointsNeededAverage = parseFloat(req.toFixed(1));
            } else {
                status = 'in_progress';
                pointsNeededAverage = parseFloat(req.toFixed(1));
            }
        }

        return {
            pointsAccumulated: parseFloat(pointsAccumulated.toFixed(2)),
            evaluatedWeight: Math.round(evaluatedWeight),
            remainingWeight: Math.round(remainingWeight),
            neededPoints: parseFloat(neededPoints.toFixed(2)),
            pointsNeededAverage,
            status,
            subjActs
        };
    }

    /* ══════════════════════════════════════════════════════════
       4. RESPALDO PERSONAL EN JSON (EXPORTAR / IMPORTAR)
    ═══════════════════════════════════════════════════════════ */
    function exportStudentData() {
        const backup = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            delivered: getDeliveredMap(),
            grades: getGradesStore(),
            seen: getSeenActivities(),
        };

        const jsonStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mis_notas_xk_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        if (typeof Notify !== 'undefined') {
            Notify.toast('Copia de respaldo personal descargada con éxito', 'success');
        }
    }

    function importStudentDataFromFile(inputEl) {
        const file = inputEl.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.delivered) localStorage.setItem(LS.delivered, JSON.stringify(data.delivered));
                if (data.grades) localStorage.setItem(LS.grades, JSON.stringify(data.grades));
                if (data.seen) localStorage.setItem(LS.seen, JSON.stringify(data.seen));

                renderGradesTab();
                if (typeof Activities !== 'undefined') {
                    Activities.renderTimeline();
                    Activities.renderCalendar();
                }
                if (typeof App !== 'undefined') App.renderDashboard();

                if (typeof Notify !== 'undefined') {
                    Notify.toast('Notas y progreso personal restaurados', 'success');
                }
            } catch (err) {
                if (typeof Notify !== 'undefined') {
                    Notify.toast('Archivo JSON de respaldo inválido', 'error');
                }
            }
        };
        reader.readAsText(file);
    }

    /* ══════════════════════════════════════════════════════════
       5. RENDERIZADO: PESTAÑA "MIS NOTAS"
    ═══════════════════════════════════════════════════════════ */
    function renderGradesTab() {
        renderStudentSummary();
        renderGradesGrid();
    }

    function renderStudentSummary() {
        const container = document.getElementById('studentProgressCard');
        if (!container) return;

        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const progress = getProgress();

        let sumAccum = 0;
        let countGraded = 0;
        let passedCount = 0;
        let atRiskCount = 0;
        let inProgressCount = 0;

        subjects.forEach(s => {
            const m = calculateSubjectMetrics(s.id);
            if (m.evaluatedWeight > 0) {
                sumAccum += (m.pointsAccumulated * (100 / m.evaluatedWeight)); // Escalar a base 20 de lo evaluado
                countGraded++;
            }
            if (m.status === 'passed') passedCount++;
            else if (m.status === 'at_risk') atRiskCount++;
            else inProgressCount++;
        });

        const generalAverage = countGraded > 0 ? (sumAccum / countGraded).toFixed(1) : '—';

        const isSecActive = (typeof Prefs !== 'undefined' && Prefs.isSecurityEnabled && Prefs.isSecurityEnabled());
        const secLockBtn = (isSecActive && _isUnlockedThisSession)
            ? `<button class="btn-ghost btn-sm" onclick="Student.lockGrades()" style="padding:2px 8px;font-size:0.68rem;color:var(--text-2);border-color:rgba(255,255,255,0.15);cursor:pointer;" title="Bloquear Notas con PIN">Bloquear Perfil</button>`
            : '';

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span class="mono" style="font-size:0.75rem;color:var(--text-3);">RESUMEN ACADÉMICO</span>
                ${secLockBtn}
            </div>
            <div class="student-summary-grid">
                <div class="summary-stat-box">
                    <span class="summary-stat-label">Promedio Actual Evaluado</span>
                    <span class="summary-stat-val mono" style="color:var(--cyan);">${generalAverage} <small style="font-size:0.65rem;color:var(--text-3)">/ 20 pts</small></span>
                </div>
                <div class="summary-stat-box">
                    <span class="summary-stat-label">Materias Aprobadas</span>
                    <span class="summary-stat-val mono" style="color:var(--green);">${passedCount} <small style="font-size:0.65rem;color:var(--text-3)">de ${subjects.length}</small></span>
                </div>
                <div class="summary-stat-box">
                    <span class="summary-stat-label">En Riesgo Académico</span>
                    <span class="summary-stat-val mono" style="color:${atRiskCount > 0 ? 'var(--red)' : 'var(--text-2)'};">${atRiskCount}</span>
                </div>
                <div class="summary-stat-box">
                    <span class="summary-stat-label">Progreso de Entregas</span>
                    <span class="summary-stat-val mono" style="color:var(--orange);">${progress.delivered} / ${progress.total} (${progress.percentage}%)</span>
                </div>
            </div>

            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width:${progress.percentage}%;"></div>
            </div>
        `;
    }

    function renderGradesGrid() {
        const grid = document.getElementById('gradesGrid');
        if (!grid) return;

        // Comprobar bloqueo opcional por PIN de perfil
        if (typeof Prefs !== 'undefined' && Prefs.isSecurityEnabled && Prefs.isSecurityEnabled() && !_isUnlockedThisSession) {
            const ci = Prefs.getStudentCi() || 'Estudiante';
            grid.innerHTML = `
                <div class="grades-lock-card" style="text-align:center;padding:44px 20px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;max-width:440px;margin:24px auto;">
                    <div style="width:48px;height:48px;border-radius:50%;background:rgba(0,240,255,0.08);border:1px solid rgba(0,240,255,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 14px auto;color:var(--cyan);">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <h3 style="font-size:1.05rem;color:var(--text-1);margin-bottom:6px;">Perfil Protegido por PIN</h3>
                    <p style="font-size:0.78rem;color:var(--text-2);line-height:1.4;margin:0 auto 18px auto;">
                        Cédula: <b class="mono" style="color:var(--cyan);">${ci}</b><br>
                        Ingresa tu PIN de 4 dígitos para acceder a tus calificaciones personales.
                    </p>
                    <div style="display:flex;gap:8px;justify-content:center;max-width:240px;margin:0 auto;">
                        <input type="password" maxlength="4" id="inputGradesUnlockPin" class="form-input mono" placeholder="••••" style="text-align:center;font-size:1.15rem;letter-spacing:5px;" inputmode="numeric" onkeydown="if(event.key==='Enter') Student.unlockWithPin()">
                        <button class="btn-primary btn-sm" onclick="Student.unlockWithPin()" style="white-space:nowrap;">Acceder</button>
                    </div>
                    <div id="gradesUnlockError" style="display:none;color:var(--red);font-size:0.74rem;margin-top:10px;">PIN incorrecto. Intenta de nuevo.</div>
                </div>
            `;
            return;
        }

        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        if (subjects.length === 0) {
            grid.innerHTML = '<p class="empty-msg" style="text-align:center;padding:40px;">No hay materias registradas en el horario.</p>';
            return;
        }

        const mode = getGradeMode();
        const cfg  = getModeConfig(mode);

        const STATUS_BADGES = {
            passed:      '<span class="grade-status-pill status-passed">Aprobada</span>',
            in_progress: '<span class="grade-status-pill status-progress">En Curso [ACTIVO]</span>',
            at_risk:     '<span class="grade-status-pill status-risk">En Riesgo</span>',
            failed:      '<span class="grade-status-pill status-failed">Reprobada</span>',
        };

        let html = '';

        subjects.forEach(s => {
            const m = calculateSubjectMetrics(s.id);
            const statusBadge = STATUS_BADGES[m.status] || STATUS_BADGES.in_progress;

            let projectionMsg = '';
            if (m.status === 'passed') {
                projectionMsg = '<div class="projection-box safe"><b>[APROBADA]</b> Ya acumulaste los 9.5 puntos mínimos reglamentarios.</div>';
            } else if (m.status === 'failed') {
                projectionMsg = '<div class="projection-box danger"><b>[ATENCIÓN]</b> Matemáticamente imposible alcanzar 9.5 en el porcentaje restante.</div>';
            } else if (m.pointsNeededAverage !== null) {
                const colorClass = m.status === 'at_risk' ? 'danger' : 'notice';
                projectionMsg = `<div class="projection-box ${colorClass}">[META] Necesitas promediar al menos <b>${m.pointsNeededAverage} / 20 pts</b> en el <b>${m.remainingWeight}%</b> restante para aprobar.</div>`;
            }

            // Desglose por cortes (1 al 4)
            const cortesHtml = [1, 2, 3, 4].map(corteNum => {
                const corteActs = m.subjActs.filter(a => String(a.corte) === String(corteNum));

                if (corteActs.length > 0) {
                    // Muestra cada actividad del corte
                    const actsList = corteActs.map(act => {
                        const gradeVal = getActivityGrade(act.id);
                        const displayVal = (gradeVal !== null && gradeVal !== undefined && gradeVal !== '')
                            ? from20(parseFloat(gradeVal), mode)
                            : '';
                        return `
                        <div class="grade-entry-row">
                            <div style="flex:1;min-width:0;">
                                <div class="grade-act-name">${act.title}</div>
                                <div class="grade-act-sub mono">[POND: ${act.weight || 0}%]</div>
                            </div>
                            <div class="grade-input-wrap">
                                <input type="number" step="${cfg.step}" min="0" max="${cfg.max}" class="grade-num-input mono"
                                    value="${displayVal}" placeholder="${cfg.placeholder}"
                                    onchange="Student.setActivityGrade('${act.id}', this.value)"
                                    title="${cfg.title}">
                                <span class="grade-scale-tag">${cfg.tag}</span>
                            </div>
                        </div>`;
                    }).join('');

                    return `
                    <div class="corte-block">
                        <div class="corte-title-row">
                            <span class="corte-tag-name">Corte ${corteNum}</span>
                        </div>
                        <div class="corte-acts-list">${actsList}</div>
                    </div>`;
                } else {
                    // Sin actividades específicas del corte: input directo por corte (25%)
                    const customGrade = getCustomCorteGrade(s.id, corteNum);
                    const displayCustom = (customGrade !== null && customGrade !== undefined && customGrade !== '')
                        ? from20(parseFloat(customGrade), mode)
                        : '';
                    return `
                    <div class="corte-block">
                        <div class="grade-entry-row">
                            <div style="flex:1;">
                                <div class="grade-act-name">Corte ${corteNum}</div>
                                <div class="grade-act-sub mono">25% (Estimado)</div>
                            </div>
                            <div class="grade-input-wrap">
                                <input type="number" step="${cfg.step}" min="0" max="${cfg.max}" class="grade-num-input mono"
                                    value="${displayCustom}" placeholder="${cfg.placeholder}"
                                    onchange="Student.setCustomCorteGrade('${s.id}', ${corteNum}, this.value)"
                                    title="${cfg.title}">
                                <span class="grade-scale-tag">${cfg.tag}</span>
                            </div>
                        </div>
                    </div>`;
                }
            }).join('');

            html += `
            <div class="subject-grade-card" style="border-top: 3px solid ${s.color || 'var(--cyan)'};">
                <div class="subj-grade-header">
                    <div>
                        <span class="subj-grade-title">${s.name} ${s.shortName ? `<span class="mono">(${s.shortName})</span>` : ''}</span>
                        <div class="subj-grade-meta">
                            ${s.teacher ? `<span>Docente: ${s.teacher}</span>` : ''}
                            ${s.room ? `<span>Aula ${s.room}</span>` : ''}
                        </div>
                    </div>
                    ${statusBadge}
                </div>

                <div class="subj-metrics-strip">
                    <div class="metric-cell">
                        <span class="metric-lbl">Acumulado</span>
                        <span class="metric-val mono" style="color:var(--cyan);">${m.pointsAccumulated} <small style="font-size:0.6rem;color:var(--text-3)">/ 20</small></span>
                    </div>
                    <div class="metric-cell">
                        <span class="metric-lbl">Evaluado</span>
                        <span class="metric-val mono">${m.evaluatedWeight}%</span>
                    </div>
                    <div class="metric-cell">
                        <span class="metric-lbl">Por Evaluar</span>
                        <span class="metric-val mono" style="color:var(--orange);">${m.remainingWeight}%</span>
                    </div>
                </div>

                <div class="cortes-wrapper">
                    ${cortesHtml}
                </div>

                ${projectionMsg}
            </div>`;
        });

        grid.innerHTML = html;
    }

    function unlockWithPin() {
        const pinInput = document.getElementById('inputGradesUnlockPin');
        const pin = pinInput ? pinInput.value.trim() : '';
        if (typeof Prefs !== 'undefined' && Prefs.checkStudentPin && Prefs.checkStudentPin(pin)) {
            _isUnlockedThisSession = true;
            renderGradesTab();
            if (typeof Notify !== 'undefined') Notify.toast('Perfil de notas desbloqueado', 'success', 2000);
        } else {
            const err = document.getElementById('gradesUnlockError');
            if (err) err.style.display = 'block';
        }
    }

    function lockGrades() {
        _isUnlockedThisSession = false;
        renderGradesTab();
        if (typeof Notify !== 'undefined') Notify.toast('Perfil de notas bloqueado', 'info', 2000);
    }

    /* ══════════════════════════════════════════════════════════
       4. IDENTIFICACIÓN DEL ESTUDIANTE Y PERFIL (SINCRONIZADO POR CÉDULA)
    ═══════════════════════════════════════════════════════════ */
    function getProfile() {
        try {
            const raw = localStorage.getItem(LS.profile);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function hasActiveProfile() {
        const p = getProfile();
        return Boolean(p && p.ci);
    }

    function saveProfile(data) {
        if (!data || !data.ci) return;
        localStorage.setItem(LS.profile, JSON.stringify(data));
        updateHeaderProfile();
    }

    function updateHeaderProfile() {
        const p = getProfile();
        const carreraEl = document.getElementById('metaCarrera');
        const seccionEl = document.getElementById('metaSeccion');
        const studentNameEl = document.getElementById('metaStudentName');

        if (p) {
            if (carreraEl && p.career) carreraEl.textContent = p.career.toUpperCase();
            if (seccionEl && p.sectionCode) seccionEl.textContent = p.sectionCode.toUpperCase();
            if (studentNameEl) studentNameEl.textContent = `${p.fullName || 'Estudiante'} [${p.ci}]`;
        } else {
            if (studentNameEl) studentNameEl.textContent = 'Identificarse';
        }
    }

    function openIdentificationModal() {
        const modal = document.getElementById('modalStudentLogin');
        if (!modal) return;
        const p = getProfile();
        if (p) {
            const nameIn = document.getElementById('studentRegName');
            const ciIn = document.getElementById('studentRegCi');
            const carIn = document.getElementById('studentRegCareer');
            const secIn = document.getElementById('studentRegSection');
            if (nameIn) nameIn.value = p.fullName || '';
            if (ciIn) ciIn.value = p.ci || '';
            if (carIn) carIn.value = p.career || 'INGENIERÍA DE SISTEMAS';
            if (secIn) secIn.value = p.sectionCode || '08S-2623-D1';
        }
        modal.classList.add('open');
    }

    function closeIdentificationModal(force = false) {
        if (force || hasActiveProfile()) {
            document.getElementById('modalStudentLogin')?.classList.remove('open');
        }
    }

    function switchIdTab(tab) {
        const tabNew = document.getElementById('btnIdTabNew');
        const tabExist = document.getElementById('btnIdTabExisting');
        const panelNew = document.getElementById('panelIdNew');
        const panelExist = document.getElementById('panelIdExisting');
        const errEl = document.getElementById('studentLoginErrorMsg');
        if (errEl) errEl.style.display = 'none';

        if (tab === 'existing') {
            tabNew?.classList.remove('active');
            tabExist?.classList.add('active');
            if (panelNew) panelNew.style.display = 'none';
            if (panelExist) panelExist.style.display = 'block';
            setTimeout(() => document.getElementById('studentLoginCi')?.focus(), 100);
        } else {
            tabNew?.classList.add('active');
            tabExist?.classList.remove('active');
            if (panelNew) panelNew.style.display = 'block';
            if (panelExist) panelExist.style.display = 'none';
            setTimeout(() => document.getElementById('studentRegName')?.focus(), 100);
        }
    }

    async function submitNewStudentForm() {
        const nameIn = document.getElementById('studentRegName');
        const ciIn   = document.getElementById('studentRegCi');
        const carIn  = document.getElementById('studentRegCareer');
        const secIn  = document.getElementById('studentRegSection');
        const errEl  = document.getElementById('studentLoginErrorMsg');

        if (errEl) errEl.style.display = 'none';

        const fullName = nameIn?.value.trim();
        const rawCi    = ciIn?.value.trim().toUpperCase();
        const career   = carIn?.value.trim() || 'INGENIERÍA DE SISTEMAS';
        const sectionCode = secIn?.value.trim().toUpperCase() || '08S-2623-D1';

        if (!fullName || fullName.length < 3) {
            showIdError('Por favor ingresa tu Nombre Completo.');
            return;
        }

        if (!rawCi || rawCi.length < 5) {
            showIdError('Por favor ingresa una Cédula válida (Ej: V-28123456).');
            return;
        }

        const formattedCi = rawCi.startsWith('V-') || rawCi.startsWith('E-') ? rawCi : `V-${rawCi}`;

        const profileData = {
            ci: formattedCi,
            fullName,
            career,
            sectionCode
        };

        saveProfile(profileData);

        // Nuevo estudiante: inicia con horario en blanco (0 materias inscritas)
        localStorage.setItem(LS.enrolled, JSON.stringify([]));

        if (typeof DB !== 'undefined' && DB.saveStudent) {
            try {
                await DB.saveStudent(profileData);
            } catch (e) {
                console.warn('[Student] Error guardando en Supabase:', e);
            }
        }

        closeIdentificationModal(true);
        _refreshAllAppViews();

        if (typeof Notify !== 'undefined') {
            Notify.toast(`Bienvenido, ${fullName}. Tu horario inicia en blanco. ¡Inscribe tus materias para comenzar!`, 'success', 4500);
        }

        setTimeout(() => {
            openEnrollModal();
        }, 600);
    }

    async function submitExistingStudentForm() {
        const ciIn   = document.getElementById('studentLoginCi');
        const pinIn  = document.getElementById('studentLoginPin');
        const errEl  = document.getElementById('studentLoginErrorMsg');

        if (errEl) errEl.style.display = 'none';

        const rawCi = ciIn?.value.trim().toUpperCase();
        const pin   = pinIn?.value.trim();

        if (!rawCi || rawCi.length < 5) {
            showIdError('Por favor ingresa tu Cédula de Identidad.');
            return;
        }

        const formattedCi = rawCi.startsWith('V-') || rawCi.startsWith('E-') ? rawCi : `V-${rawCi}`;

        let student = null;
        if (typeof DB !== 'undefined' && DB.getStudentByCi) {
            student = await DB.getStudentByCi(formattedCi);
        }

        if (!student) {
            showIdError(`Cédula [${formattedCi}] no encontrada. Si eres nuevo, regístrate en la pestaña "Nuevo Estudiante".`);
            return;
        }

        if (student.pin) {
            if (!pin) {
                showIdError('Esta Cédula tiene un PIN de seguridad asignado. Por favor ingrésalo.');
                const pinWrap = document.getElementById('existingPinWrap');
                if (pinWrap) pinWrap.style.display = 'block';
                return;
            }
            if (String(pin).trim() !== String(student.pin).trim()) {
                showIdError('PIN incorrecto para esta Cédula.');
                return;
            }
        }

        const profileData = {
            ci: student.ci || formattedCi,
            fullName: student.full_name || student.fullName || 'Estudiante',
            career: student.career || 'INGENIERÍA DE SISTEMAS',
            sectionCode: student.section_code || student.sectionCode || '08S-2623-D1',
            pin: student.pin || null
        };
        saveProfile(profileData);

        if (typeof DB !== 'undefined' && DB.getStudentEnrollments) {
            try {
                const enrollments = await DB.getStudentEnrollments(formattedCi);
                if (Array.isArray(enrollments)) {
                    const enrolledIds = enrollments.map(e => e.subject_id || e);
                    localStorage.setItem(LS.enrolled, JSON.stringify(enrolledIds));
                }
            } catch (e) {
                console.warn('[Student] Error recuperando inscripciones:', e);
            }
        }

        closeIdentificationModal(true);
        _refreshAllAppViews();

        const count = getEnrolledSubjectIds().length;
        if (typeof Notify !== 'undefined') {
            Notify.toast(`Perfil recuperado [${profileData.fullName}]. Se cargaron ${count} materias inscritas.`, 'success', 3500);
        }
    }

    function showIdError(msg) {
        const errEl = document.getElementById('studentLoginErrorMsg');
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
        }
    }

    function logoutStudent() {
        if (!confirm('¿Deseas cambiar de perfil o cerrar sesión de estudiante?')) return;
        localStorage.removeItem(LS.profile);
        localStorage.removeItem(LS.enrolled);
        updateHeaderProfile();
        _refreshAllAppViews();
        openIdentificationModal();
    }

    function _refreshAllAppViews() {
        if (typeof Schedule !== 'undefined') {
            Schedule.renderTable();
            Schedule.renderLegend();
            Schedule.populateSubjectSelects();
        }
        if (typeof App !== 'undefined') {
            App.renderDashboard();
            if (App.currentTab === 'grades') renderGradesTab();
        }
        if (typeof Activities !== 'undefined') {
            Activities.renderTimeline();
            Activities.renderCalendar();
        }
    }

    /* ══════════════════════════════════════════════════════════
       5. INSCRIPCIÓN DE MATERIAS, BÚSQUEDA Y DETECCIÓN DE CHOQUES
    ═══════════════════════════════════════════════════════════ */
    let _selectedPreviewSubjectId = null;
    let _enrollFilter = 'section'; // 'section' | 'all' | 'enrolled'
    let _enrollSearchQuery = '';

    const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    function getEnrolledSubjectIds() {
        try {
            const raw = localStorage.getItem(LS.enrolled);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function isSubjectEnrolled(subjectId) {
        return getEnrolledSubjectIds().includes(subjectId);
    }

    function getEnrolledSubjects() {
        const ids = getEnrolledSubjectIds();
        if (ids.length === 0) return [];
        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        return catalog.filter(s => ids.includes(s.id));
    }

    function checkScheduleConflict(subjectToTest) {
        if (!subjectToTest || !subjectToTest.slots || !Array.isArray(subjectToTest.slots)) {
            return { hasConflict: false, conflicts: [] };
        }

        const enrolled = getEnrolledSubjects().filter(s => s.id !== subjectToTest.id);
        const conflicts = [];

        subjectToTest.slots.forEach(slotA => {
            const dayA = slotA.day;
            const startA = slotA.startBlock;
            const endA = startA + slotA.span - 1;

            enrolled.forEach(otherSubj => {
                (otherSubj.slots || []).forEach(slotB => {
                    if (slotB.day === dayA) {
                        const startB = slotB.startBlock;
                        const endB = startB + slotB.span - 1;

                        if (Math.max(startA, startB) <= Math.min(endA, endB)) {
                            const dayName = DAY_NAMES[dayA] || `Día ${dayA}`;
                            conflicts.push({
                                dayName,
                                conflictingSubject: otherSubj,
                                slotA,
                                slotB
                            });
                        }
                    }
                });
            });
        });

        return {
            hasConflict: conflicts.length > 0,
            conflicts
        };
    }

    async function enrollSubject(subjectId) {
        if (!subjectId) return;
        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const subj = catalog.find(s => s.id === subjectId);
        if (!subj) return;

        const conflictCheck = checkScheduleConflict(subj);
        if (conflictCheck.hasConflict) {
            const firstConflict = conflictCheck.conflicts[0];
            const msg = `[CHOQUE DE HORARIO DETECTADO]\n` +
                        `Esta materia choca el ${firstConflict.dayName} con:\n` +
                        `• ${firstConflict.conflictingSubject.name} (${firstConflict.conflictingSubject.code || ''})\n\n` +
                        `¿Deseas inscribirla de todas formas?`;
            if (!confirm(msg)) {
                return;
            }
        }

        const ids = getEnrolledSubjectIds();
        if (!ids.includes(subjectId)) {
            ids.push(subjectId);
            localStorage.setItem(LS.enrolled, JSON.stringify(ids));
        }

        const profile = getProfile();
        if (profile && profile.ci && typeof DB !== 'undefined' && DB.enrollStudentSubject) {
            try {
                await DB.enrollStudentSubject(profile.ci, subj);
            } catch (e) {
                console.warn('[Student] Error guardando inscripción en Supabase:', e);
            }
        }

        _refreshAllAppViews();
        renderEnrollModal();

        if (typeof Notify !== 'undefined') {
            Notify.toast(`Materia inscrita: [${subj.code || subj.shortName || subj.id}] ${subj.name}`, 'success', 3000);
        }
    }

    async function unenrollSubject(subjectId) {
        if (!subjectId) return;
        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const subj = catalog.find(s => s.id === subjectId);
        const name = subj ? subj.name : subjectId;

        if (!confirm(`¿Estás seguro de retirar la materia "${name}" de tu horario?`)) {
            return;
        }

        let ids = getEnrolledSubjectIds();
        ids = ids.filter(id => id !== subjectId);
        localStorage.setItem(LS.enrolled, JSON.stringify(ids));

        const profile = getProfile();
        if (profile && profile.ci && typeof DB !== 'undefined' && DB.unenrollStudentSubject) {
            try {
                await DB.unenrollStudentSubject(profile.ci, subjectId);
            } catch (e) {
                console.warn('[Student] Error retirando en Supabase:', e);
            }
        }

        _refreshAllAppViews();
        renderEnrollModal();

        if (typeof Notify !== 'undefined') {
            Notify.toast('Materia retirada de tu horario', 'info', 2500);
        }
    }

    function openEnrollModal(searchQuery = '') {
        const modal = document.getElementById('modalEnrollment');
        if (!modal) return;

        _enrollSearchQuery = searchQuery || '';
        const searchInput = document.getElementById('inputEnrollSearch');
        if (searchInput) searchInput.value = _enrollSearchQuery;

        modal.classList.add('open');
        renderEnrollModal();
    }

    function closeEnrollModal() {
        document.getElementById('modalEnrollment')?.classList.remove('open');
    }

    function onEnrollSearch(query) {
        _enrollSearchQuery = (query || '').trim().toLowerCase();
        renderEnrollSubjectsList();
    }

    function setEnrollFilter(filter) {
        _enrollFilter = filter;
        document.querySelectorAll('.enroll-filter-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.filter === filter);
        });
        renderEnrollSubjectsList();
    }

    function selectSubjectForPreview(subjectId) {
        _selectedPreviewSubjectId = subjectId;
        renderEnrollSubjectsList();
        renderEnrollPreview(subjectId);
    }

    function enrollSelectedSubject() {
        if (_selectedPreviewSubjectId) {
            enrollSubject(_selectedPreviewSubjectId);
        }
    }

    function unenrollSelectedSubject() {
        if (_selectedPreviewSubjectId) {
            unenrollSubject(_selectedPreviewSubjectId);
        }
    }

    function renderEnrollModal() {
        const countBadge = document.getElementById('enrollCounterBadge');
        const enrolledCount = getEnrolledSubjectIds().length;
        if (countBadge) {
            countBadge.textContent = `${enrolledCount} Materias Inscritas`;
        }

        renderEnrollSubjectsList();

        if (!_selectedPreviewSubjectId) {
            const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
                ? Schedule.getAllCatalogSubjects()
                : [];
            if (catalog.length > 0) {
                _selectedPreviewSubjectId = catalog[0].id;
            }
        }
        if (_selectedPreviewSubjectId) {
            renderEnrollPreview(_selectedPreviewSubjectId);
        }
    }

    function renderEnrollSubjectsList() {
        const listEl = document.getElementById('enrollSubjectsList');
        if (!listEl) return;

        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : [];
        const profile = getProfile();
        const studentSection = (profile?.sectionCode || '08S-2623-D1').toUpperCase();

        let list = catalog;

        // Filtro por categoría
        if (_enrollFilter === 'section') {
            list = list.filter(s => (s.section || '08S-2623-D1').toUpperCase() === studentSection);
        } else if (_enrollFilter === 'enrolled') {
            list = list.filter(s => isSubjectEnrolled(s.id));
        }

        // Filtro por texto de búsqueda
        if (_enrollSearchQuery) {
            list = list.filter(s => {
                const code = (s.code || '').toLowerCase();
                const short = (s.shortName || '').toLowerCase();
                const name = (s.name || '').toLowerCase();
                const teacher = (s.teacher || '').toLowerCase();
                return code.includes(_enrollSearchQuery) ||
                       short.includes(_enrollSearchQuery) ||
                       name.includes(_enrollSearchQuery) ||
                       teacher.includes(_enrollSearchQuery);
            });
        }

        if (list.length === 0) {
            listEl.innerHTML = '<p class="empty-msg" style="padding:24px 12px;font-size:0.78rem;">No se encontraron materias con ese criterio de búsqueda.</p>';
            return;
        }

        listEl.innerHTML = list.map(s => {
            const isEnrolled = isSubjectEnrolled(s.id);
            const isSelected = s.id === _selectedPreviewSubjectId;
            const conflictCheck = isEnrolled ? { hasConflict: false } : checkScheduleConflict(s);

            let statusPill = isEnrolled
                ? '<span class="enroll-badge enrolled">[INSCRITA]</span>'
                : '<span class="enroll-badge available">[DISPONIBLE]</span>';

            if (!isEnrolled && conflictCheck.hasConflict) {
                statusPill = '<span class="enroll-badge conflict">[CHOQUE]</span> ' + statusPill;
            }

            return `
            <div class="enroll-item-card ${isSelected ? 'selected' : ''}" onclick="Student.selectSubjectForPreview('${s.id}')"
                 style="border-left-color: ${s.color || 'var(--cyan)'};">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                        <span class="mono" style="font-weight:700;color:var(--cyan);font-size:0.76rem;">${s.code || s.shortName || 'MAT'}</span>
                        <span style="font-size:0.65rem;color:var(--text-3);">· ${s.section || '08S-2623-D1'}</span>
                    </div>
                    <div class="enroll-item-name">${s.name}</div>
                    <div style="font-size:0.68rem;color:var(--text-3);">${s.teacher || 'Docente por asignar'} ${s.room ? `· ${s.room}` : ''}</div>
                </div>
                <div>${statusPill}</div>
            </div>`;
        }).join('');
    }

    function renderEnrollPreview(subjectId) {
        const previewEl = document.getElementById('enrollPreviewContainer');
        if (!previewEl) return;

        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : [];
        const s = catalog.find(sub => sub.id === subjectId);

        if (!s) {
            previewEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3);font-size:0.8rem;">Selecciona una materia para ver su información detallada.</div>';
            return;
        }

        const isEnrolled = isSubjectEnrolled(s.id);
        const conflictCheck = isEnrolled ? { hasConflict: false, conflicts: [] } : checkScheduleConflict(s);
        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []).filter(a => a.subjectId === s.id);

        let conflictHtml = '';
        if (!isEnrolled) {
            if (conflictCheck.hasConflict) {
                const conflictList = conflictCheck.conflicts.map(c =>
                    `• <b>${c.dayName}</b>: Coincide con <b>${c.conflictingSubject.name}</b> (${c.conflictingSubject.code || ''})`
                ).join('<br>');
                conflictHtml = `
                    <div class="conflict-alert-box">
                        <div style="font-weight:700;color:var(--red);margin-bottom:4px;display:flex;align-items:center;gap:6px;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="15" height="15"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            [CHOQUE DE HORARIO DETECTADO]
                        </div>
                        <div style="font-size:0.75rem;line-height:1.4;">${conflictList}</div>
                    </div>
                `;
            } else {
                conflictHtml = `
                    <div class="free-slot-box">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                        [HORARIO DISPONIBLE] Sin solapamientos con tus materias ya inscritas.
                    </div>
                `;
            }
        }

        const slotsHtml = (s.slots || []).map(slot => {
            const dayName = DAY_NAMES[slot.day] || `Día ${slot.day}`;
            return `<span class="slot-pill">${dayName} · Bloque ${slot.startBlock} (${slot.span} blq)</span>`;
        }).join('') || '<span style="color:var(--text-3);font-size:0.75rem;">Sin bloques definidos</span>';

        let activitiesHtml = '';
        if (activities.length === 0) {
            activitiesHtml = '<p class="empty-msg" style="padding:10px 0;font-size:0.74rem;">Sin actividades programadas actualmente en esta materia.</p>';
        } else {
            activitiesHtml = activities.map(a => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg-darkest);border:1px solid var(--border);border-radius:6px;font-size:0.74rem;margin-bottom:6px;">
                    <div>
                        <div style="font-weight:600;color:var(--text-1);">${a.title}</div>
                        <div style="font-size:0.65rem;color:var(--text-3);">Corte ${a.corte || 1} · Fecha: ${a.date || 'Sin fecha'}</div>
                    </div>
                    <span class="mono" style="font-weight:700;color:var(--yellow);font-size:0.72rem;">${a.weight || 0}%</span>
                </div>
            `).join('');
        }

        previewEl.innerHTML = `
            <div class="preview-header-wrap">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <span class="mono preview-code-tag">${s.code || s.shortName || 'MAT'}</span>
                    <span style="font-size:0.72rem;color:var(--text-3);">Sección: <b class="mono" style="color:var(--cyan);">${s.section || '08S-2623-D1'}</b></span>
                </div>
                <h3 class="preview-title">${s.name}</h3>
                <div class="preview-meta">
                    <span>Docente: <b>${s.teacher || 'Por asignar'}</b></span>
                    <span>Aula: <b>${s.room || 'Aula N/A'}</b></span>
                </div>
            </div>

            <div style="margin-bottom:14px;">
                <div class="preview-sec-label">Bloques de Horario</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                    ${slotsHtml}
                </div>
            </div>

            ${conflictHtml}

            <div style="margin-top:14px;margin-bottom:16px;">
                <div class="preview-sec-label" style="display:flex;justify-content:space-between;">
                    <span>Evaluaciones Programadas</span>
                    <span class="mono" style="font-size:0.7rem;color:var(--text-3);">${activities.length} total</span>
                </div>
                <div style="margin-top:8px;">
                    ${activitiesHtml}
                </div>
            </div>

            <div class="preview-action-row">
                ${isEnrolled
                    ? `<button type="button" class="btn-ghost text-danger" style="width:100%;justify-content:center;" onclick="Student.unenrollSelectedSubject()">
                           Retirar Materia del Horario
                       </button>`
                    : `<button type="button" class="btn-primary" style="width:100%;justify-content:center;" onclick="Student.enrollSelectedSubject()">
                           Inscribir Materia en Mi Horario
                       </button>`
                }
            </div>
        `;
    }

    /* ══════════════════════════════════════════════════════════
       INICIALIZACIÓN
    ═══════════════════════════════════════════════════════════ */
    function init() {
        updateHeaderProfile();
        renderGradesTab();
        if (!hasActiveProfile()) {
            openIdentificationModal();
        }
    }

    /* ── API PÚBLICA ─────────────────────────────────────────── */
    return {
        init,
        isDelivered,
        toggleDelivered,
        getProgress,
        isActivityNew,
        markActivitySeen,
        getActivityGrade,
        setActivityGrade,
        getCustomCorteGrade,
        setCustomCorteGrade,
        calculateSubjectMetrics,
        exportStudentData,
        importStudentDataFromFile,
        renderGradesTab,
        renderStudentSummary,
        renderGradesGrid,
        unlockWithPin,
        lockGrades,
        getGradeMode,
        // Identificación Estudiantil
        getProfile,
        hasActiveProfile,
        saveProfile,
        updateHeaderProfile,
        openIdentificationModal,
        closeIdentificationModal,
        switchIdTab,
        submitNewStudentForm,
        submitExistingStudentForm,
        logoutStudent,
        // Inscripción y Horario
        getEnrolledSubjectIds,
        isSubjectEnrolled,
        getEnrolledSubjects,
        checkScheduleConflict,
        enrollSubject,
        unenrollSubject,
        openEnrollModal,
        closeEnrollModal,
        onEnrollSearch,
        setEnrollFilter,
        selectSubjectForPreview,
        enrollSelectedSubject,
        unenrollSelectedSubject,
        renderEnrollModal
    };

})();

window.Student = Student;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Student.init();
    });
} else {
    Student.init();
}
