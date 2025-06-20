import { BaseTranslator } from './base';
import fetch from 'node-fetch';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAITranslator extends BaseTranslator {
  name = 'OpenAI';
  private apiKey: string;
  private modelName: string;
  private baseUrl: string;
  
  constructor(apiKey: string, modelName: string = 'gpt-4o-mini') {
    super();
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.baseUrl = 'https://api.openai.com/v1';
  }
  
  async translate(strings: string[], targetLang: string, sourceLang: string = 'English'): Promise<string[]> {
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: `You are a professional translator. Translate text from ${sourceLang} to ${targetLang}. Return ONLY a JSON array with the translated strings in the exact same order. Maintain any placeholder patterns like {{variable}} or {0} unchanged. Do not add any explanation or additional text.`
      },
      {
        role: 'user',
        content: `Translate the following ${strings.length} strings:\n${JSON.stringify(strings, null, 2)}`
      }
    ];
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        temperature: 0.1,
        top_p: 0.8,
        max_tokens: 10000,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as OpenAIResponse;
    const content = data.choices[0].message.content;
    
    // Handle potential JSON object wrapper
    let translations: string[];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        translations = parsed;
      } else if (parsed.translations && Array.isArray(parsed.translations)) {
        translations = parsed.translations;
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (e) {
      throw new Error(`Failed to parse OpenAI response: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    this.validateResponse(strings, translations);
    return translations;
  }
  
  async detectLanguage(strings: string[]): Promise<string> {
    const sampleSize = Math.min(5, strings.length);
    const sample = strings.slice(0, sampleSize).join(' ');
    
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: 'Detect the language of the provided text and respond with ONLY the language name in English (e.g., "English", "Spanish", "French", etc.).'
      },
      {
        role: 'user',
        content: sample
      }
    ];
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: 0.1,
          max_tokens: 50
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json() as OpenAIResponse;
      const detectedLang = data.choices[0].message.content.trim();
      return detectedLang;
    } catch (error) {
      console.warn('Language detection failed, assuming English:', error);
      return 'English';
    }
  }
  
  async isAvailable(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }
}