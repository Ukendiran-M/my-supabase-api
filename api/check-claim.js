const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
  // Setup CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://puerhcraft.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { device_uuid, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  if (!device_uuid || !ip) {
    return res.status(400).json({
      status: 'error',
      error: 'Missing device_uuid or IP address',
    });
  }

  try {
    // Check if either device_uuid or IP already made a purchase (i.e., has a non-null order_id)
    const { data: existing, error } = await supabase
      .from('claimed_subscriptions')
      .select('order_id')
      .or(`device_uuid.eq.${device_uuid},ip_address.eq.${ip}`)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase SELECT error:', error.message);
      return res.status(500).json({ status: 'error', error: 'Database read failed' });
    }

    // If there's a match with a non-null order_id, treat it as claimed
    if (existing && existing.order_id !== null) {
      return res.status(200).json({ status: 'claimed' });
    }

    // No valid prior purchase — allow access
    return res.status(200).json({ status: 'new' });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
};
