import { GeminiTranslator } from '../../src/translators/gemini';
import { OllamaTranslator } from '../../src/translators/ollama';
import { OpenAITranslator } from '../../src/translators/openai';
import { TranslatorFactory } from '../../src/translators/factory';
import fetch from 'node-fetch';

jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Translators', () => {
  describe('GeminiTranslator', () => {
    it('should create instance with API key', () => {
      const translator = new GeminiTranslator('test-api-key');
      expect(translator.name).toBe('Google Gemini');
    });

    it('should check availability based on API key', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const translator = new GeminiTranslator('test-key');
      expect(await translator.isAvailable()).toBe(true);
      delete process.env.GEMINI_API_KEY;
    });
  });

  describe('OllamaTranslator', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create instance with default config', () => {
      const translator = new OllamaTranslator();
      expect(translator.name).toBe('Ollama (Local)');
    });

    it('should create instance with custom config', () => {
      const translator = new OllamaTranslator({
        baseUrl: 'http://localhost:9999',
        model: 'custom-model',
        timeout: 30000
      });
      expect(translator.name).toBe('Ollama (Local)');
    });

    it('should check availability by calling Ollama API', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          models: [
            { name: 'deepseek-r1:latest' },
            { name: 'llama2:latest' }
          ]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OllamaTranslator();
      const isAvailable = await translator.isAvailable();
      
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.any(Object));
    });

    it('should return false when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const translator = new OllamaTranslator();
      const isAvailable = await translator.isAvailable();
      
      expect(isAvailable).toBe(false);
    });

    it('should return false when model is not installed', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:latest' }
          ]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OllamaTranslator({ model: 'deepseek-r1:latest' });
      const isAvailable = await translator.isAvailable();
      
      expect(isAvailable).toBe(false);
    });

    it('should format prompt correctly for DeepSeek models', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          response: '["Hola", "Mundo"]'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OllamaTranslator({ model: 'deepseek-r1:latest' });
      const result = await translator.translate(['Hello', 'World'], 'es');
      
      expect(result).toEqual(['Hola', 'Mundo']);
      
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.prompt).toContain('<｜User｜>');
      expect(body.prompt).toContain('<｜Assistant｜>');
    });

    it('should handle thinking tags in DeepSeek response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          response: '<think>\nLet me translate these words\n</think>\n["Hola", "Mundo"]<｜end▁of▁sentence｜>'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OllamaTranslator({ model: 'deepseek-r1:latest' });
      const result = await translator.translate(['Hello', 'World'], 'es');
      
      expect(result).toEqual(['Hola', 'Mundo']);
    });

    it('should extract JSON from mixed response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          response: 'Here are the translations: ["Bonjour", "Monde"]'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OllamaTranslator();
      const result = await translator.translate(['Hello', 'World'], 'fr');
      
      expect(result).toEqual(['Bonjour', 'Monde']);
    });

    it('should handle timeout', async () => {
      // Mock a delayed response that will timeout - need 5 for retries
      for (let i = 0; i < 5; i++) {
        mockFetch.mockImplementationOnce(() => 
          new Promise((_, reject) => {
            const timeout = setTimeout(() => {
              const error = new Error('Request aborted');
              (error as any).name = 'AbortError';
              reject(error);
            }, 150);
            // Clear timeout to avoid Jest warnings
            setTimeout(() => clearTimeout(timeout), 200);
          })
        );
      }

      const translator = new OllamaTranslator({ timeout: 100 });
      
      await expect(translator.translate(['Hello'], 'es'))
        .rejects.toThrow('Translation failed after 5 attempts: Ollama request timed out after 100ms');
    }, 30000); // Increase test timeout for 5 retries

    it('should validate response length', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          response: '["Hola"]' // Only one translation for two inputs
        })
      };
      // Mock will be called 5 times due to retries
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce(mockResponse as any);
      }

      const translator = new OllamaTranslator();
      
      await expect(translator.translate(['Hello', 'World'], 'es'))
        .rejects.toThrow('Translation failed after 5 attempts: Translation count mismatch: expected 2, got 1');
    }, 30000); // Increase test timeout for 5 retries

    it('should list available models', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          models: [
            { name: 'deepseek-r1:latest' },
            { name: 'llama2:latest' },
            { name: 'mistral:latest' }
          ]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OllamaTranslator();
      const models = await translator.listModels();
      
      expect(models).toEqual(['deepseek-r1:latest', 'llama2:latest', 'mistral:latest']);
    });
  });

  describe('OpenAITranslator', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create instance with API key', () => {
      const translator = new OpenAITranslator('test-api-key');
      expect(translator.name).toBe('OpenAI');
    });

    it('should check availability based on API key', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const translator = new OpenAITranslator('test-key');
      expect(await translator.isAvailable()).toBe(true);
      delete process.env.OPENAI_API_KEY;
    });

    it('should translate strings correctly', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '["Hola", "Mundo"]'
            }
          }]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OpenAITranslator('test-key');
      const result = await translator.translate(['Hello', 'World'], 'es');
      
      expect(result).toEqual(['Hola', 'Mundo']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    it('should handle object wrapper in response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"translations": ["Bonjour", "Monde"]}'
            }
          }]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OpenAITranslator('test-key');
      const result = await translator.translate(['Hello', 'World'], 'fr');
      
      expect(result).toEqual(['Bonjour', 'Monde']);
    });

    it('should detect language', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Spanish'
            }
          }]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const translator = new OpenAITranslator('test-key');
      const language = await translator.detectLanguage(['Hola', 'Mundo']);
      
      expect(language).toBe('Spanish');
    });
  });

  describe('TranslatorFactory', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    it('should create Gemini translator when API key is available', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create();
      expect(translator.name).toBe('Google Gemini');
    });

    it('should create Ollama translator when explicitly requested', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          models: [{ name: 'deepseek-r1:latest' }]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);
      
      const translator = await TranslatorFactory.create({ type: 'ollama' });
      expect(translator.name).toBe('Ollama (Local)');
    });

    it('should throw error when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      
      await expect(TranslatorFactory.create({ type: 'ollama' }))
        .rejects.toThrow('Ollama is not available');
    });

    it('should throw error when no provider is available', async () => {
      await expect(TranslatorFactory.create({ type: 'gemini' }))
        .rejects.toThrow('No translation provider available');
    });

    it('should create OpenAI translator when explicitly requested', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create({ type: 'openai' });
      expect(translator.name).toBe('OpenAI');
    });

    it('should throw error when OpenAI is requested but no API key', async () => {
      await expect(TranslatorFactory.create({ type: 'openai' }))
        .rejects.toThrow('OpenAI API key not found');
    });

    it('should list available providers', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';
      
      const mockResponse = {
        ok: true,
        json: async () => ({
          models: [{ name: 'deepseek-r1:latest' }]
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);
      
      const providers = await TranslatorFactory.listAvailableProviders();
      expect(providers).toContain('gemini (API key found)');
      expect(providers).toContain('openai (API key found)');
      expect(providers).toContain('ollama (local)');
    });
  });
});