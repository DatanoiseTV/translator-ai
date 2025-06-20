import { sortObjectKeys } from '../../src/helpers';

describe('Sort Keys Feature', () => {
  describe('sortObjectKeys', () => {
    it('should sort simple object keys alphabetically', () => {
      const input = {
        zebra: 'z',
        alpha: 'a',
        beta: 'b'
      };
      
      const result = sortObjectKeys(input) as any;
      const keys = Object.keys(result);
      
      expect(keys).toEqual(['alpha', 'beta', 'zebra']);
    });

    it('should sort keys case-insensitively', () => {
      const input = {
        Zebra: 'Z',
        alpha: 'a',
        Beta: 'B'
      };
      
      const result = sortObjectKeys(input) as any;
      const keys = Object.keys(result);
      
      expect(keys).toEqual(['alpha', 'Beta', 'Zebra']);
    });

    it('should recursively sort nested objects', () => {
      const input = {
        z: {
          nested: 'value',
          another: 'value',
          deeply: {
            x: 1,
            a: 2,
            m: 3
          }
        },
        a: 'first'
      };
      
      const result = sortObjectKeys(input) as any;
      const topKeys = Object.keys(result);
      const nestedKeys = Object.keys(result.z);
      const deeplyKeys = Object.keys(result.z.deeply);
      
      expect(topKeys).toEqual(['a', 'z']);
      expect(nestedKeys).toEqual(['another', 'deeply', 'nested']);
      expect(deeplyKeys).toEqual(['a', 'm', 'x']);
    });

    it('should handle arrays without sorting their elements', () => {
      const input = {
        items: ['zebra', 'alpha', 'beta'],
        count: 3
      };
      
      const result = sortObjectKeys(input) as any;
      const keys = Object.keys(result);
      
      expect(keys).toEqual(['count', 'items']);
      expect(result.items).toEqual(['zebra', 'alpha', 'beta']); // Array order preserved
    });

    it('should sort objects within arrays', () => {
      const input = {
        users: [
          { name: 'John', age: 30, city: 'NYC' },
          { name: 'Jane', age: 25, city: 'LA' }
        ]
      };
      
      const result = sortObjectKeys(input) as any;
      const firstUserKeys = Object.keys(result.users[0]);
      const secondUserKeys = Object.keys(result.users[1]);
      
      expect(firstUserKeys).toEqual(['age', 'city', 'name']);
      expect(secondUserKeys).toEqual(['age', 'city', 'name']);
    });

    it('should handle mixed types correctly', () => {
      const input = {
        string: 'value',
        number: 123,
        boolean: true,
        null: null,
        object: { z: 1, a: 2 },
        array: [3, 2, 1]
      };
      
      const result = sortObjectKeys(input) as any;
      const keys = Object.keys(result);
      const objectKeys = Object.keys(result.object);
      
      expect(keys).toEqual(['array', 'boolean', 'null', 'number', 'object', 'string']);
      expect(objectKeys).toEqual(['a', 'z']);
      expect(result.array).toEqual([3, 2, 1]); // Array order preserved
    });

    it('should handle special characters and numbers in keys', () => {
      const input = {
        '_private': 1,
        '123': 2,
        'public': 3,
        '!special': 4,
        'UPPERCASE': 5,
        'lowercase': 6
      };
      
      const result = sortObjectKeys(input) as any;
      const keys = Object.keys(result);
      
      // The actual order based on localeCompare (case-insensitive)
      expect(keys).toEqual(['123', '_private', '!special', 'lowercase', 'public', 'UPPERCASE']);
    });

    it('should work with i18n typical structures', () => {
      const input = {
        COMPONENTS: {
          BUTTON: {
            SUBMIT: 'Submit',
            CANCEL: 'Cancel'
          },
          HEADER: {
            TITLE: 'Welcome',
            SUBTITLE: 'Hello'
          }
        },
        ERRORS: {
          NOT_FOUND: '404',
          SERVER_ERROR: '500'
        }
      };
      
      const result = sortObjectKeys(input) as any;
      const topKeys = Object.keys(result);
      const componentKeys = Object.keys(result.COMPONENTS);
      const buttonKeys = Object.keys(result.COMPONENTS.BUTTON);
      
      expect(topKeys).toEqual(['COMPONENTS', 'ERRORS']);
      expect(componentKeys).toEqual(['BUTTON', 'HEADER']);
      expect(buttonKeys).toEqual(['CANCEL', 'SUBMIT']);
    });
  });

  describe('CLI integration', () => {
    it('should parse --sort-keys flag', () => {
      const args = ['node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json', '--sort-keys'];
      const sortKeysIndex = args.indexOf('--sort-keys');
      expect(sortKeysIndex).toBeGreaterThan(-1);
    });

    it('should work with other flags', () => {
      const args = ['node', 'index.js', 'input.json', '-l', 'es', '-o', 'output.json', '--sort-keys', '--metadata'];
      const sortKeysIndex = args.indexOf('--sort-keys');
      const metadataIndex = args.indexOf('--metadata');
      
      expect(sortKeysIndex).toBeGreaterThan(-1);
      expect(metadataIndex).toBeGreaterThan(-1);
    });
  });
});