import { preserveFormats, restoreFormats } from '../../src/helpers';

describe('Format Preservation', () => {
  describe('preserveFormats', () => {
    it('should preserve URLs', () => {
      const text = 'Visit our website at https://example.com for more info';
      const result = preserveFormats(text);
      
      expect(result.processed).toContain('__PRESERVE_URL_');
      expect(result.processed).not.toContain('https://example.com');
      expect(result.preservedParts).toHaveLength(1);
      expect(result.preservedParts[0].value).toBe('https://example.com');
    });

    it('should preserve email addresses', () => {
      const text = 'Contact us at support@example.com';
      const result = preserveFormats(text);
      
      expect(result.processed).toContain('__PRESERVE_EMAIL_');
      expect(result.processed).not.toContain('support@example.com');
      expect(result.preservedParts[0].value).toBe('support@example.com');
    });

    it('should preserve template variables', () => {
      const text = 'Hello {{name}}, your order {0} is ready with ${amount}';
      const result = preserveFormats(text);
      
      expect(result.processed).toContain('__PRESERVE_TEMPLATE_');
      expect(result.processed).toContain('__PRESERVE_PLACEHOLDER_');
      expect(result.preservedParts).toHaveLength(3);
    });

    it('should preserve multiple formats in one string', () => {
      const text = 'Email support@test.com or visit https://test.com for v1.2.3 updates';
      const result = preserveFormats(text);
      
      expect(result.preservedParts).toHaveLength(3);
      expect(result.preservedParts.map(p => p.value)).toContain('support@test.com');
      expect(result.preservedParts.map(p => p.value)).toContain('https://test.com');
      expect(result.preservedParts.map(p => p.value)).toContain('v1.2.3');
    });

    it('should preserve currency', () => {
      const text = 'Price: $99.99 or €89.99';
      const result = preserveFormats(text);
      
      expect(result.preservedParts).toHaveLength(2);
      expect(result.preservedParts[0].value).toBe('$99.99');
      expect(result.preservedParts[1].value).toBe('€89.99');
    });

    it('should preserve dates', () => {
      const text = 'Meeting scheduled for 2024-03-15T14:30:00Z';
      const result = preserveFormats(text);
      
      expect(result.preservedParts).toHaveLength(1);
      expect(result.preservedParts[0].value).toBe('2024-03-15T14:30:00Z');
    });
  });

  describe('restoreFormats', () => {
    it('should restore preserved formats correctly', () => {
      const original = 'Contact support@example.com or visit https://example.com';
      const preserved = preserveFormats(original);
      
      // Simulate translation
      const translated = preserved.processed
        .replace('Contact', 'Contactar')
        .replace('or visit', 'o visitar');
      
      const restored = restoreFormats(translated, preserved);
      
      expect(restored).toBe('Contactar support@example.com o visitar https://example.com');
    });

    it('should handle complex restoration', () => {
      const original = 'Version v2.1.0 costs $49.99 at https://shop.com';
      const preserved = preserveFormats(original);
      
      const translated = preserved.processed
        .replace('Version', 'Versión')
        .replace('costs', 'cuesta')
        .replace('at', 'en');
      
      const restored = restoreFormats(translated, preserved);
      
      expect(restored).toContain('v2.1.0');
      expect(restored).toContain('$49.99');
      expect(restored).toContain('https://shop.com');
      expect(restored).toContain('Versión');
      expect(restored).toContain('cuesta');
    });
  });
});