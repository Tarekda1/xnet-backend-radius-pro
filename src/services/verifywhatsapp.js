/**
 * Manual Twilio WhatsApp smoke test.
 * Usage (from repo root, with .env loaded):
 *   node src/services/verifywhatsapp.js
 *
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID
 */
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function main() {
  const account = await client.api.accounts(accountSid).fetch();
  console.log("Twilio account OK:", account.status, account.friendlyName);
}

main().catch((err) => {
  console.error("Twilio check failed:", err.message || err);
  process.exit(1);
});
