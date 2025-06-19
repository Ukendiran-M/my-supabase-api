// /api/check-claim.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const allowedOrigin = 'https://puerhcraft.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, device_uuid, user_agent } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    if (!email && !device_uuid && !ip) {
      return res.status(400).json({ status: 'error', error: 'Missing identifiers' });
    }

    const filters = [];
    if (email) filters.push(`email.eq.${email}`);
    if (device_uuid) filters.push(`device_uuid.eq.${device_uuid}`);
    if (ip) filters.push(`ip_address.eq.${ip}`);

    const { data: existing, error: fetchError } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .or(filters.join(','));

    if (fetchError) return res.status(500).json({ status: 'error', error: fetchError.message });

    if (existing.length > 0) {
      return res.json({ status: 'claimed' });
    }

    const { error: insertError } = await supabase.from('claimed_subscriptions').insert([
      {
        email,
        device_uuid,
        ip_address: ip,
        user_agent,
        claimed_at: new Date(),
      }
    ]);

    if (insertError) {
      return res.status(500).json({ status: 'error', error: insertError.message });
    }

    return res.json({ status: 'new' });

  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
