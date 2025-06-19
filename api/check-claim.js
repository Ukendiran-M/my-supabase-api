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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, device_uuid, user_agent } = req.body;
    const ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    if (!email && !device_uuid && !ip_address) {
      return res.status(400).json({ status: 'error', error: 'Missing identifiers' });
    }

    // Build OR conditions for Supabase query
    const orFilters = [];
    if (email) orFilters.push(`email.eq.${email}`);
    if (device_uuid) orFilters.push(`device_uuid.eq.${device_uuid}`);
    if (ip_address) orFilters.push(`ip_address.eq.${ip_address}`);

    const { data: existing, error } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .or(orFilters.join(','));

    if (error) {
      console.error('Supabase query error:', error.message);
      return res.status(500).json({ status: 'error', error: error.message });
    }

    if (existing.length > 0) {
      return res.json({ status: 'claimed' });
    }

    // Optionally, log the pre-check (not required for validation)
    await supabase.from('claimed_subscriptions').insert([
      {
        email,
        device_uuid,
        ip_address,
        user_agent,
        claimed_at: new Date(),
        order_id: null, // Will be updated later via webhook
      }
    ]);

    return res.json({ status: 'new' });

  } catch (err) {
    console.error('API error:', err.message);
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
