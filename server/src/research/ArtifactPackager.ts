import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

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

async function createZipArchive(runDir: string, zipPath: string): Promise<boolean> {
  const files = listFilesRecursive(runDir).filter(
    (relativePath) => relativePath !== 'artifacts.zip' && relativePath !== 'artifacts_manifest.json'
  );
  if (files.length === 0) {
    return false;
  }

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => resolve());
    output.on('error', (error: Error) => reject(error));
    archive.on('error', (error: Error) => reject(error));

    archive.pipe(output);

    for (const relativePath of files) {
      archive.file(path.join(runDir, relativePath), { name: relativePath });
    }

    void archive.finalize();
  });

  return fs.existsSync(zipPath);
}

export async function packageArtifacts(runDir: string): Promise<{ files: string[]; zipPath: string | null }> {
  const zipPath = path.join(runDir, 'artifacts.zip');
  let zipCreated = false;

  try {
    zipCreated = await createZipArchive(runDir, zipPath);
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
