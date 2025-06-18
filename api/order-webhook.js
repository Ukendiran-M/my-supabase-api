// pages/api/order-webhook.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Optional: Set a shared secret to verify manually
const BASIC_SECRET = process.env.WEBHOOK_SHARED_SECRET; // Set this in Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const incomingSecret = req.headers['x-shopify-topic-secret']; // Custom header you control
  if (BASIC_SECRET && incomingSecret !== BASIC_SECRET) {
    return res.status(401).json({ message: 'Unauthorized: Invalid Secret' });
  }

  try {
    const order = req.body;

    // Check if order already exists (use Shopify order ID or email)
    const existing = await supabase
      .from('claimed_subscriptions')
      .select('*')
      .eq('email', order.email)
      .single();

    if (existing.data) {
      return res.status(200).json({ message: 'Order already exists' });
    }

    // Insert new order into Supabase
    const { error } = await supabase.from('claimed_subscriptions').insert([
      {
        email: order.email,
        fingerprint: 'basic', // placeholder if you don’t collect this
        ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
        claimed_at: new Date(),
      },
    ]);

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