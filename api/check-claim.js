// ✅ Use your firebaseAdmin.js to init ONCE
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // ✅ Always set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', 'https://puerhcraft.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Handle preflight OPTIONS safely
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ✅ Now your actual logic — only runs for POST
  const { device_uuid, cookie_id, fingerprint, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  if (!ip) {
    return res.status(400).json({ status: 'error', error: 'Missing IP address' });
  }

  try {
    // Firestore OR workaround:
    const orConditions = [];
    if (device_uuid) orConditions.push(['device_uuid', '==', device_uuid]);
    if (cookie_id) orConditions.push(['cookie_id', '==', cookie_id]);
    if (fingerprint) orConditions.push(['fingerprint', '==', fingerprint]);
    orConditions.push(['ip_address', '==', ip]);

    let matchFound = false;
    for (const [field, op, value] of orConditions) {
      const snap = await db.collection('claimed_subscriptions')
        .where(field, op, value)
        .limit(1)
        .get();

      if (!snap.empty) {
        matchFound = true;
        break;
      }
    }

    if (matchFound) {
      return res.status(200).json({ status: 'claimed' });
    }

    return res.status(200).json({ status: 'new' });

  } catch (err) {
    console.error('🔥 Firestore query error:', err);
    return res.status(500).json({ status: 'error', error: err.message });
  }
}