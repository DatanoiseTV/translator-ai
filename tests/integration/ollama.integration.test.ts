import { OllamaTranslator } from '../../src/translators/ollama';
import { TranslatorFactory } from '../../src/translators/factory';

describe('Ollama Integration Tests', () => {
  let ollamaAvailable = false;
  let translator: OllamaTranslator;

  beforeAll(async () => {
    // Check if Ollama is actually running
    translator = new OllamaTranslator();
    try {
      ollamaAvailable = await translator.isAvailable();
      if (!ollamaAvailable) {
        console.log('Skipping Ollama integration tests: Ollama not running or deepseek-r1:latest not installed');
      }
    } catch (error) {
      console.log('Skipping Ollama integration tests: Cannot connect to Ollama');
    }
  });

  it('should check if Ollama is running', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    expect(ollamaAvailable).toBe(true);
  });

  it('should list available models', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    const models = await translator.listModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    console.log('Available Ollama models:', models);
  });

  it('should translate a simple string', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    const result = await translator.translate(['Hello'], 'es');
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('string');
    expect(result[0].toLowerCase()).not.toBe('hello'); // Should be translated
    console.log('Translation result:', result);
  }, 30000); // 30 second timeout

  it('should translate multiple strings', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    const input = ['Hello', 'World', 'How are you?'];
    const result = await translator.translate(input, 'es');
    
    expect(result).toHaveLength(3);
    result.forEach((translation, index) => {
      expect(typeof translation).toBe('string');
      expect(translation.toLowerCase()).not.toBe(input[index].toLowerCase());
    });
    
    console.log('Multi-string translation:', result);
  }, 30000);

  it('should preserve placeholders', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    const input = ['Hello {{name}}', 'You have {0} messages'];
    const result = await translator.translate(input, 'es');
    
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('{{name}}');
    expect(result[1]).toContain('{0}');
    
    console.log('Placeholder preservation:', result);
  }, 30000);

  it('should handle different target languages', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    const input = ['Good morning'];
    
    // Test French
    const frenchResult = await translator.translate(input, 'fr');
    // Check that it's either translated or at least attempted
    expect(frenchResult[0]).toBeDefined();
    expect(frenchResult[0].length).toBeGreaterThan(0);
    console.log('French:', frenchResult);
    
    // Test German
    const germanResult = await translator.translate(input, 'de');
    expect(germanResult[0]).toBeDefined();
    expect(germanResult[0].length).toBeGreaterThan(0);
    console.log('German:', germanResult);
    
    // Test Japanese
    const japaneseResult = await translator.translate(input, 'ja');
    expect(japaneseResult[0]).toBeDefined();
    expect(japaneseResult[0].length).toBeGreaterThan(0);
    console.log('Japanese:', japaneseResult);
  }, 60000); // 60 second timeout for multiple translations

  it('should work through TranslatorFactory', async () => {
    if (!ollamaAvailable) {
      console.log('Ollama not available - skipping test');
      return;
    }

    const factoryTranslator = await TranslatorFactory.create({ type: 'ollama' });
    expect(factoryTranslator.name).toBe('Ollama (Local)');
    
    const result = await factoryTranslator.translate(['Test'], 'es');
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('string');
  }, 30000);
});