import WarpAPI from 'warp-agent-sdk';

const client = new WarpAPI({
  apiKey: process.env['WARP_API_KEY'], // This is the default and can be omitted
  baseURL: process.env['BASE_URL'], // Not needed; this video is being recorded against our staging server :)
});

const response = await client.agent.run({
  prompt: `
  
You are a helpful assistant that can fix bugs in code.
A nil pointer dereference occurred.
Message:
runtime.errorString: runtime error: invalid memory address or nil pointer dereference
Stacktrace:
{
"frames": [
{
"abs_path": "/Users/benjamin/Projects/warp-ambient-agent-demos/sentry-monitor/error-trigger/script.go",
"addr_mode": null,
"colno": null,
"context_line": "\t_ = *p // nil pointer dereference",
"data": {
"client_in_app": true
},
"errors": null,
"filename": "/Users/benjamin/Projects/warp-ambient-agent-demos/sentry-monitor/error-trigger/script.go",
"function": "main",
"image_addr": null,
"in_app": true,
"instruction_addr": null,
"lineno": 22,
"lock": null,
"module": "main",
"package": null,
"platform": null,
"post_context": [
"}",
""
],
"pre_context": [
"\tdefer sentry.Flush(2 * time.Second)",
"",
"\tdefer sentry.Recover()",
"",
"\tvar p *int"
],
"raw_function": null,
"source_link": null,
"symbol": null,
"symbol_addr": null,
"trust": null,
"vars": null
}
]
}
Please analyze the stacktrace and suggest a fix.
  `,
  config: {
    environment_id: 'IbSjYlAGaBhR3dbsutY8Rj'
  }
});

console.log(`Agent started. Task ID: ${response.task_id}`);

// Poll until task reaches a terminal state or has session_link
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;
const startTime = Date.now();
const PENDING_STATES = ['QUEUED', 'PENDING', 'CLAIMED', 'INPROGRESS'];

let task = await client.agent.tasks.retrieve(response.task_id);
while (PENDING_STATES.includes(task.state) && !task.session_link && Date.now() - startTime < POLL_TIMEOUT_MS) {
  console.log(`Polling... state: ${task.state}`);
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  task = await client.agent.tasks.retrieve(response.task_id);
}

console.log(`Agent state: ${task.state}`);

if (task.state === 'FAILED') {
  console.log(`Error: ${task.status_message?.message || 'Task failed with no message'}`);
} else if (task.session_link) {
  console.log(`View agent session: ${task.session_link}`);
}
