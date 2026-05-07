// Bella Vista Voice Agent — Main Server
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import {
  checkAvailability,
  bookReservation,
  logCallAnalytics,
} from "./calendar.js";

const app = express();
app.use(express.json());
const server = createServer(app);

app.get("/", (req, res) => {
  res.json({ status: "🍝 Bella Vista Voice Agent is running!" });
});

// Retell webhook — call lifecycle + post-call analytics
app.post("/webhook", async (req, res) => {
  const { event, call } = req.body;
  console.log(`[Webhook] ${event} | Call: ${call?.call_id}`);

  if (event === "call_analyzed") {
    const transcript = call?.transcript || "";
    const duration = call?.end_timestamp - call?.start_timestamp || 0;
    const bookingMade =
      transcript.toLowerCase().includes("confirmed") ||
      transcript.toLowerCase().includes("reservation is confirmed") ||
      transcript.toLowerCase().includes("you're all set");
    await logCallAnalytics(call.call_id, duration, transcript, bookingMade);
  }

  res.status(204).send();
});

// Check availability
app.post("/check-availability", async (req, res) => {
  console.log("[Check] Full body:", JSON.stringify(req.body));
  const { date, time } = req.body.args || req.body;
  console.log(`[Check] ${date} @ ${time}`);

  if (!date || !time) {
    return res.json({
      available: false,
      message: "Please provide both a date and time.",
    });
  }

  const result = await checkAvailability(date, time);

  if (result.available) {
    return res.json({
      available: true,
      message: `${time} on ${date} is available. ${result.spotsRemaining} tables remaining.`,
    });
  }

  let message = `Sorry, ${time} on ${date} is not available. ${result.reason}`;
  if (result.alternativeSlot)
    message += ` Next available: ${result.alternativeSlot}.`;
  return res.json({
    available: false,
    message,
    alternativeSlot: result.alternativeSlot,
  });
});

// Book reservation
app.post("/book", async (req, res) => {
  console.log("[Book] Full body:", JSON.stringify(req.body));
  const { name, party_size, date, time, phone_number } =
    req.body.args || req.body;
  console.log(
    `[Book] ${name} | Party: ${party_size} | ${date} @ ${time} | Phone: ${phone_number}`,
  );

  if (!name || !party_size || !date || !time) {
    return res.json({ success: false, message: "Missing booking details." });
  }

  // Double-check availability
  const availability = await checkAvailability(date, time);
  if (!availability.available) {
    let message = `Sorry, that slot is no longer available. ${availability.reason}`;
    if (availability.alternativeSlot)
      message += ` Would ${availability.alternativeSlot} work?`;
    return res.json({ success: false, message });
  }

  const result = await bookReservation(
    name,
    party_size,
    date,
    time,
    phone_number,
  );

  if (result.success) {
    const smsNote = phone_number
      ? " A confirmation text has been sent to your phone!"
      : "";
    return res.json({
      success: true,
      message: `Confirmed! ${name}, party of ${party_size}, on ${date} at ${time} at Bella Vista.${smsNote} We look forward to seeing you!`,
    });
  }

  return res.json({
    success: false,
    message: "Error confirming reservation. Please try again.",
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n🍝 Bella Vista Voice Agent`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`POST /check-availability`);
  console.log(`POST /book`);
  console.log(`POST /webhook\n`);
});
