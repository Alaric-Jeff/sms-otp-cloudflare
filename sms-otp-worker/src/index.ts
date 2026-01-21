export interface Env {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

// Generate Firebase Auth Token using Web Crypto API
async function getFirebaseToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: "https://firestore.googleapis.com/",
    iat: now,
    exp: expiry,
  };

  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const payloadBase64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const signatureInput = `${headerBase64}.${payloadBase64}`;

  // Import private key
  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signatureInput)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signatureInput}.${signatureBase64}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Firestore REST API helper
async function firestoreRequest(
  env: Env,
  path: string,
  method: string = "GET",
  body?: any
) {
  const token = await getFirebaseToken(env);
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore error: ${error}`);
  }

  return response.json();
}

// Convert Firestore document to simple object
function firestoreToObject(doc: any): any {
  if (!doc.fields) return null;
  const obj: any = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    const val = value as any;
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.timestampValue !== undefined) obj[key] = new Date(val.timestampValue);
    else if (val.nullValue !== undefined) obj[key] = null;
  }
  return obj;
}

// Convert object to Firestore format
function objectToFirestore(obj: any): any {
  const fields: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") fields[key] = { stringValue: value };
    else if (typeof value === "number") fields[key] = { integerValue: value.toString() };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else if (value instanceof Date) fields[key] = { timestampValue: value.toISOString() };
    else if (value === null) fields[key] = { nullValue: null };
  }
  return { fields };
}

// Generate random 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send SMS via Twilio using Phone Number
async function sendTwilioSms(to: string, message: string, env: Env) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: env.TWILIO_PHONE_NUMBER,
    Body: message,
  });
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio SMS error: ${text}`);
  }

  return res.json();
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = (await request.json()) as {
        userId?: string;
        phone?: string;
        otp?: string;
        action?: "send" | "verify";
      };
      const { userId, phone, otp, action } = body;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get user document from Firestore
      const userDoc = await firestoreRequest(env, `/users/${userId}`);
      const userData = firestoreToObject(userDoc);

      if (!userData) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // SEND OTP
      if (action === "send") {
        if (!userData.isPhoneVerified || !userData.is2FAEnabled) {
          return new Response(
            JSON.stringify({ error: "2FA not enabled or phone not verified" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }

        if (!phone) {
          return new Response(
            JSON.stringify({ error: "Phone required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Generate OTP
        const otpCode = generateOtp();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Store OTP in Firestore
        await firestoreRequest(
          env,
          `/users/${userId}?updateMask.fieldPaths=currentOtpCode&updateMask.fieldPaths=otpExpiresAt`,
          "PATCH",
          objectToFirestore({
            currentOtpCode: otpCode,
            otpExpiresAt: otpExpiresAt,
          })
        );

        // Send SMS with OTP
        const message = `Your verification code is: ${otpCode}. It will expire in 5 minutes.`;
        await sendTwilioSms(phone, message, env);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "OTP sent via SMS",
            expiresIn: "5 minutes"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // VERIFY OTP
      if (action === "verify") {
        if (!otp) {
          return new Response(
            JSON.stringify({ error: "OTP required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Check if OTP matches and is not expired
        if (
          userData.currentOtpCode === otp &&
          userData.otpExpiresAt &&
          userData.otpExpiresAt > new Date()
        ) {
          // Clear OTP from Firestore after successful verification
          await firestoreRequest(
            env,
            `/users/${userId}?updateMask.fieldPaths=currentOtpCode&updateMask.fieldPaths=otpExpiresAt`,
            "PATCH",
            objectToFirestore({
              currentOtpCode: null,
              otpExpiresAt: null,
            })
          );

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "OTP verified successfully" 
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Invalid or expired OTP" 
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Action must be send or verify" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      const error = err as Error;
      console.error(error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};