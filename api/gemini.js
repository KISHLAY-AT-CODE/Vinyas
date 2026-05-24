import { getISTLogPrefix } from './timezone.js';
import { connectToDatabase } from './db.js';

const requestCounts = new Map();

function isRateLimited(syncId) {
  const now = Date.now();
  const limit = 15; // Max 15 requests per minute
  const windowMs = 60 * 1000;
  
  if (!requestCounts.has(syncId)) {
    requestCounts.set(syncId, []);
  }
  
  const timestamps = requestCounts.get(syncId);
  const activeTimestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (activeTimestamps.length >= limit) {
    return true;
  }
  
  activeTimestamps.push(now);
  requestCounts.set(syncId, activeTimestamps);
  return false;
}

function extractJson(str) {
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  let startIdx = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx === -1) {
    throw new Error("No JSON structure ({ or [) found in response: " + str);
  }

  const endIdx = str.lastIndexOf(endChar);
  if (endIdx === -1 || endIdx < startIdx) {
    throw new Error(`No matching JSON end boundary (${endChar}) found in response`);
  }

  return str.substring(startIdx, endIdx + 1);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let { prompt, systemInstruction, isJson, syncId: rawSyncId } = req.body;

  if (!rawSyncId || typeof rawSyncId !== 'string') {
    return res.status(400).json({ error: 'Authentication required: missing or invalid syncId' });
  }
  const syncId = String(rawSyncId).trim();
  if (!syncId) {
    return res.status(400).json({ error: 'Authentication required: syncId cannot be empty' });
  }

  // Rate Limiting per syncId (Max 15 requests per minute)
  if (isRateLimited(syncId)) {
    return res.status(429).json({ error: 'Too many AI requests. Please slow down (limit is 15 requests per minute)' });
  }

  // Verify syncId is secure or exists in DB
  const isSecure = syncId.startsWith('vny_sec_');
  let exists = false;
  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');
    const userDoc = await collection.findOne({ syncId });
    exists = !!userDoc;
  } catch (dbErr) {
    console.error('Database check error in Gemini handler:', dbErr);
  }

  if (!isSecure && !exists) {
    return res.status(403).json({ error: 'Access denied: Sync ID must be secure or registered in the database.' });
  }

  // Truncate overly long prompts
  if (typeof prompt === 'string' && prompt.length > 50000) {
    prompt = prompt.substring(0, 50000) + '... (truncated due to length limits)';
  }

  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 20; i++) {
    if (process.env[`GEMINI_API_KEY_${i}`]) {
      keys.push(process.env[`GEMINI_API_KEY_${i}`]);
    }
  }

  if (keys.length === 0 && !process.env.GENERAL_API) {
    return res.status(500).json({ error: 'Neither Gemini nor Cerebras API keys are configured on the server.' });
  }

  let finalResult = null;
  let success = false;
  let lastError = null;
  let lastStatus = 500;
  const attempts = [];

  if (keys.length > 0) {
    // Load balancing: select a random starting key index
    const startIndex = Math.floor(Math.random() * keys.length);
    let attemptsCount = 0;

    for (let i = 0; i < keys.length; i++) {
      const currentIndex = (startIndex + i) % keys.length;
      const geminiApiKey = keys[currentIndex];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`;

      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: isJson ? "application/json" : "text/plain"
        }
      };

      try {
        attemptsCount++;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`${getISTLogPrefix()} [Gemini API Warning] Key index ${currentIndex} failed (Status: ${response.status}). Error: ${errText.substring(0, 200)}`);
          
          lastError = `Key index ${currentIndex} returned status ${response.status}: ${errText}`;
          lastStatus = response.status;
          attempts.push({
            index: currentIndex,
            status: response.status,
            error: errText.substring(0, 200)
          });
          continue; // Try next key
        }

        const result = await response.json();
        let text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error("Empty response from API");
        }

        if (isJson) {
          const cleanJsonStr = extractJson(text);
          finalResult = JSON.parse(cleanJsonStr);
        } else {
          finalResult = text;
        }

        success = true;
        console.log(`${getISTLogPrefix()} [Gemini API Success] Resolved using Key index ${currentIndex} (Attempt ${attemptsCount}/${keys.length})`);
        attempts.push({
          index: currentIndex,
          status: 200
        });
        break; // Success!
      } catch (error) {
        console.error(`${getISTLogPrefix()} [Gemini API Error] Key index ${currentIndex} execution failed:`, error.message);
        lastError = error.message;
        lastStatus = 500;
        attempts.push({
          index: currentIndex,
          status: 500,
          error: error.message
        });
      }
    }
  }

  // Cerebras Fallback if Gemini failed or was not configured
  const cerebrasKeys = [];
  if (process.env.CEREBRAS_API_KEY) cerebrasKeys.push(process.env.CEREBRAS_API_KEY);
  if (process.env.GENERAL_API_KEY?.startsWith('csk')) cerebrasKeys.push(process.env.GENERAL_API_KEY);
  if (process.env.GENERAL_API?.startsWith('csk')) cerebrasKeys.push(process.env.GENERAL_API);
  for (let i = 1; i <= 20; i++) {
    if (process.env[`CEREBRAS_API_KEY_${i}`]) {
      cerebrasKeys.push(process.env[`CEREBRAS_API_KEY_${i}`]);
    }
    if (process.env[`GENERAL_API_KEY_${i}`]?.startsWith('csk')) {
      cerebrasKeys.push(process.env[`GENERAL_API_KEY_${i}`]);
    }
    if (process.env[`GENERAL_API_${i}`]?.startsWith('csk')) {
      cerebrasKeys.push(process.env[`GENERAL_API_${i}`]);
    }
  }

  if (!success && cerebrasKeys.length > 0) {
    console.log(`${getISTLogPrefix()} [Cerebras Fallback] Attempting fallback using Cerebras gpt-oss-120b... Found ${cerebrasKeys.length} keys.`);
    for (let cIdx = 0; cIdx < cerebrasKeys.length; cIdx++) {
      const cerebrasApiKey = cerebrasKeys[cIdx];
      const url = 'https://api.cerebras.ai/v1/chat/completions';
      const payload = {
        model: 'gpt-oss-120b',
        messages: [
          { role: 'system', content: systemInstruction || '' },
          { role: 'user', content: prompt }
        ],
        response_format: isJson ? { type: 'json_object' } : null
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`${getISTLogPrefix()} [Cerebras Fallback Error] Key index ${cIdx} failed (Status: ${response.status}). Error: ${errText.substring(0, 200)}`);
          lastError = `Cerebras fallback failed (Status ${response.status}): ${errText}`;
          lastStatus = response.status;
          attempts.push({
            index: `Cerebras Fallback Key ${cIdx}`,
            status: response.status,
            error: errText.substring(0, 200)
          });
        } else {
          const result = await response.json();
          const text = result.choices?.[0]?.message?.content;
          
          if (!text) {
            throw new Error("Empty response from Cerebras API");
          }

          if (isJson) {
            const cleanJsonStr = extractJson(text);
            finalResult = JSON.parse(cleanJsonStr);
          } else {
            finalResult = text;
          }

          success = true;
          console.log(`${getISTLogPrefix()} [Cerebras Fallback Success] Successfully resolved using Cerebras Key ${cIdx}`);
          attempts.push({
            index: `Cerebras Fallback Key ${cIdx}`,
            status: 200
          });
          break; // Success!
        }
      } catch (error) {
        console.error(`${getISTLogPrefix()} [Cerebras Fallback Error] Key index ${cIdx} exception occurred:`, error.message);
        lastError = `Cerebras exception: ${error.message}`;
        lastStatus = 500;
        attempts.push({
          index: `Cerebras Fallback Key ${cIdx}`,
          status: 500,
          error: error.message
        });
      }
    }
  }

  // Groq Fallback if Gemini & Cerebras failed or were not configured
  const groqKeys = [];
  if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
  if (process.env.GENERAL_API_KEY?.startsWith('gsk')) groqKeys.push(process.env.GENERAL_API_KEY);
  if (process.env.GENERAL_API?.startsWith('gsk')) groqKeys.push(process.env.GENERAL_API);
  for (let i = 1; i <= 20; i++) {
    if (process.env[`GROQ_API_KEY_${i}`]) {
      groqKeys.push(process.env[`GROQ_API_KEY_${i}`]);
    }
    if (process.env[`GENERAL_API_KEY_${i}`]?.startsWith('gsk')) {
      groqKeys.push(process.env[`GENERAL_API_KEY_${i}`]);
    }
    if (process.env[`GENERAL_API_${i}`]?.startsWith('gsk')) {
      groqKeys.push(process.env[`GENERAL_API_${i}`]);
    }
  }

  if (!success && groqKeys.length > 0) {
    console.log(`${getISTLogPrefix()} [Groq Fallback] Attempting fallback using Groq Llama-3.3-70b... Found ${groqKeys.length} keys.`);
    for (let gIdx = 0; gIdx < groqKeys.length; gIdx++) {
      const groqApiKey = groqKeys[gIdx];
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction || '' },
          { role: 'user', content: prompt }
        ],
        response_format: isJson ? { type: 'json_object' } : null
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`${getISTLogPrefix()} [Groq Fallback Error] Key index ${gIdx} failed (Status: ${response.status}). Error: ${errText.substring(0, 200)}`);
          lastError = `Groq fallback failed (Status ${response.status}): ${errText}`;
          lastStatus = response.status;
          attempts.push({
            index: `Groq Fallback Key ${gIdx}`,
            status: response.status,
            error: errText.substring(0, 200)
          });
        } else {
          const result = await response.json();
          const text = result.choices?.[0]?.message?.content;
          
          if (!text) {
            throw new Error("Empty response from Groq API");
          }

          if (isJson) {
            const cleanJsonStr = extractJson(text);
            finalResult = JSON.parse(cleanJsonStr);
          } else {
            finalResult = text;
          }

          success = true;
          console.log(`${getISTLogPrefix()} [Groq Fallback Success] Successfully resolved using Groq Key ${gIdx}`);
          attempts.push({
            index: `Groq Fallback Key ${gIdx}`,
            status: 200
          });
          break; // Success!
        }
      } catch (error) {
        console.error(`${getISTLogPrefix()} [Groq Fallback Error] Key index ${gIdx} exception occurred:`, error.message);
        lastError = `Groq exception: ${error.message}`;
        lastStatus = 500;
        attempts.push({
          index: `Groq Fallback Key ${gIdx}`,
          status: 500,
          error: error.message
        });
      }
    }
  }

  // Set the attempts header for client monitoring
  res.setHeader('x-gemini-attempts', JSON.stringify(attempts));

  if (success) {
    if (isJson) {
      return res.status(200).json(finalResult);
    } else {
      return res.status(200).send(finalResult);
    }
  } else {
    return res.status(lastStatus).json({ 
      error: 'All configured Gemini API keys and fallbacks exhausted or rate-limited.', 
      details: lastError,
      exhausted: true 
    });
  }
}
