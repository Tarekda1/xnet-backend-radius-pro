const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createVerification() {
  const verification = await client.verify.v2
    .services("VA0e75c96dc31cd132955e8cfd2018f74e")
    .verifications.create({
      channel: "whatsapp",
      to: "+9613974338",
    });

  console.log(verification.accountSid);
}

createVerification();