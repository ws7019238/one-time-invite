// api/visit.js
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebase() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(serviceAccount) });
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { code, uaHint } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing code' });
    }

    initFirebase();
    const db = getFirestore();
    const docRef = db.collection('invites').doc(code);
    const docSnap = await docRef.get();

    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const ua = req.headers['user-agent'] || uaHint || 'unknown';

    if (!docSnap.exists) {
      await docRef.set({
        code,
        used: true,
        first_ip: ip,
        first_ua: ua,
        first_at: new Date().toISOString(),
      });
      return res.status(200).json({ ok: true, allowed: true });
    }

    return res.status(410).json({
      ok: true,
      allowed: false,
      reason: 'expired',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
