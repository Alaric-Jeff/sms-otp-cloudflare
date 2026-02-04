Cloudflare Worker – iProgSMS OTP Send & Verify
==================================================

A serverless Cloudflare Worker that provides OTP (One-Time Password) sending and verification
using the iProgSMS API. Designed for mobile apps and frontend clients that need SMS-based
authentication without exposing API tokens.

This project is reusable by deploying it to your own Cloudflare Worker and supplying your own
iProgSMS API token via environment variables.

--------------------------------------------------
Features
--------------------------------------------------
- Send OTP via SMS using iProgSMS
- Verify OTP codes
- Single endpoint with action-based routing
- Detailed request logging (useful for debugging)
- Secure API token handling via environment variables

--------------------------------------------------
Requirements
--------------------------------------------------
- Cloudflare account
- Cloudflare Workers
- Wrangler CLI
- iProgSMS account with API token

--------------------------------------------------
Environment Variables
--------------------------------------------------
Set the following environment variable in your Cloudflare Worker:

IPROGSMS_API = Your iProgSMS API token

--------------------------------------------------
Setup Instructions
--------------------------------------------------
1. Fork or clone this repository

2. Install Wrangler CLI
   npm install -g wrangler

3. Login to Cloudflare
   wrangler login

4. Set the environment variable
   wrangler secret put IPROGSMS_API

5. Deploy the Worker
   wrangler deploy

--------------------------------------------------
API Usage
--------------------------------------------------
Endpoint:
POST /

--------------------------------------------------
Send OTP
--------------------------------------------------
Request body (JSON):

{
  "action": "send",
  "phone_number": "639XXXXXXXXX",
  "message": "Optional custom OTP message"
}

--------------------------------------------------
Verify OTP
--------------------------------------------------
Request body (JSON):

{
  "action": "verify",
  "phone_number": "639XXXXXXXXX",
  "otp": "123456"
}

--------------------------------------------------
Response Format
--------------------------------------------------
Send OTP (success):
{
  "status": "success",
  "message": "OTP sent successfully",
  "otp_code": null,
  "otp_code_expires_at": null
}

Verify OTP (success):
{
  "status": "success",
  "message": "OTP verified successfully",
  "data": {
    "phone_number": "...",
    "otp_code": "...",
    "expired_at": null
  }
}

Error:
{
  "status": "error",
  "message": "error description"
}

--------------------------------------------------
Notes
--------------------------------------------------
- API tokens are never committed to the repository
- Each user deploys this Worker under their own Cloudflare account
- SMS usage and billing are tied to the user’s own iProgSMS account
- Logging is verbose by default; consider reducing logs in production

--------------------------------------------------
License
--------------------------------------------------
Add a license (MIT recommended) if you want others to freely reuse this project.
"""

path = Path("/mnt/data/README_IPROGSMS.txt")
path.write_text(content)

path
