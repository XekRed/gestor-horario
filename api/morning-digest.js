import { runMorningDigest } from '../scripts/morning-digest.mjs';

export default async function handler(req, res) {
    // Permitir invocación vía GET o POST (Vercel Cron o webhook)
    try {
        const result = await runMorningDigest(process.env);
        return res.status(200).json({
            ok: true,
            timestamp: new Date().toISOString(),
            ...result
        });
    } catch (error) {
        console.error('[API Digest Error]:', error);
        return res.status(500).json({
            ok: false,
            error: error.message || 'Error ejecutando resumen matutino'
        });
    }
}
