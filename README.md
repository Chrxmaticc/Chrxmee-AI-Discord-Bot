# Chrxmee AI

## Overview

Chrxmee AI is a Discord bot that uses the Groq API to provide AI chat capabilities. The bot is built with Discord.js and offers slash commands for users to interact with AI features directly in Discord servers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Framework
- **Discord.js v14** handles all Discord interactions, including slash commands, message events, and gateway connections
- Commands are organized in a modular `/commands` folder structure
- Command registration is handled via `deploy-commands.js`

### Command Pattern
- Each command exports a `data` object (SlashCommandBuilder) and an `execute` function
- Commands are dynamically loaded at startup

### AI Integration
- **Groq API** is the backend for all AI functionality
- AI capability:
  - Text chat completions (`/ask` command) using the `llama-3.3-70b-versatile` model
- API calls use native `fetch` with Bearer token authentication

### Configuration
- Environment variables managed via `dotenv`:
  - `BOT_TOKEN` - Discord bot authentication token
  - `CLIENT_ID` - Discord application client ID
  - `GROQ_API_KEY` - Groq API key

## External Dependencies

### Third-Party Services
- **Discord API** - Bot platform
- **Groq API** - AI backend
  - Endpoint: `https://api.groq.com/openai/v1/chat/completions`

### NPM Packages
- `discord.js` (v14.25.1)
- `dotenv` (v16.6.1)

### Runtime Requirements
- Node.js >= 18.0.0
