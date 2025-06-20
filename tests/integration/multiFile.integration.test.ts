import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('Multi-File Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const outputDir = path.join(__dirname, '..', 'output');

  beforeAll(async () => {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  it('should process multiple files with deduplication', async () => {
    // Skip if no API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping integration test: GEMINI_API_KEY not set');
      return;
    }

    const cmd = `npm start -- "${fixturesDir}/file1.json" "${fixturesDir}/file2.json" -l es -o "${outputDir}/{name}.{lang}.json" --stats --no-cache`;
    
    const { stdout, stderr } = await execAsync(cmd);
    
    // Check that deduplication message appears
    expect(stdout).toContain('Deduplication saved');
    expect(stdout).toContain('API calls');
    
    // Check that files were created
    const file1Exists = await fs.access(path.join(outputDir, 'file1.es.json')).then(() => true).catch(() => false);
    const file2Exists = await fs.access(path.join(outputDir, 'file2.es.json')).then(() => true).catch(() => false);
    
    expect(file1Exists).toBe(true);
    expect(file2Exists).toBe(true);
    
    // Check that shared strings have the same translation
    const file1Content = JSON.parse(await fs.readFile(path.join(outputDir, 'file1.es.json'), 'utf-8'));
    const file2Content = JSON.parse(await fs.readFile(path.join(outputDir, 'file2.es.json'), 'utf-8'));
    
    expect(file1Content.shared).toBe(file2Content.shared);
  }, 30000); // 30 second timeout for API calls

  it('should handle glob patterns', async () => {
    // Skip if no API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping integration test: GEMINI_API_KEY not set');
      return;
    }

    const cmd = `npm start -- "${fixturesDir}/*.json" -l es -o "${outputDir}/{name}.glob.{lang}.json" --no-cache`;
    
    const { stdout, stderr } = await execAsync(cmd);
    
    // Should process multiple files
    expect(stdout).toContain('Processing');
    
    // Check that files were created with glob pattern
    const files = await fs.readdir(outputDir);
    const globFiles = files.filter(f => f.includes('.glob.'));
    
    expect(globFiles.length).toBeGreaterThan(0);
  }, 30000);
});