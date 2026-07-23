// ---------------------------------------------------------------------------
// Universal provider registry.
//
// Each adapter converts the app's internal message list into the shape a given
// chat API expects, and parses the reply + token usage back out. Presets are
// provided for the popular providers; a "Custom" (OpenAI-compatible) adapter
// lets the user point their key at ANY chat model by supplying a base URL and
// model id. Because most APIs (and OpenRouter, which proxies almost every
// model) speak the OpenAI format, this covers effectively any AI chat model.
// ---------------------------------------------------------------------------

/** Normalize an internal message list into OpenAI chat format. */
function toOpenAIMessages(systemPrompt, messages) {
  const out = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
  for (const m of messages) {
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  return out;
}

// --- OpenAI-compatible adapter (OpenAI, DeepSeek, OpenRouter, Custom, ...) ---
function openAICompatible(cfg) {
  return {
    id: cfg.id,
    label: cfg.label,
    kind: 'openai',
    defaultBaseUrl: cfg.baseUrl,
    defaultModel: cfg.model,
    models: cfg.models || [],
    docsUrl: cfg.docsUrl || '',
    requiresBaseUrl: !!cfg.requiresBaseUrl,
    balance: cfg.balance || null,

    buildRequest({ apiKey, baseUrl, model, systemPrompt, messages, temperature = 0.7, maxTokens = 1024, extraHeaders = {} }) {
      const root = (baseUrl || cfg.baseUrl || '').replace(/\/$/, '');
      const url = `${root}/chat/completions`;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(cfg.extraHeaders || {}),
        ...extraHeaders
      };
      const body = {
        model: model || cfg.model,
        messages: toOpenAIMessages(systemPrompt, messages),
        temperature,
        max_tokens: maxTokens,
        stream: false
      };
      return { url, options: { method: 'POST', headers, body: JSON.stringify(body) } };
    },

    parseResponse(json) {
      const content = json?.choices?.[0]?.message?.content ?? '';
      const u = json?.usage || {};
      return {
        content: typeof content === 'string' ? content : JSON.stringify(content),
        usage: {
          prompt: u.prompt_tokens ?? u.input_tokens ?? null,
          completion: u.completion_tokens ?? u.output_tokens ?? null,
          total: u.total_tokens ?? null
        }
      };
    }
  };
}

// --- Google Gemini adapter ---
const geminiAdapter = {
  id: 'gemini',
  label: 'Google Gemini',
  kind: 'gemini',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  defaultModel: 'gemini-1.5-flash',
  models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
  docsUrl: 'https://ai.google.dev/gemini-api/docs',
  requiresBaseUrl: false,
  balance: null,

  buildRequest({ apiKey, baseUrl, model, systemPrompt, messages, temperature = 0.7, maxTokens = 1024 }) {
    const root = (baseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const mdl = model || this.defaultModel;
    const url = `${root}/models/${mdl}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const body = {
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
    return {
      url,
      options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    };
  },

  parseResponse(json) {
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const content = parts.map((p) => p.text || '').join('');
    const u = json?.usageMetadata || {};
    return {
      content,
      usage: {
        prompt: u.promptTokenCount ?? null,
        completion: u.candidatesTokenCount ?? null,
        total: u.totalTokenCount ?? null
      }
    };
  }
};

// --- Anthropic Claude adapter ---
const claudeAdapter = {
  id: 'claude',
  label: 'Anthropic Claude',
  kind: 'anthropic',
  defaultBaseUrl: 'https://api.anthropic.com/v1',
  defaultModel: 'claude-3-5-sonnet-latest',
  models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  docsUrl: 'https://docs.anthropic.com/en/api',
  requiresBaseUrl: false,
  balance: null,

  buildRequest({ apiKey, baseUrl, model, systemPrompt, messages, temperature = 0.7, maxTokens = 1024 }) {
    const root = (baseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${root}/messages`;
    const msgs = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    const body = { model: model || this.defaultModel, max_tokens: maxTokens, temperature, messages: msgs };
    if (systemPrompt) body.system = systemPrompt;
    return {
      url,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // Allow calls from a browser/WebView origin.
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      }
    };
  },

  parseResponse(json) {
    const content = (json?.content || []).map((c) => c.text || '').join('');
    const u = json?.usage || {};
    const prompt = u.input_tokens ?? null;
    const completion = u.output_tokens ?? null;
    return {
      content,
      usage: {
        prompt,
        completion,
        total: prompt != null && completion != null ? prompt + completion : null
      }
    };
  }
};

// --- Preset registry ---
export const PROVIDERS = {
  openai: openAICompatible({
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
    docsUrl: 'https://platform.openai.com/docs/api-reference'
  }),
  gemini: geminiAdapter,
  claude: claudeAdapter,
  deepseek: openAICompatible({
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    docsUrl: 'https://api-docs.deepseek.com',
    balance: {
      label: 'Số dư tài khoản',
      async fetch(apiKey, platformFetch) {
        const res = await platformFetch('https://api.deepseek.com/user/balance', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
        });
        const json = await res.json();
        const info = json?.balance_infos?.[0];
        if (!info) return null;
        return { text: `${info.total_balance} ${info.currency}`, raw: json };
      }
    }
  }),
  openrouter: openAICompatible({
    id: 'openrouter',
    label: 'OpenRouter (mọi model)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5', 'meta-llama/llama-3.1-70b-instruct'],
    docsUrl: 'https://openrouter.ai/docs',
    extraHeaders: { 'HTTP-Referer': 'https://ai-companion.app', 'X-Title': 'AI Companion' },
    balance: {
      label: 'Tín dụng còn lại',
      async fetch(apiKey, platformFetch) {
        const res = await platformFetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        const json = await res.json();
        const d = json?.data;
        if (!d) return null;
        const remaining = d.limit != null ? (d.limit - (d.usage || 0)).toFixed(4) : null;
        return {
          text: remaining != null ? `$${remaining} còn lại` : `$${(d.usage || 0).toFixed(4)} đã dùng`,
          raw: json
        };
      }
    }
  }),
  custom: openAICompatible({
    id: 'custom',
    label: 'Tùy chỉnh (OpenAI-compatible)',
    baseUrl: '',
    model: '',
    models: [],
    requiresBaseUrl: true,
    docsUrl: ''
  })
};

export const PROVIDER_LIST = Object.values(PROVIDERS).map((p) => ({
  id: p.id,
  label: p.label,
  defaultModel: p.defaultModel,
  defaultBaseUrl: p.defaultBaseUrl,
  models: p.models,
  requiresBaseUrl: p.requiresBaseUrl,
  docsUrl: p.docsUrl,
  hasBalance: !!p.balance
}));

export function getProvider(id) {
  return PROVIDERS[id] || PROVIDERS.custom;
}
