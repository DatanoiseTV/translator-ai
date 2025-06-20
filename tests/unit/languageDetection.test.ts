import { GeminiTranslator } from '../../src/translators/gemini';
import { OllamaTranslator } from '../../src/translators/ollama';

// Mock the dependencies
jest.mock('@google/generative-ai');
jest.mock('node-fetch');

describe('Language Detection', () => {
  describe('GeminiTranslator', () => {
    it('should have detectLanguage method', () => {
      const translator = new GeminiTranslator('test-key');
      expect(typeof translator.detectLanguage).toBe('function');
    });

    it('should detect English by default on error', async () => {
      const translator = new GeminiTranslator('test-key');
      
      // Mock the genAI to throw an error
      const mockGenerateContent = jest.fn().mockRejectedValue(new Error('API Error'));
      (translator as any).genAI = {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent
        })
      };

      const result = await translator.detectLanguage(['Hello world']);
      expect(result).toBe('English');
    });
  });

  describe('OllamaTranslator', () => {
    it('should have detectLanguage method', () => {
      const translator = new OllamaTranslator();
      expect(typeof translator.detectLanguage).toBe('function');
    });

    it('should return English on error', async () => {
      const translator = new OllamaTranslator();
      
      // Mock fetch to reject
      const fetch = require('node-fetch');
      fetch.default = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await translator.detectLanguage(['Hola mundo']);
      expect(result).toBe('English');
    });
  });

  describe('CLI Integration', () => {
    it('should parse detect-source flag', () => {
      const { Command } = require('commander');
      const program = new Command();
      
      program
        .option('--detect-source', 'Auto-detect source language')
        .exitOverride();
      
      program.parse(['node', 'test', '--detect-source']);
      const opts = program.opts();
      
      expect(opts.detectSource).toBe(true);
    });
  });
});