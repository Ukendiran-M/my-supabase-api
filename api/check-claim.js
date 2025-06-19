import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // --- Add CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "https://puerhcraft.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { device_uuid, user_agent } = req.body;
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    null;

  if (!device_uuid && !ip) {
    return res.status(400).json({
      status: 'error',
      error: 'Missing device_uuid or IP address',
    });
  }

  try {
    const filters = [];
    if (device_uuid) filters.push(`device_uuid.eq.${device_uuid}`);
    if (ip) filters.push(`ip_address.eq.${ip}`);

    let existing = [];
    if (filters.length > 0) {
      const { data, error } = await supabase
        .from('claimed_subscriptions')
        .select('id')
        .or(filters.join(','));

      if (error) {
        console.error('Supabase SELECT error:', error.message);
        return res.status(500).json({ status: 'error', error: 'DB read failed' });
      }
      existing = data;
    }

    if (existing.length > 0) {
      return res.json({ status: 'claimed' });
    }

    const { error: insertError } = await supabase
      .from('claimed_subscriptions')
      .insert([
        {
          device_uuid: device_uuid || null,
          ip_address: ip,
          user_agent: user_agent || null,
          claimed_at: new Date(),
          order_id: null,
        },
      ]);

    if (insertError) {
      console.error('Supabase INSERT error:', insertError.message);
      return res.status(500).json({ status: 'error', error: 'DB insert failed' });
    }

    return res.json({ status: 'new' });
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
}