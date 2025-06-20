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
  }
}