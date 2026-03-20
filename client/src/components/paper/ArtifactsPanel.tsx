type Props = {
  runId: string | null;
  artifacts: string[];
  artifactUrl: (file: string) => string;
  artifactZipUrl: string | null;
};

export function ArtifactsPanel({ runId, artifacts, artifactUrl, artifactZipUrl }: Props) {
  if (!runId || artifacts.length === 0) {
    return null;
  }

  return (
    <section style={{ background: '#1a1a2e', padding: 20, borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>Artifacts</h2>
      <div style={{ marginBottom: 16 }}>
        {artifacts.map((file) => (
          <div key={file} style={{ marginBottom: 8 }}>
            <a href={artifactUrl(file)} target="_blank" rel="noreferrer" style={{ color: '#8fb3ff' }}>
              {file}
            </a>
          </div>
        ))}
      </div>
      {artifactZipUrl ? (
        <a
          href={artifactZipUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #55A868 0%, #3d8e50 100%)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 10,
            fontWeight: 'bold'
          }}
        >
          Download artifacts.zip
        </a>
      ) : null}
    </section>
  );
}
