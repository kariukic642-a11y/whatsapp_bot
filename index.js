const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Store conversation history per phone number
const conversations = {};

// Your bot's personality — edit this!
const SYSTEM_PROMPT = `You are a helpful WhatsApp assistant. Keep replies concise and friendly since this is a messaging app. 
Use plain text only — no markdown formatting like ** or ##.
If someone sends a voice note or media, politely let them know you can only process text for now.`;

app.get('/', (req, res) => res.send('WhatsApp bot is running!'));

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim();
  const from = req.body.From;

  if (!incomingMsg || !from) {
    return res.status(400).send('Bad request');
  }

  console.log(`Message from ${from}: ${incomingMsg}`);

  // Initialize conversation history for new users
  if (!conversations[from]) {
    conversations[from] = [];
  }

  // Add user message to history
  conversations[from].push({ role: 'user', content: incomingMsg });

  // Keep only last 10 messages to avoid token limits
  if (conversations[from].length > 10) {
    conversations[from] = conversations[from].slice(-10);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: conversations[from],
    });

    const reply = response.content[0].text;

    // Add assistant reply to history
    conversations[from].push({ role: 'assistant', content: reply });

    // Send reply via Twilio TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('Claude API error:', err);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I'm having trouble right now. Please try again in a moment.</Message>
</Response>`;
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
