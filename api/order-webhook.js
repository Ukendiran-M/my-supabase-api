import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BASIC_SECRET = process.env.WEBHOOK_SHARED_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const incomingSecret = req.headers['x-shopify-topic-secret'];
  if (BASIC_SECRET && incomingSecret !== BASIC_SECRET) {
    return res.status(401).json({ message: 'Unauthorized: Invalid Secret' });
  }

  try {
    const order = req.body;

    // Step 1: Extract email safely
    const email = order.email || null;
    if (!email) {
      return res.status(400).json({ message: 'Missing order email' });
    }

    // Step 2: Extract device_uuid from note_attributes
    let device_uuid = null;
    if (Array.isArray(order.note_attributes)) {
      const attr = order.note_attributes.find(attr => attr.name === 'device_uuid');
      if (attr && typeof attr.value === 'string') {
        device_uuid = attr.value;
      }
    }

    // Step 3: Check if this email already claimed
    const { data: existing, error: lookupError } = await supabase
      .from('claimed_subscriptions')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) {
      console.error('Supabase lookup error:', lookupError);
      return res.status(500).json({ message: 'Database lookup error' });
    }

    if (existing) {
      return res.status(200).json({ message: 'Order already exists' });
    }

    // Step 4: Insert claim into Supabase
    const { error: insertError } = await supabase.from('claimed_subscriptions').insert([{
      email,
      device_uuid,
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
      claimed_at: new Date().toISOString(),
      order_id: order.id || null
    }]);

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ message: 'Insert failed' });
    }

    return res.status(200).json({ message: 'Order saved successfully' });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ message: 'Unexpected server error' });
  }
}
