/* =============================================================
   student.js — Panel Personal del Estudiante
   Almacenamiento 100% independiente en localStorage por dispositivo.
   Checklist de entregas, seguimiento de notas por corte (0-20),
   proyecciones de aprobación y respaldo de datos personales en JSON.
   ============================================================= */

const Student = (() => {

    /* ── KEYS LOCALSTORAGE ───────────────────────────────────── */
    const LS = {
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
       INICIALIZACIÓN
    ═══════════════════════════════════════════════════════════ */
    function init() {
        renderGradesTab();
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
        getGradeMode
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
