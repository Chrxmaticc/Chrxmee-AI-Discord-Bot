# Chrxmee AI

## Overview

Chrxmee AI is a Discord bot that wraps the Grok AI API (via x.ai) to provide AI chat and image generation capabilities. The bot is built with Discord.js and offers slash commands for users to interact with AI features directly in Discord servers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Framework
- **Discord.js v14** handles all Discord interactions, including slash commands, message events, and gateway connections
- Commands are organized in a modular `/commands` folder structure where each command is a separate file
- Command registration is handled separately via `deploy-commands.js` which registers commands globally with Discord's API

### Command Pattern
- Each command exports a `data` object (SlashCommandBuilder) and an `execute` function
- Commands are dynamically loaded at startup by scanning the commands directory
- The bot uses `Collection` from Discord.js to store command handlers for quick lookup

### AI Integration
- **Grok AI API** (x.ai) is the backend for all AI functionality
- Two main AI capabilities:
  - Text chat completions (`/ask` command) using the `grok-2-1212` model
  - Image generation (`/image-generate` command) using the `grok-2-vision-1212` model
- API calls use native `fetch` with Bearer token authentication
- All AI commands use `deferReply()` to handle API latency gracefully

### Configuration
- Environment variables managed via `dotenv`:
  - `BOT_TOKEN` - Discord bot authentication token
  - `CLIENT_ID` - Discord application client ID for command registration
  - `XAI_API_KEY` - Grok/x.ai API key for AI functionality

## External Dependencies

### Third-Party Services
- **Discord API** - Bot hosting and user interaction platform
- **x.ai API** - Grok AI backend for chat completions and image generation
  - Endpoint: `https://api.x.ai/v1/chat/completions` (text)
  - Endpoint: `https://api.x.ai/v1/images/generations` (images)

### NPM Packages
- `discord.js` (v14.25.1) - Discord bot framework
- `dotenv` (v16.6.1) - Environment variable management

### Runtime Requirements
- Node.js >= 18.0.0