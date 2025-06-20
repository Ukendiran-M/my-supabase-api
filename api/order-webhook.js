import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BASIC_SECRET = process.env.WEBHOOK_SHARED_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const incomingSecret = req.headers['x-shopify-topic-secret'];
  if (BASIC_SECRET && incomingSecret !== BASIC_SECRET) {
    return res.status(401).json({ message: 'Unauthorized: Invalid Secret' });
  }

  try {
    const order = req.body;

    // Safely extract device_uuid from note_attributes
    let device_uuid = null;
    if (Array.isArray(order.note_attributes)) {
      const uuidAttr = order.note_attributes.find(attr => attr.name === 'device_uuid');
      if (uuidAttr) {
        device_uuid = uuidAttr.value || null;
      }
    }

    // Check if the email already exists
    const { data: existing } = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .eq('email', order.email)
      .single();

    if (existing) {
      return res.status(200).json({ message: 'Order already exists' });
    }

    // Insert new record
    const { error } = await supabase.from('claimed_subscriptions').insert([{
      email: order.email,
      device_uuid,
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'],
      claimed_at: new Date(),
      order_id: order.id,
    }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ message: 'Insert failed' });
    }

    return res.status(200).json({ message: 'Order saved' });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}