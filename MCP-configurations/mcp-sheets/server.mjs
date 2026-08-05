#!/usr/bin/env node
/**
 * Google Sheets MCP Server
 * Authenticates as the user via OAuth2 — all writes appear under the user's name
 * in Google Sheets revision history.
 *
 * First run:  node server.mjs --auth
 * Normal use: configured in .mcp.json, called automatically by Claude Code
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import fs   from 'fs';
import path from 'path';
import http from 'http';
import url  from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDS_PATH = path.join(__dirname, 'credentials.json');

// ── OAuth2 helpers ────────────────────────────────────────────────────────────

function loadCredentials() {
  if (!fs.existsSync(CREDS_PATH)) {
    throw new Error(
      `credentials.json not found at ${CREDS_PATH}.\n` +
      'Download it from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.'
    );
  }
  const raw  = JSON.parse(fs.readFileSync(CREDS_PATH));
  const cred = raw.installed || raw.web;
  return {
    clientId:     cred.client_id,
    clientSecret: cred.client_secret,
    redirectUri:  'http://localhost:3456/oauth2callback',
  };
}

function buildOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = loadCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function authorize() {
  const auth = buildOAuth2Client();

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    auth.setCredentials(token);

    // Refresh if expired
    if (token.expiry_date && Date.now() > token.expiry_date - 60_000) {
      const { credentials } = await auth.refreshAccessToken();
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
      auth.setCredentials(credentials);
    }
    return auth;
  }

  throw new Error('Not authenticated. Run: node server.mjs --auth');
}

async function runAuthFlow() {
  const auth = buildOAuth2Client();
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
    prompt: 'consent',
  });

  console.log('\n─────────────────────────────────────────────────');
  console.log('Open this URL in your browser and log in:');
  console.log('\n' + authUrl + '\n');
  console.log('Waiting for callback on http://localhost:3456 ...');
  console.log('─────────────────────────────────────────────────\n');

  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const { query } = url.parse(req.url, true);
        if (!query.code) { res.end('No code received'); return; }

        const { tokens } = await auth.getToken(query.code);
        auth.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

        res.end('<html><body><h2>✅ Authenticated!</h2><p>You can close this tab and return to the terminal.</p></body></html>');
        server.close();
        console.log('✅ Token saved to token.json');
        resolve();
      } catch (e) {
        res.end('Error: ' + e.message);
        reject(e);
      }
    });
    server.listen(3456);
    server.on('error', reject);
  });
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

async function getSheets(auth) {
  return google.sheets({ version: 'v4', auth });
}

// ── Docs API helpers ──────────────────────────────────────────────────────────

async function getDocs(auth) {
  return google.docs({ version: 'v1', auth });
}

async function replaceDocContent(docs, documentId, text) {
  const doc = await docs.documents.get({ documentId });
  const endIndex = doc.data.body.content.at(-1).endIndex - 1;

  const requests = [];
  if (endIndex > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text } });

  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}

function a1(col, row) {
  let c = '';
  while (col > 0) {
    col--;
    c = String.fromCharCode(65 + (col % 26)) + c;
    col = Math.floor(col / 26);
  }
  return `${c}${row}`;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

async function main() {
  // Auth-only mode
  if (process.argv.includes('--auth')) {
    await runAuthFlow();
    process.exit(0);
  }

  let auth;
  try {
    auth = await authorize();
  } catch (e) {
    process.stderr.write('Auth error: ' + e.message + '\n');
    process.exit(1);
  }

  const server = new Server(
    { name: 'google-sheets', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // ── Tool: write_range ──────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'sheets_write_range',
        description: 'Write a 2D array of values to a Google Sheet range. Values appear under the authenticated user\'s name in revision history.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string', description: 'The spreadsheet ID from the URL' },
            range:         { type: 'string', description: 'A1 notation range, e.g. "Sheet1!A1:G10"' },
            values:        { type: 'array',  description: '2D array of cell values', items: { type: 'array' } },
          },
          required: ['spreadsheetId', 'range', 'values'],
        },
      },
      {
        name: 'sheets_clear_range',
        description: 'Clear a range in a Google Sheet.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string' },
            range:         { type: 'string' },
          },
          required: ['spreadsheetId', 'range'],
        },
      },
      {
        name: 'sheets_batch_update',
        description: 'Apply formatting, merges, validation, and conditional formatting rules to a Google Sheet using the batchUpdate API.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string' },
            requests:      { type: 'array', description: 'Array of batchUpdate request objects per Sheets API spec' },
          },
          required: ['spreadsheetId', 'requests'],
        },
      },
      {
        name: 'sheets_read_range',
        description: 'Read values from a Google Sheet range.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string' },
            range:         { type: 'string' },
          },
          required: ['spreadsheetId', 'range'],
        },
      },
      {
        name: 'sheets_get_metadata',
        description: 'Get spreadsheet metadata including sheet names, IDs, and grid properties.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string' },
          },
          required: ['spreadsheetId'],
        },
      },
      {
        name: 'docs_update_content',
        description: 'Replace the entire content of a Google Doc with new text. Use this to sync project context documents.',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: { type: 'string', description: 'The document ID from the Google Docs URL' },
            content:    { type: 'string', description: 'New full text content to write into the document' },
          },
          required: ['documentId', 'content'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const sheets = await getSheets(auth);

    try {
      if (name === 'sheets_write_range') {
        const res = await sheets.spreadsheets.values.update({
          spreadsheetId: args.spreadsheetId,
          range:         args.range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: args.values },
        });
        return { content: [{ type: 'text', text: `Updated ${res.data.updatedCells} cells in ${args.range}` }] };
      }

      if (name === 'sheets_clear_range') {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: args.spreadsheetId,
          range:         args.range,
        });
        return { content: [{ type: 'text', text: `Cleared ${args.range}` }] };
      }

      if (name === 'sheets_batch_update') {
        const res = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: { requests: args.requests },
        });
        return { content: [{ type: 'text', text: `batchUpdate applied — ${args.requests.length} request(s)` }] };
      }

      if (name === 'sheets_read_range') {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: args.spreadsheetId,
          range:         args.range,
        });
        return { content: [{ type: 'text', text: JSON.stringify(res.data.values || []) }] };
      }

      if (name === 'sheets_get_metadata') {
        const res = await sheets.spreadsheets.get({
          spreadsheetId: args.spreadsheetId,
          fields: 'sheets.properties',
        });
        const sheetList = res.data.sheets.map(s =>
          `${s.properties.title} (id=${s.properties.sheetId}, rows=${s.properties.gridProperties.rowCount})`
        ).join('\n');
        return { content: [{ type: 'text', text: sheetList }] };
      }

      if (name === 'docs_update_content') {
        const docs = await getDocs(auth);
        await replaceDocContent(docs, args.documentId, args.content);
        return { content: [{ type: 'text', text: `Document ${args.documentId} updated successfully` }] };
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };

    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(e => {
  process.stderr.write('Fatal: ' + e.message + '\n');
  process.exit(1);
});
