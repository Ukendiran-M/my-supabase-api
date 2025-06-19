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
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, fingerprint } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    if (!email && !fingerprint && !ip) {
      return res.status(400).json({ status: 'error', error: 'Missing identifiers' });
    }

    const orFilters = [];
    if (email) orFilters.push(`email.eq.${email}`);
    if (fingerprint) orFilters.push(`fingerprint.eq.${fingerprint}`);
    if (ip) orFilters.push(`ip_address.eq.${ip}`);

    const { data: existing, error } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .or(orFilters.join(','));

    if (error) {
      return res.status(500).json({ status: 'error', error: error.message });
    }

    if (existing.length > 0) {
      return res.json({ status: 'claimed' });
    } else {
      return res.json({ status: 'new' });
    }

  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}