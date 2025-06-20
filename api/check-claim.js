const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://puerhcraft.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { device_uuid, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  if (!device_uuid || !ip) {
    return res.status(400).json({ status: 'error', error: 'Missing device_uuid or IP address' });
  }

  try {
    // Check if the device OR IP already made a completed claim
    const { data: existing, error } = await supabase
      .from('claimed_subscriptions')
      .select('order_id')
      .or(`device_uuid.eq.${device_uuid},ip_address.eq.${ip}`)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase SELECT error:', error.message);
      return res.status(500).json({ status: 'error', error: 'DB read failed' });
    }

    if (existing && existing.order_id !== null) {
      // Device or IP has already made a purchase
      return res.status(200).json({ status: 'claimed' });
    }

    // No completed order — allow to claim
    return res.status(200).json({ status: 'new' });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
};