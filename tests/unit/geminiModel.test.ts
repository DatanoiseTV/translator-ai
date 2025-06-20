import { GeminiTranslator } from '../../src/translators/gemini';
import { TranslatorFactory } from '../../src/translators/factory';

describe('Gemini Model Selection', () => {
  describe('GeminiTranslator', () => {
    it('should use default model when not specified', () => {
      const translator = new GeminiTranslator('test-api-key');
      expect((translator as any).modelName).toBe('gemini-2.0-flash-lite');
    });

    it('should use custom model when specified', () => {
      const translator = new GeminiTranslator('test-api-key', 'gemini-pro');
      expect((translator as any).modelName).toBe('gemini-pro');
    });

    it('should accept different gemini models', () => {
      const models = [
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash',
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
      ];
      
      models.forEach(model => {
        const translator = new GeminiTranslator('test-api-key', model);
        expect((translator as any).modelName).toBe(model);
      });
    });

    it('should work with gemini-2.5-flash model', () => {
      const translator = new GeminiTranslator('test-api-key', 'gemini-2.5-flash');
      expect((translator as any).modelName).toBe('gemini-2.5-flash');
    });

    it('should work with gemini-2.0-flash-lite model', () => {
      const translator = new GeminiTranslator('test-api-key', 'gemini-2.0-flash-lite');
      expect((translator as any).modelName).toBe('gemini-2.0-flash-lite');
    });
  });

  describe('TranslatorFactory', () => {
    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('should pass gemini model to translator', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create({
        type: 'gemini',
        geminiModel: 'gemini-pro'
      });
      
      expect(translator.name).toBe('Google Gemini');
      expect((translator as any).modelName).toBe('gemini-pro');
    });

    it('should use default model when not specified', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      
      const translator = await TranslatorFactory.create({
        type: 'gemini'
      });
      
      expect(translator.name).toBe('Google Gemini');
      expect((translator as any).modelName).toBe('gemini-2.0-flash-lite');
    });
  });

  describe('CLI integration', () => {
    it('should parse --gemini-model flag', () => {
      const args = ['node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json', '--gemini-model', 'gemini-pro'];
      const modelIndex = args.indexOf('--gemini-model');
      expect(modelIndex).toBeGreaterThan(-1);
      expect(args[modelIndex + 1]).toBe('gemini-pro');
    });

    it('should work with other provider flags', () => {
      const args = [
        'node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json',
        '--provider', 'gemini',
        '--gemini-model', 'gemini-1.5-pro'
      ];
      
      const providerIndex = args.indexOf('--provider');
      const modelIndex = args.indexOf('--gemini-model');
      
      expect(providerIndex).toBeGreaterThan(-1);
      expect(args[providerIndex + 1]).toBe('gemini');
      expect(modelIndex).toBeGreaterThan(-1);
      expect(args[modelIndex + 1]).toBe('gemini-1.5-pro');
    });
  });
});