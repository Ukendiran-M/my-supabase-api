import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Set allowed origin
const allowedOrigin = 'https://puerhcraft.com';

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight for 1 day

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, fingerprint } = req.body;

    if (!email || !fingerprint) {
      return res.status(400).json({ status: 'error', error: 'Missing email or fingerprint' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // 1. Check if already claimed
    const { data: existing, error: fetchError } = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .or(`email.eq.${email},fingerprint.eq.${fingerprint}`);

    if (fetchError) {
      return res.status(500).json({ status: 'error', error: fetchError.message });
    }

    if (existing && existing.length > 0) {
      return res.json({ status: 'claimed' });
    }

    // 2. Insert new claim
    const { error: insertError } = await supabase.from('claimed_subscriptions').insert([
      {
        email,
        fingerprint,
        ip_address: ip,
        user_agent: userAgent,
        claimed_at: new Date(),
      },
    ]);

    if (insertError) {
      return res.status(500).json({ status: 'error', error: insertError.message });
    }

    return res.json({ status: 'new' });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}