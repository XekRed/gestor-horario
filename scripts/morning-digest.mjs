/**
 * =============================================================
 * morning-digest.mjs — Notificador Automático Matutino
 * Gestor Académico Universitario XK
 *
 * Compatible con:
 * - GitHub Actions Cron
 * - Vercel Serverless / Cron
 * - Supabase Edge Functions / Railway Worker
 * - Ejecución manual vía Node.js CLI
 *
 * Horario de referencia: 06:30 AM (America/Caracas, UTC-4)
 * =============================================================
 */

const DEFAULT_SUPABASE_URL = 'https://qwshviiriavlosnpyaku.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3c2h2aWlyaWF2bG9zbnB5YWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTY2OTQsImV4cCI6MjEwODk3MjY5NH0.4r-v04SgjheLtqn7rQIL4FEqqmAK2lpDAZk4p3kCDY4';

/**
 * Obtiene la fecha en formato YYYY-MM-DD en la zona horaria de Venezuela (UTC-4)
 */
function getCaracasDate(offsetDays = 0) {
    const now = new Date();
    if (offsetDays !== 0) {
        now.setUTCDate(now.getUTCDate() + offsetDays);
    }
    const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Caracas',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return dtf.format(now);
}

/**
 * Formatea una fecha ISO para encabezado legible en español
 */
function getCaracasHeaderDate() {
    const dtf = new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const str = dtf.format(new Date());
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Consulta la base de datos Supabase mediante REST API directa
 */
async function fetchSupabase(endpoint, url, key) {
    const cleanUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    const target = `${cleanUrl}/rest/v1/${endpoint}`;
    const res = await fetch(target, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    });
    if (!res.ok) {
        throw new Error(`Error en Supabase GET ${endpoint}: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

/**
 * Construye el texto formateado del resumen diario
 */
function formatDigestMessage(section, subjects, activitiesToday, activitiesTomorrow) {
    const todayHuman = getCaracasHeaderDate();
    const career = section?.career || 'INGENIERÍA DE SISTEMAS';
    const secCode = section?.section_code || '08S-2623-D1';

    const subjectMap = new Map();
    for (const s of subjects) {
        subjectMap.set(s.id, s);
    }

    let text = `[RESUMEN ACADÉMICO MATUTINO]\n`;
    text += `${career} — SECCIÓN ${secCode}\n`;
    text += `Fecha: ${todayHuman} (06:30 AM VET)\n`;
    text += `────────────────────────────\n\n`;

    if (activitiesToday.length === 0) {
        text += `• No hay evaluaciones ni eventos programados para HOY.\n\n`;
    } else {
        text += `[ACTIVIDADES PARA HOY]:\n`;
        activitiesToday.forEach((act, idx) => {
            const subj = act.subject_id ? subjectMap.get(act.subject_id) : null;
            const subjName = subj ? subj.name : 'ACTIVIDAD ESPECIAL';
            const subjCode = subj ? `[${subj.subject_code || 'N/A'}]` : '[GENERAL]';
            const room = subj?.classroom ? `(Aula: ${subj.classroom})` : '';

            let timeStr = '23:59';
            if (act.due_date) {
                const dt = new Date(act.due_date);
                const tf = new Intl.DateTimeFormat('es-VE', {
                    timeZone: 'America/Caracas',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                timeStr = tf.format(dt);
            }

            const cutStr = act.cut ? `Corte ${act.cut}` : 'General';
            const weightStr = act.percentage ? ` — ${act.percentage}%` : '';
            const priorityStr = (act.priority || 'media').toUpperCase();

            text += `${idx + 1}. ${subjName} ${subjCode} ${room}\n`;
            text += `   • Tarea: ${act.title}\n`;
            text += `   • Parámetros: [${cutStr}${weightStr}] — Prioridad: [${priorityStr}]\n`;
            text += `   • Hora límite: ${timeStr}\n`;

            const g = (typeof act.guidelines === 'object' && act.guidelines !== null) ? act.guidelines : {};
            if (g.mode) {
                text += `   • Modalidad: ${g.mode === 'group' ? `Grupal (Máx. ${g.groupMax || 'N'} personas)` : 'Individual'}\n`;
            }
            if (g.deliveryFormat) {
                text += `   • Formato: ${g.deliveryFormat.toUpperCase()}\n`;
            }
            if (g.instructions) {
                const cleanInst = g.instructions.length > 140 ? g.instructions.slice(0, 137) + '...' : g.instructions;
                text += `   • Pautas: ${cleanInst}\n`;
            }
            text += `\n`;
        });
    }

    if (activitiesTomorrow.length > 0) {
        text += `[VISTAZO PARA MAÑANA]:\n`;
        activitiesTomorrow.forEach((act, idx) => {
            const subj = act.subject_id ? subjectMap.get(act.subject_id) : null;
            const subjName = subj ? subj.name : 'ACTIVIDAD ESPECIAL';
            const subjCode = subj ? `[${subj.subject_code || 'N/A'}]` : '';
            text += `• ${subjName} ${subjCode}: ${act.title} (${act.cut ? `Corte ${act.cut}` : 'General'})\n`;
        });
        text += `\n`;
    }

    text += `────────────────────────────\n`;
    text += `Gestor Académico Universitario XK\n`;
    text += `Consulta el horario y directrices completas en la app web.`;

    return text;
}

/**
 * Envío vía Telegram Bot API
 */
async function sendTelegram(botToken, chatId, messageText) {
    if (!botToken || !chatId) {
        console.log('[Digest] Omitiendo Telegram (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados)');
        return { skipped: true };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            disable_web_page_preview: true
        })
    });

    const data = await res.json();
    if (!data.ok) {
        throw new Error(`Error en Telegram API: ${data.description || 'Desconocido'}`);
    }
    console.log('[Digest] Mensaje publicado en Telegram con éxito');
    return { success: true, messageId: data.result?.message_id };
}

/**
 * Conector opcional con Resend (Email)
 */
async function sendResend(apiKey, toEmail, subject, textContent) {
    if (!apiKey || !toEmail) {
        return { skipped: true };
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            from: 'Gestor Academico <onboarding@resend.dev>',
            to: Array.isArray(toEmail) ? toEmail : [toEmail],
            subject: subject,
            text: textContent
        })
    });

    const data = await res.json();
    if (!res.ok) {
        console.warn('[Digest] Error enviando correo con Resend:', data);
        return { error: data };
    }
    console.log('[Digest] Correo enviado vía Resend con éxito:', data.id);
    return { success: true, id: data.id };
}

/**
 * Función principal exportable para Vercel Cron y CLI
 */
export async function runMorningDigest(env = process.env) {
    const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
    const telegramToken = env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = env.TELEGRAM_CHAT_ID;
    const resendKey = env.RESEND_API_KEY;
    const resendTo = env.RESEND_TO_EMAIL;

    console.log(`[Digest] Iniciando procesamiento matutino (Hora Venezuela)...`);
    const todayStr = getCaracasDate(0);
    const tomorrowStr = getCaracasDate(1);
    console.log(`[Digest] Fecha objetivo HOY: ${todayStr} | MAÑANA: ${tomorrowStr}`);

    // Consultar datos de Supabase
    const [sections, subjects, activities] = await Promise.all([
        fetchSupabase('sections?select=*&limit=1', supabaseUrl, supabaseKey),
        fetchSupabase('subjects?select=*', supabaseUrl, supabaseKey),
        fetchSupabase('activities?select=*&order=due_date.asc', supabaseUrl, supabaseKey)
    ]);

    const section = sections[0] || null;

    // Filtrar actividades por fecha en zona horaria America/Caracas
    const activitiesToday = [];
    const activitiesTomorrow = [];

    for (const act of activities) {
        if (!act.due_date) continue;
        const dt = new Date(act.due_date);
        const dtf = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Caracas',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const actDateStr = dtf.format(dt);

        if (actDateStr === todayStr) {
            activitiesToday.push(act);
        } else if (actDateStr === tomorrowStr) {
            activitiesTomorrow.push(act);
        }
    }

    console.log(`[Digest] Actividades encontradas: ${activitiesToday.length} para hoy, ${activitiesTomorrow.length} para mañana`);

    const message = formatDigestMessage(section, subjects, activitiesToday, activitiesTomorrow);
    console.log('\n--- VISTA PREVIA DEL MENSAJE ---\n');
    console.log(message);
    console.log('\n---------------------------------\n');

    // Envío a canales
    const telegramResult = await sendTelegram(telegramToken, telegramChatId, message);
    const resendResult = await sendResend(resendKey, resendTo, `[AVISO ACADÉMICO] Actividades para hoy — ${section?.section_code || '08S'}`, message);

    return {
        success: true,
        date: todayStr,
        countToday: activitiesToday.length,
        countTomorrow: activitiesTomorrow.length,
        telegram: telegramResult,
        resend: resendResult,
        message
    };
}

import { pathToFileURL } from 'url';

// Ejecución directa si se invoca con `node scripts/morning-digest.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runMorningDigest()
        .then(res => {
            console.log('[Digest] Finalizado correctamente:', JSON.stringify({
                date: res.date,
                countToday: res.countToday,
                countTomorrow: res.countTomorrow
            }));
            process.exit(0);
        })
        .catch(err => {
            console.error('[Digest] Error crítico durante la ejecución:', err);
            process.exit(1);
        });
}
