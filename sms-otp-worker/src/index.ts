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
    console.log('========================================')
    console.log('NEW REQUEST')
    console.log('Method:', request.method)
    console.log('URL:', request.url)
    console.log('Headers:', JSON.stringify(Object.fromEntries(request.headers)))
    
    if (request.method !== 'POST') {
      console.log('ERROR: Method not allowed')
      return new Response('Method Not Allowed', { status: 405 })
    }

    let body: OtpRequest
    try {
      const rawBody = await request.text()
      console.log('Raw request body:', rawBody)
      body = JSON.parse(rawBody) as OtpRequest
      console.log('Parsed request body:', JSON.stringify(body, null, 2))
    } catch (err) {
      console.error('ERROR: Failed to parse JSON')
      console.error('Parse error:', err)
      return new Response('Invalid JSON body', { status: 400 })
    }

    console.log('Environment variables check:')
    console.log('IPROGSMS_API exists:', !!env.IPROGSMS_API)
    console.log('IPROGSMS_API type:', typeof env.IPROGSMS_API)
    console.log('IPROGSMS_API length:', env.IPROGSMS_API?.length || 0)
    console.log('IPROGSMS_API first 10 chars:', env.IPROGSMS_API?.substring(0, 10) + '...')

    try {
      if (body.action === 'send') {
        console.log('Action: SEND OTP')
        console.log('Phone number:', body.phone_number)
        console.log('Custom message:', body.message || 'none')
        
        const iprogRes = await sendOtp(env, body.phone_number, body.message)
        
        console.log('Send OTP successful')
        console.log('Response from iprog:', JSON.stringify(iprogRes, null, 2))

        const response = {
          status: iprogRes.status ?? 'success',
          message: iprogRes.message ?? 'OTP sent successfully',
          otp_code: iprogRes.otp_code ?? null,
          otp_code_expires_at: iprogRes.otp_code_expires_at ?? null
        }

        console.log('Normalized response:', JSON.stringify(response, null, 2))
        console.log('========================================')
        return Response.json(response)
      }

      if (body.action === 'verify') {
        console.log('Action: VERIFY OTP')
        console.log('Phone number:', body.phone_number)
        console.log('OTP code:', body.otp)
        
        const iprogRes = await verifyOtp(env, body.phone_number, body.otp)
        
        console.log('Verify OTP successful')
        console.log('Response from iprog:', JSON.stringify(iprogRes, null, 2))

        const response = {
          status: iprogRes.status ?? 'success',
          message: iprogRes.message ?? 'OTP verified successfully',
          data: iprogRes.data ?? {
            phone_number: body.phone_number,
            otp_code: body.otp,
            expired_at: iprogRes.expired_at ?? null
          }
        }

        console.log('Normalized response:', JSON.stringify(response, null, 2))
        console.log('========================================')
        return Response.json(response)
      }

      console.log('ERROR: Invalid action:', body)
      return new Response('Invalid action', { status: 400 })
    } catch (err) {
      console.error('========================================')
      console.error('FATAL ERROR')
      console.error('Error type:', err?.constructor?.name)
      console.error('Error message:', err instanceof Error ? err.message : String(err))
      console.error('Error stack:', err instanceof Error ? err.stack : 'no stack')
      console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
      console.error('========================================')
      return new Response('Internal Server Error', { status: 500 })
    }
  },
} satisfies ExportedHandler<Env>

type IprogSendResponse = {
  status?: string
  message?: string
  otp_code?: string | null
  otp_code_expires_at?: string | null
  [key: string]: unknown
}

async function sendOtp(
  env: Env,
  phone_number: string,
  message?: string
): Promise<IprogSendResponse> {
  const requestBody = {
    api_token: env.IPROGSMS_API,
    phone_number,
    ...(message?.trim() && { message }),
  }

  console.log('Calling iprog send_otp endpoint')
  console.log('URL:', `${iprogUrl}/send_otp`)
  console.log('Request body:', JSON.stringify({
    ...requestBody,
    api_token: requestBody.api_token.substring(0, 10) + '...'
  }, null, 2))

  const res = await fetch(`${iprogUrl}/send_otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  console.log('iprog send_otp response status:', res.status)
  console.log('iprog send_otp response headers:', JSON.stringify(Object.fromEntries(res.headers)))

  const responseText = await res.text()
  console.log('iprog send_otp response body (raw):', responseText)

  if (!res.ok) {
    console.error('iprog send_otp request failed')
    console.error('Status:', res.status)
    console.error('Response:', responseText)
    throw new Error(`Send OTP failed: ${res.status} - ${responseText}`)
  }

  let parsedResponse
  try {
    parsedResponse = JSON.parse(responseText)
    console.log('iprog send_otp response body (parsed):', JSON.stringify(parsedResponse, null, 2))
  } catch (err) {
    console.error('Failed to parse iprog response as JSON')
    console.error('Parse error:', err)
    throw new Error('Invalid JSON response from iprog')
  }

  return parsedResponse as IprogSendResponse
}

type IprogVerifyResponse = {
  status?: string
  message?: string
  data?: unknown
  expired_at?: string | null
  [key: string]: unknown
}

async function verifyOtp(
  env: Env,
  phone_number: string,
  otp: string
): Promise<IprogVerifyResponse> {
  const requestBody = {
    api_token: env.IPROGSMS_API,
    phone_number,
    otp,
  }

  console.log('Calling iprog verify_otp endpoint')
  console.log('URL:', `${iprogUrl}/verify_otp`)
  console.log('Request body:', JSON.stringify({
    ...requestBody,
    api_token: requestBody.api_token.substring(0, 10) + '...'
  }, null, 2))

  const res = await fetch(`${iprogUrl}/verify_otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  console.log('iprog verify_otp response status:', res.status)
  console.log('iprog verify_otp response headers:', JSON.stringify(Object.fromEntries(res.headers)))

  const responseText = await res.text()
  console.log('iprog verify_otp response body (raw):', responseText)

  if (!res.ok) {
    console.error('iprog verify_otp request failed')
    console.error('Status:', res.status)
    console.error('Response:', responseText)
    throw new Error(`Verify OTP failed: ${res.status} - ${responseText}`)
  }

  let parsedResponse
  try {
    parsedResponse = JSON.parse(responseText)
    console.log('iprog verify_otp response body (parsed):', JSON.stringify(parsedResponse, null, 2))
  } catch (err) {
    console.error('Failed to parse iprog response as JSON')
    console.error('Parse error:', err)
    throw new Error('Invalid JSON response from iprog')
  }

  return parsedResponse as IprogVerifyResponse
}