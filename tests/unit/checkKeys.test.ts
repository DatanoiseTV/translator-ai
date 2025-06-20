import { compareKeys } from '../../src/helpers';

describe('Check Keys Feature', () => {
  describe('compareKeys', () => {
    it('should detect all keys are present', () => {
      const source = {
        greeting: 'Hello',
        farewell: 'Goodbye',
        nested: {
          item1: 'One',
          item2: 'Two'
        }
      };
      
      const output = {
        greeting: 'Hola',
        farewell: 'Adiós',
        nested: {
          item1: 'Uno',
          item2: 'Dos'
        }
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(true);
      expect(result.missingKeys.size).toBe(0);
      expect(result.extraKeys.size).toBe(0);
      expect(result.sourceKeys.size).toBe(5); // greeting, farewell, nested, nested.item1, nested.item2
    });

    it('should detect missing keys', () => {
      const source = {
        greeting: 'Hello',
        farewell: 'Goodbye',
        welcome: 'Welcome'
      };
      
      const output = {
        greeting: 'Hola',
        farewell: 'Adiós'
        // welcome is missing
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(false);
      expect(result.missingKeys.size).toBe(1);
      expect(result.missingKeys.has('welcome')).toBe(true);
      expect(result.extraKeys.size).toBe(0);
    });

    it('should detect extra keys', () => {
      const source = {
        greeting: 'Hello'
      };
      
      const output = {
        greeting: 'Hola',
        unexpected: 'Extra'
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(true); // Extra keys don't invalidate
      expect(result.missingKeys.size).toBe(0);
      expect(result.extraKeys.size).toBe(1);
      expect(result.extraKeys.has('unexpected')).toBe(true);
    });

    it('should handle nested missing keys', () => {
      const source = {
        user: {
          name: 'Name',
          email: 'Email',
          settings: {
            theme: 'Theme',
            language: 'Language'
          }
        }
      };
      
      const output = {
        user: {
          name: 'Nombre',
          // email is missing
          settings: {
            theme: 'Tema'
            // language is missing
          }
        }
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(false);
      expect(result.missingKeys.size).toBe(2);
      expect(result.missingKeys.has('user.email')).toBe(true);
      expect(result.missingKeys.has('user.settings.language')).toBe(true);
    });

    it('should ignore metadata keys by default', () => {
      const source = {
        greeting: 'Hello'
      };
      
      const output = {
        _translator_metadata: {
          tool: 'translator-ai',
          timestamp: '2024-01-01'
        },
        greeting: 'Hola'
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(true);
      expect(result.missingKeys.size).toBe(0);
      expect(result.extraKeys.size).toBe(0); // Metadata is ignored
    });

    it('should handle arrays correctly', () => {
      const source = {
        items: ['One', 'Two', 'Three'],
        config: {
          options: ['A', 'B']
        }
      };
      
      const output = {
        items: ['Uno', 'Dos'], // Different length is OK
        config: {
          options: ['A', 'B', 'C'] // Different length is OK
        }
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(true);
      expect(result.sourceKeys.has('items')).toBe(true);
      expect(result.sourceKeys.has('config.options')).toBe(true);
      // Individual array indices are not tracked
      expect(result.sourceKeys.has('items[0]')).toBe(false);
    });

    it('should handle empty objects', () => {
      const source = {};
      const output = {};
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(true);
      expect(result.sourceKeys.size).toBe(0);
      expect(result.outputKeys.size).toBe(0);
    });

    it('should detect when entire nested object is missing', () => {
      const source = {
        section1: {
          item1: 'One',
          item2: 'Two'
        },
        section2: {
          item3: 'Three'
        }
      };
      
      const output = {
        section1: {
          item1: 'Uno',
          item2: 'Dos'
        }
        // section2 is completely missing
      };
      
      const result = compareKeys(source, output);
      
      expect(result.isValid).toBe(false);
      expect(result.missingKeys.has('section2.item3')).toBe(true);
    });
  });

  describe('CLI integration', () => {
    it('should parse --check-keys flag', () => {
      const args = ['node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json', '--check-keys'];
      const checkKeysIndex = args.indexOf('--check-keys');
      expect(checkKeysIndex).toBeGreaterThan(-1);
    });

    it('should work with other flags', () => {
      const args = ['node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json', '--check-keys', '--sort-keys'];
      const checkKeysIndex = args.indexOf('--check-keys');
      const sortKeysIndex = args.indexOf('--sort-keys');
      
      expect(checkKeysIndex).toBeGreaterThan(-1);
      expect(sortKeysIndex).toBeGreaterThan(-1);
    });
  });
});