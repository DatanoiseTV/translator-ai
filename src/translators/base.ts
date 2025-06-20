export interface TranslationProvider {
  name: string;
  translate(strings: string[], targetLang: string): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}

export interface TranslationOptions {
  targetLanguage: string;
  batchSize?: number;
  timeout?: number;
}

export abstract class BaseTranslator implements TranslationProvider {
  abstract name: string;
  
  abstract translate(strings: string[], targetLang: string): Promise<string[]>;
  
  abstract isAvailable(): Promise<boolean>;
  
  protected validateResponse(strings: string[], translations: string[]): void {
    if (translations.length !== strings.length) {
      throw new Error(
        `Translation count mismatch: expected ${strings.length}, got ${translations.length}`
      );
    }
    
    // Check for empty or missing translations
    for (let i = 0; i < translations.length; i++) {
      if (!translations[i] || translations[i].trim() === '') {
        throw new Error(
          `Empty translation at index ${i}: input was "${strings[i]}", output was empty`
        );
      }
      
      // Check if translation is identical to input (might indicate failure)
      // Skip this check for proper nouns and brand names
      const isLikelyProperNoun = /^[A-Z][a-z]*(\s[A-Z][a-z]*)*$/.test(strings[i]);
      const isSingleWord = !strings[i].includes(' ');
      
      if (!isLikelyProperNoun && !isSingleWord && translations[i] === strings[i]) {
        console.warn(
          `Warning: Translation identical to input at index ${i}: "${strings[i]}" => "${translations[i]}"`
        );
      }
    }
  }
}