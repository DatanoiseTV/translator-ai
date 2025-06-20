import { BaseTranslator } from './base';
import fetch from 'node-fetch';

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export class OllamaTranslator extends BaseTranslator {
  name = 'Ollama (Local)';
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private maxRetries: number = 3;
  
  constructor(config: OllamaConfig = {}) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'deepseek-r1:latest';
    this.timeout = config.timeout || 60000; // 60 seconds default
  }
  
  async translate(strings: string[], targetLang: string): Promise<string[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.attemptTranslation(strings, targetLang);
        return result;
      } catch (error: any) {
        lastError = error;
        if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
          console.error(`[Ollama] Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
        }
        
        if (attempt < this.maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
            console.error(`[Ollama] Waiting ${waitTime}ms before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw new Error(`Translation failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }
  
  private async attemptTranslation(strings: string[], targetLang: string): Promise<string[]> {
    // For DeepSeek-R1, we need to format the prompt in their expected format
    const isDeepSeek = this.model.includes('deepseek');
    
    // Add verbose logging
    if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
      console.error(`[Ollama] Model: ${this.model}`);
      console.error(`[Ollama] Target language: ${targetLang}`);
      console.error(`[Ollama] Strings to translate: ${JSON.stringify(strings)}`);
    }
    
    let prompt: string;
    if (isDeepSeek) {
      // DeepSeek format with explicit user/assistant markers
      prompt = `<｜User｜>Translate these ${strings.length} strings from English to ${targetLang}.

CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array [] containing the translations
2. The array MUST have exactly ${strings.length} strings
3. Maintain the EXACT same order as the input
4. Preserve ALL placeholders unchanged (like {{var}}, {0}, %s, etc.)
5. Do NOT add any text before or after the JSON
6. Do NOT wrap the array in an object

Example:
Input: ["Hello", "Welcome {{name}}"]
Output: ["Hola", "Bienvenido {{name}}"]

Input to translate:
${JSON.stringify(strings, null, 2)}
<｜Assistant｜>`;
    } else {
      // Generic format for other models
      prompt = `Translate the following ${strings.length} strings from English to ${targetLang}.

Rules:
1. Return ONLY a valid JSON array with the translated strings
2. Keep the exact same order as the input
3. Preserve any placeholder patterns like {{variable}}, {0}, %s, etc.
4. Do not include any explanations, markdown formatting, or additional text
5. The output must be valid JSON that can be parsed

Input strings:
${JSON.stringify(strings, null, 2)}

Output:`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const requestBody = {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower for more consistent translations
          top_p: 0.95, // DeepSeek R1 default
          stop: [
            "<｜begin▁of▁sentence｜>",
            "<｜end▁of▁sentence｜>",
            "<｜User｜>",
            "<｜Assistant｜>"
          ],
        },
        format: 'json',
      };
      
      if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
        console.error(`[Ollama] Request body: ${JSON.stringify(requestBody, null, 2)}`);
      }
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      let responseText = data.response;
      
      if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
        console.error(`[Ollama] Raw response: ${JSON.stringify(data, null, 2)}`);
      }
      
      // Remove DeepSeek thinking tags if present
      if (this.model.includes('deepseek')) {
        responseText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        // Also remove any trailing end markers
        responseText = responseText.replace(/<｜end▁of▁sentence｜>/g, '').trim();
      }
      
      if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
        console.error(`[Ollama] Cleaned response text: ${responseText}`);
      }
      
      // Extract JSON from the response
      let translations: string[];
      
      // First, try to extract just the JSON part from the response
      // Handle cases where LLM adds text before/after JSON
      let jsonString = responseText.trim();
      
      // Common patterns where LLMs add extra text
      const patterns = [
        /Here (?:is|are) the translations?:?\s*(\{[\s\S]*\}|\[[\s\S]*\])/i,
        /The translations? (?:is|are):?\s*(\{[\s\S]*\}|\[[\s\S]*\])/i,
        /```json\s*([\s\S]*?)\s*```/,
        /```\s*([\s\S]*?)\s*```/,
        /(\{[\s\S]*\}|\[[\s\S]*\])/, // Just find JSON anywhere
      ];
      
      for (const pattern of patterns) {
        const match = responseText.match(pattern);
        if (match) {
          jsonString = match[1] || match[0];
          break;
        }
      }
      
      // Try multiple JSON extraction strategies
      const extractionStrategies = [
        // Strategy 1: Parse the cleaned string directly
        () => {
          const parsed = JSON.parse(jsonString);
          if (Array.isArray(parsed)) {
            return parsed;
          } else if (parsed.translations && Array.isArray(parsed.translations)) {
            return parsed.translations;
          }
          throw new Error('Not a valid translation format');
        },
        
        // Strategy 2: Find array pattern
        () => {
          const arrayMatch = jsonString.match(/\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\]/);
          if (arrayMatch) {
            return JSON.parse(arrayMatch[0]);
          }
          throw new Error('No array found');
        },
        
        // Strategy 3: Find object with translations
        () => {
          const objectMatch = jsonString.match(/\{\s*"translations"\s*:\s*\[[^\]]*\]\s*\}/);
          if (objectMatch) {
            const parsed = JSON.parse(objectMatch[0]);
            return parsed.translations;
          }
          throw new Error('No translations object found');
        },
        
        // Strategy 4: Try to fix common JSON errors
        () => {
          // Fix unescaped quotes in values
          let fixed = jsonString.replace(/"([^"]*)":\s*"([^"]*(?:\\.[^"]*)*)"/g, (match: string, key: string, value: string) => {
            const fixedValue = value.replace(/(?<!\\)"/g, '\\"');
            return `"${key}": "${fixedValue}"`;
          });
          
          const parsed = JSON.parse(fixed);
          if (Array.isArray(parsed)) {
            return parsed;
          } else if (parsed.translations && Array.isArray(parsed.translations)) {
            return parsed.translations;
          }
          throw new Error('Fixed JSON still not valid');
        }
      ];
      
      let lastError: Error | null = null;
      for (const strategy of extractionStrategies) {
        try {
          translations = strategy();
          if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
            console.error(`[Ollama] Successfully extracted translations using strategy`);
          }
          break;
        } catch (e: any) {
          lastError = e;
          if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
            console.error(`[Ollama] Extraction strategy failed: ${e.message}`);
          }
        }
      }
      
      if (!translations!) {
        throw new Error(`Could not extract valid translations from response. Last error: ${lastError?.message}`);
      }
      
      this.validateResponse(strings, translations);
      return translations;
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json() as any;
      const models = data.models || [];
      
      // Check if the specified model is available
      return models.some((m: any) => m.name === this.model);
      
    } catch (error) {
      return false;
    }
  }
  
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error('Failed to list Ollama models');
      }
      
      const data = await response.json() as any;
      return (data.models || []).map((m: any) => m.name);
      
    } catch (error) {
      throw new Error(`Failed to connect to Ollama: ${error}`);
    }
  }
}