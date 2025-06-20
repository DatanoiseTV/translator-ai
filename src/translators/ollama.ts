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
  private maxRetries: number = 5;
  private useJsonFormat: boolean = true;
  private useSimplifiedPrompt: boolean = false;
  
  constructor(config: OllamaConfig = {}) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'deepseek-r1:latest';
    this.timeout = config.timeout || 60000; // 60 seconds default
  }
  
  async translate(strings: string[], targetLang: string, sourceLang: string = 'English'): Promise<string[]> {
    let lastError: Error | null = null;
    
    // Reset flags at the start
    this.useJsonFormat = true;
    this.useSimplifiedPrompt = false;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.attemptTranslation(strings, targetLang, sourceLang);
        return result;
      } catch (error: any) {
        lastError = error;
        if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
          console.error(`[Ollama] Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
        }
        
        if (attempt < this.maxRetries) {
          // Wait before retrying (exponential backoff with jitter)
          const baseWaitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          const jitter = Math.random() * 500; // Add random jitter
          const waitTime = baseWaitTime + jitter;
          
          if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
            console.error(`[Ollama] Waiting ${Math.round(waitTime)}ms before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // On retries, try simpler prompt formats
          if (attempt === 2) {
            // Try without format: 'json' constraint
            this.useJsonFormat = false;
          } else if (attempt === 3) {
            // Try with simplified prompt
            this.useSimplifiedPrompt = true;
          }
        }
      }
    }
    
    throw new Error(`Translation failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  async detectLanguage(strings: string[]): Promise<string> {
    // Take a sample of strings for detection
    const sampleSize = Math.min(5, strings.length);
    const sample = strings.slice(0, sampleSize).join(' ');
    
    const prompt = `Detect the language of this text and respond with ONLY the language name in English (e.g., "English", "Spanish", "French", etc.): "${sample}"`;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }
      
      const data = await response.json() as any;
      const detectedLang = data.response.trim();
      
      if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
        console.error(`[Ollama] Detected language: ${detectedLang}`);
      }
      
      return detectedLang;
    } catch (error) {
      console.warn('Language detection failed, assuming English:', error);
      return 'English';
    }
  }
  
  private async attemptTranslation(strings: string[], targetLang: string, sourceLang: string = 'English'): Promise<string[]> {
    // For DeepSeek-R1, we need to format the prompt in their expected format
    const isDeepSeek = this.model.includes('deepseek');
    
    // Add verbose logging
    if (process.env.OLLAMA_VERBOSE === 'true' || process.argv.includes('--verbose')) {
      console.error(`[Ollama] Model: ${this.model}`);
      console.error(`[Ollama] Target language: ${targetLang}`);
      console.error(`[Ollama] Strings to translate: ${JSON.stringify(strings)}`);
    }
    
    let prompt: string;
    if (this.useSimplifiedPrompt) {
      // Simplified prompt for retries
      prompt = `Translate from ${sourceLang} to ${targetLang}:\n${JSON.stringify(strings)}\n\nReturn JSON array with translations.`;
    } else if (isDeepSeek) {
      // DeepSeek format with more flexible instructions
      prompt = `<｜User｜>Translate these ${strings.length} strings from ${sourceLang} to ${targetLang}.

Return a JSON response with the translations. You can return either:
- A JSON array with ${strings.length} translated strings in order
- A JSON object mapping each original string to its translation

Preserve ALL placeholders unchanged (like {{var}}, {0}, %s, etc.)

Input to translate:
${JSON.stringify(strings, null, 2)}
<｜Assistant｜>`;
    } else {
      // Generic format for other models
      prompt = `Translate the following ${strings.length} strings from ${sourceLang} to ${targetLang}.

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
      const requestBody: any = {
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
      };
      
      // Only add format: 'json' if the flag is true
      if (this.useJsonFormat) {
        requestBody.format = 'json';
      }
      
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
          } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            // Handle various object formats
            const keys = Object.keys(parsed);
            
            // Check if it's a direct mapping
            if (keys.length === strings.length) {
              // Check if each value is an array with one element
              const allArrays = keys.every(key => Array.isArray(parsed[key]) && parsed[key].length === 1);
              if (allArrays) {
                // Extract the first element from each array in order
                return strings.map(str => {
                  const translation = parsed[str];
                  return Array.isArray(translation) ? translation[0] : translation;
                });
              }
              // Or if it's a simple key-value mapping
              return strings.map(str => parsed[str] || str);
            }
            
            // Check if it's numbered keys (0, 1, 2, etc.)
            const hasNumberedKeys = keys.every(key => /^\d+$/.test(key));
            if (hasNumberedKeys && keys.length === strings.length) {
              return keys.sort((a, b) => parseInt(a) - parseInt(b)).map(key => parsed[key]);
            }
            
            // Check if values are the translations (any object structure)
            const values = Object.values(parsed);
            if (values.length === strings.length && values.every(v => typeof v === 'string')) {
              return values;
            }
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
        },
        
        // Strategy 5: Extract strings from any valid JSON structure
        () => {
          const parsed = JSON.parse(jsonString);
          const extractedStrings: string[] = [];
          
          // Recursive function to extract strings
          const extractStrings = (obj: any, depth: number = 0): void => {
            if (depth > 5) return; // Prevent infinite recursion
            
            if (typeof obj === 'string') {
              extractedStrings.push(obj);
            } else if (Array.isArray(obj)) {
              obj.forEach(item => extractStrings(item, depth + 1));
            } else if (typeof obj === 'object' && obj !== null) {
              Object.values(obj).forEach(value => extractStrings(value, depth + 1));
            }
          };
          
          extractStrings(parsed);
          
          // Only return if we got the expected number of strings
          if (extractedStrings.length === strings.length) {
            return extractedStrings;
          }
          
          throw new Error(`Found ${extractedStrings.length} strings, expected ${strings.length}`);
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