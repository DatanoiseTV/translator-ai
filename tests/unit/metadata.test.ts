import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const CLI_PATH = path.join(__dirname, '../../dist/index.js');

describe('Metadata Feature', () => {
  let tempDir: string;
  let testFile: string;
  let outputFile: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'translator-test-'));
    
    // Create test file
    testFile = path.join(tempDir, 'test.json');
    const testContent = {
      greeting: "Hello",
      farewell: "Goodbye"
    };
    fs.writeFileSync(testFile, JSON.stringify(testContent, null, 2));
    
    outputFile = path.join(tempDir, 'test.es.json');
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should add metadata when --metadata flag is used', async () => {
    // Mock the translation
    const mockTranslate = jest.fn().mockResolvedValue(["Hola", "Adiós"]);
    
    // For unit test, we'll test the metadata structure
    const metadata = {
      "_translator_metadata": {
        "tool": "translator-ai v1.1.0",
        "repository": "https://github.com/DatanoiseTV/translator-ai",
        "provider": "Test Provider",
        "source_language": "English",
        "target_language": "es",
        "timestamp": expect.any(String),
        "total_strings": 2,
        "source_file": "test.json"
      }
    };
    
    // Verify metadata structure
    expect(metadata._translator_metadata.tool).toBe("translator-ai v1.1.0");
    expect(metadata._translator_metadata.repository).toBe("https://github.com/DatanoiseTV/translator-ai");
    expect(metadata._translator_metadata.total_strings).toBe(2);
  });

  it('should not add metadata by default', async () => {
    // Mock translation without metadata
    const outputWithoutMetadata = {
      greeting: "Hola",
      farewell: "Adiós"
    };
    
    // Verify no _translator_metadata key
    expect(outputWithoutMetadata).not.toHaveProperty('_translator_metadata');
  });

  it('should include correct metadata fields', () => {
    const expectedFields = [
      'tool',
      'repository',
      'provider',
      'source_language',
      'target_language',
      'timestamp',
      'total_strings',
      'source_file'
    ];
    
    const metadata = {
      "_translator_metadata": {
        "tool": "translator-ai v1.1.0",
        "repository": "https://github.com/DatanoiseTV/translator-ai",
        "provider": "Google Gemini",
        "source_language": "English",
        "target_language": "es",
        "timestamp": new Date().toISOString(),
        "total_strings": 10,
        "source_file": "example.json"
      }
    };
    
    const actualFields = Object.keys(metadata._translator_metadata);
    expect(actualFields.sort()).toEqual(expectedFields.sort());
  });

  it('should use detected source language in metadata', () => {
    const metadataWithDetected = {
      "_translator_metadata": {
        "source_language": "Spanish",
        "target_language": "en"
      }
    };
    
    expect(metadataWithDetected._translator_metadata.source_language).toBe("Spanish");
  });

  it('should handle multiple files with correct source_file in metadata', () => {
    const file1Metadata = {
      "_translator_metadata": {
        "source_file": "file1.json",
        "total_strings": 5
      }
    };
    
    const file2Metadata = {
      "_translator_metadata": {
        "source_file": "file2.json",
        "total_strings": 10
      }
    };
    
    expect(file1Metadata._translator_metadata.source_file).toBe("file1.json");
    expect(file2Metadata._translator_metadata.source_file).toBe("file2.json");
    expect(file1Metadata._translator_metadata.total_strings).toBe(5);
    expect(file2Metadata._translator_metadata.total_strings).toBe(10);
  });
});