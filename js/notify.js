/* =============================================================
   notify.js — Sistema de Alertas, Web Notifications y Difusión
              (WhatsApp Directo + Telegram Bot API & Share)
   ============================================================= */

const Notify = (() => {

    const LS_TELEGRAM = 'gx_telegram_config';

    /* ══════════════════════════════════════════════════════════
       1. NOTIFICACIONES DENTRO DE LA APP (TOASTS)
    ═══════════════════════════════════════════════════════════ */
    function toast(msg, type = 'info', duration = 3500) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;

        const icons = {
            success: '[OK]',
            error:   '[!]',
            warning: '[!]',
            info:    '[i]'
        };
        const icon = icons[type] || '[·]';

        el.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-text">${msg}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(el);

        // Haptic feedback en dispositivos táctiles si está soportado
        if ('vibrate' in navigator) {
            try { navigator.vibrate(type === 'error' ? [50, 50, 50] : [30]); } catch (e) {}
        }

        setTimeout(() => {
            if (el.parentElement) {
                el.style.opacity = '0';
                el.style.transform = 'translateX(20px)';
                setTimeout(() => el.remove(), 250);
            }
        }, duration);
    }

    /* ══════════════════════════════════════════════════════════
       2. WEB NOTIFICATIONS NATIVAS (NAVEGADOR / MÓVIL)
    ═══════════════════════════════════════════════════════════ */
    async function requestPermission() {
        if (!('Notification' in window)) {
            toast('Tu navegador no soporta notificaciones de escritorio', 'warning');
            return false;
        }

        if (Notification.permission === 'granted') {
            toast('Notificaciones de escritorio ya activadas', 'info');
            checkImminentDeliveriesNotification();
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                toast('¡Notificaciones activadas con éxito!', 'success');
                sendWebNotification('Gestor Académico XK', {
                    body: 'Notificaciones activadas. Te avisaremos cuando tengas evaluaciones próximas.',
                    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%2300f0ff%22/><polygon points=%2250,20 80,50 50,80 20,50%22 fill=%22%23060a0c%22/></svg>'
                });
                checkImminentDeliveriesNotification();
                return true;
            }
        }

        toast('Permiso de notificaciones denegado en el navegador', 'error');
        return false;
    }

    function sendWebNotification(title, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            return new Notification(title, {
                badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%2300f0ff%22/></svg>',
                ...options
            });
        } catch (e) {
            console.warn('[Notify] No se pudo emitir notificación web:', e);
        }
    }

    function checkImminentDeliveriesNotification() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const now = new Date(); now.setHours(0, 0, 0, 0);

        const imminent = activities.filter(a => {
            if (!a.date) return false;
            const diff = (new Date(a.date + 'T00:00:00') - now) / 86400000;
            return diff >= 0 && diff <= 1; // Hoy o Mañana
        });

        if (imminent.length > 0) {
            const act = imminent[0];
            const diff = Math.round((new Date(act.date + 'T00:00:00') - now) / 86400000);
            const when = diff === 0 ? '[VENCE HOY]' : '[VENCE MAÑANA]';
            sendWebNotification(`[ENTREGA PRÓXIMA]: ${act.title}`, {
                body: `${when} (${act.date} ${act.time ? `a las ${act.time}` : ''}). Revisa las directrices en la web.`,
            });
        }
    }

    /* ══════════════════════════════════════════════════════════
       2.1. BANNER MATUTINO FIJO ("ACTIVIDADES PARA HOY")
    ═══════════════════════════════════════════════════════════ */
    function checkMorningTodayBanner() {
        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // Obtener asignaturas activas de la matrícula personal del estudiante
        const activeSubjects = (typeof Schedule !== 'undefined' && typeof Schedule.getActiveSubjects === 'function')
            ? Schedule.getActiveSubjects()
            : (typeof Schedule !== 'undefined' ? Schedule.getSubjects() : []);
        const activeIds = new Set(activeSubjects.map(s => s.id));

        // Filtrar evaluaciones que vencen HOY para sus materias no entregadas
        const todayActs = activities.filter(a => {
            if (!a.date || a.date !== todayStr) return false;
            if (a.subjectId && activeIds.size > 0 && !activeIds.has(a.subjectId)) return false;
            if (typeof Student !== 'undefined' && Student.isDelivered(a.id)) return false;
            return true;
        });

        const existing = document.getElementById('morningTodayBanner');
        if (todayActs.length === 0) {
            if (existing) existing.remove();
            return;
        }

        let banner = existing;
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'morningTodayBanner';
            banner.className = 'morning-today-banner';
            const targetContainer = document.querySelector('.main-content') || document.querySelector('.app-container');
            if (targetContainer) {
                targetContainer.insertBefore(banner, targetContainer.firstChild);
            }
        }

        const itemsHtml = todayActs.map(a => {
            const subj = activeSubjects.find(s => s.id === a.subjectId);
            const name = subj ? subj.name : 'ACTIVIDAD ESPECIAL';
            const time = a.time ? `(Límite: ${a.time})` : '';
            return `
                <div class="morning-act-row">
                    <span class="morning-act-dot"></span>
                    <span class="morning-act-subj">${name}:</span>
                    <span class="morning-act-title">${a.title}</span>
                    <span class="morning-act-time">${time}</span>
                    <button class="btn-ghost btn-xs" onclick="Activities.openDetailModal('${a.id}')">Ver Directrices</button>
                </div>
            `;
        }).join('');

        banner.innerHTML = `
            <div class="morning-banner-header">
                <div class="morning-banner-title">
                    <span class="morning-badge">[AVISO MATUTINO]</span>
                    <strong>Tienes ${todayActs.length} actividad(es) con entrega para HOY</strong>
                </div>
                <button class="morning-banner-close" onclick="this.closest('#morningTodayBanner').remove()">&times;</button>
            </div>
            <div class="morning-banner-list">
                ${itemsHtml}
            </div>
        `;

        // Notificación web nativa (una sola emisión al día)
        const lastNotifDate = localStorage.getItem('gx_morning_web_notif_date');
        if (lastNotifDate !== todayStr && 'Notification' in window && Notification.permission === 'granted') {
            localStorage.setItem('gx_morning_web_notif_date', todayStr);
            const first = todayActs[0];
            sendWebNotification(`[AVISO MATUTINO] Tienes ${todayActs.length} entrega(s) HOY`, {
                body: `${first.title} ${first.time ? `(Hora: ${first.time})` : ''}. Consulta directrices en la app.`,
                tag: 'morning-digest-' + todayStr
            });
        }
    }

    /* ══════════════════════════════════════════════════════════
       3. DIFUSIÓN POR WHATSAPP (MENSAJES CON EMOJIS Y FORMATO)
    ═══════════════════════════════════════════════════════════ */
    function shareActivityWhatsApp(activityId) {
        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const a = activities.find(act => act.id === activityId);
        if (!a) return;

        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const subj = subjects.find(s => s.id === a.subjectId);
        const settings = typeof DB !== 'undefined' ? DB.getSettings() : { carrera: 'INGENIERÍA DE SISTEMAS', seccion: '08S-2623-D1' };
        const g = a.guidelines || {};

        let text = `*— AVISO DE EVALUACIÓN / ACTIVIDAD —*\n`;
        text += `*${settings.carrera}* | Secc. *${settings.seccion}*\n\n`;

        text += `*${a.title}*\n`;
        if (subj) {
            text += `• *Materia:* ${subj.name} ${subj.room ? `(Aula: ${subj.room})` : ''}\n`;
            if (subj.teacher) text += `• *Docente:* ${subj.teacher}\n`;
        } else {
            text += `• *Tipo:* Evento Especial / Fuera de Materia\n`;
        }

        text += `• *Fecha límite:* ${formatDateES(a.date)} ${a.time ? `a las ${a.time}` : ''}\n`;
        if (a.corte) text += `• *Corte:* ${a.corte}° Corte | • *Ponderación:* ${a.weight || 0}%\n`;
        if (a.priority) text += `• *Prioridad:* ${a.priority.toUpperCase()}\n`;

        text += `• *Modalidad:* ${g.mode === 'group' ? `Grupal (Máx ${g.groupMax || 'N'} personas)` : 'Individual'}\n`;
        if (g.deliveryFormat) text += `• *Formato:* ${g.deliveryFormat.toUpperCase()}\n`;

        if (g.instructions || a.desc) {
            text += `\n• *Directrices:* ${g.instructions || a.desc}\n`;
        }
        if (g.resourceLink) {
            text += `• *Material de Apoyo:* ${g.resourceLink}\n`;
        }

        text += `\n_Gestor Académico XK: https://xekred.github.io/gestor-universitario/_`;

        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        toast('Abriendo WhatsApp...', 'success');
    }

    function shareTodayScheduleWhatsApp() {
        const todayClasses = typeof Schedule !== 'undefined' ? Schedule.getTodayClasses() : [];
        const settings = typeof DB !== 'undefined' ? DB.getSettings() : { carrera: 'INGENIERÍA DE SISTEMAS', seccion: '08S-2623-D1' };
        const now = new Date();
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diaNombre = dias[now.getDay()];
        const fechaStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        let text = `*— HORARIO DE HOY — ${diaNombre.toUpperCase()} (${fechaStr})*\n`;
        text += `*${settings.carrera}* | Secc. *${settings.seccion}*\n\n`;

        if (!todayClasses || todayClasses.length === 0) {
            text += `*No hay clases programadas para hoy.*\n`;
        } else {
            todayClasses.forEach((c, idx) => {
                text += `${idx + 1}. ⏰ *${c.start} - ${c.end}*\n`;
                text += `   • *${c.name}*\n`;
                if (c.room) text += `     Aula: ${c.room}\n`;
                if (c.teacher) text += `     Docente: ${c.teacher}\n`;
                text += `\n`;
            });
        }

        // Próximas actividades cercanas (próximos 7 días)
        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const upcoming = activities.filter(a => {
            if (!a.date) return false;
            const diff = (new Date(a.date + 'T00:00:00') - now) / 86400000;
            return diff >= 0 && diff <= 7;
        });

        if (upcoming.length > 0) {
            text += `• *EVALUACIONES / ENTREGAS ESTA SEMANA:*\n`;
            upcoming.forEach(a => {
                text += `• *${a.title}* (${a.date}) ${a.corte ? `— Corte ${a.corte}` : ''} ${a.weight ? `(${a.weight}%)` : ''}\n`;
            });
            text += `\n`;
        }

        text += `_Gestor Académico XK: https://xekred.github.io/gestor-universitario/_`;

        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        toast('Abriendo WhatsApp...', 'success');
    }

    function shareWeeklyScheduleWhatsApp() {
        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const settings = typeof DB !== 'undefined' ? DB.getSettings() : { carrera: 'INGENIERÍA DE SISTEMAS', seccion: '08S-2623-D1' };
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const allBlocks = typeof Schedule !== 'undefined' ? Schedule.ALL_BLOCKS : [];

        let text = `*— HORARIO SEMANAL COMPLETO —*\n`;
        text += `*${settings.carrera}* | Sem. *${settings.semestre || 'VIII'}* | Secc. *${settings.seccion}*\n\n`;

        dias.forEach((dia, dayIdx) => {
            const daySlots = [];
            subjects.forEach(s => {
                if (!s.slots) return;
                s.slots.forEach(slot => {
                    if (slot.day === dayIdx) {
                        const startBlk = allBlocks[slot.startBlock] || { start: '??:??' };
                        const endBlk = allBlocks[slot.startBlock + slot.span - 1] || startBlk;
                        daySlots.push({
                            subject: s.name,
                            room: s.room || '',
                            startBlock: slot.startBlock,
                            time: `${startBlk.start} - ${endBlk.end}`
                        });
                    }
                });
            });

            if (daySlots.length > 0) {
                daySlots.sort((a, b) => a.startBlock - b.startBlock);
                text += `*── ${dia.toUpperCase()} ──*\n`;
                daySlots.forEach(s => {
                    text += `⏰ ${s.time} | *${s.subject}* ${s.room ? `(${s.room})` : ''}\n`;
                });
                text += `\n`;
            }
        });

        text += `_Gestor Académico XK_`;
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    /* ══════════════════════════════════════════════════════════
       4. DIFUSIÓN POR TELEGRAM (BOT API & SHARE LINK)
    ═══════════════════════════════════════════════════════════ */
    function getTelegramConfig() {
        const s = localStorage.getItem(LS_TELEGRAM);
        return s ? JSON.parse(s) : { botToken: '', chatId: '', active: false };
    }

    function saveTelegramConfig(cfg) {
        localStorage.setItem(LS_TELEGRAM, JSON.stringify(cfg));
    }

    async function sendTelegramAlert(text) {
        const cfg = getTelegramConfig();
        if (!cfg.botToken || !cfg.chatId) {
            toast('Bot Token o Chat ID no configurados en Admin. Abriendo compartir directo...', 'warning');
            shareTelegramDirect(text);
            return false;
        }

        const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: cfg.chatId,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });
            const data = await resp.json();
            if (data.ok) {
                toast('Alerta publicada con éxito en el canal de Telegram ', 'success');
                return true;
            } else {
                toast(`Telegram API: ${data.description || 'Error de envío'}`, 'error');
                shareTelegramDirect(text);
                return false;
            }
        } catch (e) {
            toast(`Fallo de conexión Telegram: ${e.message}. Abriendo compartir directo...`, 'warning');
            shareTelegramDirect(text);
            return false;
        }
    }

    function shareTelegramDirect(text) {
        const appUrl = 'https://xekred.github.io/gestor-universitario/';
        const url = `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    async function shareActivityTelegram(activityId) {
        const activities = (typeof DB !== 'undefined' ? DB.get('activities') : []) || [];
        const a = activities.find(act => act.id === activityId);
        if (!a) return;

        const subjects = typeof Schedule !== 'undefined' ? Schedule.getSubjects() : [];
        const subj = subjects.find(s => s.id === a.subjectId);
        const settings = typeof DB !== 'undefined' ? DB.getSettings() : { carrera: 'INGENIERÍA DE SISTEMAS', seccion: '08S-2623-D1' };
        const g = a.guidelines || {};

        let text = `*— AVISO DE ACTIVIDAD ACADÉMICA —*\n`;
        text += `*${settings.carrera}* | Secc. *${settings.seccion}*\n\n`;
        text += `*${a.title}*\n`;
        if (subj) text += `• *Materia:* ${subj.name} ${subj.room ? `(Aula ${subj.room})` : ''}\n`;
        text += `• *Fecha límite:* ${formatDateES(a.date)} ${a.time ? `a las ${a.time}` : ''}\n`;
        if (a.corte) text += `• *Corte:* ${a.corte}° Corte | • *Ponderación:* ${a.weight || 0}%\n`;
        text += `• *Modalidad:* ${g.mode === 'group' ? `Grupal (Máx ${g.groupMax || 'N'})` : 'Individual'}\n`;
        if (g.instructions || a.desc) text += `\n• *Directrices:* ${g.instructions || a.desc}\n`;
        if (g.resourceLink) text += `• *Material:* ${g.resourceLink}\n`;

        const cfg = getTelegramConfig();
        if (cfg.botToken && cfg.chatId) {
            await sendTelegramAlert(text);
        } else {
            shareTelegramDirect(text);
            toast('Abriendo Telegram para compartir...', 'info');
        }
    }

    function formatDateES(dateStr) {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }

    /* ══════════════════════════════════════════════════════════
       5. CHEQUEO AUTOMÁTICO DE RECORDATORIOS
    ═══════════════════════════════════════════════════════════ */
    function checkReminders() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const now = new Date();
        const curDay = now.getDay() >= 1 && now.getDay() <= 6 ? now.getDay() - 1 : -1;
        if (curDay === -1) return;

        const curMinutes = now.getHours() * 60 + now.getMinutes();

        const nextClass = typeof Schedule !== 'undefined' ? Schedule.getNextClass() : null;
        if (nextClass && nextClass.start) {
            const [h, m] = nextClass.start.split(':').map(Number);
            const classMinutes = h * 60 + m;
            const diff = classMinutes - curMinutes;

            if (diff === 15) {
                sendWebNotification(`[PRÓXIMA CLASE] en 15 minutos`, {
                    body: `${nextClass.name} inicia a las ${nextClass.start}${nextClass.room ? ` en el aula ${nextClass.room}` : ''}.`,
                });
            }
        }
    }

    setInterval(checkReminders, 60000);

    // Chequeo inicial al cargar
    setTimeout(() => {
        checkImminentDeliveriesNotification();
        checkMorningTodayBanner();
    }, 2000);

    /* ── API PÚBLICA ─────────────────────────────────────────── */
    return {
        toast,
        requestPermission,
        sendWebNotification,
        checkImminentDeliveriesNotification,
        checkMorningTodayBanner,
        shareTodayScheduleWhatsApp,
        shareWeeklyScheduleWhatsApp,
        shareActivityWhatsApp,
        shareActivityTelegram,
        sendTelegramAlert,
        shareTelegramDirect,
        getTelegramConfig,
        saveTelegramConfig
    };

})();

window.Notify = Notify;
