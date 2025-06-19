import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { device_uuid, user_agent } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!device_uuid || !ip) {
      return res.status(400).json({ status: 'error', error: 'Missing device_uuid or IP' });
    }

    // Check if this device or IP has already claimed
    const { data: existing, error: checkError } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .or(`device_uuid.eq.${device_uuid},ip_address.eq.${ip}`)
      .maybeSingle();

    if (checkError) {
      console.error('Supabase SELECT error:', checkError.message);
      return res.status(500).json({ status: 'error', error: 'Database read failed' });
    }

    if (existing) {
      return res.status(200).json({ status: 'claimed' });
    }

    // Insert new claim record
    const { error: insertError } = await supabase.from('claimed_subscriptions').insert([
      {
        device_uuid,
        ip_address: ip,
        user_agent: user_agent || null,
        claimed_at: new Date(),
        order_id: null // no order yet
      }
    ]);

    if (insertError) {
      console.error('Supabase INSERT error:', insertError.message);
      return res.status(500).json({ status: 'error', error: 'DB insert failed' });
    }

    return res.status(200).json({ status: 'new' });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ status: 'error', error: 'Server error' });
  }
}
