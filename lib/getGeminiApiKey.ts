export const GEMINI_API_KEY_ENV = 'VITE_GEMINI_API_KEY';
const GEMINI_API_KEY_STORAGE = 'auragen_gemini_api_key';

let cachedApiKey = '';

const readEnvKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  return typeof apiKey === 'string' ? apiKey : '';
};

export const getGeminiApiKey = (): string => {
  if (cachedApiKey) return cachedApiKey;
  const storedKey = typeof window !== 'undefined'
    ? window.localStorage.getItem(GEMINI_API_KEY_STORAGE)
    : null;
  if (storedKey) {
    cachedApiKey = storedKey;
    return storedKey;
  }
  const envKey = readEnvKey();
  if (envKey) cachedApiKey = envKey;
  return envKey;
};

export const setGeminiApiKey = (apiKey: string) => {
  cachedApiKey = apiKey;
  if (typeof window !== 'undefined') {
    if (apiKey) {
      window.localStorage.setItem(GEMINI_API_KEY_STORAGE, apiKey);
    } else {
      window.localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
  }
};

export const syncGeminiApiKeyFromAIStudio = async (): Promise<boolean> => {
  const aistudio = typeof window !== 'undefined' ? (window as any).aistudio : null;
  const fetchKey = aistudio?.getSelectedApiKey ?? aistudio?.getApiKey;
  if (typeof fetchKey !== 'function') return false;
  const apiKey = await Promise.resolve(fetchKey());
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    setGeminiApiKey(apiKey);
    return true;
  }
  return false;
};
