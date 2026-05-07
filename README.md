# 🍝 Bella Vista Voice Agent

> A production-ready AI phone agent that handles restaurant reservations end-to-end — built with **Retell AI**, **Google Calendar**, **Google Sheets**, and **Twilio WhatsApp** in under 10 hours.

**🎬 Demo:** [Watch the demo video](https://www.loom.com/share/0e10e6523264483eba6fbb1d2d450bf3)
**👤 Built by:** [Kshitij Mishra]

---

## What It Does

**Sofia**, Bella Vista's AI reservations agent, answers incoming calls and handles the full booking flow autonomously:

- 🎙️ Answers calls naturally — warm, concise, never robotic
- 📅 Checks **real-time availability** via Google Calendar
- 🪑 Enforces **capacity limits** — max 5 tables per slot
- 🕐 Enforces **business hours** — 11:00 AM to 11:00 PM only
- ✅ **Books reservations** directly to Google Calendar
- 📊 Logs every booking to **Google Sheets** for analytics
- 💬 Sends **WhatsApp confirmation** to the guest instantly
- 📈 Tracks **post-call analytics** — duration, transcript, booking rate
- 🔄 Suggests **next available slot** if requested time is fully booked

---

## Demo Flow

```
📞 Caller: "Hi, I'd like to book a table for 4 this Saturday at 7pm"

Sofia: "Of course! Can I get your name?"
Caller: "Matt"

Sofia: "Let me check our availability for you, one moment!"
       [→ checks Google Calendar in real time]

Sofia: "7 PM on Saturday is available! Can I get your phone 
        number to send a WhatsApp confirmation?"
Caller: "404-XXX-XXXX"

Sofia: "Perfect! Confirmed — party of 4, Saturday May 18th 
        at 7 PM at Bella Vista. A WhatsApp confirmation has 
        been sent. We look forward to seeing you!"

→ Google Calendar event created ✅
→ Google Sheets row logged ✅  
→ WhatsApp message delivered ✅
→ Call analytics recorded ✅
```

---

## Architecture

```
Caller
  ↓
Retell AI (Voice Layer)
  STT → transcription
  TTS → Sofia's voice
  GPT-4.1 nano → conversation
  ↓
Custom Functions (HTTP)
  ↓
Your Node.js Server
  ├── POST /check-availability → Google Calendar API
  ├── POST /book              → Google Calendar + Sheets + WhatsApp
  └── POST /webhook           → Call Analytics → Google Sheets
```

**Retell handles:** Phone calls, speech-to-text, text-to-speech, turn-taking, interruptions

**Your server handles:** Business logic, availability, capacity, bookings, analytics

---

## Tech Stack

| Layer | Tool | Cost |
|---|---|---|
| Voice AI Platform | [Retell AI](https://retellai.com) | Free trial |
| Conversation LLM | GPT-4.1 nano (via Retell) | Included |
| Backend | Node.js + Express | Free |
| Calendar & Availability | Google Calendar API | Free |
| Analytics & Logging | Google Sheets API | Free |
| WhatsApp Confirmations | Twilio WhatsApp Sandbox | Free |
| Local Tunnel | ngrok | Free |

**Total infrastructure cost: $0**

---

## Google Sheets Structure

### Reservations Tab
| Name | Party Size | Date | Time | Status | Booked At | Event ID | Phone |
|---|---|---|---|---|---|---|---|
| Matt | 4 | 2026-05-18 | 19:00 | Confirmed | 2026-05-07T... | abc123 | 4049924571 |

### Call Analytics Tab
| Call ID | Timestamp | Duration (secs) | Booking Made | Transcript |
|---|---|---|---|---|
| call_abc... | 2026-05-07T... | 72 | Yes | Agent: Thank you... |

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/bella-vista-agent
cd bella-vista-agent
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `RETELL_API_KEY` | [app.retellai.com](https://app.retellai.com) → Settings → API Keys |
| `GOOGLE_SHEET_ID` | From your Google Sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Cloud Console → Service Accounts |
| `GOOGLE_PRIVATE_KEY` | Google Cloud Console → Service Account → Keys → JSON |
| `GOOGLE_CALENDAR_ID` | Google Calendar → Settings → Integrate Calendar |
| `TWILIO_ACCOUNT_SID` | [twilio.com](https://twilio.com) → Console Dashboard |
| `TWILIO_AUTH_TOKEN` | [twilio.com](https://twilio.com) → Console Dashboard |
| `TWILIO_PHONE_NUMBER` | `whatsapp:XXX-XXX-XXXX` (Sandbox) |

### 3. Set Up Google Cloud

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. `bella-vista`)
3. Enable **Google Calendar API** and **Google Sheets API**
4. Create a **Service Account** → download JSON key
5. Share your Google Sheet and Google Calendar with the service account email (Editor access)

### 4. Set Up Google Sheets

Create a sheet with two tabs:

**Tab 1 — `Reservations`:**
```
Name | Party Size | Date | Time | Status | Booked At | Event ID | Phone
```

**Tab 2 — `Call Analytics`:**
```
Call ID | Timestamp | Duration (secs) | Booking Made | Transcript
```

### 5. Set Up Retell Agent

1. Go to [app.retellai.com](https://app.retellai.com) → Create Agent → Blank Agent → Single Prompt
2. Paste the system prompt (see below)
3. Add two **Custom Functions:**

**Function 1: `check_availability`**
- URL: `https://your-ngrok-url/check-availability`
- Method: POST
- Parameters: `date` (string), `time` (string)
- Enable: Payload args only ✅
- Enable: Talk while waiting ✅ → *"Let me check our availability for you, one moment!"*

**Function 2: `book_reservation`**
- URL: `https://your-ngrok-url/book`
- Method: POST
- Parameters: `name` (string), `party_size` (number), `date` (string), `time` (string), `phone_number` (string)
- Enable: Payload args only ✅
- Enable: Talk while waiting ✅ → *"Perfect, let me confirm that reservation for you!"*

4. Set Webhook URL: `https://your-ngrok-url/webhook`

### 6. Set Up Twilio WhatsApp Sandbox

1. Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Send the join code to `+1XXX-XXX-XXXX` on WhatsApp
3. You're connected to the sandbox

### 7. Run

```bash
# Terminal 1 — start server
npm run dev

# Terminal 2 — expose to internet
ngrok http 8080
```

Update your Retell function URLs with the ngrok URL, then hit **Publish** in Retell and test!

---

## System Prompt

```
Today's date is {{current_date}}. You are Sofia, the friendly reservations agent 
for Bella Vista, an upscale Italian restaurant in San Francisco.

## Your Personality
- Warm, professional, and concise — like a great maître d'
- Never robotic. Use natural filler phrases like "Of course!", "Absolutely"
- Keep responses SHORT — max 2 sentences per turn

## Your Job
1. Greet the caller warmly
2. Collect: guest name, phone number, party size, date, time
3. Call check_availability
4. If available → call book_reservation
5. If NOT available → offer the alternativeSlot returned
6. End with a warm confirmation

## Restaurant Details
- Name: Bella Vista | Cuisine: Modern Italian
- Hours: Tuesday–Sunday, 11:00 AM–11:00 PM (closed Mondays)
- Location: 400 Columbus Ave, San Francisco, CA
- Max party size: 12

## Rules
- ALWAYS call check_availability before booking
- ALWAYS call book_reservation to confirm — never tell the caller 
  they're booked without calling it first
- Never book outside 11:00 AM–11:00 PM
- Always confirm the spelling of the guest's name
```

---

## Project Structure

```
bella-vista-agent/
├── src/
│   ├── index.js      # Express server — /check-availability, /book, /webhook
│   └── calendar.js   # Google Calendar + Sheets + Twilio WhatsApp
├── .env.example
├── package.json
└── README.md
```

---

## Deploy to Production

```bash
# Railway (recommended)
npm install -g @railway/cli
railway login
railway init
railway up
```

Set all `.env` variables in Railway dashboard → update Retell function URLs to your Railway domain → done.

---

## What This Demonstrates

This project was built as a Forward Deployed Engineer demo for Retell AI. It shows:

| Skill | Evidence |
|---|---|
| Retell Platform Knowledge | Native functions, webhooks, prompt engineering |
| Systems Thinking | Cal.com → Google Calendar migration, capacity vs availability |
| Production Mindset | Business hours enforcement, capacity limits, error handling |
| Speed of Execution | Full working agent in under 10 hours |
| Customer Empathy | WhatsApp confirmations, natural conversation flow |

---

## Built By

**Kshitij Mishra** 

