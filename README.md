# Search Funds

Give it a link of a company and it will spin up 3 AI Agents to search the web, and compile a P.E style report for you.

## Prerequisites

Copy `.env.example` to `.env` and add your Anthropic API key:

```bash
cp .env.example .env
```

## Run

```bash
bun install
bun dev
```

For WebSocket server:

```bash
bun run dev:ws
```

## To Use

Find the link of a SMB or Mid-Market business that you want our agent to generate a report of and paste it into the text box.

Answers will take 5-20 minutes.
