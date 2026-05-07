// Google Calendar + Sheets + Twilio SMS for Bella Vista
// Calendar = source of truth for bookings
// Sheets = analytics
// Twilio = SMS confirmations

import { google } from "googleapis";
import twilio from "twilio";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
];

const OPEN_HOUR = 11;
const CLOSE_HOUR = 23;
const MAX_CAPACITY = 5;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
}

function parseDateTime(dateStr, timeStr) {
  const cleaned = `${dateStr} ${timeStr}`.replace(/(\d+)(st|nd|rd|th)/, "$1");
  return new Date(cleaned);
}

function isWithinBusinessHours(date) {
  const hour = date.getHours();
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

// Send SMS confirmation via Twilio
async function sendSMSConfirmation(
  phoneNumber,
  name,
  partySize,
  dateStr,
  timeStr,
) {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );

    const formatted = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+1${phoneNumber.replace(/\D/g, "")}`;

    const message = await client.messages.create({
      body: `Hi ${name}! 🍝 Your reservation at Bella Vista is confirmed!\n\nParty of ${partySize}\n📅 ${dateStr}\n⏰ ${timeStr}\n📍 400 Columbus Ave, San Francisco\n\nWe look forward to seeing you!`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `whatsapp:${formatted}`, // ← change this line
    });

    console.log(`[SMS] Sent to ${formatted} | SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error("[SMS] Error:", err.message);
    return { success: false, error: err.message };
  }
}

// Check availability via Google Calendar
export async function checkAvailability(dateStr, timeStr) {
  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const calendar = google.calendar({ version: "v3", auth: client });

    const startTime = parseDateTime(dateStr, timeStr);

    if (isNaN(startTime.getTime())) {
      return {
        available: false,
        reason: "Could not understand that date and time.",
      };
    }

    if (!isWithinBusinessHours(startTime)) {
      return {
        available: false,
        reason: "We are only open from 11:00 AM to 11:00 PM.",
      };
    }

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const bookingCount = (response.data.items || []).length;

    if (bookingCount >= MAX_CAPACITY) {
      const nextSlot = await findNextAvailableSlot(calendar, startTime);
      return {
        available: false,
        reason: `That slot is fully booked (${bookingCount}/${MAX_CAPACITY} tables taken).`,
        alternativeSlot: nextSlot,
      };
    }

    return { available: true, spotsRemaining: MAX_CAPACITY - bookingCount };
  } catch (err) {
    console.error("[Calendar] checkAvailability error:", err.message);
    return { available: true, spotsRemaining: MAX_CAPACITY };
  }
}

// Find next available 30-min slot
async function findNextAvailableSlot(calendar, fromTime) {
  for (let i = 1; i <= 16; i++) {
    const candidate = new Date(fromTime.getTime() + i * 30 * 60 * 1000);
    if (!isWithinBusinessHours(candidate)) continue;

    const endCandidate = new Date(candidate.getTime() + 60 * 60 * 1000);
    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: candidate.toISOString(),
      timeMax: endCandidate.toISOString(),
      singleEvents: true,
    });

    if ((res.data.items || []).length < MAX_CAPACITY) {
      return candidate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }
  return null;
}

// Book reservation: Calendar + Sheets + SMS
export async function bookReservation(
  name,
  partySize,
  dateStr,
  timeStr,
  phoneNumber,
) {
  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const calendar = google.calendar({ version: "v3", auth: client });
    const sheets = google.sheets({ version: "v4", auth: client });

    const startTime = parseDateTime(dateStr, timeStr);

    if (isNaN(startTime.getTime())) {
      return { success: false, error: "Could not parse the date and time." };
    }

    if (!isWithinBusinessHours(startTime)) {
      return {
        success: false,
        error: "Requested time is outside business hours.",
      };
    }

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    // 1. Create Google Calendar event
    const event = {
      summary: `Reservation - ${name} (Party of ${partySize})`,
      description: `Restaurant reservation for ${name}\nParty size: ${partySize}\nPhone: ${phoneNumber || "N/A"}\nBooked via Sofia voice agent`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "America/New_York",
      },
      end: { dateTime: endTime.toISOString(), timeZone: "America/New_York" },
    };

    const calResult = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: event,
    });

    console.log(`[Calendar] Event created: ${calResult.data.htmlLink}`);

    // 2. Log to Google Sheets
    const bookedAt = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Reservations!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            name,
            partySize,
            dateStr,
            timeStr,
            "Confirmed",
            bookedAt,
            calResult.data.id,
            phoneNumber || "",
          ],
        ],
      },
    });

    console.log(`[Sheets] Booking logged for ${name}`);

    // 3. Send SMS confirmation
    if (phoneNumber) {
      await sendSMSConfirmation(
        String(phoneNumber),
        name,
        partySize,
        dateStr,
        timeStr,
      );
    }

    return { success: true, eventId: calResult.data.id };
  } catch (err) {
    console.error("[Booking] Error:", err.message);
    return { success: false, error: err.message };
  }
}

// Log post-call analytics to Google Sheets
export async function logCallAnalytics(
  callId,
  duration,
  transcript,
  bookingMade,
) {
  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const timestamp = new Date().toISOString();
    const durationSecs = Math.round((duration || 0) / 1000);

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Call Analytics!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            callId,
            timestamp,
            durationSecs,
            bookingMade ? "Yes" : "No",
            transcript?.substring(0, 500) || "",
          ],
        ],
      },
    });

    console.log(`[Analytics] Call ${callId} logged`);
  } catch (err) {
    console.error("[Analytics] Error:", err.message);
  }
}
