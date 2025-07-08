import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  // Setup CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://puerhcraft.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { device_uuid, cookie_id, fingerprint, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  if (!ip) {
    return res.status(400).json({ status: 'error', error: 'Missing IP address' });
  }

  try {
    // Build dynamic OR filters
    const orConditions = [];
    if (device_uuid) orConditions.push(['device_uuid', '==', device_uuid]);
    if (cookie_id) orConditions.push(['cookie_id', '==', cookie_id]);
    if (fingerprint) orConditions.push(['fingerprint', '==', fingerprint]);
    orConditions.push(['ip_address', '==', ip]);

    let matchFound = false;

    // Firestore does not support native ORs → run each query and check
    for (const [field, op, value] of orConditions) {
      const snapshot = await db
        .collection('claimed_subscriptions')
        .where(field, op, value)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        matchFound = true;
        break;
      }
    }

    if (matchFound) {
      return res.status(200).json({ status: 'claimed' });
    }

    return res.status(200).json({ status: 'new' });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
}