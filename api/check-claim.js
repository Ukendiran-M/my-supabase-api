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
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight for 1 day

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, fingerprint } = req.body;

    if (!fingerprint) {
      return res.status(400).json({ status: 'error', error: 'Missing fingerprint' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    // Dynamically build filter conditions based on what's available
    const filters = [];
    if (email) filters.push(`email.eq.${email}`);
    if (fingerprint) filters.push(`fingerprint.eq.${fingerprint}`);
    if (ip) filters.push(`ip_address.eq.${ip}`);

    const filterQuery = filters.join(',');

    const { data: existing, error } = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .or(filterQuery);

    if (error) {
      return res.status(500).json({ status: 'error', error: error.message });
    }

    if (existing && existing.length > 0) {
      return res.json({ status: 'claimed' });
    }

    return res.json({ status: 'new' });

  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}