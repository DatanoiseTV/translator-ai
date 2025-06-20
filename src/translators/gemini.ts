import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { BaseTranslator } from './base';

export class GeminiTranslator extends BaseTranslator {
  name = 'Google Gemini';
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  
  constructor(apiKey: string, modelName: string = 'gemini-2.0-flash-lite') {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }
  
  async translate(strings: string[], targetLang: string): Promise<string[]> {
    const model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 10000,
        // @ts-ignore - responseMimeType is not in the type definitions yet
        responseMimeType: "application/json",
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
    
    const prompt = `Translate the following ${strings.length} strings from English to ${targetLang} language.
Return ONLY a JSON array with the translated strings in the exact same order.
Maintain any placeholder patterns like {{variable}} or {0} unchanged.
Do not add any explanation or additional text.

Strings to translate:
${JSON.stringify(strings, null, 2)}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    const responseText = result.response.text();
    const translations = JSON.parse(responseText);
    
    this.validateResponse(strings, translations);
    return translations;
  }
  
  async isAvailable(): Promise<boolean> {
    return !!process.env.GEMINI_API_KEY;
  }
}