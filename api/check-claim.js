import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: true,
  },
};

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
    console.log("BODY RECEIVED:", req.body);

    const { email, fingerprint } = req.body;

    if (!email || !fingerprint) {
      console.error("Missing values:", { email, fingerprint });
      return res.status(400).json({ status: 'error', error: 'Missing email or fingerprint' });
    }

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const userAgent = req.headers['user-agent'];

    const { data: existing, error: fetchError } = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .or(`email.eq.${email},fingerprint.eq.${fingerprint}`);

    if (fetchError) {
      console.error("Fetch Error:", fetchError);
      return res.status(500).json({ status: 'error', error: fetchError.message });
    }

    if (existing && existing.length > 0) {
      return res.json({ status: 'claimed' });
    }

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
      console.error("Insert Error:", insertError);
      return res.status(500).json({ status: 'error', error: insertError.message });
    }

    return res.json({ status: 'new' });

  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ status: 'error', error: err.message });
  }
}