import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

const MediaInspector = ({ onClose, assets }) => {
    const [tab, setTab] = useState('sounds');
    const [search, setSearch] = useState('');
    const [sounds, setSounds] = useState([]);
    const [effects, setEffects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFx, setSelectedFx] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const endpoint = tab === 'sounds' ? '/api/media/sounds' : '/api/media/fx';
                const res = await fetch(`${API_BASE}${endpoint}`);
                const data = await res.json();
                if (tab === 'sounds') setSounds(data);
                else setEffects(data);
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        fetchData();
    }, [tab]);

    const filteredSounds = sounds.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.path.toLowerCase().includes(search.toLowerCase()));
    const filteredEffects = effects.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    const activeColor = tab === 'sounds' ? '#00b894' : '#0984e3';

    const highlightJava = (code) => {
        if (!code) return '';
        return code
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\b(public|private|protected|static|final|new|return|if|else|for|while|float|int|boolean|void|class)\b/g, '<span style="color: #ff9800; font-weight: bold;">$1</span>')
            .replace(/\b(Draw|Drawf|Fill|Lines|Angles|Mathf|Core|Pal|Interp|Color|Radials)\b/g, '<span style="color: #00cec9;">$1</span>')
            .replace(/("[^"]*")/g, '<span style="color: #7bed9f;">$1</span>')
            .replace(/(\b\d+\.?\d*f?\b)/g, '<span style="color: #fdcb6e;">$1</span>')
            .replace(/(\/\/.*)/g, '<span style="color: #636e72; font-style: italic;">$1</span>');
    };

    const getUsages = (soundName) => {
        if (!assets) return [];
        return assets.filter(a => {
            if (!a.properties) return false;
            return Object.values(a.properties).some(v =>
                typeof v === 'string' && v.includes(`Sounds.${soundName}`)
            );
        }).map(a => a.name || a.variableName || a.id);
    };

    // VFX Canvas Simulator Component
    const VfxCanvas = ({ code, lifetime }) => {
        const canvasRef = React.useRef(null);

        React.useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            let animationId;
            let startTime = performance.now();
            const durationMs = (lifetime / 60) * 1000;

            // Compile Java to JS
            let js = code
                .replace(/e\.fin\(\)/g, 'fin').replace(/e\.fout\(\)/g, 'fout').replace(/e\.fslope\(\)/g, 'fslope')
                .replace(/e\.x/g, 'cx').replace(/e\.y/g, 'cy')
                .replace(/([\d.]+)f/g, '$1')
                .replace(/Mathf\.sin\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '(Math.sin(($1)/($2)*Math.PI*2)*($3))')
                .replace(/Mathf\.random\(([^)]*)\)/g, '(Math.random())');

            const script = `
                const fout = 1 - fin;
                const fslope = fin < 0.5 ? fin * 2 : (1 - fin) * 2;
                
                const Lines = {
                    stroke: (w) => { ctx.lineWidth = w; },
                    circle: (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); },
                    lineAngle: (x, y, ang, len) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang*Math.PI/180)*len, y + Math.sin(ang*Math.PI/180)*len); ctx.stroke(); },
                    poly: (x, y, sides, radius, rot) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2); ctx.stroke(); }
                };
                const Fill = {
                    circle: (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); },
                    poly: (x, y, sides, radius, rot) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2); ctx.fill(); }
                };
                const Draw = {
                    color: (c1, c2, t) => { ctx.strokeStyle = '#e74c3c'; ctx.fillStyle = '#e74c3c'; },
                    alpha: (a) => { ctx.globalAlpha = a; }
                };
                const Drawf = {
                    tri: (x, y, w, l, rot) => { Lines.lineAngle(x, y, rot, l); }
                };
                const Pal = { bulletYellow: '#f1c40f', lancerLaser: '#8ab4f8' };
                const Color = { orange: '#e67e22', white: '#fff', gray: '#7f8c8d' };
                const Angles = { randLenVectors: (id, amount, len, cb) => { for(let i=0; i<Math.min(amount, 10); i++) { cb(cx + Math.cos(i)*len, cy + Math.sin(i)*len); } } };
                
                try { ${js} } catch(err) {}
            `;
            let drawFunc;
            try {
                drawFunc = new Function('ctx', 'fin', 'cx', 'cy', script);
            } catch (compileErr) {
                console.error("VFX Compile Error:", compileErr);
                drawFunc = () => { };
            }

            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            const render = (time) => {
                const elapsed = time - startTime;
                let fin = (elapsed % durationMs) / durationMs;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw grid
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                for (let i = 0; i < canvas.width; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
                for (let i = 0; i < canvas.height; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

                ctx.strokeStyle = '#fff';
                ctx.fillStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1;

                drawFunc(ctx, fin, cx, cy);

                animationId = requestAnimationFrame(render);
            };
            animationId = requestAnimationFrame(render);

            return () => cancelAnimationFrame(animationId);
        }, [code, lifetime]);

        return (
            <div style={{ position: 'relative', width: '100%', height: '200px', background: '#0a0a0f', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <canvas ref={canvasRef} width={400} height={200} style={{ width: '100%', height: '100%' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>LIVE PREVIEW</div>
            </div>
        );
    };

    return (
        <div style={{
            flexGrow: 1, height: '100%', display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", system-ui, sans-serif', color: '#e0e0e0',
            animation: 'fadeIn 0.3s ease'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideInRight { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .media-card { transition: all 0.3s; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); }
                .media-card:hover { transform: translateY(-4px); background: rgba(255, 255, 255, 0.05); }
                .media-tab { transition: all 0.3s; }
                .media-tab:hover:not(.active-tab) { background: rgba(255, 255, 255, 0.05) !important; color: #fff !important; }
                
                /* Custom Audio Player Styling */
                audio::-webkit-media-controls-panel { background-color: rgba(255, 255, 255, 0.05); }
                audio::-webkit-media-controls-play-button, audio::-webkit-media-controls-mute-button { filter: invert(1); opacity: 0.7; }
                audio::-webkit-media-controls-current-time-display, audio::-webkit-media-controls-time-remaining-display { color: #aaa; text-shadow: none; }
            `}</style>

            {/* Ambient Base Glow */}
            <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: '60vw', height: '40vh', borderRadius: '50%', background: `radial-gradient(ellipse, ${activeColor}15 0%, transparent 60%)`,
                pointerEvents: 'none', zIndex: 0, transition: 'background 0.5s'
            }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid #2a2a35', borderRadius: '12px', background: '#0a0a0f', margin: '0 30px 30px 30px' }}>
                <header style={{
                    padding: '20px 40px', borderBottom: '1px solid #2a2a35',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `linear-gradient(135deg, ${activeColor}, ${tab === 'sounds' ? '#00cec9' : '#74b9ff'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: `0 4px 15px ${activeColor}44` }}>
                                {tab === 'sounds' ? '🎙️' : '✨'}
                            </div>
                            <div>
                                <h2 style={{ margin: 0, color: '#fff', letterSpacing: '0.05em', fontWeight: 800, fontSize: '20px' }}>MEDIA INSPECTOR</h2>
                                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Analyze game assets instantly</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', background: '#1a1a24', borderRadius: '10px', padding: '4px', border: '1px solid #2a2a35' }}>
                            <button
                                className={`media-tab ${tab === 'sounds' ? 'active-tab' : ''}`}
                                onClick={() => setTab('sounds')}
                                style={{
                                    padding: '8px 20px', border: 'none', borderRadius: '8px',
                                    background: tab === 'sounds' ? '#222' : 'transparent',
                                    color: tab === 'sounds' ? '#fff' : '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                                    boxShadow: tab === 'sounds' ? '0 2px 10px rgba(0,0,0,0.2)' : 'none'
                                }}
                            >
                                Audio Assets
                            </button>
                            <button
                                className={`media-tab ${tab === 'effects' ? 'active-tab' : ''}`}
                                onClick={() => setTab('effects')}
                                style={{
                                    padding: '8px 20px', border: 'none', borderRadius: '8px',
                                    background: tab === 'effects' ? '#222' : 'transparent',
                                    color: tab === 'effects' ? '#fff' : '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                                    boxShadow: tab === 'effects' ? '0 2px 10px rgba(0,0,0,0.2)' : 'none'
                                }}
                            >
                                Visual Effects
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                            <input
                                type="text"
                                placeholder={`Filter ${tab}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    padding: '10px 15px 10px 35px', borderRadius: '8px', background: '#1a1a24',
                                    border: '1px solid #333', color: 'white', width: '280px', outline: 'none',
                                    fontSize: '14px', transition: 'border-color 0.3s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = activeColor}
                                onBlur={(e) => e.target.style.borderColor = '#333'}
                            />
                        </div>
                        {tab === 'sounds' && (
                            <button
                                onClick={() => {
                                    document.querySelectorAll('audio').forEach(a => {
                                        a.pause();
                                        a.currentTime = 0;
                                    });
                                }}
                                style={{
                                    background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', color: '#e74c3c',
                                    padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)'; e.currentTarget.style.color = '#ff7675' }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)'; e.currentTarget.style.color = '#e74c3c' }}
                                title="Stop All Audio"
                            >
                                ⏹️
                            </button>
                        )}
                    </div>
                </header>

                <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                    <div style={{
                        flexGrow: 1, padding: '30px 40px', overflowY: 'auto',
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', alignContent: 'start'
                    }}>
                        {loading ? (
                            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '20px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: activeColor, animation: 'spin 1s linear infinite' }} />
                                <div style={{ color: '#888', letterSpacing: '0.1em', fontSize: '12px', textTransform: 'uppercase' }}>Initializing Streams...</div>
                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                        ) : tab === 'sounds' ? (
                            filteredSounds.map((sound, i) => {
                                const usages = getUsages(sound.name);
                                return (
                                    <div key={i} className="media-card" style={{
                                        padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '15px'
                                    }} onMouseOver={(e) => e.currentTarget.style.borderColor = `${activeColor}66`} onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎵</div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sound.name}</div>
                                                <div style={{ fontSize: '12px', color: '#777', fontFamily: 'monospace', marginTop: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sound.path}</div>
                                            </div>
                                        </div>

                                        {usages.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 'bold' }}>Used By</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {usages.map((u, idx) => (
                                                        <span key={idx} style={{ background: 'rgba(0,184,148,0.15)', color: '#00cec9', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid rgba(0,184,148,0.3)' }}>{u}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '10px', marginTop: 'auto' }}>
                                            <audio controls style={{ width: '100%', height: '36px', outline: 'none' }}>
                                                <source src={`${API_BASE}/sounds/${sound.path}`} type="audio/ogg" />
                                            </audio>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            filteredEffects.map((fx, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedFx(fx)}
                                    className="media-card"
                                    style={{
                                        padding: '20px', borderRadius: '16px', cursor: 'pointer',
                                        border: selectedFx?.name === fx.name ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.05)',
                                        boxShadow: selectedFx?.name === fx.name ? `0 0 20px ${activeColor}33` : 'none',
                                        background: selectedFx?.name === fx.name ? `${activeColor}11` : 'rgba(255,255,255,0.03)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: activeColor }}>✦</div>
                                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>{fx.name}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 15px', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration (Frames)</span>
                                            <span style={{ color: activeColor, fontWeight: 'bold', fontSize: '14px' }}>{fx.lifetime}f</span>
                                        </div>
                                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time (Sec)</span>
                                            <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '14px' }}>{Math.round(fx.lifetime / 0.6) / 100}s</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        {/* Empty state padding */}
                        <div style={{ height: '20px' }} />
                    </div>

                    {tab === 'effects' && selectedFx && (
                        <div style={{
                            width: '450px', background: 'rgba(20, 20, 28, 0.8)', borderLeft: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(20px)'
                        }}>
                            <div style={{ padding: '25px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${activeColor}22`, color: activeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✦</div>
                                    <div>
                                        <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>{selectedFx.name}</h3>
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>Effect Inspector</div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedFx(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}>✕</button>
                            </div>

                            <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                <VfxCanvas code={selectedFx.code} lifetime={selectedFx.lifetime} />

                                <div>
                                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>Core Definition (Java)</div>
                                    <div style={{ background: '#0a0a0f', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: activeColor, opacity: 0.5 }} />
                                        <pre
                                            style={{ margin: 0, fontSize: '13px', color: '#7bb0ff', overflowX: 'auto', lineHeight: '1.6', fontFamily: '"Fira Code", "Consolas", monospace' }}
                                            dangerouslySetInnerHTML={{ __html: highlightJava(selectedFx.code) }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '30px', padding: '20px', background: `${activeColor}11`, borderRadius: '12px', border: `1px solid ${activeColor}33` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activeColor, fontSize: '12px', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <span>ℹ️</span> Rendering Context
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.5' }}>
                                        This effect is rendered using Mindustry's graphics DSL. The core graphics are drawn frame-by-frame based on the <code style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px' }}>e.fin()</code> (progress) and <code style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px' }}>e.fout()</code> (inverse progress) variables.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaInspector;
