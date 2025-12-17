# Warp Agent SDK Demo - Sentry Issue Monitor

This demonstrates how you can use the [Warp Agent TypeScript SDK](https://github.com/warpdotdev/warp-sdk-typescript) to trigger an ambient agent from a Node.js server. This example listens for [Sentry](https://sentry.io) alerts and triggers a coding agent to fix the bug. 

## Prerequisites

You'll need to install the following tools to run both the monitor server and the `error-trigger` written in Golang:

- [Go](https://go.dev/doc/install) 1.21+ for the `error-trigger`
- [Node.js](https://nodejs.org/) 18+ for the monitor server
- [ngrok](https://ngrok.com/) to expose the monitor server as a Sentry webhook
- Sentry organization with admin access
- Warp API key ([create one here](https://docs.warp.dev/developers/cli#generating-api-keys))

## Initial Setup

First, install the dependencies for the `monitor` and the `error-trigger`:

**Monitor (TypeScript):**
```bash
cd monitor
npm install
```

**Error Trigger (Golang):**
```bash
cd error-trigger
go mod download
```

Then, you can verify that the `warp-agent-sdk` is able to connect by running the `test.js` script. This will start a coding agent and poll for a session link for you to interact with the agent as it is running.

You can [create a Warp API key](https://docs.warp.dev/developers/cli#generating-api-keys) and set as an environment variable in a `.env` file. Copy the example template like so:

```bash
cd monitor
cp .env.example .env
```

And set the `WARP_API_KEY` to the key you created.

Finally, run the test script and wait for a session link to be returned:

```bash
node --env-file=.env test.js
```

## Set up the Sentry integration

You will need to expose your dev server as a public URL, then configure an integration from Sentry.

### 1. Start the ngrok tunnel

This will expose your monitor server as a public URL for Sentry to forward alerts:

```bash
ngrok http 3000
```

Then, copy the forwarding URL (e.g., `https://abc123.ngrok-free.dev`) to configure in Sentry.

### 2. Configure Sentry

#### Create Internal Integration

1. Go to **Settings > Developer Settings > New Internal Integration**
2. Name: `Nil Pointer Monitor`
3. Webhook URL: `<your-ngrok-url>/sentry/webhook`
4. Enable **Alert Rule Action** toggle
5. Permissions: Read access to **Issue & Event**
6. Save and copy the **Client Secret**

#### Create Issue Alert Rule

1. Go to **Alerts > Create Alert > Issue Alert**
2. Select your project
3. Triggers: "A new issue is created" and "The issue changes state from resolved to unresolved"
4. Filter: The event's message value contains "nil pointer dereference"
5. Action: **Send a notification via [your integration name]**
6. Save rule

### 3. Configure environment

Update your `.env` file with the following values:

- `SENTRY_CLIENT_SECRET` - Client secret from Sentry internal integration (required)
- `PORT` - Server port to expose as a webhook (default: `3000`)

### 4. Run the server

```bash
cd monitor
npm run dev
```

### 5. Trigger an example error

Set the `SENTRY_DSN` environment variable to your Sentry project DSN (found in **Settings > Projects > [your project] > Client Keys**):

```bash
cd error-trigger
SENTRY_DSN=<your-dsn> go run script.go
```

This should trigger an alert in your Sentry dashboard, and ping `/sentry/webhook` in your Node.js server.

## Monitor endpoints

- `POST /sentry/webhook` - Sentry webhook receiver
- `GET /health` - Health check
