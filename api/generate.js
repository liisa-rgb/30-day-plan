// Cost/capability tiers, lowest first. The model is chosen dynamically from
// whatever is live in the Anthropic Models API, so the app keeps working when a
// model is retired instead of pinning to a single (eventually expired) ID.
const TIER_ORDER = ['haiku', 'sonnet', 'opus', 'fable', 'mythos'];

// Re-check the available models periodically rather than on every request.
const MODEL_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cachedModel = null;
let cachedAt = 0;

function tierOf(modelId) {
  const id = modelId.toLowerCase();
  return TIER_ORDER.findIndex((tier) => id.includes(tier));
}

// Pick the second-to-lowest tier that's currently available (e.g. Sonnet when
// Haiku/Sonnet/Opus are live), using the newest model within that tier.
async function selectModel(apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!res.ok) {
    throw new Error(`Models API error: ${res.status}`);
  }

  const { data } = await res.json();

  // newest model per present tier (created_at is ISO 8601 — lexical compare works)
  const byTier = new Map();
  for (const model of data || []) {
    const tier = tierOf(model.id);
    if (tier === -1) continue;
    const current = byTier.get(tier);
    if (!current || (model.created_at || '') > (current.created_at || '')) {
      byTier.set(tier, model);
    }
  }

  const tiers = [...byTier.keys()].sort((a, b) => a - b);
  if (tiers.length === 0) {
    throw new Error('No known Claude models available');
  }

  // second-to-lowest tier, or the only tier if just one is available
  const chosenTier = tiers.length >= 2 ? tiers[1] : tiers[0];
  return byTier.get(chosenTier).id;
}

async function getModel(apiKey) {
  const now = Date.now();
  if (cachedModel && now - cachedAt < MODEL_TTL_MS) {
    return cachedModel;
  }

  try {
    cachedModel = await selectModel(apiKey);
    cachedAt = now;
  } catch (err) {
    // If discovery fails but we have a previously selected model, keep using it.
    if (cachedModel) {
      console.error('Model discovery failed, using cached model:', err);
      return cachedModel;
    }
    throw err;
  }

  return cachedModel;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { system, messages } = req.body;

    const model = await getModel(apiKey);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
