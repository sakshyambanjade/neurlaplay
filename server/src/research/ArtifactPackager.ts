import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function listFilesRecursive(root: string, base: string = root): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(fullPath, base));
    } else {
      out.push(path.relative(base, fullPath));
    }
  }
  return out.sort();
}

export async function packageArtifacts(runDir: string): Promise<{ files: string[]; zipPath: string | null }> {
  const zipPath = path.join(runDir, 'artifacts.zip');
  let zipCreated = false;

  try {
    execSync(`powershell -Command "Compress-Archive -Path '${runDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
      stdio: 'ignore'
    });
    zipCreated = fs.existsSync(zipPath);
  } catch {
    zipCreated = false;
  }

  const files = listFilesRecursive(runDir);
  fs.writeFileSync(
    path.join(runDir, 'artifacts_manifest.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        files,
        zipPath: zipCreated ? zipPath : null
      },
      null,
      2
    )
  );

  return {
    files,
    zipPath: zipCreated ? zipPath : null
  };
}
