import { TranslationProvider } from './base';
import { GeminiTranslator } from './gemini';
import { OllamaTranslator } from './ollama';
import { OpenAITranslator } from './openai';

export type TranslatorType = 'gemini' | 'ollama' | 'openai';

export interface TranslatorConfig {
  type?: TranslatorType;
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  ollamaTimeout?: number;
  openaiApiKey?: string;
  openaiModel?: string;
}

export class TranslatorFactory {
  static async create(config: TranslatorConfig = {}): Promise<TranslationProvider> {
    const type = config.type || this.detectType(config);
    
    switch (type) {
      case 'ollama':
        const ollama = new OllamaTranslator({
          baseUrl: config.ollamaBaseUrl,
          model: config.ollamaModel,
          timeout: config.ollamaTimeout,
        });
        
        if (await ollama.isAvailable()) {
          return ollama;
        } else {
          throw new Error(
            'Ollama is not available. Make sure Ollama is running and the model is installed.\n' +
            'Run: ollama pull deepseek-r1:latest'
          );
        }
        
      case 'openai':
        const openaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
        
        if (!openaiKey) {
          throw new Error(
            'OpenAI API key not found. Either:\n' +
            '1. Set OPENAI_API_KEY environment variable\n' +
            '2. Use a different provider (gemini or ollama)'
          );
        }
        
        return new OpenAITranslator(openaiKey, config.openaiModel);
        
      case 'gemini':
      default:
        const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
          throw new Error(
            'No translation provider available. Either:\n' +
            '1. Set GEMINI_API_KEY environment variable\n' +
            '2. Use --provider ollama with Ollama running locally\n' +
            '3. Use --provider openai with OPENAI_API_KEY set'
          );
        }
        
        return new GeminiTranslator(apiKey, config.geminiModel);
    }
  }
  
  private static detectType(config: TranslatorConfig): TranslatorType {
    // If Gemini API key is provided, prefer Gemini
    if (config.geminiApiKey || process.env.GEMINI_API_KEY) {
      return 'gemini';
    }
    
    // If OpenAI API key is provided, use OpenAI
    if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    
    // Otherwise default to Ollama
    return 'ollama';
  }
  
  static async listAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    // Check Gemini
    if (process.env.GEMINI_API_KEY) {
      available.push('gemini (API key found)');
    }
    
    // Check OpenAI
    if (process.env.OPENAI_API_KEY) {
      available.push('openai (API key found)');
    }
    
    // Check Ollama
    const ollama = new OllamaTranslator();
    if (await ollama.isAvailable()) {
      available.push('ollama (local)');
    }
    
    return available;
  }
}