import * as admin from "firebase-admin";

// ✅ Prevent re-initialization in serverless envs
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const BASIC_SECRET = process.env.WEBHOOK_SHARED_SECRET;

export default async function handler(req, res) {
  // ✅ Allow POST only
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // ✅ Verify webhook secret
  const incomingSecret = req.headers["x-shopify-topic-secret"];
  if (BASIC_SECRET && incomingSecret !== BASIC_SECRET) {
    console.warn("⚠️ Invalid webhook secret:", incomingSecret);
    return res.status(401).json({ message: "Unauthorized: Invalid Secret" });
  }

  try {
    const order = req.body;
    console.log("🧾 Incoming order:", JSON.stringify(order, null, 2));

    // 1️⃣ Extract customer email
    const email = order.email || null;
    if (!email) {
      console.warn("❌ Missing order email");
      return res.status(400).json({ message: "Missing order email" });
    }

    // 2️⃣ Extract note_attributes for device fingerprinting
    let device_uuid = null;
    let cookie_id = null;
    let fingerprint = null;

    if (Array.isArray(order.note_attributes)) {
      for (const attr of order.note_attributes) {
        if (attr.name === "device_uuid") device_uuid = attr.value;
        else if (attr.name === "cookie_id") cookie_id = attr.value;
        else if (attr.name === "fingerprint") fingerprint = attr.value;
      }
    }

    console.log("🔍 Extracted identifiers:", { device_uuid, cookie_id, fingerprint });

    // 3️⃣ Check for existing claim by email
    const claimsRef = db.collection("claimed_subscriptions");
    const snapshot = await claimsRef.where("email", "==", email).limit(1).get();

    if (!snapshot.empty) {
      console.log(`📦 Duplicate claim: Email ${email} already exists.`);
      return res.status(200).json({ message: "Order already exists" });
    }

    // 4️⃣ Add new claim
    const newClaim = {
      email,
      device_uuid: device_uuid || null,
      cookie_id: cookie_id || null,
      fingerprint: fingerprint || null,
      ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null,
      user_agent: req.headers["user-agent"] || null,
      claimed_at: admin.firestore.FieldValue.serverTimestamp(),
      order_id: order.id || null,
    };

    console.log("📤 Adding claim to Firestore:", newClaim);

    const docRef = await claimsRef.add(newClaim);

    console.log(`✅ Order saved. Doc ID: ${docRef.id} for ${email}`);
    return res.status(200).json({ message: "Order saved successfully", id: docRef.id });
  } catch (err) {
    console.error("🔥 Webhook handler error:", err);
    return res.status(500).json({ message: "Unexpected server error", error: err.message });
  }
}