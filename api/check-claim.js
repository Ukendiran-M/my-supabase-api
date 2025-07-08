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

  const { device_uuid, cookie_id, fingerprint, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  if (!ip) {
    return res.status(400).json({ status: 'error', error: 'Missing IP address' });
  }

  try {
    // Build dynamic OR conditions
    const filters = [];
    if (device_uuid) filters.push(`device_uuid.eq.${device_uuid}`);
    if (cookie_id) filters.push(`cookie_id.eq.${cookie_id}`);
    if (fingerprint) filters.push(`fingerprint.eq.${fingerprint}`);
    filters.push(`ip_address.eq.${ip}`); // Always check IP

    const filterExpression = filters.join(',');

    const { data: existing, error } = await supabase
      .from('claimed_subscriptions')
      .select('order_id')
      .or(filterExpression)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase SELECT error:', error.message);
      return res.status(500).json({ status: 'error', error: 'Database read failed' });
    }

    if (existing && existing.order_id !== null) {
      return res.status(200).json({ status: 'claimed' });
    }

    return res.status(200).json({ status: 'new' });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
};