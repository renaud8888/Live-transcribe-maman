import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SUPPORTED_LANGUAGES = new Set([
  'fr',
  'en',
  'nl',
  'de',
  'es',
  'it',
  'pl',
  'pt',
  'ar',
  'tr',
  'uk',
  'ja',
  'ko',
  'zh'
]);

app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/session', async (req, res) => {
  try {
    const { direction, sourceLanguage, targetLanguage } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY_MISSING',
        message: 'La variable OPENAI_API_KEY n’est pas configurée côté serveur.'
      });
    }

    if (!SUPPORTED_LANGUAGES.has(sourceLanguage) || !SUPPORTED_LANGUAGES.has(targetLanguage)) {
      return res.status(400).json({
        error: 'LANGUAGE_NOT_SUPPORTED',
        message: 'Langue source ou cible non prise en charge.'
      });
    }

    const openAIResponse = await fetch(
      'https://api.openai.com/v1/realtime/translations/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expires_after: {
            anchor: 'created_at',
            seconds: 600
          },
          session: {
            model: 'gpt-realtime-translate',
            audio: {
              output: {
                language: targetLanguage
              }
            }
          }
        })
      }
    );

    const payload = await readOpenAIJson(openAIResponse);

    if (!openAIResponse.ok) {
      return res.status(openAIResponse.status).json({
        error: 'OPENAI_ERROR',
        message: payload?.error?.message || 'OpenAI a refusé la création de session.',
        details: payload
      });
    }

    res.json({
      client_secret:
        payload?.client_secret?.value ||
        payload?.client_secret ||
        payload?.secret ||
        payload?.value,
      expires_at: payload?.client_secret?.expires_at || payload?.expires_at || null
    });
  } catch (error) {
    console.error('Session creation failed:', error);
    res.status(502).json({
      error: 'SESSION_CREATION_FAILED',
      message: 'Impossible de créer une session de traduction pour le moment.'
    });
  }
});

app.post(['/translate', '/api/translate-text'], async (req, res) => {
  try {
    const { text, sourceLanguage = 'fr', targetLanguage } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY_MISSING',
        message: 'La variable OPENAI_API_KEY n’est pas configurée côté serveur.'
      });
    }

    if (!text || typeof text !== 'string' || text.trim().length > 900) {
      return res.status(400).json({
        error: 'TEXT_INVALID',
        message: 'Texte manquant ou trop long.'
      });
    }

    if (!SUPPORTED_LANGUAGES.has(sourceLanguage) || !SUPPORTED_LANGUAGES.has(targetLanguage)) {
      return res.status(400).json({
        error: 'LANGUAGE_NOT_SUPPORTED',
        message: 'Langue source ou cible non prise en charge.'
      });
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content:
              'Translate short hospitality messages between the requested languages. Return only the translation, no quotes, no explanation.'
          },
          {
            role: 'user',
            content: `Source language: ${sourceLanguage}\nTarget language: ${targetLanguage}\nText: ${text.trim()}`
          }
        ]
      })
    });

    const payload = await readOpenAIJson(openAIResponse);

    if (!openAIResponse.ok) {
      return res.status(openAIResponse.status).json({
        error: 'OPENAI_ERROR',
        message: payload?.error?.message || 'OpenAI a refusé la traduction.',
        details: payload
      });
    }

    res.json({
      translation: extractResponseText(payload)
    });
  } catch (error) {
    console.error('Text translation failed:', error);
    res.status(502).json({
      error: 'TRANSLATION_FAILED',
      message: 'Impossible de traduire cette phrase pour le moment.'
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Interprète du gîte disponible sur http://localhost:${PORT}`);
});

function extractResponseText(payload) {
  if (payload?.output_text) return payload.output_text.trim();

  const output = payload?.output || [];
  for (const item of output) {
    for (const content of item.content || []) {
      if (content.text) return content.text.trim();
    }
  }

  return '';
}

async function readOpenAIJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
