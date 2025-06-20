# translator-ai

[![CI](https://github.com/DatanoiseTV/translator-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/DatanoiseTV/translator-ai/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/translator-ai.svg)](https://www.npmjs.com/package/translator-ai)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://coff.ee/datanoisetv)

Fast and efficient JSON i18n translator supporting multiple AI providers (Google Gemini & Ollama/DeepSeek) with intelligent caching, multi-file deduplication, and MCP integration.

## Features

- **Multiple AI Providers**: Choose between Google Gemini (cloud) or Ollama/DeepSeek (local) for translations
- **Multi-File Support**: Process multiple files with automatic deduplication to save API calls
- **Incremental Caching**: Only translates new or modified strings, dramatically reducing API calls
- **Batch Processing**: Intelligently batches translations for optimal performance
- **Path Preservation**: Maintains exact JSON structure including nested objects and arrays
- **Cross-Platform**: Works on Windows, macOS, and Linux with automatic cache directory detection
- **Developer Friendly**: Built-in performance statistics and progress indicators
- **Cost Effective**: Minimizes API usage through smart caching and deduplication
- **Language Detection**: Automatically detect source language instead of assuming English
- **Multiple Target Languages**: Translate to multiple languages in a single command
- **Translation Metadata**: Optionally include translation details in output files for tracking
- **Dry Run Mode**: Preview what would be translated without making API calls
- **Format Preservation**: Maintains URLs, emails, dates, numbers, and template variables unchanged

## Installation

### Global Installation (Recommended)

```bash
npm install -g translator-ai
```

### Local Installation

```bash
npm install translator-ai
```

## Configuration

### Option 1: Google Gemini API (Cloud)

Create a `.env` file in your project root or set the environment variable:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Option 2: Ollama with DeepSeek-R1 (Local)

For completely local translation without API costs:

1. Install [Ollama](https://ollama.ai)
2. Pull the DeepSeek-R1 model:
   ```bash
   ollama pull deepseek-r1:latest
   ```
3. Use the `--provider ollama` flag:
   ```bash
   translator-ai source.json -l es -o spanish.json --provider ollama
   ```

## Usage

### Basic Usage

```bash
# Translate a single file
translator-ai source.json -l es -o spanish.json

# Translate multiple files with deduplication
translator-ai src/locales/en/*.json -l es -o "{dir}/{name}.{lang}.json"

# Use glob patterns
translator-ai "src/**/*.en.json" -l fr -o "{dir}/{name}.fr.json"
```

### Command Line Options

```
translator-ai <inputFiles...> [options]

Arguments:
  inputFiles                   Path(s) to source JSON file(s) or glob patterns

Options:
  -l, --lang <langCodes>      Target language code(s), comma-separated for multiple
  -o, --output <pattern>      Output file path or pattern
  --stdout                    Output to stdout instead of file
  --stats                     Show detailed performance statistics
  --no-cache                  Disable incremental translation cache
  --cache-file <path>         Custom cache file path
  --provider <type>           Translation provider: gemini or ollama (default: gemini)
  --ollama-url <url>          Ollama API URL (default: http://localhost:11434)
  --ollama-model <model>      Ollama model name (default: deepseek-r1:latest)
  --list-providers            List available translation providers
  --verbose                   Enable verbose output for debugging
  --detect-source             Auto-detect source language instead of assuming English
  --dry-run                   Preview what would be translated without making API calls
  --preserve-formats          Preserve URLs, emails, numbers, dates, and other formats
  --no-metadata               Disable adding metadata to output files
  -h, --help                  Display help
  -V, --version               Display version

Output Pattern Variables (for multiple files):
  {dir}   - Original directory path
  {name}  - Original filename without extension
  {lang}  - Target language code
```

### Examples

#### Translate a single file
```bash
translator-ai en.json -l es -o es.json
```

#### Translate multiple files with pattern
```bash
# All JSON files in a directory
translator-ai locales/en/*.json -l es -o "locales/es/{name}.json"

# Recursive glob pattern
translator-ai "src/**/en.json" -l fr -o "{dir}/fr.json"

# Multiple specific files
translator-ai file1.json file2.json file3.json -l de -o "{name}.de.json"
```

#### Translate with deduplication savings
```bash
# Shows statistics including how many API calls were saved
translator-ai src/i18n/*.json -l ja -o "{dir}/{name}.{lang}.json" --stats
```

#### Output to stdout (useful for piping)
```bash
translator-ai en.json -l de --stdout > de.json
```

#### Parse output with jq
```bash
translator-ai en.json -l de --stdout | jq
```

#### Disable caching for fresh translation
```bash
translator-ai en.json -l ja -o ja.json --no-cache
```

#### Use custom cache location
```bash
translator-ai en.json -l ko -o ko.json --cache-file /path/to/cache.json
```

#### Use Ollama for local translation
```bash
# Basic usage with Ollama
translator-ai en.json -l es -o es.json --provider ollama

# Use a different Ollama model
translator-ai en.json -l fr -o fr.json --provider ollama --ollama-model llama2:latest

# Connect to remote Ollama instance
translator-ai en.json -l de -o de.json --provider ollama --ollama-url http://192.168.1.100:11434

# Check available providers
translator-ai --list-providers
```

#### Advanced Features
```bash
# Detect source language automatically
translator-ai content.json -l es -o spanish.json --detect-source

# Translate to multiple languages at once
translator-ai en.json -l es,fr,de,ja -o translations/{lang}.json

# Dry run - see what would be translated without making API calls
translator-ai en.json -l es -o es.json --dry-run

# Preserve formats (URLs, emails, dates, numbers, template variables)
translator-ai app.json -l fr -o app-fr.json --preserve-formats

# Include translation metadata (enabled by default)
translator-ai en.json -l fr -o fr.json

# Disable metadata for cleaner output
translator-ai en.json -l fr -o fr.json --no-metadata

# Combine features
translator-ai src/**/*.json -l es,fr,de -o "{dir}/{name}.{lang}.json" \
  --detect-source --preserve-formats --stats
```

### Translation Metadata

By default, translator-ai adds metadata to help track translations:

```json
{
  "_translator_metadata": {
    "tool": "translator-ai v1.0.9",
    "repository": "https://github.com/DatanoiseTV/translator-ai",
    "provider": "Google Gemini",
    "source_language": "English",
    "target_language": "fr",
    "timestamp": "2025-06-20T12:34:56.789Z",
    "total_strings": 42,
    "source_file": "en.json"
  },
  "greeting": "Bonjour",
  "farewell": "Au revoir"
}
```

Use `--no-metadata` to disable this feature.

### Supported Language Codes

It should support any standardized language codes.

## How It Works

1. **Parsing**: Reads and flattens your JSON structure into paths
2. **Deduplication**: When processing multiple files, identifies shared strings
3. **Caching**: Checks cache for previously translated strings
4. **Diffing**: Identifies new or modified strings needing translation
5. **Batching**: Groups unique strings into optimal batch sizes for API efficiency
6. **Translation**: Sends batches to selected provider (Gemini API or local Ollama)
7. **Reconstruction**: Rebuilds the exact JSON structure with translations
8. **Caching**: Updates cache with new translations for future use

### Multi-File Deduplication

When translating multiple files, translator-ai automatically:
- Identifies duplicate strings across files
- Translates each unique string only once
- Applies the same translation consistently across all files
- Saves significant API calls and ensures consistency

Example: If 10 files share 50% of their strings, you save ~50% on API calls!

## Cache Management

### Default Cache Locations

- **Windows**: `%APPDATA%\translator-ai\translation-cache.json`
- **macOS**: `~/Library/Caches/translator-ai/translation-cache.json`
- **Linux**: `~/.cache/translator-ai/translation-cache.json`

The cache file stores translations indexed by:
- Source file path
- Target language
- SHA-256 hash of source string

This ensures that:
- Modified strings are retranslated
- Removed strings are pruned from cache
- Multiple projects can share the same cache without conflicts

## Provider Comparison

### Google Gemini
- **Pros**: Fast, accurate, handles large batches efficiently
- **Cons**: Requires API key, has usage costs
- **Best for**: Production use, large projects, when accuracy is critical

### Ollama (Local)
- **Pros**: Free, runs locally, no API limits, privacy-friendly
- **Cons**: Slower, requires local resources, model download needed
- **Best for**: Development, privacy-sensitive data, cost-conscious projects

## Performance Tips

1. **Use caching** (enabled by default) to minimize API calls
2. **Batch multiple files** in the same session to leverage warm cache
3. **Use `--stats` flag** to monitor performance and optimization opportunities
4. **Keep source files consistent** to maximize cache hits
5. **For Ollama**: Use a powerful machine for better performance

## API Limits and Costs

### Gemini API
- Uses Gemini 2.0 Flash Lite model for optimal speed and cost
- Chooses best batch size dynamically depending on input key count
- Batches up to 100 strings per API call
- Check [Google's pricing](https://ai.google.dev/pricing) for current rates

### Ollama
- No API costs - runs entirely on your hardware
- Performance depends on your machine's capabilities
- Supports various models with different speed/quality tradeoffs

## Using with Model Context Protocol (MCP)

translator-ai can be used as an MCP server, allowing AI assistants like Claude Desktop to translate files directly.

### MCP Configuration

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "translator-ai": {
      "command": "npx",
      "args": [
        "-y",
        "translator-ai-mcp"
      ],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here"
        // Or for Ollama:
        // "TRANSLATOR_PROVIDER": "ollama"
      }
    }
  }
}
```

### MCP Usage Examples

Once configured, you can ask Claude to translate files:

```
Human: Can you translate my English locale file to Spanish?

Claude: I'll translate your English locale file to Spanish using translator-ai.

<use_tool name="translate_json">
{
  "inputFile": "locales/en.json",
  "targetLanguage": "es",
  "outputFile": "locales/es.json"
}
</use_tool>

Successfully translated! The file has been saved to locales/es.json.
```

For multiple files with deduplication:

```
Human: Translate all my English JSON files in the locales folder to German.

Claude: I'll translate all your English JSON files to German with deduplication.

<use_tool name="translate_multiple">
{
  "pattern": "locales/en/*.json",
  "targetLanguage": "de",
  "outputPattern": "locales/de/{name}.json",
  "showStats": true
}
</use_tool>

Translation complete! Processed 5 files with 23% deduplication savings.
```

### MCP Tools Available

1. **translate_json**: Translate a single JSON file
   - `inputFile`: Path to source file
   - `targetLanguage`: Target language code
   - `outputFile`: Output file path

2. **translate_multiple**: Translate multiple files with deduplication
   - `pattern`: File pattern or paths
   - `targetLanguage`: Target language code
   - `outputPattern`: Output pattern with {dir}, {name}, {lang} variables
   - `showStats`: Show deduplication statistics (optional)

## Integration with Static Site Generators

### Working with YAML Files (Hugo, Jekyll, etc.)

Since translator-ai works with JSON files, you'll need to convert YAML to JSON and back. Here's a practical workflow:

#### Setup YAML conversion tools

```bash
# Install yaml conversion tools
npm install -g js-yaml
# or
pip install pyyaml
```

#### Hugo Example with YAML Conversion

1. **Create a translation script** (`translate-hugo.sh`):

```bash
#!/bin/bash
# translate-hugo.sh - Translate Hugo YAML i18n files

# Function to translate YAML file
translate_yaml() {
  local input_file=$1
  local lang=$2
  local output_file=$3
  
  echo "Translating $input_file to $lang..."
  
  # Convert YAML to JSON
  npx js-yaml $input_file > temp_input.json
  
  # Translate JSON
  translator-ai temp_input.json -l $lang -o temp_output.json
  
  # Convert back to YAML
  npx js-yaml temp_output.json > $output_file
  
  # Cleanup
  rm temp_input.json temp_output.json
}

# Translate Hugo i18n files
translate_yaml themes/your-theme/i18n/en.yaml es themes/your-theme/i18n/es.yaml
translate_yaml themes/your-theme/i18n/en.yaml fr themes/your-theme/i18n/fr.yaml
translate_yaml themes/your-theme/i18n/en.yaml de themes/your-theme/i18n/de.yaml
```

2. **Python-based converter** for more complex scenarios:

```python
#!/usr/bin/env python3
# hugo-translate.py

import yaml
import json
import subprocess
import sys
import os

def yaml_to_json(yaml_file):
    """Convert YAML to JSON"""
    with open(yaml_file, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return json.dumps(data, ensure_ascii=False, indent=2)

def json_to_yaml(json_str):
    """Convert JSON back to YAML"""
    data = json.loads(json_str)
    return yaml.dump(data, allow_unicode=True, default_flow_style=False)

def translate_yaml_file(input_yaml, target_lang, output_yaml):
    """Translate a YAML file using translator-ai"""
    
    # Create temp JSON file
    temp_json_in = 'temp_in.json'
    temp_json_out = f'temp_out_{target_lang}.json'
    
    try:
        # Convert YAML to JSON
        json_content = yaml_to_json(input_yaml)
        with open(temp_json_in, 'w', encoding='utf-8') as f:
            f.write(json_content)
        
        # Run translator-ai
        cmd = [
            'translator-ai',
            temp_json_in,
            '-l', target_lang,
            '-o', temp_json_out
        ]
        subprocess.run(cmd, check=True)
        
        # Read translated JSON and convert back to YAML
        with open(temp_json_out, 'r', encoding='utf-8') as f:
            translated_json = f.read()
        
        yaml_content = json_to_yaml(translated_json)
        
        # Write YAML output
        with open(output_yaml, 'w', encoding='utf-8') as f:
            f.write(yaml_content)
        
        print(f"✓ Translated {input_yaml} to {output_yaml}")
        
    finally:
        # Cleanup temp files
        for f in [temp_json_in, temp_json_out]:
            if os.path.exists(f):
                os.remove(f)

# Usage
if __name__ == "__main__":
    languages = ['es', 'fr', 'de', 'ja']
    
    for lang in languages:
        translate_yaml_file(
            'i18n/en.yaml',
            lang,
            f'i18n/{lang}.yaml'
        )
```

#### Node.js Solution with Proper YAML Handling

Create `translate-yaml.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const path = require('path');

function translateYamlFile(inputPath, targetLang, outputPath) {
  console.log(`Translating ${inputPath} to ${targetLang}...`);
  
  // Read and parse YAML
  const yamlContent = fs.readFileSync(inputPath, 'utf8');
  const data = yaml.load(yamlContent);
  
  // Write temporary JSON
  const tempJsonIn = `temp_${path.basename(inputPath)}.json`;
  const tempJsonOut = `temp_${path.basename(inputPath)}_${targetLang}.json`;
  
  fs.writeFileSync(tempJsonIn, JSON.stringify(data, null, 2));
  
  try {
    // Translate using translator-ai
    execSync(`translator-ai ${tempJsonIn} -l ${targetLang} -o ${tempJsonOut}`);
    
    // Read translated JSON
    const translatedData = JSON.parse(fs.readFileSync(tempJsonOut, 'utf8'));
    
    // Convert back to YAML
    const translatedYaml = yaml.dump(translatedData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true
    });
    
    // Write output YAML
    fs.writeFileSync(outputPath, translatedYaml);
    console.log(`✓ Created ${outputPath}`);
    
  } finally {
    // Cleanup
    [tempJsonIn, tempJsonOut].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }
}

// Example usage
const languages = ['es', 'fr', 'de'];
languages.forEach(lang => {
  translateYamlFile(
    'i18n/en.yaml',
    lang,
    `i18n/${lang}.yaml`
  );
});
```

### Real-world Hugo Workflow

Hugo supports two translation methods: by filename (`about.en.md`, `about.fr.md`) or by content directory (`content/en/`, `content/fr/`). Here's how to automate both:

#### Method 1: Translation by Filename

Create `hugo-translate-files.sh`:

```bash
#!/bin/bash
# Translate Hugo content files using filename convention

SOURCE_LANG="en"
TARGET_LANGS=("es" "fr" "de" "ja")

# Find all English content files
find content -name "*.${SOURCE_LANG}.md" | while read -r file; do
  # Extract base filename without language suffix
  base_name="${file%.${SOURCE_LANG}.md}"
  
  for lang in "${TARGET_LANGS[@]}"; do
    output_file="${base_name}.${lang}.md"
    
    # Skip if translation already exists
    if [ -f "$output_file" ]; then
      echo "Skipping $output_file (already exists)"
      continue
    fi
    
    # Extract front matter
    awk '/^---$/{p=1; next} p&&/^---$/{exit} p' "$file" > temp_frontmatter.yaml
    
    # Convert front matter to JSON
    npx js-yaml temp_frontmatter.yaml > temp_frontmatter.json
    
    # Translate front matter
    translator-ai temp_frontmatter.json -l "$lang" -o "temp_translated.json"
    
    # Convert back to YAML
    echo "---" > "$output_file"
    npx js-yaml temp_translated.json >> "$output_file"
    echo "---" >> "$output_file"
    
    # Copy content (you might want to translate this too)
    awk '/^---$/{p++} p==2{print}' "$file" | tail -n +2 >> "$output_file"
    
    echo "Created $output_file"
  done
  
  # Cleanup
  rm -f temp_frontmatter.yaml temp_frontmatter.json temp_translated.json
done
```

#### Method 2: Translation by Content Directory

1. **Setup Hugo config** (`config.yaml`):

```yaml
defaultContentLanguage: en
defaultContentLanguageInSubdir: false

languages:
  en:
    contentDir: content/en
    languageName: English
    weight: 1
  es:
    contentDir: content/es
    languageName: Español
    weight: 2
  fr:
    contentDir: content/fr
    languageName: Français
    weight: 3

# Rest of your config...
```

2. **Create translation script** (`hugo-translate-dirs.js`):

```javascript
#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const glob = require('glob');

const SOURCE_LANG = 'en';
const TARGET_LANGS = ['es', 'fr', 'de'];

async function translateHugoContent() {
  // Ensure target directories exist
  for (const lang of TARGET_LANGS) {
    await fs.ensureDir(`content/${lang}`);
  }
  
  // Find all content files in source language
  const files = glob.sync(`content/${SOURCE_LANG}/**/*.md`);
  
  for (const file of files) {
    const relativePath = path.relative(`content/${SOURCE_LANG}`, file);
    
    for (const lang of TARGET_LANGS) {
      const targetFile = path.join(`content/${lang}`, relativePath);
      
      // Skip if already translated
      if (await fs.pathExists(targetFile)) {
        console.log(`Skipping ${targetFile} (exists)`);
        continue;
      }
      
      await translateFile(file, targetFile, lang);
    }
  }
}

async function translateFile(sourceFile, targetFile, targetLang) {
  console.log(`Translating ${sourceFile} to ${targetLang}...`);
  
  const content = await fs.readFile(sourceFile, 'utf8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontMatterMatch) {
    // No front matter, just copy
    await fs.ensureDir(path.dirname(targetFile));
    await fs.copyFile(sourceFile, targetFile);
    return;
  }
  
  // Parse front matter
  const frontMatter = yaml.load(frontMatterMatch[1]);
  const body = content.substring(frontMatterMatch[0].length);
  
  // Extract translatable fields
  const translatable = {
    title: frontMatter.title || '',
    description: frontMatter.description || '',
    summary: frontMatter.summary || '',
    keywords: frontMatter.keywords || []
  };
  
  // Save for translation
  await fs.writeJson('temp_meta.json', translatable);
  
  // Translate
  execSync(`translator-ai temp_meta.json -l ${targetLang} -o temp_translated.json`);
  
  // Read translations
  const translated = await fs.readJson('temp_translated.json');
  
  // Update front matter
  Object.assign(frontMatter, translated);
  
  // Write translated file
  await fs.ensureDir(path.dirname(targetFile));
  const newContent = `---\n${yaml.dump(frontMatter)}---${body}`;
  await fs.writeFile(targetFile, newContent);
  
  // Cleanup
  await fs.remove('temp_meta.json');
  await fs.remove('temp_translated.json');
  
  console.log(`✓ Created ${targetFile}`);
}

// Run translation
translateHugoContent().catch(console.error);
```

#### Hugo i18n Files Translation

1. **Install dependencies**:
```bash
npm install -g translator-ai js-yaml
```

2. **Create a Makefile** for easy translation:

```makefile
# Makefile for Hugo translations
LANGUAGES := es fr de ja zh
SOURCE_YAML := i18n/en.yaml
THEME_DIR := themes/your-theme

.PHONY: translate
translate: $(foreach lang,$(LANGUAGES),translate-$(lang))

translate-%:
	@echo "Translating to $*..."
	@npx js-yaml $(SOURCE_YAML) > temp.json
	@translator-ai temp.json -l $* -o temp_$*.json
	@npx js-yaml temp_$*.json > i18n/$*.yaml
	@rm temp.json temp_$*.json
	@echo "✓ Created i18n/$*.yaml"

.PHONY: translate-theme
translate-theme:
	@for lang in $(LANGUAGES); do \
		make translate-theme-$$lang; \
	done

translate-theme-%:
	@echo "Translating theme to $*..."
	@npx js-yaml $(THEME_DIR)/i18n/en.yaml > temp_theme.json
	@translator-ai temp_theme.json -l $* -o temp_theme_$*.json
	@npx js-yaml temp_theme_$*.json > $(THEME_DIR)/i18n/$*.yaml
	@rm temp_theme.json temp_theme_$*.json

.PHONY: clean
clean:
	@rm -f temp*.json

# Translate everything
.PHONY: all
all: translate translate-theme
```

Usage:
```bash
# Translate to all languages
make all

# Translate to specific language
make translate-es

# Translate theme files
make translate-theme
```

#### Complete Hugo Translation Workflow

Here's a comprehensive script that handles both content and i18n translations:

```javascript
#!/usr/bin/env node
// hugo-complete-translator.js
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const glob = require('glob');

class HugoTranslator {
  constructor(targetLanguages = ['es', 'fr', 'de']) {
    this.targetLanguages = targetLanguages;
    this.tempFiles = [];
  }

  async translateSite() {
    console.log('Starting Hugo site translation...\n');
    
    // 1. Translate i18n files
    await this.translateI18nFiles();
    
    // 2. Translate content
    await this.translateContent();
    
    // 3. Update config
    await this.updateConfig();
    
    console.log('\nTranslation complete!');
  }

  async translateI18nFiles() {
    console.log('Translating i18n files...');
    const i18nFiles = glob.sync('i18n/en.{yaml,yml,toml}');
    
    for (const file of i18nFiles) {
      const ext = path.extname(file);
      
      for (const lang of this.targetLanguages) {
        const outputFile = `i18n/${lang}${ext}`;
        
        if (await fs.pathExists(outputFile)) {
          console.log(`  Skipping ${outputFile} (exists)`);
          continue;
        }
        
        // Convert to JSON
        const tempJson = `temp_i18n_${lang}.json`;
        await this.convertToJson(file, tempJson);
        
        // Translate
        const translatedJson = `temp_i18n_${lang}_translated.json`;
        execSync(`translator-ai ${tempJson} -l ${lang} -o ${translatedJson}`);
        
        // Convert back
        await this.convertFromJson(translatedJson, outputFile, ext);
        
        // Cleanup
        await fs.remove(tempJson);
        await fs.remove(translatedJson);
        
        console.log(`  ✓ Created ${outputFile}`);
      }
    }
  }

  async translateContent() {
    console.log('\nTranslating content...');
    
    // Detect translation method
    const useContentDirs = await fs.pathExists('content/en');
    
    if (useContentDirs) {
      await this.translateContentByDirectory();
    } else {
      await this.translateContentByFilename();
    }
  }

  async translateContentByDirectory() {
    const files = glob.sync('content/en/**/*.md');
    
    for (const file of files) {
      const relativePath = path.relative('content/en', file);
      
      for (const lang of this.targetLanguages) {
        const targetFile = path.join('content', lang, relativePath);
        
        if (await fs.pathExists(targetFile)) continue;
        
        await this.translateMarkdownFile(file, targetFile, lang);
      }
    }
  }

  async translateContentByFilename() {
    const files = glob.sync('content/**/*.en.md');
    
    for (const file of files) {
      const baseName = file.replace('.en.md', '');
      
      for (const lang of this.targetLanguages) {
        const targetFile = `${baseName}.${lang}.md`;
        
        if (await fs.pathExists(targetFile)) continue;
        
        await this.translateMarkdownFile(file, targetFile, lang);
      }
    }
  }

  async translateMarkdownFile(sourceFile, targetFile, targetLang) {
    const content = await fs.readFile(sourceFile, 'utf8');
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontMatterMatch) {
      await fs.copy(sourceFile, targetFile);
      return;
    }
    
    const frontMatter = yaml.load(frontMatterMatch[1]);
    const body = content.substring(frontMatterMatch[0].length);
    
    // Translate front matter
    const translatable = this.extractTranslatableFields(frontMatter);
    const tempJson = `temp_content_${path.basename(sourceFile)}.json`;
    const translatedJson = `${tempJson}.translated`;
    
    await fs.writeJson(tempJson, translatable);
    execSync(`translator-ai ${tempJson} -l ${targetLang} -o ${translatedJson}`);
    
    const translated = await fs.readJson(translatedJson);
    Object.assign(frontMatter, translated);
    
    // Write translated file
    await fs.ensureDir(path.dirname(targetFile));
    const newContent = `---\n${yaml.dump(frontMatter)}---${body}`;
    await fs.writeFile(targetFile, newContent);
    
    // Cleanup
    await fs.remove(tempJson);
    await fs.remove(translatedJson);
    
    console.log(`  ✓ ${targetFile}`);
  }

  extractTranslatableFields(frontMatter) {
    const fields = ['title', 'description', 'summary', 'keywords', 'tags'];
    const translatable = {};
    
    fields.forEach(field => {
      if (frontMatter[field]) {
        translatable[field] = frontMatter[field];
      }
    });
    
    return translatable;
  }

  async convertToJson(inputFile, outputFile) {
    const ext = path.extname(inputFile);
    const content = await fs.readFile(inputFile, 'utf8');
    let data;
    
    if (ext === '.yaml' || ext === '.yml') {
      data = yaml.load(content);
    } else if (ext === '.toml') {
      // You'd need a TOML parser here
      throw new Error('TOML support not implemented in this example');
    }
    
    await fs.writeJson(outputFile, data, { spaces: 2 });
  }

  async convertFromJson(inputFile, outputFile, format) {
    const data = await fs.readJson(inputFile);
    let content;
    
    if (format === '.yaml' || format === '.yml') {
      content = yaml.dump(data, { 
        indent: 2, 
        lineWidth: -1,
        noRefs: true 
      });
    } else if (format === '.toml') {
      throw new Error('TOML support not implemented in this example');
    }
    
    await fs.writeFile(outputFile, content);
  }

  async updateConfig() {
    console.log('\nUpdating Hugo config...');
    
    const configFile = glob.sync('config.{yaml,yml,toml,json}')[0];
    if (!configFile) return;
    
    // This is a simplified example - you'd need to properly parse and update
    console.log('  ! Remember to update your config.yaml with language settings');
  }
}

// Run the translator
if (require.main === module) {
  const translator = new HugoTranslator(['es', 'fr', 'de']);
  translator.translateSite().catch(console.error);
}

module.exports = HugoTranslator;
```

#### Using with Hugo Modules

If you're using Hugo Modules, you can create a translation module:

```go
// go.mod
module github.com/yourusername/hugo-translator

go 1.19

require (
    github.com/yourusername/your-theme v1.0.0
)
```

Then in your `package.json`:

```json
{
  "scripts": {
    "translate": "node hugo-complete-translator.js",
    "translate:content": "node hugo-complete-translator.js --content-only",
    "translate:i18n": "node hugo-complete-translator.js --i18n-only",
    "build": "npm run translate && hugo"
  }
}
```

### Jekyll with YAML Front Matter

For Jekyll posts with YAML front matter:

```python
#!/usr/bin/env python3
# translate-jekyll-posts.py

import os
import yaml
import json
import subprocess
import frontmatter

def translate_jekyll_post(post_path, target_lang, output_dir):
    """Translate Jekyll post including front matter"""
    
    # Load post with front matter
    post = frontmatter.load(post_path)
    
    # Extract translatable front matter fields
    translatable = {
        'title': post.metadata.get('title', ''),
        'description': post.metadata.get('description', ''),
        'excerpt': post.metadata.get('excerpt', '')
    }
    
    # Save as JSON for translation
    with open('temp_meta.json', 'w', encoding='utf-8') as f:
        json.dump(translatable, f, ensure_ascii=False, indent=2)
    
    # Translate
    subprocess.run([
        'translator-ai',
        'temp_meta.json',
        '-l', target_lang,
        '-o', f'temp_meta_{target_lang}.json'
    ])
    
    # Load translations
    with open(f'temp_meta_{target_lang}.json', 'r', encoding='utf-8') as f:
        translations = json.load(f)
    
    # Update post metadata
    for key, value in translations.items():
        if value:  # Only update if translation exists
            post.metadata[key] = value
    
    # Add language to metadata
    post.metadata['lang'] = target_lang
    
    # Save translated post
    output_path = os.path.join(output_dir, os.path.basename(post_path))
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter.dumps(post))
    
    # Cleanup
    os.remove('temp_meta.json')
    os.remove(f'temp_meta_{target_lang}.json')

# Translate all posts
for lang in ['es', 'fr', 'de']:
    os.makedirs(f'_posts/{lang}', exist_ok=True)
    for post in os.listdir('_posts/en'):
        if post.endswith('.md'):
            translate_jekyll_post(
                f'_posts/en/{post}',
                lang,
                f'_posts/{lang}'
            )
```

### Tips for YAML/JSON Conversion

1. **Preserve formatting**: Use `js-yaml` with proper options to maintain YAML structure
2. **Handle special characters**: Ensure proper encoding (UTF-8) throughout
3. **Validate output**: Some YAML features (anchors, aliases) may need special handling
4. **Consider TOML**: For Hugo, you might also need to handle TOML config files

### Alternative: Direct YAML Support (Feature Request)

If you frequently work with YAML files, consider creating a wrapper script that handles conversion automatically, or request YAML support as a feature for translator-ai.

## Development

### Building from source

```bash
git clone https://github.com/DatanoiseTV/translator-ai.git
cd translator-ai
npm install
npm run build
```

### Testing locally

```bash
npm start -- test.json -l es -o output.json
```

## License

This project requires attribution for both commercial and non-commercial use. See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on [GitHub](https://github.com/DatanoiseTV/translator-ai/issues).

If you find this tool useful, consider supporting the development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://coff.ee/datanoisetv)