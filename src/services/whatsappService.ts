import axios from "axios";

type WhatsAppSendOptions = {
    to: string; // E.164 without '+' (WhatsApp Cloud API expects country code without plus)
    message: string;
};

/**
 * Sends a WhatsApp text message via Meta WhatsApp Cloud API.
 * Requires the following env vars:
 * - WHATSAPP_TOKEN: Permanent access token
 * - WHATSAPP_PHONE_NUMBER_ID: Sender phone number id
 * - WHATSAPP_ENABLED: 'true' to enable sending
 */
export async function sendWhatsAppMessage({ to, message }: WhatsAppSendOptions): Promise<void> {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
        return; // disabled in this environment
    }

    const provider = (process.env.WHATSAPP_PROVIDER || 'cloud').toLowerCase();
    if (provider === 'twilio') {
        return sendViaTwilio({ to, message });
    }

    return sendViaCloud({ to, message });
}

function resolveOverrideDigits(): string | undefined {
    const override = process.env.WHATSAPP_OVERRIDE_TO?.trim();
    if (!override) return undefined;
    if (override.startsWith('whatsapp:')) {
        return override.replace(/[^0-9]/g, '');
    }
    return override.replace(/\D/g, '');
}

async function sendViaCloud({ to, message }: WhatsAppSendOptions): Promise<void> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
        console.warn("WhatsApp Cloud not configured: missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
        return;
    }

    // Normalize phone (remove non-digits and leading '+')
    const overrideDigits = resolveOverrideDigits();
    const normalizedTo = (overrideDigits || to || "").replace(/\D/g, "");
    if (!normalizedTo) {
        console.warn("WhatsApp not sent: invalid recipient phone");
        return;
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    try {
        await axios.post(
            url,
            {
                messaging_product: "whatsapp",
                to: normalizedTo,
                type: "text",
                text: { body: message },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            }
        );
    } catch (error: any) {
        const status = error?.response?.status;
        const data = error?.response?.data;
        console.error("WhatsApp Cloud send failed", { status, data, message: error?.message });
    }
}

async function sendViaTwilio({ to, message }: WhatsAppSendOptions): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // optional

    if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
        console.warn("Twilio not configured: missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID");
        return;
    }

    // Normalize to E.164 and prepend whatsapp:
    const overrideDigitsTwilio = resolveOverrideDigits();
    let digits = (overrideDigitsTwilio || to || "").replace(/\D/g, "");
    if (!digits) {
        console.warn("Twilio WhatsApp not sent: invalid recipient phone");
        return;
    }
    const toParam = `whatsapp:+${digits}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params: Record<string, string> = {
        To: toParam, Body: message,  // Either MessagingServiceSid OR From (not both)
        ...(messagingServiceSid
            ? { MessagingServiceSid: messagingServiceSid }
            : { From: from as string }),
        StatusCallback: process.env.TWILIO_STATUS_CALLBACK_URL ?? ""
    };
    if (messagingServiceSid) {
        params["MessagingServiceSid"] = messagingServiceSid;
    } else {
        params["From"] = from as string;
    }
    const body = new URLSearchParams(params).toString();

    console.log('body', body);

    try {
        const { data } = await axios.post(url, body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            auth: { username: accountSid, password: authToken },
            timeout: 10000,
        });
        console.log("Twilio SID:", data.sid);
    } catch (error: any) {
        const status = error?.response?.status;
        const data = error?.response?.data;
        console.error("Twilio WhatsApp send failed", { status, data, message: error?.message });
    }
}

export function composePaidMessage(params: {
    fullName?: string | null;
    username?: string;
    amount?: number;
    invoiceId?: number;
}): string {
    const name = params.fullName || params.username || "Customer";
    const amountStr = typeof params.amount === 'number' ? params.amount.toFixed(2) : undefined;
    const invoiceRef = params.invoiceId ? ` (Invoice #${params.invoiceId})` : "";
    return `Hi ${name}, your payment${invoiceRef} has been received${amountStr ? `: $${amountStr}` : ''}. Thank you!`;
}


