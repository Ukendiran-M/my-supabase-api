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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { device_uuid, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  if (!device_uuid || !ip) {
    return res.status(400).json({
      status: 'error',
      error: 'Missing device_uuid or IP address',
    });
  }

  try {
    // Check only for records that have order_id (i.e., completed purchase)
    const { data: existing, error: checkError } = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .eq('device_uuid', device_uuid)
      .eq('ip_address', ip)
      .not('order_id', 'is', null)  // <-- Only if an order exists
      .maybeSingle();

    if (checkError) {
      console.error('Supabase SELECT error:', checkError.message);
      return res.status(500).json({ status: 'error', error: 'DB read failed' });
    }

    if (existing) {
      return res.status(200).json({ status: 'claimed' });
    }

    return res.status(200).json({ status: 'new' });
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
};