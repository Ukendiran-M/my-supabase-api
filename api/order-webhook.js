import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const rawBody = await new Promise(resolve => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
    });

    const order = JSON.parse(rawBody);
    const email = order.email;
    const ip = order.client_details?.browser_ip;
    const userAgent = order.client_details?.user_agent;
    const isFreeProduct = order.line_items.some(item =>
      item.title.toLowerCase().includes("free")
    );

    if (!email || !isFreeProduct) {
      return res.status(200).json({ status: 'skipped' });
    }

    const { error } = await supabase.from('claimed_subscriptions').insert([{
      email,
      fingerprint: null, // no fingerprint from webhook
      ip_address: ip || 'unknown',
      user_agent: userAgent || 'unknown',
      claimed_at: new Date()
    }]);

    if (error) {
      return res.status(500).json({ status: 'error', error: error.message });
    }

    return res.status(200).json({ status: 'recorded' });

  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}