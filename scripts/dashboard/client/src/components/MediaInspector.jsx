import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

const MediaInspector = ({ onClose }) => {
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

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0a0a0a', zIndex: 1100, display: 'flex', flexDirection: 'column', fontFamily: '"Inter", sans-serif', color: '#e0e0e0' }}>
            <header style={{ padding: '1.5rem 2.5rem', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.8rem' }}>🎙️</span>
                        <h2 style={{ margin: 0, color: '#03a9f4', letterSpacing: '0.1em', fontWeight: 800 }}>MEDIA INSPECTOR</h2>
                    </div>
                    <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: '8px', padding: '0.3rem' }}>
                        <button
                            onClick={() => setTab('sounds')}
                            style={{ padding: '0.6rem 1.5rem', border: 'none', borderRadius: '6px', background: tab === 'sounds' ? '#03a9f4' : 'transparent', color: tab === 'sounds' ? 'white' : '#888', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                            SOUND ASSETS
                        </button>
                        <button
                            onClick={() => setTab('effects')}
                            style={{ padding: '0.6rem 1.5rem', border: 'none', borderRadius: '6px', background: tab === 'effects' ? '#03a9f4' : 'transparent', color: tab === 'effects' ? 'white' : '#888', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                            VISUAL EFFECTS
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder={`Search ${tab}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: '0.7rem 1.2rem', borderRadius: '8px', background: '#222', border: '1px solid #444', color: 'white', width: '300px', outline: 'none' }}
                    />
                    <button
                        onClick={onClose}
                        style={{ background: '#333', border: 'none', color: 'white', padding: '0.7rem 1.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.target.style.background = '#444'}
                        onMouseOut={(e) => e.target.style.background = '#333'}
                    >
                        EXIT
                    </button>
                </div>
            </header>

            <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flexGrow: 1, padding: '2rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', alignContent: 'start' }}>
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', color: '#666' }}>Initializing asset streams...</div>
                    ) : tab === 'sounds' ? (
                        filteredSounds.map((sound, i) => (
                            <div key={i} style={{ background: '#161616', padding: '1.2rem', borderRadius: '12px', border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s, border-color 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = '#03a9f4'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseOut={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'none' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '0.2rem', fontSize: '0.95rem' }}>{sound.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'monospace' }}>{sound.path}</div>
                                </div>
                                <audio controls style={{ width: '100%', height: '32px' }}>
                                    <source src={`${API_BASE}/sounds/${sound.path}`} type="audio/ogg" />
                                </audio>
                            </div>
                        ))
                    ) : (
                        filteredEffects.map((fx, i) => (
                            <div
                                key={i}
                                onClick={() => setSelectedFx(fx)}
                                style={{ background: '#161616', padding: '1.2rem', borderRadius: '12px', border: selectedFx?.name === fx.name ? '2px solid #03a9f4' : '1px solid #2a2a2a', cursor: 'pointer' }}
                            >
                                <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '0.4rem' }}>{fx.name}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: '#03a9f4' }}>Lifetime: {fx.lifetime}f</span>
                                    <span style={{ color: '#666' }}>{Math.round(fx.lifetime / 0.6) / 100}s</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {tab === 'effects' && selectedFx && (
                    <div style={{ width: '500px', background: '#111', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)' }}>
                        <div style={{ padding: '2rem', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#03a9f4' }}>{selectedFx.name}</h3>
                            <button onClick={() => setSelectedFx(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>
                        <div style={{ flexGrow: 1, padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Core Definition (Java)</div>
                            <pre style={{ background: '#080808', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222', fontSize: '0.85rem', color: '#4caf50', overflowX: 'auto', lineHeight: '1.5' }}>
                                {selectedFx.code}
                            </pre>
                            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(3, 169, 244, 0.05)', borderRadius: '8px', border: '1px solid rgba(3, 169, 244, 0.2)' }}>
                                <div style={{ color: '#03a9f4', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>INSPECTOR NOTE</div>
                                <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                                    This effect is defined using Mindustry's drawing DSL. Graphics are rendered frame-by-frame based on the `e.fin()` and `e.fout()` progress variables.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaInspector;
