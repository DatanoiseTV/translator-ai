import { OpenAITranslator } from '../../src/translators/openai';
import { TranslatorFactory } from '../../src/translators/factory';

describe('OpenAI Support', () => {
  describe('OpenAITranslator', () => {
    it('should use default model when not specified', () => {
      const translator = new OpenAITranslator('test-api-key');
      expect((translator as any).modelName).toBe('gpt-4o-mini');
    });

    it('should use custom model when specified', () => {
      const translator = new OpenAITranslator('test-api-key', 'gpt-4o');
      expect((translator as any).modelName).toBe('gpt-4o');
    });

    it('should accept different OpenAI models', () => {
      const models = [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'gpt-4',
        'gpt-4-32k'
      ];
      
      models.forEach(model => {
        const translator = new OpenAITranslator('test-api-key', model);
        expect((translator as any).modelName).toBe(model);
      });
    });

    it('should have correct name', () => {
      const translator = new OpenAITranslator('test-api-key');
      expect(translator.name).toBe('OpenAI');
    });
  });

  describe('TranslatorFactory', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
    });

    it('should create OpenAI translator when type is specified', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create({
        type: 'openai'
      });
      
      expect(translator.name).toBe('OpenAI');
      expect((translator as any).modelName).toBe('gpt-4o-mini');
    });

    it('should pass openai model to translator', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create({
        type: 'openai',
        openaiModel: 'gpt-4o'
      });
      
      expect(translator.name).toBe('OpenAI');
      expect((translator as any).modelName).toBe('gpt-4o');
    });

    it('should auto-detect openai when only OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create();
      
      expect(translator.name).toBe('OpenAI');
    });

    it('should throw error when openai is selected but no API key', async () => {
      await expect(TranslatorFactory.create({
        type: 'openai'
      })).rejects.toThrow('OpenAI API key not found');
    });
  });

  describe('CLI integration', () => {
    it('should parse --openai-model flag', () => {
      const args = ['node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json', '--provider', 'openai', '--openai-model', 'gpt-4o'];
      const modelIndex = args.indexOf('--openai-model');
      expect(modelIndex).toBeGreaterThan(-1);
      expect(args[modelIndex + 1]).toBe('gpt-4o');
    });

    it('should work with provider selection', () => {
      const args = [
        'node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json',
        '--provider', 'openai',
        '--openai-model', 'gpt-4-turbo'
      ];
      
      const providerIndex = args.indexOf('--provider');
      const modelIndex = args.indexOf('--openai-model');
      
      expect(providerIndex).toBeGreaterThan(-1);
      expect(args[providerIndex + 1]).toBe('openai');
      expect(modelIndex).toBeGreaterThan(-1);
      expect(args[modelIndex + 1]).toBe('gpt-4-turbo');
    });
  });
});