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
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(16,18,23,0.96) 0%, rgba(12,14,18,0.94) 100%)',
        padding: 24,
        borderRadius: 24,
        border: '1px solid rgba(147, 163, 184, 0.12)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.32)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18
        }}
      >
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#b39a70' }}>
            Archive
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 28, letterSpacing: '-0.05em' }}>Run Output</h2>
        </div>
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            background: 'rgba(243, 182, 77, 0.12)',
            color: '#f3c575',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1
          }}
        >
          {artifacts.length} files
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 18
        }}
      >
        {artifacts.map((file) => (
          <a
            key={file}
            href={artifactUrl(file)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              padding: '14px 16px',
              borderRadius: 16,
              background: 'linear-gradient(180deg, rgba(19,22,29,0.98) 0%, rgba(13,15,20,0.98) 100%)',
              color: '#dce4ef',
              textDecoration: 'none',
              border: '1px solid rgba(243, 182, 77, 0.08)'
            }}
          >
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#b39a70', marginBottom: 6 }}>
              File
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>
              {file}
            </div>
          </a>
        ))}
      </div>
      {artifactZipUrl ? (
        <a
          href={artifactZipUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            padding: '14px 22px',
            background: 'linear-gradient(135deg, #f3b64d 0%, #d38b2f 100%)',
            color: '#111317',
            textDecoration: 'none',
            borderRadius: 16,
            fontWeight: 800,
            boxShadow: '0 18px 36px rgba(0, 0, 0, 0.28)'
          }}
        >
          Download artifacts.zip
        </a>
      ) : null}
    </section>
  );
}
