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
        const iprogRes = await sendOtp(env, body.phone_number, body.message)

        // Normalize response
        const response = {
          status: iprogRes.status ?? 'success',
          message: iprogRes.message ?? 'OTP sent successfully',
          otp_code: iprogRes.otp_code,
          otp_code_expires_at: iprogRes.otp_code_expires_at
        }

        return Response.json(response)
      }

      if (body.action === 'verify') {
        const iprogRes = await verifyOtp(env, body.phone_number, body.otp)

        // Normalize response
        const response = {
          status: iprogRes.status ?? 'success',
          message: iprogRes.message ?? 'OTP verified successfully',
          data: iprogRes.data ?? [
            {
              phone_number: body.phone_number,
              otp_code: body.otp,
              expired_at: iprogRes.expired_at ?? null
            }
          ]
        }

        return Response.json(response)
      }

      return new Response('Invalid action', { status: 400 })
    } catch (err) {
      console.log(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}

type IprogSendResponse = {
  status?: string
  message?: string
  otp_code?: string | null
  otp_code_expires_at?: string | null
  [key: string]: any
}

async function sendOtp(
  env: Env,
  phone_number: string,
  message?: string
): Promise<IprogSendResponse> {
  const res = await fetch(`${iprogUrl}/send_otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_token: env.IPROGSMS_API,
      phone_number,
      message: message?.trim() ? message : undefined, // optional
    }),
  })

  if (!res.ok) {
    throw new Error(`Send OTP failed: ${res.status}`)
  }

  const json = await res.json()
  return json as IprogSendResponse
}

type IprogVerifyResponse = {
  status?: string
  message?: string
  data?: any
  expired_at?: string | null
  [key: string]: any
}

async function verifyOtp(
  env: Env,
  phone_number: string,
  otp: string
): Promise<IprogVerifyResponse> {
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

  const json = await res.json()
  return json as IprogVerifyResponse
}
