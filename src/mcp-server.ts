#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "translator-ai",
    version: "1.0.5",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "translate_json") {
    const { inputFile, targetLanguage, outputFile } = args as {
      inputFile: string;
      targetLanguage: string;
      outputFile: string;
    };
    
    try {
      // Build the command
      const provider = process.env.TRANSLATOR_PROVIDER || 'gemini';
      const cmd = `translator-ai "${inputFile}" -l ${targetLanguage} -o "${outputFile}" --provider ${provider}`;
      
      // Execute the command
      const { stdout, stderr } = await execAsync(cmd, {
        env: { ...process.env }
      });
      
      // Return success result
      return {
        content: [
          {
            type: "text",
            text: `Successfully translated ${inputFile} to ${targetLanguage}\nOutput saved to: ${outputFile}\n${stdout}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error translating file: ${error.message}\n${error.stderr || ''}`
          }
        ],
        isError: true
      };
    }
  }
  
  if (name === "translate_multiple") {
    const { pattern, targetLanguage, outputPattern, showStats = false } = args as {
      pattern: string;
      targetLanguage: string;
      outputPattern: string;
      showStats?: boolean;
    };
    
    try {
      // Build the command
      const statsFlag = showStats ? "--stats" : "";
      const provider = process.env.TRANSLATOR_PROVIDER || 'gemini';
      const cmd = `translator-ai ${pattern} -l ${targetLanguage} -o "${outputPattern}" ${statsFlag} --provider ${provider}`;
      
      // Execute the command
      const { stdout, stderr } = await execAsync(cmd, {
        env: { ...process.env }
      });
      
      // Return success result
      return {
        content: [
          {
            type: "text",
            text: stdout
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error translating files: ${error.message}\n${error.stderr || ''}`
          }
        ],
        isError: true
      };
    }
  }
  
  // Unknown tool
  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`
      }
    ],
    isError: true
  };
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "translate_json",
        description: "Translate a JSON i18n file to a target language using Google Gemini API with caching",
        inputSchema: {
          type: "object",
          properties: {
            inputFile: {
              type: "string",
              description: "Path to the source JSON file to translate"
            },
            targetLanguage: {
              type: "string",
              description: "Target language code (e.g., 'es' for Spanish, 'fr' for French, 'de' for German)"
            },
            outputFile: {
              type: "string",
              description: "Path where the translated file should be saved"
            }
          },
          required: ["inputFile", "targetLanguage", "outputFile"]
        }
      },
      {
        name: "translate_multiple",
        description: "Translate multiple JSON files with automatic deduplication to save API calls",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "File pattern or multiple files (e.g., 'locales/en/*.json' or 'file1.json file2.json')"
            },
            targetLanguage: {
              type: "string",
              description: "Target language code (e.g., 'es', 'fr', 'de')"
            },
            outputPattern: {
              type: "string",
              description: "Output pattern with variables: {dir} for directory, {name} for filename, {lang} for language"
            },
            showStats: {
              type: "boolean",
              description: "Show deduplication statistics and API call savings",
              default: false
            }
          },
          required: ["pattern", "targetLanguage", "outputPattern"]
        }
      }
    ]
  };
});

// Start the MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr so it doesn't interfere with MCP communication
  console.error("translator-ai MCP server running");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});