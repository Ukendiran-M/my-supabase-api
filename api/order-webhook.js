import crypto from 'crypto';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false, // Required to verify raw body
  },
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await buffer(req);
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // Verify HMAC
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (hash !== hmacHeader) {
    console.log("HMAC verification failed");
    return res.status(401).json({ error: 'Unauthorized - HMAC mismatch' });
  }

  const order = JSON.parse(rawBody.toString('utf8'));

  const isFree = order.line_items.some(item =>
    item.title.toLowerCase().includes('free')
  );

  if (!isFree) {
    return res.status(200).json({ status: 'not_free' });
  }

  const email = order.email;
  const ip = order.customer?.default_address?.ip || 'unknown';
  const userAgent = req.headers['user-agent'];

  const { data: existing } = await supabase
    .from('claimed_subscriptions')
    .select('id')
    .eq('email', email);

  if (existing && existing.length > 0) {
    return res.status(200).json({ status: 'already_claimed' });
  }

  const { error: insertError } = await supabase.from('claimed_subscriptions').insert([
    {
      email,
      fingerprint: 'via-webhook',
      ip_address: ip,
      user_agent: userAgent,
      claimed_at: new Date(),
    },
  ]);

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({ status: 'claimed' });
}