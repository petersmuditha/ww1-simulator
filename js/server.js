const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api', async (req, res) => {
    try {
        // Legge la chiave API inviata dal client
        const authHeader = req.headers.authorization;
        const userApiKey = authHeader ? authHeader.split(' ')[1] : null;

        if (!userApiKey) {
            return res.status(401).json({ error: 'API Key mancante. Inseriscila nel gioco.' });
        }

        const body = req.body;
        let messages = [{ role: "system", content: body.system }];
        if (body.history && Array.isArray(body.history)) {
            body.history.forEach(msg => {
                messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.parts[0].text });
            });
        }
        messages.push({ role: "user", content: body.message });

        // Chiama Groq usando la chiave DELL'UTENTE
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${userApiKey}`, // <-- Usa la chiave dell'utente
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b", // Modello attuale e supportato da Groq
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (data.error) return res.status(400).json({ error: data.error.message });
        res.json({ reply: data.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Proxy attivo su http://localhost:3000'));