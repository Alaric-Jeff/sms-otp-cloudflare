export interface Env {
  IPROGSMS_API: string
}

const iprogUrl = 'https://www.iprogsms.com/api/v1/otp'

type OtpRequest =
  | {
    action: 'send'
    phone_number: string
    message?: string
  }
  | {
    action: 'verify'
    phone_number: string
    otp: string
  }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let body: OtpRequest
    try {
      body = (await request.json()) as OtpRequest
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    try {
      if (body.action === 'send') {
        const result = await sendOtp(env, body.phone_number, body.message)
        return Response.json(result)
      }

      if (body.action === 'verify') {
        const result = await verifyOtp(env, body.phone_number, body.otp)
        return Response.json(result)
      }

      return new Response('Invalid action', { status: 400 })
    } catch (err) {
      console.log(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}

async function sendOtp(
  env: Env,
  phone_number: string,
  message?: string
) {
  const res = await fetch(`${iprogUrl}/send_otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_token: env.IPROGSMS_API, // ← correct field name
      phone_number,
      message: message ?? undefined, // optional
    }),
  })

  if (!res.ok) {
    throw new Error(`Send OTP failed: ${res.status}`)
  }

  return res.json()
}

async function verifyOtp(
  env: Env,
  phone_number: string,
  otp: string
) {
  const res = await fetch(`${iprogUrl}/verify_otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_token: env.IPROGSMS_API,
      phone_number,
      otp,
    }),
  })

  if (!res.ok) {
    throw new Error(`Verify OTP failed: ${res.status}`)
  }

  return res.json()
}
