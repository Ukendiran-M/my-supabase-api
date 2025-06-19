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
    const { data: existing, error: checkError } = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .eq('device_uuid', device_uuid)
      .eq('ip_address', ip)
      .maybeSingle();

    if (checkError) {
      console.error('Supabase SELECT error:', checkError.message);
      return res.status(500).json({ status: 'error', error: 'DB read failed' });
    }

    if (existing) {
      return res.status(200).json({ status: 'claimed' });
    }

    const insertData = {
      device_uuid,
      ip_address: ip,
      user_agent: user_agent || null,
      claimed_at: new Date(),
      order_id: null,
    };

    const { error: insertError } = await supabase
      .from('claimed_subscriptions')
      .insert([insertData]);

    if (insertError) {
      console.error('Supabase INSERT error:', insertError.message);
      return res.status(500).json({ status: 'error', error: 'DB insert failed' });
    }

    return res.status(200).json({ status: 'new' });
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
};
