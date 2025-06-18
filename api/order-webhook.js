import crypto from 'crypto';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false, // Disable bodyParser to read raw body for HMAC verification
  },
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const rawBody = await buffer(req);
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (!hmacHeader || !secret) {
      console.error('Missing HMAC header or webhook secret');
      return res.status(401).json({ error: 'Unauthorized - Missing signature or secret' });
    }

    // HMAC verification
    const generatedHash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const isVerified = crypto.timingSafeEqual(
      Buffer.from(generatedHash),
      Buffer.from(hmacHeader)
    );

    if (!isVerified) {
      console.warn('❌ HMAC verification failed');
      return res.status(401).json({ error: 'Unauthorized - HMAC mismatch' });
    }

    // Parse and log order data
    const order = JSON.parse(rawBody.toString('utf8'));
    console.log('✅ Verified Webhook Order:', order.id);

    // Check if it contains a free product
    const isFree = order.line_items.some(item =>
      item.title.toLowerCase().includes('free')
    );

    if (!isFree) {
      return res.status(200).json({ status: 'not_free' });
    }

    const email = order.email;
    const ip = order.customer?.default_address?.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'Webhook';

    // Prevent duplicate claims
    const { data: existing, error: fetchError } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .eq('email', email);

    if (fetchError) {
      console.error('Error checking existing claims:', fetchError.message);
      return res.status(500).json({ error: fetchError.message });
    }

    if (existing && existing.length > 0) {
      return res.status(200).json({ status: 'already_claimed' });
    }

    // Insert new claim
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
      console.error('Insert error:', insertError.message);
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json({ status: 'claimed' });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}