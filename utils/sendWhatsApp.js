const axios = require("axios");

/* ================= WHATSAPP STATUS UPDATE (NEW) =================
   Sends the approved "job_status_update" template to a customer's WhatsApp when their
   Job Sheet's Device Status changes (Received / Pending / Repaired / Delivered).

   Template body (approved on Meta): "Hi {{1}}, update on your device (Job Sheet {{2}}): {{3}} - Radnus Communication"
   {{1}} = customer name, {{2}} = job sheet number, {{3}} = status message (mapped below).

   NOTE ON LANGUAGE CODE: the template was created with "Language: English" (not
   "English (US)"), so this uses language code "en". If Meta rejects the request with an
   "invalid parameter" / template-not-found error, check the template's exact language code
   in WhatsApp Manager → Message Templates and change LANGUAGE_CODE below to match
   (commonly "en" or "en_US"). */

const LANGUAGE_CODE = "en";

// Maps each Device Status value (from the Job Sheet's device.mobileStatus field) to the
// customer-facing sentence sent as {{3}}. Statuses not listed here (e.g. "Cancelled",
// "Delivered NR/NA") are intentionally skipped — no message sent — since those don't need
// a customer notification the same way.
const STATUS_MESSAGES = {
  "Received": "We've received your device and started the inspection.",
  "Pending": "Your device service is currently in progress.",
  "Repaired": "Your device is repaired and ready for pickup!",
  "Delivered": "Your device has been delivered. Thank you for choosing us!",
};

/**
 * Sends a job-status WhatsApp message to a customer.
 * @param {string} contactNumber - 10-digit Indian mobile number (no country code), e.g. "9876543210"
 * @param {string} customerName
 * @param {string} jobSheetNo - e.g. "JS-657"
 * @param {string} status - one of the keys in STATUS_MESSAGES
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
const sendJobStatusWhatsApp = async (contactNumber, customerName, jobSheetNo, status) => {
  try {
    const statusMessage = STATUS_MESSAGES[status];
    if (!statusMessage) {
      // Status not mapped (e.g. Cancelled) — nothing to send, not an error.
      return false;
    }

    const cleanContact = String(contactNumber || "").replace(/\D/g, "");
    if (cleanContact.length !== 10) {
      console.error("WhatsApp send skipped: invalid contact number ->", contactNumber);
      return false;
    }
    const toNumber = `91${cleanContact}`; // Indian country code, no "+" per WhatsApp Cloud API format

    const API_VERSION = "v21.0";
    const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: toNumber,
      type: "template",
      template: {
        name: "job_status_update",
        language: { code: LANGUAGE_CODE },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: customerName || "Customer" },
              { type: "text", text: jobSheetNo || "" },
              { type: "text", text: statusMessage },
            ],
          },
        ],
      },
    };

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return true;
  } catch (err) {
    // Never let a WhatsApp failure break the Job Sheet save/update — just log it.
    console.error("WhatsApp send failed:", err.response?.data || err.message);
    return false;
  }
};

module.exports = { sendJobStatusWhatsApp, STATUS_MESSAGES };