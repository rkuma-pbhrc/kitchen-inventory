import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

/**
 * Scanner component.
 * Renders a full-screen camera viewfinder.
 * Calls onResult(barcode) when a barcode is decoded.
 * Calls onError(message) on failure.
 */
export default function Scanner({ onResult, onError, active = true }) {
  const videoRef    = useRef(null);
  const readerRef   = useRef(null);
  const [status, setStatus]     = useState('initializing'); // initializing | scanning | error
  const [errorMsg, setErrorMsg] = useState('');
  const lastScan    = useRef(0); // debounce

  useEffect(() => {
    if (!active) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.listVideoInputDevices()
      .then(devices => {
        if (devices.length === 0) throw new Error('No camera found');

        // Prefer rear camera on mobile
        const rearCam = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        const deviceId = rearCam ? rearCam.deviceId : devices[devices.length - 1].deviceId;

        setStatus('scanning');
        return reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
          if (result) {
            const now = Date.now();
            if (now - lastScan.current < 2000) return; // 2s debounce
            lastScan.current = now;
            onResult(result.getText());
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn('Scanner error:', err.message);
          }
        });
      })
      .catch(err => {
        setStatus('error');
        const msg = err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err.message || 'Camera unavailable';
        setErrorMsg(msg);
        if (onError) onError(msg);
      });

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, [active]);

  return (
    <div style={{ position: 'relative', width: '100%', background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        playsInline
        muted
      />

      {/* Scanning overlay */}
      {status === 'scanning' && (
        <>
          {/* Corner brackets */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'relative', width: '65%', aspectRatio: '1' }}>
              {[['0','0','0','auto'], ['0','auto','0','0'], ['auto','0','auto','auto'], ['auto','auto','auto','0']].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: pos[0], left: pos[1], bottom: pos[2], right: pos[3],
                  width: 24, height: 24,
                  borderTop:    (i < 2) ? '3px solid #f0c040' : 'none',
                  borderBottom: (i >= 2) ? '3px solid #f0c040' : 'none',
                  borderLeft:   (i === 0 || i === 2) ? '3px solid #f0c040' : 'none',
                  borderRight:  (i === 1 || i === 3) ? '3px solid #f0c040' : 'none',
                }} />
              ))}
              {/* Scan line */}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #f0c040, transparent)',
                animation: 'scanLine 2s ease-in-out infinite',
                top: '50%',
              }} />
            </div>
          </div>
          <style>{`@keyframes scanLine { 0%,100%{top:15%;opacity:0} 50%{top:85%;opacity:1} }`}</style>
          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
            Point camera at a barcode
          </div>
        </>
      )}

      {/* Initializing */}
      {status === 'initializing' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#888' }}>
          <div className="spinner" />
          <span style={{ fontSize: '0.84rem' }}>Starting camera…</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 10 }}>
          <span style={{ fontSize: '2rem' }}>📷</span>
          <p style={{ fontSize: '0.84rem', color: '#e57373' }}>{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
