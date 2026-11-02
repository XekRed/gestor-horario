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

    function switchScale(newScale) {
        if (typeof Prefs !== 'undefined' && Prefs.setGradeMode) {
            Prefs.setGradeMode(newScale);
        }
        renderGradesTab();
        if (typeof App !== 'undefined') App.renderDashboard();
        if (typeof Notify !== 'undefined') {
            const names = {
                percentage: 'Porcentaje % (0–100%)',
                scale20: 'Escala 20 Puntos (Aprobación: 9.60 pts)',
                scale5: 'Escala 5 Puntos (Aprobación: 2.40 pts)'
            };
            Notify.toast(`Escala de notas: ${names[newScale] || newScale}`, 'info', 2000);
        }
    }

    function getModeConfig(mode) {
        if (mode === 'scale20') {
            return {
                max: 20,
                step: 0.1,
                tag: '/ 20',
                placeholder: '0-20 pts',
                scaleMax: 20,
                passingDisplay: '9.60 pts',
                label: '20 Puntos',
                title: 'Nota en escala de 0 a 20 puntos'
            };
        }
        if (mode === 'scale5') {
            return {
                max: 5,
                step: 0.05,
                tag: '/ 5',
                placeholder: '0-5 pts',
                scaleMax: 5,
                passingDisplay: '2.40 pts',
                label: '5 Puntos',
                title: 'Nota en escala de 0 a 5 puntos'
            };
        }
        return {
            max: 100,
            step: 1,
            tag: '%',
            placeholder: '0-100%',
            scaleMax: 100,
            passingDisplay: '48.0%',
            label: 'Porcentaje %',
            title: 'Nota en porcentaje (0–100%)'
        };
    }

    // Convierte el valor ingresado por el usuario en el modo actual a porcentaje nativo (0-100%)
    function inputToPct(val, mode) {
        if (val === null || val === undefined || isNaN(val) || val === '') return null;
        const num = parseFloat(val);
        if (mode === 'scale20') return (num / 20) * 100;
        if (mode === 'scale5') return (num / 5) * 100;
        return Math.max(0, num);
    }

    // Convierte un porcentaje nativo (0-100%) al valor de visualización en el modo actual
    function pctToDisplay(pct, mode, decimals = null) {
        if (pct === null || pct === undefined || isNaN(pct)) return '';
        const num = parseFloat(pct);
        if (mode === 'scale20') {
            const dec = decimals !== null ? decimals : 2;
            return (num * 0.20).toFixed(dec);
        }
        if (mode === 'scale5') {
            const dec = decimals !== null ? decimals : 2;
            return (num * 0.05).toFixed(dec);
        }
        const dec = decimals !== null ? decimals : 1;
        return num.toFixed(dec);
    }

    function getActivityGrade(activityId) {
        const store = getGradesStore();
        return store.activities ? store.activities[activityId] : null;
    }

    function setActivityGrade(activityId, grade) {
        const store = getGradesStore();
        if (!store.activities) store.activities = {};

        const mode = getGradeMode();
        const pct = inputToPct(grade, mode);
        if (pct === null) {
            delete store.activities[activityId];
        } else {
            store.activities[activityId] = Math.max(0, Math.min(100, parseFloat(pct.toFixed(2))));
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
        const pct = inputToPct(grade, mode);
        if (pct === null) {
            delete store.customCortes[subjectId][corteNum];
        } else {
            store.customCortes[subjectId][corteNum] = Math.max(0, Math.min(100, parseFloat(pct.toFixed(2))));
        }

        saveGradesStore(store);
        renderGradesTab();
        if (typeof App !== 'undefined') App.renderDashboard();
    }

    /* ══════════════════════════════════════════════════════════
       CÁLCULO PONDERADO: 4 CORTES DE 25% · APROBACIÓN AL 48%
    ═══════════════════════════════════════════════════════════ */
    function calculateSubjectMetrics(subjectId) {
        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const subjActs = allActs.filter(a => a.subjectId === subjectId);

        // 4 Cortes de 25%
        const corteBreakdown = {};
        const corteScores = { 1: null, 2: null, 3: null, 4: null };
        let totalAssignedWeight = 0;
        let evaluatedWeight = 0;
        let rawAcumulado = 0;

        [1, 2, 3, 4].forEach(corteNum => {
            const actsInCorte = subjActs.filter(a => String(a.corte) === String(corteNum));
            let plannedWeight = 0;
            let evalWeight = 0;
            let earnedPct = 0;

            if (actsInCorte.length > 0) {
                actsInCorte.forEach(a => {
                    const w = parseFloat(a.weight) || 0;
                    plannedWeight += w;
                    const g = getActivityGrade(a.id);
                    if (g !== null && g !== undefined && !isNaN(g)) {
                        evalWeight += w;
                        earnedPct += (parseFloat(g) / 100) * w;
                    }
                });
            } else {
                // Sin actividades del admin: corte manual nominal de 25%
                plannedWeight = 25;
                const customG = getCustomCorteGrade(subjectId, corteNum);
                if (customG !== null && customG !== undefined && !isNaN(customG)) {
                    evalWeight = 25;
                    earnedPct = (parseFloat(customG) / 100) * 25;
                }
            }

            totalAssignedWeight += plannedWeight;
            evaluatedWeight += evalWeight;
            rawAcumulado += earnedPct;

            corteScores[corteNum] = evalWeight > 0 ? parseFloat(earnedPct.toFixed(2)) : null;

            corteBreakdown[corteNum] = {
                plannedWeight,
                evalWeight,
                earnedPct: parseFloat(earnedPct.toFixed(2)),
                acts: actsInCorte
            };
        });

        // REGLA: Limitar acumulado máximo que puede obtener un estudiante a 100%
        const totalAcumulado = Math.min(100, Math.max(0, parseFloat(rawAcumulado.toFixed(2))));
        const remainingWeight = Math.max(0, 100 - evaluatedWeight);

        // REGLA: Aprobación al 48%
        const passingThreshold = 48.0;
        let status = 'in_progress';
        let neededPct = 0;

        if (totalAcumulado >= passingThreshold) {
            status = 'passed';
            neededPct = 0;
        } else if (totalAcumulado + remainingWeight < passingThreshold) {
            status = 'failed';
            neededPct = parseFloat((passingThreshold - totalAcumulado).toFixed(1));
        } else {
            neededPct = parseFloat((passingThreshold - totalAcumulado).toFixed(1));
            // Si para aprobar necesita promediar más del 70% de lo restante
            if (remainingWeight > 0 && (neededPct / remainingWeight) > 0.70) {
                status = 'at_risk';
            } else {
                status = 'in_progress';
            }
        }

        return {
            totalAcumulado,
            evaluatedWeight: Math.round(evaluatedWeight),
            remainingWeight: Math.round(remainingWeight),
            totalAssignedWeight,
            passingThreshold,
            neededPct,
            status,
            corteBreakdown,
            corteScores,
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
        const mode = getGradeMode();

        let sumAccum = 0;
        let countGraded = 0;
        let passedCount = 0;
        let atRiskCount = 0;
        let inProgressCount = 0;

        subjects.forEach(s => {
            const m = calculateSubjectMetrics(s.id);
            if (m.evaluatedWeight > 0) {
                sumAccum += m.totalAcumulado;
                countGraded++;
            }
            if (m.status === 'passed') passedCount++;
            else if (m.status === 'at_risk') atRiskCount++;
            else if (m.status === 'failed') {}
            else inProgressCount++;
        });

        const generalAveragePct = countGraded > 0 ? (sumAccum / countGraded) : null;
        let averageDisplay = '—';
        let averageSub = '/ 100%';
        if (generalAveragePct !== null) {
            if (mode === 'scale20') {
                averageDisplay = (generalAveragePct * 0.20).toFixed(2);
                averageSub = '/ 20 pts';
            } else if (mode === 'scale5') {
                averageDisplay = (generalAveragePct * 0.05).toFixed(2);
                averageSub = '/ 5 pts';
            } else {
                averageDisplay = `${generalAveragePct.toFixed(1)}%`;
                averageSub = '/ 100%';
            }
        }

        const isSecActive = (typeof Prefs !== 'undefined' && Prefs.isSecurityEnabled && Prefs.isSecurityEnabled());
        const secLockBtn = (isSecActive && _isUnlockedThisSession)
            ? `<button class="btn-ghost btn-sm" onclick="Student.lockGrades()" style="padding:2px 8px;font-size:0.68rem;color:var(--text-2);border-color:rgba(255,255,255,0.15);cursor:pointer;" title="Bloquear Notas con PIN">Bloquear Perfil</button>`
            : '';

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span class="mono" style="font-size:0.75rem;color:var(--text-3);">RESUMEN ACADÉMICO (4 CORTES DE 25% · APROBACIÓN CON 48%)</span>
                ${secLockBtn}
            </div>
            <div class="student-summary-grid">
                <div class="summary-stat-box">
                    <span class="summary-stat-label">Promedio Acumulado Actual</span>
                    <span class="summary-stat-val mono" style="color:var(--cyan);">${averageDisplay} <small style="font-size:0.65rem;color:var(--text-3)">${averageSub}</small></span>
                </div>
                <div class="summary-stat-box">
                    <span class="summary-stat-label">Materias Aprobadas</span>
                    <span class="summary-stat-val mono" style="color:var(--green);">${passedCount} <small style="font-size:0.65rem;color:var(--text-3)">de ${subjects.length} (Mín. 48%)</small></span>
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

        // Actualizar estado activo en los botones del switch de escala en la cabecera
        const currentMode = getGradeMode();
        document.querySelectorAll('#gradeScaleSwitchGroup .scale-switch-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scale === currentMode);
        });

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
            grid.innerHTML = `
                <div class="empty-schedule-alert" style="margin:20px 0;">
                    <div class="esa-title">No hay materias inscritas en tu horario</div>
                    <div class="esa-desc">Inscribe tus asignaturas para registrar tus notas por corte y hacer seguimiento a tu rendimiento académico.</div>
                    <button class="btn-primary btn-sm" onclick="Student.openEnrollModal()" style="margin-top:6px;">Inscribir Materias</button>
                </div>
            `;
            return;
        }

        const mode = getGradeMode();
        const cfg  = getModeConfig(mode);

        const STATUS_BADGES = {
            passed:      '<span class="grade-status-pill status-passed">[APROBADO]</span>',
            in_progress: '<span class="grade-status-pill status-progress">[EN CURSO]</span>',
            at_risk:     '<span class="grade-status-pill status-risk">[EN RIESGO]</span>',
            failed:      '<span class="grade-status-pill status-failed">[REPROBADO]</span>',
        };

        let html = '';

        subjects.forEach(s => {
            const m = calculateSubjectMetrics(s.id);
            const statusBadge = STATUS_BADGES[m.status] || STATUS_BADGES.in_progress;

            let projectionMsg = '';
            const displayAcum = pctToDisplay(m.totalAcumulado, mode);
            const displayAcumText = mode === 'percentage' ? `${displayAcum}%` : `${displayAcum} pts`;

            if (m.status === 'passed') {
                projectionMsg = `<div class="projection-box safe"><b>[APROBADO]</b> ¡Materia aprobada! Acumulaste <b>${displayAcumText}</b> (Mínimo aprobatorio reglamentario: <b>${cfg.passingDisplay}</b>).</div>`;
            } else if (m.status === 'failed') {
                projectionMsg = `<div class="projection-box danger"><b>[REPROBADO]</b> Acumulaste ${displayAcumText}. Con el ${m.remainingWeight}% restante disponible no es posible alcanzar el 48% reglamentario.</div>`;
            } else if (m.status === 'at_risk') {
                projectionMsg = `<div class="projection-box danger"><b>[EN RIESGO]</b> Llevas <b>${displayAcumText}</b>. Te falta <b>${m.neededPct}%</b> acumulado para alcanzar el <b>48%</b> aprobatorio. Necesitas promediar alto en el ${m.remainingWeight}% restante.</div>`;
            } else {
                projectionMsg = `<div class="projection-box notice"><b>[META]</b> Llevas <b>${displayAcumText}</b> acumulado. Te falta <b>${m.neededPct}%</b> para alcanzar el <b>48%</b> (${cfg.passingDisplay}) y aprobar la materia.</div>`;
            }

            // Desglose por cortes (1 al 4 de 25% c/u)
            const cortesHtml = [1, 2, 3, 4].map(corteNum => {
                const cb = m.corteBreakdown[corteNum];
                const corteSubtotalPct = cb.earnedPct;
                const corteSubtotalDisplay = pctToDisplay(corteSubtotalPct, mode);
                const corteNominalMax = mode === 'percentage' ? '25%' : (mode === 'scale20' ? '5.00 pts' : '1.25 pts');

                let actsListHtml = '';
                if (cb.acts.length > 0) {
                    actsListHtml = cb.acts.map(act => {
                        const gradePct = getActivityGrade(act.id);
                        const displayVal = (gradePct !== null && gradePct !== undefined && gradePct !== '')
                            ? pctToDisplay(parseFloat(gradePct), mode)
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
                } else {
                    const customGrade = getCustomCorteGrade(s.id, corteNum);
                    const displayCustom = (customGrade !== null && customGrade !== undefined && customGrade !== '')
                        ? pctToDisplay(parseFloat(customGrade), mode)
                        : '';
                    actsListHtml = `
                        <div class="grade-entry-row">
                            <div style="flex:1;">
                                <div class="grade-act-name">Evaluación de Corte ${corteNum}</div>
                                <div class="grade-act-sub mono">Corte estándar nominal de 25%</div>
                            </div>
                            <div class="grade-input-wrap">
                                <input type="number" step="${cfg.step}" min="0" max="${cfg.max}" class="grade-num-input mono"
                                    value="${displayCustom}" placeholder="${cfg.placeholder}"
                                    onchange="Student.setCustomCorteGrade('${s.id}', ${corteNum}, this.value)"
                                    title="${cfg.title}">
                                <span class="grade-scale-tag">${cfg.tag}</span>
                            </div>
                        </div>`;
                }

                return `
                <div class="corte-block">
                    <div class="corte-title-row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div>
                            <span class="corte-tag-name">Corte ${corteNum} (25%)</span>
                            ${cb.plannedWeight > 25 ? `<span class="mono" style="font-size:0.65rem;color:var(--cyan);margin-left:6px;">[EXTRA: ${cb.plannedWeight}%]</span>` : ''}
                        </div>
                        <span class="corte-subtotal-tag">Subtotal: ${corteSubtotalDisplay} / ${corteNominalMax}</span>
                    </div>
                    <div class="corte-acts-list">${actsListHtml}</div>
                </div>`;
            }).join('');

            const accumDisplay = pctToDisplay(m.totalAcumulado, mode);
            const scaleTag = mode === 'percentage' ? '/ 100%' : (mode === 'scale20' ? '/ 20 pts' : '/ 5 pts');

            html += `
            <div class="subject-grade-card" style="border-top: 3px solid ${s.color || 'var(--cyan)'};">
                <div class="subj-grade-header">
                    <div>
                        <span class="subj-grade-title">${s.name} ${s.shortName ? `<span class="mono">(${s.shortName})</span>` : ''}</span>
                        <div class="subj-grade-meta">
                            ${s.teacher ? `<span>Docente: ${s.teacher}</span>` : ''}
                            ${s.room ? `<span>Aula: ${s.room}</span>` : ''}
                        </div>
                    </div>
                    ${statusBadge}
                </div>

                <div class="subj-metrics-strip">
                    <div class="metric-cell">
                        <span class="metric-lbl">Acumulado</span>
                        <span class="metric-val mono" style="color:var(--cyan);">${accumDisplay} <small style="font-size:0.6rem;color:var(--text-3)">${scaleTag}</small></span>
                    </div>
                    <div class="metric-cell">
                        <span class="metric-lbl">Mín. Aprobatorio</span>
                        <span class="metric-val mono" style="color:var(--green);">${cfg.passingDisplay}</span>
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

    /* ══════════════════════════════════════════════════════════
       EXPORTAR NOTAS EN PDF (jsPDF + AutoTable)
    ═══════════════════════════════════════════════════════════ */
    async function exportGradesPdf() {
        const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDFClass) {
            if (typeof Notify !== 'undefined') {
                Notify.toast('Cargando librería PDF en el navegador, por favor intenta en un momento...', 'warning');
            }
            return;
        }

        const profile = getProfile() || {
            fullName: 'Estudiante',
            ci: 'V-00000000',
            career: 'INGENIERÍA DE SISTEMAS',
            sectionCode: '08S-2623-D1'
        };

        const subjects = (typeof Schedule !== 'undefined' ? Schedule.getSubjects() : []) || [];
        if (subjects.length === 0) {
            if (typeof Notify !== 'undefined') {
                Notify.toast('No tienes materias inscritas para exportar', 'warning');
            }
            return;
        }

        const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'letter' });

        // Fecha actual formateada
        const today = new Date();
        const dStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const tStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
        const dateFormatted = `${dStr} - ${tStr}`;

        // Encabezado institucional elegante y sobrio (sin emojis)
        doc.setFillColor(15, 23, 42); // slate dark #0f172a
        doc.rect(0, 0, 216, 26, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('GESTOR ACADÉMICO UNIVERSITARIO - XK', 14, 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text('PLANILLA OFICIAL DE CALIFICACIONES Y RENDIMIENTO ACADÉMICO', 14, 17);
        doc.text(`Fecha de Emisión: ${dateFormatted}`, 14, 22);

        // Ficha del Estudiante
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 32, 188, 26, 2, 2, 'FD');

        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.text('ESTUDIANTE:', 18, 39);
        doc.text('CÉDULA:', 18, 46);
        doc.text('CARRERA:', 18, 53);

        doc.text('SECCIÓN:', 115, 39);
        doc.text('SEMESTRE:', 115, 46);
        doc.text('RÉGIMEN:', 115, 53);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text((profile.fullName || 'Estudiante').toUpperCase(), 44, 39);
        doc.text((profile.ci || 'V-00000000').toUpperCase(), 44, 46);
        doc.text((profile.career || 'INGENIERÍA DE SISTEMAS').toUpperCase(), 44, 53);

        doc.text((profile.sectionCode || '08S-2623-D1').toUpperCase(), 138, 39);
        doc.text('SEMESTRE VIII', 138, 46);
        doc.text('4 CORTES DE 25% (MÍN. APROBATORIO: 48%)', 138, 53);

        // Construcción de filas para autoTable
        const rows = [];
        let sumAcum = 0;
        let passedCount = 0;

        subjects.forEach(s => {
            const m = calculateSubjectMetrics(s.id);
            const c1 = m.corteScores[1] !== null ? `${m.corteScores[1].toFixed(1)}%` : '—';
            const c2 = m.corteScores[2] !== null ? `${m.corteScores[2].toFixed(1)}%` : '—';
            const c3 = m.corteScores[3] !== null ? `${m.corteScores[3].toFixed(1)}%` : '—';
            const c4 = m.corteScores[4] !== null ? `${m.corteScores[4].toFixed(1)}%` : '—';
            const totalPct = `${m.totalAcumulado.toFixed(1)}%`;
            const equiv20 = `${(m.totalAcumulado * 0.20).toFixed(2)} pts`;

            let estadoLabel = 'EN CURSO';
            if (m.status === 'passed') {
                estadoLabel = 'APROBADO';
                passedCount++;
            } else if (m.status === 'failed') {
                estadoLabel = 'REPROBADO';
            }

            sumAcum += m.totalAcumulado;

            rows.push([
                `${s.name}\n[${s.code || s.shortName || 'MAT'}]`,
                c1,
                c2,
                c3,
                c4,
                totalPct,
                equiv20,
                estadoLabel
            ]);
        });

        const avgPct = subjects.length > 0 ? (sumAcum / subjects.length) : 0;
        const avg20 = (avgPct * 0.20).toFixed(2);

        doc.autoTable({
            startY: 64,
            head: [['Asignatura', 'Corte 1\n(25%)', 'Corte 2\n(25%)', 'Corte 3\n(25%)', 'Corte 4\n(25%)', 'Total\n(%)', 'Equivalente\n(20 pts)', 'Estado']],
            body: rows,
            theme: 'grid',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            columnStyles: {
                0: { halign: 'left', cellWidth: 54, fontStyle: 'bold' },
                1: { halign: 'center', cellWidth: 18 },
                2: { halign: 'center', cellWidth: 18 },
                3: { halign: 'center', cellWidth: 18 },
                4: { halign: 'center', cellWidth: 18 },
                5: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
                6: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
                7: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }
            },
            styles: {
                fontSize: 7.8,
                cellPadding: 3.5,
                valign: 'middle',
                lineColor: [226, 232, 240],
                lineWidth: 0.2
            },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 7) {
                    if (data.cell.raw === 'APROBADO') {
                        data.cell.styles.textColor = [16, 149, 106]; // green
                    } else if (data.cell.raw === 'REPROBADO') {
                        data.cell.styles.textColor = [220, 38, 38]; // red
                    } else {
                        data.cell.styles.textColor = [202, 138, 4]; // yellow/amber
                    }
                }
            }
        });

        // Resumen final debajo de la tabla
        const finalY = doc.lastAutoTable.finalY + 8;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, finalY, 188, 22, 2, 2, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`Total Materias Inscritas: ${subjects.length}`, 18, finalY + 7);
        doc.text(`Materias Aprobadas: ${passedCount} de ${subjects.length}`, 80, finalY + 7);
        doc.text(`Promedio Acumulado: ${avgPct.toFixed(1)}% (${avg20} / 20 pts)`, 138, finalY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('* Nota mínima aprobatoria reglamentaria: 48.0% (Equivalente exacto a 9.60 / 20 pts y 2.40 / 5 pts).', 18, finalY + 14);
        doc.text('Documento emitido electrónicamente desde el Gestor Académico XK · Válido para control de notas personal del estudiante.', 18, finalY + 18);

        // Guardar archivo PDF
        const cleanCi = (profile.ci || 'estudiante').replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Calificaciones_${cleanCi}_${new Date().toISOString().slice(0, 10)}.pdf`);

        if (typeof Notify !== 'undefined') {
            Notify.toast('Planilla de Calificaciones descargada en PDF con éxito', 'success');
        }
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
       4. IDENTIFICACIÓN ESTUDIANTIL, BLOQUEO Y ONBOARDING EN 2 PASOS
    ═══════════════════════════════════════════════════════════ */

    // Parseo seguro de bloques de horario (array, json string u objeto)
    function parseScheduleBlocks(blocks) {
        if (!blocks) return [];
        if (Array.isArray(blocks)) return blocks;
        if (typeof blocks === 'string') {
            try {
                const parsed = JSON.parse(blocks);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        if (typeof blocks === 'object') {
            if (Array.isArray(blocks.slots)) return blocks.slots;
            if (Array.isArray(blocks.blocks)) return blocks.blocks;
        }
        return [];
    }

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
        const semestreEl = document.getElementById('metaSemestre');
        const studentNameEl = document.getElementById('metaStudentName');
        const studentBadge = document.getElementById('metaStudentBadge');
        const studentSep = document.getElementById('metaStudentSep');

        if (p) {
            if (carreraEl && p.career) carreraEl.textContent = p.career.toUpperCase();
            if (seccionEl && p.sectionCode) seccionEl.textContent = p.sectionCode.toUpperCase();
            if (semestreEl && p.semester) semestreEl.textContent = p.semester.toUpperCase();
            if (studentNameEl) studentNameEl.textContent = `${p.fullName || 'Estudiante'} [${p.ci}]`;
            if (studentBadge) studentBadge.style.display = 'flex';
            if (studentSep) studentSep.style.display = 'inline-block';
        } else {
            if (studentNameEl) studentNameEl.textContent = 'Identificarse';
            if (studentBadge) studentBadge.style.display = 'none';
            if (studentSep) studentSep.style.display = 'none';
        }
    }

    /* ── BLOQUEO ESTRICTO DE INTERFAZ ───────────────────────── */
    function checkOnboardingLock() {
        const hasProf = hasActiveProfile();
        const isAdmin = (typeof DB !== 'undefined' && DB.isAdminUnlocked && DB.isAdminUnlocked());
        const obScreen = document.getElementById('onboardingContainer');

        if (!hasProf && !isAdmin) {
            // Bloqueo total del resto de la app
            document.body.classList.add('app-locked');
            if (obScreen) {
                obScreen.style.display = 'flex';
                initOnboardingStep1();
            }
        } else {
            // Desbloqueo y renderizado normal
            document.body.classList.remove('app-locked');
            if (obScreen) {
                obScreen.style.display = 'none';
            }
            updateHeaderProfile();
        }
    }

    /* ── PASO 1 DEL ONBOARDING: IDENTIFICACIÓN Y CASCADA ────── */
    let _ciLookupTimeout = null;

    function initOnboardingStep1() {
        const step1 = document.getElementById('onboardingStep1');
        const step2 = document.getElementById('onboardingStep2');
        const pill1 = document.getElementById('obStepPill1');
        const pill2 = document.getElementById('obStepPill2');

        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        if (pill1) { pill1.classList.add('active'); pill1.classList.remove('done'); }
        if (pill2) { pill2.classList.remove('active', 'done'); }

        const p = getProfile();
        const ciInput = document.getElementById('obInputCi');
        const nameInput = document.getElementById('obInputName');

        if (p) {
            if (ciInput) ciInput.value = p.ci || '';
            if (nameInput) nameInput.value = p.fullName || '';
            populateCascadeCareers(p.career, p.semester, p.sectionCode);
        } else {
            populateCascadeCareers();
        }
    }

    function populateCascadeCareers(selCareer = '', selSemester = '', selSection = '') {
        const careerSelect = document.getElementById('obSelectCareer');
        if (!careerSelect) return;

        const sections = (typeof DB !== 'undefined' && DB.getSections) ? DB.getSections() : [];
        const careers = [...new Set(sections.map(s => (s.career || '').trim().toUpperCase()).filter(Boolean))].sort();

        if (careers.length === 0) {
            careers.push('INGENIERÍA DE SISTEMAS');
        }

        careerSelect.innerHTML = '<option value="">Selecciona Carrera...</option>' +
            careers.map(c => `<option value="${c}">${c}</option>`).join('');

        if (selCareer && careers.includes(selCareer.toUpperCase())) {
            careerSelect.value = selCareer.toUpperCase();
            onCascadeCareerChange(selCareer.toUpperCase(), selSemester, selSection);
        } else {
            onCascadeCareerChange('', '', '');
        }
    }

    function onCascadeCareerChange(career, selSemester = '', selSection = '') {
        const semSelect = document.getElementById('obSelectSemester');
        const secSelect = document.getElementById('obSelectSection');
        if (!semSelect || !secSelect) return;

        const cleanCareer = (career || '').trim().toUpperCase();
        if (!cleanCareer) {
            semSelect.disabled = true;
            semSelect.innerHTML = '<option value="">Esperando Carrera...</option>';
            secSelect.disabled = true;
            secSelect.innerHTML = '<option value="">Esperando Semestre...</option>';
            return;
        }

        const sections = (typeof DB !== 'undefined' && DB.getSections) ? DB.getSections() : [];
        const semesters = [...new Set(
            sections
                .filter(s => (s.career || '').trim().toUpperCase() === cleanCareer)
                .map(s => (s.semester || '').trim().toUpperCase())
                .filter(Boolean)
        )].sort();

        if (semesters.length === 0) {
            semesters.push('VIII');
        }

        semSelect.disabled = false;
        semSelect.innerHTML = '<option value="">Selecciona Semestre...</option>' +
            semesters.map(sm => `<option value="${sm}">Semestre ${sm}</option>`).join('');

        if (selSemester && semesters.includes(selSemester.toUpperCase())) {
            semSelect.value = selSemester.toUpperCase();
            onCascadeSemesterChange(selSemester.toUpperCase(), selSection);
        } else {
            onCascadeSemesterChange('', '');
        }
    }

    function onCascadeSemesterChange(semester, selSection = '') {
        const careerSelect = document.getElementById('obSelectCareer');
        const secSelect = document.getElementById('obSelectSection');
        if (!careerSelect || !secSelect) return;

        const cleanCareer = (careerSelect.value || '').trim().toUpperCase();
        const cleanSemester = (semester || '').trim().toUpperCase();

        if (!cleanCareer || !cleanSemester) {
            secSelect.disabled = true;
            secSelect.innerHTML = '<option value="">Esperando Semestre...</option>';
            return;
        }

        const sections = (typeof DB !== 'undefined' && DB.getSections) ? DB.getSections() : [];
        const matching = sections.filter(s =>
            (s.career || '').trim().toUpperCase() === cleanCareer &&
            (s.semester || '').trim().toUpperCase() === cleanSemester
        );

        if (matching.length === 0) {
            matching.push({ section_code: '08S-2623-D1', period: '2026-I (Diurno)' });
        }

        secSelect.disabled = false;
        secSelect.innerHTML = '<option value="">Selecciona Sección...</option>' +
            matching.map(s => `<option value="${s.section_code}">${s.section_code} (${s.period || 'Regular'})` + '</option>').join('');

        if (selSection && matching.some(s => s.section_code === selSection.toUpperCase())) {
            secSelect.value = selSection.toUpperCase();
        } else if (matching.length === 1) {
            secSelect.value = matching[0].section_code;
        }
    }

    function onCascadeSectionChange(sectionCode) {
        // Callback al cambiar de sección
    }

    // Normalizador de Cédula (tolerante a puntos, prefijos y espacios)
    function normalizeCi(raw) {
        if (!raw) return '';
        const cleaned = String(raw).trim().toUpperCase().replace(/[.\s]/g, '');
        const numOnly = cleaned.replace(/[^0-9]/g, '');
        if (!numOnly) return '';
        const prefix = cleaned.startsWith('E') ? 'E-' : 'V-';
        return `${prefix}${numOnly}`;
    }

    function onCiInput(rawVal) {
        clearTimeout(_ciLookupTimeout);
        _ciLookupTimeout = setTimeout(() => {
            lookupStudentByCi(rawVal);
        }, 500);
    }

    function onCiBlur(rawVal) {
        clearTimeout(_ciLookupTimeout);
        lookupStudentByCi(rawVal);
    }

    async function lookupStudentByCi(rawVal) {
        const noticeEl = document.getElementById('obLookupNotice');
        const pinWrap = document.getElementById('obPinWrap');
        const nameInput = document.getElementById('obInputName');
        const normCi = normalizeCi(rawVal);

        if (!normCi || normCi.length < 5) {
            if (noticeEl) noticeEl.style.display = 'none';
            if (pinWrap) pinWrap.style.display = 'none';
            return;
        }

        let student = null;
        if (typeof DB !== 'undefined' && DB.getStudentByCi) {
            student = await DB.getStudentByCi(normCi);
        }

        if (student) {
            if (noticeEl) {
                noticeEl.className = 'lookup-notice-badge success';
                noticeEl.style.display = 'block';
                noticeEl.innerHTML = `[ESTUDIANTE ENCONTRADO] ¡Hola, <b>${student.full_name || student.fullName || 'Estudiante'}</b>! Tus datos fueron recuperados automáticamente.`;
            }
            if (nameInput && !nameInput.value.trim()) {
                nameInput.value = student.full_name || student.fullName || '';
            }
            if (student.pin) {
                if (pinWrap) pinWrap.style.display = 'block';
            } else {
                if (pinWrap) pinWrap.style.display = 'none';
            }

            // Seleccionar sección en cascada si coincide
            const savedSec = student.section_code || student.sectionCode;
            if (savedSec && typeof DB !== 'undefined' && DB.getSections) {
                const secObj = DB.getSections().find(s => s.section_code === savedSec);
                if (secObj) {
                    populateCascadeCareers(secObj.career, secObj.semester, secObj.section_code);
                }
            }

            // Cargar inscripciones previas
            if (typeof DB !== 'undefined' && DB.getStudentEnrollments) {
                try {
                    const enrollments = await DB.getStudentEnrollments(normCi);
                    if (Array.isArray(enrollments) && enrollments.length > 0) {
                        const enrolledIds = enrollments.map(e => e.subject_id || e);
                        localStorage.setItem(LS.enrolled, JSON.stringify(enrolledIds));
                    }
                } catch (e) {}
            }
        } else {
            if (noticeEl) noticeEl.style.display = 'none';
            if (pinWrap) pinWrap.style.display = 'none';
        }
    }

    async function submitOnboardingStep1() {
        const ciInput = document.getElementById('obInputCi');
        const nameInput = document.getElementById('obInputName');
        const pinInput = document.getElementById('obInputPin');
        const carSelect = document.getElementById('obSelectCareer');
        const semSelect = document.getElementById('obSelectSemester');
        const secSelect = document.getElementById('obSelectSection');
        const errEl = document.getElementById('obStep1Error');

        if (errEl) errEl.style.display = 'none';

        const rawCi = ciInput ? ciInput.value.trim() : '';
        const normCi = normalizeCi(rawCi);
        const fullName = nameInput ? nameInput.value.trim() : '';
        const career = carSelect ? carSelect.value.trim() : '';
        const semester = semSelect ? semSelect.value.trim() : '';
        const sectionCode = secSelect ? secSelect.value.trim().toUpperCase() : '';

        if (!normCi || normCi.length < 5) {
            showObError('Por favor ingresa un número de Cédula válido (Ej: 28123456 o V-28123456).');
            return;
        }

        if (!fullName || fullName.length < 3) {
            showObError('Por favor ingresa tu Nombre Completo.');
            return;
        }

        if (!career) {
            showObError('Por favor selecciona tu Carrera.');
            return;
        }

        if (!semester) {
            showObError('Por favor selecciona tu Semestre.');
            return;
        }

        if (!sectionCode) {
            showObError('Por favor selecciona tu Código de Sección.');
            return;
        }

        // Comprobar PIN si el perfil existe y tiene PIN
        let existingStudent = null;
        if (typeof DB !== 'undefined' && DB.getStudentByCi) {
            existingStudent = await DB.getStudentByCi(normCi);
        }
        if (existingStudent && existingStudent.pin) {
            const enteredPin = pinInput ? pinInput.value.trim() : '';
            if (!enteredPin) {
                showObError('Esta cédula tiene un PIN de protección asignado. Ingrésalo para continuar.');
                document.getElementById('obPinWrap').style.display = 'block';
                return;
            }
            if (String(enteredPin) !== String(existingStudent.pin).trim()) {
                showObError('El PIN ingresado es incorrecto para esta Cédula.');
                return;
            }
        }

        const profileData = {
            ci: normCi,
            fullName,
            career,
            semester,
            sectionCode,
            pin: existingStudent?.pin || null
        };

        saveProfile(profileData);

        // Guardar en Supabase en segundo plano
        if (typeof DB !== 'undefined' && DB.saveStudent) {
            DB.saveStudent(profileData).catch(() => {});
        }

        // Actualizar datos de configuración de sección activa
        if (typeof DB !== 'undefined' && DB.saveSettings) {
            DB.saveSettings({
                carrera: career,
                semestre: semester,
                seccion: sectionCode,
                periodo: '2026-I (Diurno)'
            }).catch(() => {});
        }

        // Transición visual a Paso 2
        const step1 = document.getElementById('onboardingStep1');
        const step2 = document.getElementById('onboardingStep2');
        const pill1 = document.getElementById('obStepPill1');
        const pill2 = document.getElementById('obStepPill2');

        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';
        if (pill1) { pill1.classList.remove('active'); pill1.classList.add('done'); }
        if (pill2) { pill2.classList.add('active'); }

        renderOnboardingStep2();
    }

    function showObError(msg) {
        const errEl = document.getElementById('obStep1Error');
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
        } else if (typeof Notify !== 'undefined') {
            Notify.toast(msg, 'error');
        }
    }

    /* ── PASO 2 DEL ONBOARDING: INSCRIPCIÓN DE MATERIAS ─────── */
    let _obSearchQuery = '';
    let _obSelectedPreviewId = null;

    function renderOnboardingStep2() {
        const p = getProfile();
        const secCode = (p?.sectionCode || '08S-2623-D1').trim().toUpperCase();
        const secLabel = document.getElementById('obStep2SectionLabel');
        const countLabel = document.getElementById('obStep2CountLabel');
        const enrolledCount = getEnrolledSubjectIds().length;

        if (secLabel) secLabel.textContent = secCode;
        if (countLabel) countLabel.textContent = `${enrolledCount} materias`;

        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const listContainer = document.getElementById('obSubjectsListContainer');
        if (!listContainer) return;

        let displayList = [];
        const isSearch = _obSearchQuery.length > 0;

        if (isSearch) {
            const q = _obSearchQuery.trim().toUpperCase();
            displayList = catalog.filter(s => {
                const code = (s.code || s.subject_code || '').trim().toUpperCase();
                const short = (s.shortName || '').trim().toUpperCase();
                const name = (s.name || '').trim().toUpperCase();
                const id = (s.id || '').trim().toUpperCase();
                return code.includes(q) || short.includes(q) || name.includes(q) || id.includes(q);
            });
            const titleEl = document.getElementById('obListHeaderTitle');
            if (titleEl) titleEl.textContent = `Resultados para "${_obSearchQuery}" (${displayList.length})`;
        } else {
            // Recomendadas para la sección seleccionada
            displayList = catalog.filter(s => {
                const sSec = (s.section || s.section_code || '').trim().toUpperCase();
                return sSec === secCode || (s.code && s.code.includes(secCode.slice(0, 3)));
            });
            const titleEl = document.getElementById('obListHeaderTitle');
            if (titleEl) titleEl.textContent = `Recomendadas para Sección ${secCode} (${displayList.length})`;
        }

        if (displayList.length === 0) {
            listContainer.innerHTML = `<p class="empty-msg" style="padding:24px 12px;text-align:center;">
                ${isSearch ? 'No se encontraron materias con ese código.' : 'No hay materias registradas para tu sección.'}
            </p>`;
        } else {
            listContainer.innerHTML = displayList.map(s => {
                const isEnrolled = isSubjectEnrolled(s.id);
                const isSelected = _obSelectedPreviewId === s.id;
                const conflictCheck = isEnrolled ? { hasConflict: false } : checkScheduleConflict(s);

                let badgeHtml = '<span class="enroll-badge available">[DISPONIBLE]</span>';
                if (isEnrolled) {
                    badgeHtml = '<span class="enroll-badge enrolled">[INSCRITA]</span>';
                } else if (conflictCheck.hasConflict) {
                    badgeHtml = '<span class="enroll-badge conflict">[CHOQUE]</span>';
                }

                return `
                <div class="enroll-item-card ${isSelected ? 'selected' : ''}" onclick="Student.selectObSubjectForPreview('${s.id}')">
                    <div class="enroll-item-header">
                        <span class="mono" style="font-weight:700;color:var(--cyan);font-size:0.75rem;">${s.code || s.shortName || 'MAT'}</span>
                        ${badgeHtml}
                    </div>
                    <div class="enroll-item-title">${s.name}</div>
                    <div class="enroll-item-sub">
                        <span>Docente: ${s.teacher || 'Por asignar'}</span>
                        <span>· Aula: ${s.room || 'Aula N/A'}</span>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px;">
                        ${isEnrolled
                            ? `<button type="button" class="btn-ghost btn-sm text-danger" onclick="event.stopPropagation();Student.unenrollSubject('${s.id}', this)">Retirar</button>`
                            : `<button type="button" class="btn-primary btn-sm" onclick="event.stopPropagation();Student.enrollSubject('${s.id}', this)">Inscribir</button>`
                        }
                    </div>
                </div>`;
            }).join('');
        }

        // Si no hay preview seleccionado, elegir el primero
        if (!_obSelectedPreviewId && displayList.length > 0) {
            _obSelectedPreviewId = displayList[0].id;
        }
        if (_obSelectedPreviewId) {
            renderObPreview(_obSelectedPreviewId);
        }
    }

    function onObSearchInput(query) {
        _obSearchQuery = (query || '').trim().toUpperCase();
        renderOnboardingStep2();
    }

    function selectObSubjectForPreview(subjectId) {
        _obSelectedPreviewId = subjectId;
        renderOnboardingStep2();
    }

    function renderObPreview(subjectId) {
        const previewEl = document.getElementById('obPreviewContainer');
        if (!previewEl) return;

        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const s = catalog.find(sub => sub.id === subjectId);
        if (!s) {
            previewEl.innerHTML = '<p class="empty-msg" style="padding:24px;text-align:center;">Selecciona una materia para ver su detalle.</p>';
            return;
        }

        const isEnrolled = isSubjectEnrolled(s.id);
        const conflictCheck = isEnrolled ? { hasConflict: false, conflicts: [] } : checkScheduleConflict(s);
        const slots = parseScheduleBlocks(s.slots || s.schedule_blocks);
        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const activities = (allActs || []).filter(a => a && a.subjectId === s.id);

        let conflictHtml = '';
        if (conflictCheck.hasConflict) {
            conflictHtml = `
                <div class="conflict-alert-box">
                    <div class="conflict-title">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="14" height="14"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        [CHOQUE DE HORARIO DETECTADO]
                    </div>
                    <div>Esta asignatura coincide en horario con materias que ya inscribiste:</div>
                    ${conflictCheck.conflicts.map(c => `
                        <div class="conflict-item">• <b>${c.dayName}</b> con <b>${c.conflictingSubject.name}</b> (${c.conflictingSubject.code || ''})</div>
                    `).join('')}
                </div>
            `;
        } else {
            conflictHtml = `
                <div class="free-slot-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                    [HORARIO DISPONIBLE] Sin choques con tus materias inscritas.
                </div>
            `;
        }

        const slotsHtml = slots.length > 0
            ? slots.map(sl => {
                const dayName = DAY_NAMES[sl.day] || `Día ${sl.day}`;
                return `<span class="slot-pill">${dayName}: Bloque ${sl.startBlock} (${sl.span * 45} min)</span>`;
            }).join('')
            : '<span style="font-size:0.72rem;color:var(--text-3);">Sin bloques definidos</span>';

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

            <div style="margin-bottom:12px;">
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
                    ? `<button type="button" class="btn-ghost text-danger" style="width:100%;justify-content:center;" onclick="Student.unenrollSubject('${s.id}', this)">
                           Retirar Materia del Horario
                       </button>`
                    : `<button type="button" class="btn-primary" style="width:100%;justify-content:center;" onclick="Student.enrollSubject('${s.id}', this)">
                           Inscribir Materia en Mi Horario
                       </button>`
                }
            </div>
        `;
    }

    async function enrollAllSectionSubjects() {
        const btn = document.getElementById('btnBatchEnrollSection');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Inscribiendo...';
        }

        const profile = getProfile();
        const secCode = (profile?.sectionCode || '08S-2623-D1').trim().toUpperCase();
        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const sectionSubjects = catalog.filter(s => {
            const sSec = (s.section || s.section_code || '').trim().toUpperCase();
            return sSec === secCode || (s.code && s.code.includes(secCode.slice(0, 3)));
        });

        if (sectionSubjects.length === 0) {
            if (btn) { btn.disabled = false; btn.textContent = 'Inscribir todas las de mi sección'; }
            if (typeof Notify !== 'undefined') Notify.toast('No se encontraron materias para tu sección.', 'warning');
            return;
        }

        const ids = getEnrolledSubjectIds();
        let addedCount = 0;

        for (const subj of sectionSubjects) {
            if (!ids.includes(subj.id)) {
                ids.push(subj.id);
                addedCount++;
                if (profile && profile.ci && typeof DB !== 'undefined' && DB.enrollStudentSubject) {
                    DB.enrollStudentSubject(profile.ci, subj).catch(() => {});
                }
            }
        }

        localStorage.setItem(LS.enrolled, JSON.stringify(ids));
        _refreshAllAppViews();
        renderOnboardingStep2();
        renderEnrollModal();

        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Inscribir todas las de mi sección';
        }

        if (typeof Notify !== 'undefined') {
            Notify.toast(`Se inscribieron ${addedCount} materias de tu sección con éxito.`, 'success', 3500);
        }
    }

    function finishOnboarding() {
        document.body.classList.remove('app-locked');
        document.body.style.overflow = '';
        const obScreen = document.getElementById('onboardingContainer');
        if (obScreen) obScreen.style.display = 'none';

        updateHeaderProfile();
        _refreshAllAppViews();

        const p = getProfile();
        const enrolledCount = getEnrolledSubjectIds().length;
        if (typeof Notify !== 'undefined') {
            Notify.toast(`¡Bienvenido, ${p?.fullName || 'Estudiante'}! Has ingresado con ${enrolledCount} materias inscritas.`, 'success', 4000);
        }
    }

    /* ══════════════════════════════════════════════════════════
       5. INSCRIPCIÓN Y RETIRO REACTIVO (MODAL DENTRO DE LA APP)
    ═══════════════════════════════════════════════════════════ */
    let _isEnrollActionPending = false;
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
        const slotsA = parseScheduleBlocks(subjectToTest?.slots || subjectToTest?.schedule_blocks);
        if (slotsA.length === 0) {
            return { hasConflict: false, conflicts: [] };
        }

        const enrolled = getEnrolledSubjects().filter(s => s.id !== subjectToTest.id);
        const conflicts = [];

        slotsA.forEach(slotA => {
            const dayA = slotA.day;
            const startA = slotA.startBlock;
            const endA = startA + slotA.span - 1;

            enrolled.forEach(otherSubj => {
                const slotsB = parseScheduleBlocks(otherSubj.slots || otherSubj.schedule_blocks);
                slotsB.forEach(slotB => {
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

    async function enrollSubject(subjectId, btn = null) {
        if (!subjectId || _isEnrollActionPending) return;
        _isEnrollActionPending = true;

        let origText = '';
        if (btn) {
            btn.disabled = true;
            origText = btn.innerHTML;
            btn.textContent = 'Procesando...';
        }

        try {
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
                DB.enrollStudentSubject(profile.ci, subj).catch(() => {});
            }

            _refreshAllAppViews();
            renderEnrollModal();
            renderOnboardingStep2();

            if (typeof Notify !== 'undefined') {
                Notify.toast(`Materia inscrita: [${subj.code || subj.shortName || subj.id}] ${subj.name}`, 'success', 3000);
            }
        } finally {
            _isEnrollActionPending = false;
            if (btn) {
                btn.disabled = false;
            }
        }
    }

    async function unenrollSubject(subjectId, btn = null) {
        if (!subjectId || _isEnrollActionPending) return;
        _isEnrollActionPending = true;

        let origText = '';
        if (btn) {
            btn.disabled = true;
            origText = btn.innerHTML;
            btn.textContent = 'Procesando...';
        }

        try {
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
                DB.unenrollStudentSubject(profile.ci, subjectId).catch(() => {});
            }

            _refreshAllAppViews();
            renderEnrollModal();
            renderOnboardingStep2();

            if (typeof Notify !== 'undefined') {
                Notify.toast('Materia retirada de tu horario', 'info', 2500);
            }
        } finally {
            _isEnrollActionPending = false;
            if (btn) {
                btn.disabled = false;
            }
        }
    }

    function _refreshAllAppViews() {
        if (typeof Schedule !== 'undefined') {
            Schedule.renderTable();
            Schedule.renderLegend();
            Schedule.populateSubjectSelects();
        }
        if (typeof App !== 'undefined') {
            App.renderDashboard();
        }
        renderGradesTab();
        if (typeof Activities !== 'undefined') {
            Activities.renderTimeline();
            Activities.renderCalendar();
        }
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function openEnrollModal(searchQuery = '') {
        const modal = document.getElementById('modalEnrollment');
        if (!modal) return;

        _enrollSearchQuery = (searchQuery || '').trim().toUpperCase();
        const searchInput = document.getElementById('inputEnrollSearch');
        if (searchInput) searchInput.value = _enrollSearchQuery;

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        renderEnrollModal();
    }

    function closeEnrollModal() {
        const modal = document.getElementById('modalEnrollment');
        if (modal) modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    function onEnrollSearch(query) {
        _enrollSearchQuery = (query || '').trim().toUpperCase();
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

    function enrollSelectedSubject(btn = null) {
        if (_selectedPreviewSubjectId) {
            enrollSubject(_selectedPreviewSubjectId, btn);
        }
    }

    function unenrollSelectedSubject(btn = null) {
        if (_selectedPreviewSubjectId) {
            unenrollSubject(_selectedPreviewSubjectId, btn);
        }
    }

    function renderEnrollModal() {
        const countBadge = document.getElementById('enrollCounterBadge');
        const enrolledCount = getEnrolledSubjectIds().length;
        if (countBadge) {
            countBadge.textContent = `${enrolledCount} Materias Inscritas`;
        }

        const p = getProfile();
        const badgeSec = document.getElementById('enrollBadgeSection');
        if (badgeSec && p && p.sectionCode) {
            badgeSec.textContent = p.sectionCode;
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
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const enrolledIds = getEnrolledSubjectIds();
        const profile = getProfile();
        const userSection = (profile?.sectionCode || '08S-2623-D1').trim().toUpperCase();

        let filtered = catalog;

        // Filtro por chips
        if (_enrollFilter === 'enrolled') {
            filtered = filtered.filter(s => enrolledIds.includes(s.id));
        } else if (_enrollFilter === 'section') {
            filtered = filtered.filter(s => {
                const sSec = (s.section || s.section_code || '').trim().toUpperCase();
                return sSec === userSection || (s.code && s.code.includes(userSection.slice(0, 3)));
            });
        }

        // Filtro por buscador (tolerante a mayúsculas/minúsculas y espacios)
        if (_enrollSearchQuery.length > 0) {
            const q = _enrollSearchQuery;
            filtered = filtered.filter(s => {
                const code = (s.code || s.subject_code || '').trim().toUpperCase();
                const short = (s.shortName || '').trim().toUpperCase();
                const name = (s.name || '').trim().toUpperCase();
                const id = (s.id || '').trim().toUpperCase();
                return code.includes(q) || short.includes(q) || name.includes(q) || id.includes(q);
            });
        }

        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="empty-msg" style="padding:24px;text-align:center;">No se encontraron materias disponibles.</p>';
            return;
        }

        listEl.innerHTML = filtered.map(s => {
            const isEnrolled = enrolledIds.includes(s.id);
            const isSelected = _selectedPreviewSubjectId === s.id;
            const conflictCheck = isEnrolled ? { hasConflict: false } : checkScheduleConflict(s);

            let badgeHtml = '<span class="enroll-badge available">[DISPONIBLE]</span>';
            if (isEnrolled) {
                badgeHtml = '<span class="enroll-badge enrolled">[INSCRITA]</span>';
            } else if (conflictCheck.hasConflict) {
                badgeHtml = '<span class="enroll-badge conflict">[CHOQUE]</span>';
            }

            return `
            <div class="enroll-item-card ${isSelected ? 'selected' : ''}" onclick="Student.selectSubjectForPreview('${s.id}')">
                <div class="enroll-item-header">
                    <span class="mono" style="font-weight:700;color:var(--cyan);font-size:0.75rem;">${s.code || s.shortName || 'MAT'}</span>
                    ${badgeHtml}
                </div>
                <div class="enroll-item-title">${s.name}</div>
                <div class="enroll-item-sub">
                    <span>Docente: ${s.teacher || 'Por asignar'}</span>
                    <span>· Aula: ${s.room || 'Aula N/A'}</span>
                </div>
            </div>`;
        }).join('');
    }

    function renderEnrollPreview(subjectId) {
        const previewEl = document.getElementById('enrollPreviewContainer');
        if (!previewEl) return;

        const catalog = (typeof Schedule !== 'undefined' && Schedule.getAllCatalogSubjects)
            ? Schedule.getAllCatalogSubjects()
            : ((typeof DB !== 'undefined' ? DB.get('subjects') : []) || []);

        const s = catalog.find(sub => sub.id === subjectId);
        if (!s) {
            previewEl.innerHTML = '<p class="empty-msg" style="padding:24px;text-align:center;">Selecciona una materia para ver su detalle.</p>';
            return;
        }

        const isEnrolled = isSubjectEnrolled(s.id);
        const conflictCheck = isEnrolled ? { hasConflict: false, conflicts: [] } : checkScheduleConflict(s);
        const slots = parseScheduleBlocks(s.slots || s.schedule_blocks);
        const allActs = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const activities = (allActs || []).filter(a => a && a.subjectId === s.id);

        let conflictHtml = '';
        if (conflictCheck.hasConflict) {
            conflictHtml = `
                <div class="conflict-alert-box">
                    <div class="conflict-title">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="14" height="14"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        [CHOQUE DE HORARIO DETECTADO]
                    </div>
                    <div>Esta asignatura coincide en horario con materias que ya inscribiste:</div>
                    ${conflictCheck.conflicts.map(c => `
                        <div class="conflict-item">• <b>${c.dayName}</b> con <b>${c.conflictingSubject.name}</b> (${c.conflictingSubject.code || ''})</div>
                    `).join('')}
                </div>
            `;
        } else {
            conflictHtml = `
                <div class="free-slot-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                    [HORARIO DISPONIBLE] Sin choques con tus materias inscritas.
                </div>
            `;
        }

        const slotsHtml = slots.length > 0
            ? slots.map(sl => {
                const dayName = DAY_NAMES[sl.day] || `Día ${sl.day}`;
                return `<span class="slot-pill">${dayName}: Bloque ${sl.startBlock} (${sl.span * 45} min)</span>`;
            }).join('')
            : '<span style="font-size:0.72rem;color:var(--text-3);">Sin bloques definidos</span>';

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
                    ? `<button type="button" class="btn-ghost text-danger" style="width:100%;justify-content:center;" onclick="Student.unenrollSelectedSubject(this)">
                           Retirar Materia del Horario
                       </button>`
                    : `<button type="button" class="btn-primary" style="width:100%;justify-content:center;" onclick="Student.enrollSelectedSubject(this)">
                           Inscribir Materia en Mi Horario
                       </button>`
                }
            </div>
        `;
    }

    function logoutStudent() {
        if (!confirm('¿Deseas cerrar la sesión del estudiante en este dispositivo?')) return;
        localStorage.removeItem(LS.profile);
        localStorage.removeItem(LS.enrolled);
        checkOnboardingLock();
        _refreshAllAppViews();
        if (typeof Notify !== 'undefined') Notify.toast('Sesión cerrada correctamente', 'info');
    }

    function openProfileOrLogout() {
        const p = getProfile();
        if (!p) {
            checkOnboardingLock();
            return;
        }
        if (confirm(`Estudiante: ${p.fullName}\nCédula: ${p.ci}\nCarrera: ${p.career}\nSección: ${p.sectionCode}\n\n¿Deseas cerrar la sesión de estudiante en este dispositivo?`)) {
            logoutStudent();
        }
    }

    /* ══════════════════════════════════════════════════════════
       INICIALIZACIÓN
    ═══════════════════════════════════════════════════════════ */
    function init() {
        updateHeaderProfile();
        renderGradesTab();
        checkOnboardingLock();
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
        switchScale,
        exportGradesPdf,
        inputToPct,
        pctToDisplay,
        // Identificación Estudiantil y Onboarding
        getProfile,
        hasActiveProfile,
        saveProfile,
        updateHeaderProfile,
        checkOnboardingLock,
        initOnboardingStep1,
        populateCascadeCareers,
        onCascadeCareerChange,
        onCascadeSemesterChange,
        onCascadeSectionChange,
        onCiInput,
        onCiBlur,
        submitOnboardingStep1,
        renderOnboardingStep2,
        onObSearchInput,
        selectObSubjectForPreview,
        enrollAllSectionSubjects,
        finishOnboarding,
        logoutStudent,
        openProfileOrLogout,
        openIdentificationModal: openProfileOrLogout,
        // Inscripción y Horario
        getEnrolledSubjectIds,
        isSubjectEnrolled,
        getEnrolledSubjects,
        checkScheduleConflict,
        parseScheduleBlocks,
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
