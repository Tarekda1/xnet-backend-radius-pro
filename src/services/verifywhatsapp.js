const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID || "AC09e5a7c9b12d0ebd104552b30045b0e4";
const authToken = process.env.TWILIO_AUTH_TOKEN || "6e9c964ab42ad7c3100a6c5a3eb0ce9d";
const client = twilio(accountSid, authToken);

async function createVerification() {
  const verification = await client.verify.v2
    .services("VA0e75c96dc31cd132955e8cfd2018f74e")
    .verifications.create({
      channel: "whatsapp",
      to: "+9613974338",
    });

  console.log(verification);
}

createVerification();