import axios from "axios";

// type WhatsAppSendOptions = {
//   to: string;              // E.164, with or without '+'
//   message?: string;        // used only for freeform (inside 24h)
//   template?: "paid_en" | "paid_ar";
//   vars?: { name: string; invoiceId?: number | string; amount?: number | string };
//   useFreeform?: boolean;   // set true only if you're sure you're inside 24h
// };

export async function sendViaTwilio(opts) {
  const accountSid = "AC09e5a7c9b12d0ebd104552b30045b0e4";
  const authToken  = "8c94c5b0c50fdd9c7e72b79b056702ec";
  const mgSid      = "MGd03f7778f585a5adf76873037c009b26"; // recommended
  const from       = process.env.TWILIO_WHATSAPP_FROM;         // optional if not using MG

  if (!accountSid || !authToken || (!mgSid && !from)) {
    console.warn("Twilio not configured: need SID/TOKEN and either MG or From");
    return;
  }

  const digits = (opts.to || "").replace(/\D/g, "");
  if (!digits) {
    console.warn("Twilio WhatsApp not sent: invalid recipient phone");
    return;
  }
  const toParam = `whatsapp:+${digits}`;

  // --- Decide send mode ---
  const sendingTemplate = !opts.useFreeform; // default to template unless explicitly freeform
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  if (sendingTemplate) {
    // Pick ContentSid (EN/AR)
    const contentSid =
      opts.template === "paid_ar"
        ?"HX2b1c610a6367c55059c95190739d9dc8"
        : "HX2b1c610a6367c55059c95190739d9dc8";

    if (!contentSid) {
      console.warn("Missing TWILIO_CONTENT_SID for the chosen template");
      return;
    }

    // Map variables: {{1}} name, {{2}} invoiceId, {{3}} amount
    const name      = opts.vars?.name ?? "Customer";
    const invoiceId = opts.vars?.invoiceId?.toString() ?? "";
    const amount    = typeof opts.vars?.amount === "number"
      ? opts.vars.amount.toFixed(2)
      : (opts.vars?.amount ?? "").toString();

    const params = {
      To: toParam,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({ "1": name, "2": invoiceId, "3": amount }),
    };
    if (mgSid) params["MessagingServiceSid"] = mgSid; else params["From"] = from;
    // if (process.env.TWILIO_STATUS_CALLBACK_URL) {
    //   params["StatusCallback"] = process.env.TWILIO_STATUS_CALLBACK_URL;
    // }

    const body = new URLSearchParams(params).toString();
    const { data } = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: accountSid, password: authToken },
      timeout: 10000,
    });
    console.log("Twilio template send SID:", data.sid);
    return;
  }

  // --- Free-form path (use only inside 24h) ---
  if (!opts.message) {
    console.warn("Freeform send requires `message`");
    return;
  }

  const params = {
    To: toParam,
    Body: opts.message,
  };
  if (mgSid) params["MessagingServiceSid"] = mgSid; else params["From"] = from;
  if (process.env.TWILIO_STATUS_CALLBACK_URL) {
    params["StatusCallback"] = process.env.TWILIO_STATUS_CALLBACK_URL;
  }

  const body = new URLSearchParams(params).toString();
  const { data } = await axios.post(url, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    auth: { username: accountSid, password: authToken },
    timeout: 10000,
  });
  console.log("Twilio freeform send SID:", data.sid);
}

await sendViaTwilio({
  to: "9613974338",
  template: "paid_en",                         // or "paid_ar"
  vars: { name: "نديم كمال ابو عقده", invoiceId: 2462, amount: 30 }
});