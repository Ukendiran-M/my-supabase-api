import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false, // We need raw body for HMAC verification
  },
};

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', err => reject(err));
  });

export default async function handler(req, res) {
  try {
    const rawBody = await getRawBody(req);
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const generatedHash = crypto
      .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (hmac !== generatedHash) {
      return res.status(401).json({ status: 'unauthorized' });
    }

    const order = JSON.parse(rawBody);
    const email = order.email?.toLowerCase();
    const ip = order.client_details?.browser_ip;
    const userAgent = order.client_details?.user_agent;

    const isFreeProduct = order.line_items.some(item =>
      item.title.toLowerCase().includes('free')
    );

    if (!email || !isFreeProduct) {
      return res.status(200).json({ status: 'skipped' });
    }

    // Avoid duplicate entry
    const { data: existing, error: fetchError } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .eq('email', email);

    if (fetchError) {
      return res.status(500).json({ status: 'error', error: fetchError.message });
    }

    if (existing && existing.length > 0) {
      return res.status(200).json({ status: 'duplicate_skipped' });
    }

    const { error: insertError } = await supabase.from('claimed_subscriptions').insert([
      {
        email,
        fingerprint: null,
        ip_address: ip || 'unknown',
        user_agent: userAgent || 'unknown',
        claimed_at: new Date()
      }
    ]);

    if (insertError) {
      return res.status(500).json({ status: 'insert_error', error: insertError.message });
    }

    return res.status(200).json({ status: 'recorded' });

  } catch (err) {
    return res.status(500).json({ status: 'crash', error: err.message });
  }
}