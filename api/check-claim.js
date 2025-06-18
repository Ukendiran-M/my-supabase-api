// /api/check-claim.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // ✅ CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://puerhcraft.com"); // Only allow your domain
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Only accept POST
  if (req.method !== 'POST') return res.status(405).end();

  const { email, fingerprint } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!email || !fingerprint) {
    return res.status(400).json({ status: 'error', error: 'Missing email or fingerprint' });
  }

  // ✅ 1. Check if already claimed
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

  // ✅ 2. Insert new claim
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