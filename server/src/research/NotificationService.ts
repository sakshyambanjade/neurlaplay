import type { RunStatus } from './types/run.js';

type RunNotificationArgs = {
  status: RunStatus;
  runDir: string;
  artifactZipPath?: string | null;
};

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function notificationsConfigured(): boolean {
  return (
    trimEnv('RESEND_API_KEY').length > 0 &&
    trimEnv('RUN_NOTIFY_EMAIL_TO').length > 0
  );
}

function buildRunUrl(pathname: string): string | null {
  const baseUrl = trimEnv('APP_PUBLIC_URL').replace(/\/$/, '');
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl}${pathname}`;
}

function buildNotificationText(args: RunNotificationArgs): string {
  const { status, runDir, artifactZipPath } = args;
  const statusUrl = buildRunUrl(`/api/paper/status/${status.runId}`);
  const artifactsUrl = buildRunUrl(`/api/paper/artifacts/${status.runId}`);

  const lines = [
    `Run: ${status.runId}`,
    `State: ${status.step}`,
    `Progress: ${status.progress}/${status.total}`,
    `Started: ${status.startedAt}`,
    `Finished: ${status.finishedAt ?? 'n/a'}`,
    `Run directory: ${runDir}`
  ];

  if (status.error) {
    lines.push(`Error: ${status.error}`);
  }
  if (artifactZipPath) {
    lines.push(`Artifact zip: ${artifactZipPath}`);
  }
  if (statusUrl) {
    lines.push(`Status URL: ${statusUrl}`);
  }
  if (artifactsUrl) {
    lines.push(`Artifacts URL: ${artifactsUrl}`);
  }

  return lines.join('\n');
}

export async function sendRunNotification(args: RunNotificationArgs): Promise<boolean> {
  if (!notificationsConfigured()) {
    return false;
  }

  const apiKey = trimEnv('RESEND_API_KEY');
  const to = trimEnv('RUN_NOTIFY_EMAIL_TO');
  const from = trimEnv('RUN_NOTIFY_EMAIL_FROM') || 'NeuraPlay <onboarding@resend.dev>';
  const subjectPrefix = trimEnv('RUN_NOTIFY_SUBJECT_PREFIX') || '[NeuraPlay]';
  const state = args.status.done && !args.status.error ? 'completed' : 'failed';
  const subject = `${subjectPrefix} Run ${state}: ${args.status.runId}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: buildNotificationText(args)
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend notification failed (${response.status}): ${body}`);
  }

  return true;
}
