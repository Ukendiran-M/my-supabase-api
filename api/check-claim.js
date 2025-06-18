// /api/check-claim.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, fingerprint } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // 1. Check if already claimed
  const { data: existing } = await supabase
    .from('claimed_subscriptions')
    .select('*')
    .or(`email.eq.${email},fingerprint.eq.${fingerprint}`);

  if (existing && existing.length > 0) {
    return res.json({ status: 'claimed' });
  }

  // 2. Insert new claim
  const { error } = await supabase.from('claimed_subscriptions').insert([
    {
      email,
      fingerprint,
      ip_address: ip,
      user_agent: userAgent,
      claimed_at: new Date(),
    },
  ]);

  if (error) return res.status(500).json({ status: 'error', error });

  return res.json({ status: 'new' });
}