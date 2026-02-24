import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

export default function CampaignEditor({ assets }) {
    const [planet, setPlanet] = useState('serpulo');
    const [selectedSector, setSelectedSector] = useState(null);
    const [campaignData, setCampaignData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/api/campaign`)
            .then(res => res.json())
            .then(data => setCampaignData(data))
            .catch(console.error);
    }, []);

    const saveCampaign = useCallback(async (newData) => {
        setIsSaving(true);
        try {
            await fetch(`${API_BASE}/api/campaign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });
        } catch (e) {
            console.error(e);
        }
        setIsSaving(false);
    }, []);

    if (!campaignData) {
        return (
            <div style={{ padding: '2rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                Loading planetary data...
            </div>
        );
    }

    const activeData = campaignData[planet];
    const { sectors, layout: mapLayout } = activeData;

    const handleMapClick = (e) => {
        // Only trigger if clicking on the empty background, not over a node
        if (e.target.tagName !== 'svg' && e.target.tagName !== 'circle' || typeof e.target.className?.baseVal === 'string' && e.target.className.baseVal.includes('no-click')) return;

        // Find click coordinates relative to SVG
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newId = `sector-${Date.now().toString().slice(-4)}`;
        const newSector = { id: newId, name: 'New Sector', difficulty: 1, type: 'survival', unlockReq: [] };

        setCampaignData(prev => ({
            ...prev,
            [planet]: {
                sectors: [...prev[planet].sectors, newSector],
                layout: { ...prev[planet].layout, [newId]: { x, y } }
            }
        }));
        setSelectedSector(newSector);
    };

    const getDifficultyColor = (diff) => {
        if (diff <= 2) return '#4caf50'; // Easy
        if (diff <= 4) return '#8bc34a'; // Medium-Easy
        if (diff <= 6) return '#ffeb3b'; // Medium
        if (diff <= 8) return '#ff9800'; // Hard
        return '#f44336'; // Extreme
    };

    return (
        <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🗺️</span> Campaign Editor
                    </h1>
                    <p style={{ color: '#888', marginTop: '0.4rem', marginBottom: 0 }}>
                        Design the planetary sector progression and capture conditions.
                    </p>
                </div>

                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <button
                        onClick={() => { setPlanet('serpulo'); setSelectedSector(null); }}
                        style={{
                            padding: '10px 30px', background: planet === 'serpulo' ? '#222' : 'transparent',
                            border: 'none', borderRadius: '8px', color: planet === 'serpulo' ? '#f39c12' : '#888',
                            fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.1em'
                        }}
                    >
                        SERPULO
                    </button>
                    <button
                        onClick={() => { setPlanet('erekir'); setSelectedSector(null); }}
                        style={{
                            padding: '10px 30px', background: planet === 'erekir' ? '#222' : 'transparent',
                            border: 'none', borderRadius: '8px', color: planet === 'erekir' ? '#e74c3c' : '#888',
                            fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.1em'
                        }}
                    >
                        EREKIR
                    </button>
                </div>
            </header>

            <div style={{ flexGrow: 1, display: 'flex', gap: '2rem', height: 'calc(100% - 100px)' }}>
                {/* Visual Map Area */}
                <div style={{ flexGrow: 1, background: '#0a0a0f', border: '1px solid #2a2a35', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
                    {/* Background Grid */}
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

                    {/* Planet Wireframe Mockup */}
                    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} onClick={handleMapClick}>
                        <circle cx="50%" cy="50%" r="40%" fill="none" stroke={planet === 'serpulo' ? "rgba(243,156,18,0.15)" : "rgba(231,76,60,0.15)"} strokeWidth="2" strokeDasharray="10 10" className="no-click" />
                        <circle cx="50%" cy="50%" r="30%" fill="none" stroke={planet === 'serpulo' ? "rgba(0,188,212,0.05)" : "rgba(231,76,60,0.05)"} strokeWidth="1" className="no-click" />

                        {/* Draw connection lines */}
                        {sectors.map(sector =>
                            sector.unlockReq.map(reqId => {
                                const from = mapLayout[reqId];
                                const to = mapLayout[sector.id];
                                if (!from || !to) return null;
                                return (
                                    <line
                                        key={`${reqId}-${sector.id}`}
                                        x1={`${from.x}%`} y1={`${from.y}%`}
                                        x2={`${to.x}%`} y2={`${to.y}%`}
                                        stroke={selectedSector?.id === sector.id || selectedSector?.id === reqId ? '#00bcd4' : 'rgba(255,255,255,0.1)'}
                                        strokeWidth="2"
                                    />
                                );
                            })
                        )}

                        {/* Draw Nodes */}
                        {sectors.map(sector => {
                            const pos = mapLayout[sector.id];
                            const isSelected = selectedSector?.id === sector.id;
                            if (!pos) return null;
                            return (
                                <g
                                    key={sector.id}
                                    style={{ pointerEvents: 'auto', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onClick={() => setSelectedSector(sector)}
                                // Make selection area larger
                                >
                                    <circle
                                        cx={`${pos.x}%`} cy={`${pos.y}%`}
                                        r={isSelected ? 16 : 12}
                                        fill={isSelected ? '#111' : getDifficultyColor(sector.difficulty)}
                                        stroke={isSelected ? '#00bcd4' : 'rgba(0,0,0,0.5)'}
                                        strokeWidth={isSelected ? 3 : 1}
                                        style={{ transition: 'all 0.2s' }}
                                    />
                                    {isSelected && (
                                        <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r={20} fill="none" stroke="#00bcd4" strokeWidth="1" strokeDasharray="4 4">
                                            <animateTransform attributeName="transform" type="rotate" from={`0 ${pos.x}% ${pos.y}%`} to={`360 ${pos.x}% ${pos.y}%`} dur="5s" repeatCount="indefinite" />
                                        </circle>
                                    )}
                                    {/* Icon within inner circle */}
                                    <text x={`${pos.x}%`} y={`${pos.y}%`} textAnchor="middle" dominantBaseline="central" fontSize={isSelected ? 12 : 10} fill={isSelected ? getDifficultyColor(sector.difficulty) : '#111'} style={{ pointerEvents: 'none' }}>
                                        {sector.type === 'attack' ? '⚔' : '⛊'}
                                    </text>

                                    {/* Label */}
                                    <rect x={`calc(${pos.x}% - 40px)`} y={`calc(${pos.y}% + 18px)`} width="80" height="18" fill="rgba(0,0,0,0.7)" rx="4" />
                                    <text x={`${pos.x}%`} y={`calc(${pos.y}% + 30px)`} textAnchor="middle" fill="#ccc" fontSize="10px" style={{ pointerEvents: 'none' }}>
                                        {sector.name}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(20,20,28,0.8)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)' }}>
                        <div style={{ color: '#ccc', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>Difficulty Legend</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#888' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: getDifficultyColor(1) }}></span> Low</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#888' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: getDifficultyColor(3) }}></span> Medium</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#888' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: getDifficultyColor(8) }}></span> High</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#888' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: getDifficultyColor(10) }}></span> Extreme</div>
                    </div>
                </div>

                {/* Sector Properties Sidebar */}
                <div style={{ width: '300px', background: '#1a1a24', border: '1px solid #2a2a35', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {selectedSector ? (
                        <>
                            <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: getDifficultyColor(selectedSector.difficulty) }}>{selectedSector.type === 'attack' ? '⚔️' : '⛊'}</span>
                                {selectedSector.name}
                            </h2>
                            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1.5rem', fontFamily: 'monospace', background: '#111', padding: '4px 8px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                                sector-{selectedSector.id}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.3rem', fontWeight: 'bold' }}>Sector Name</label>
                                    <input
                                        type="text"
                                        value={selectedSector.name}
                                        onChange={(e) => updateSectorParam('name', e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '6px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.3rem', fontWeight: 'bold' }}>Map Type</label>
                                    <select
                                        value={selectedSector.type}
                                        onChange={(e) => updateSectorParam('type', e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '6px' }}
                                    >
                                        <option value="survival">Survival</option>
                                        <option value="attack">Attack</option>
                                        <option value="pvp">PvP</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.3rem', fontWeight: 'bold' }}>Threat Level (Difficulty)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input type="range" min="1" max="10" value={selectedSector.difficulty} onChange={(e) => updateSectorParam('difficulty', parseInt(e.target.value))} style={{ flexGrow: 1 }} />
                                        <span style={{ color: getDifficultyColor(selectedSector.difficulty), fontWeight: 'bold' }}>{selectedSector.difficulty}/10</span>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.3rem', fontWeight: 'bold' }}>Unlock Requirements</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {selectedSector.unlockReq.length > 0 ? selectedSector.unlockReq.map(req => (
                                            <div key={req} style={{ background: 'rgba(0, 188, 212, 0.1)', border: '1px solid rgba(0, 188, 212, 0.3)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#aaddff', display: 'flex', justifyContent: 'space-between' }}>
                                                Capture {sectors.find(s => s.id === req)?.name || req}
                                                <button onClick={() => updateSectorParam('unlockReq', selectedSector.unlockReq.filter(r => r !== req))} style={{ background: 'transparent', border: 'none', color: '#ff6666', cursor: 'pointer' }}>✖</button>
                                            </div>
                                        )) : <span style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>None (Starting Node)</span>}
                                        <button
                                            onClick={() => {
                                                const options = sectors.filter(s => s.id !== selectedSector.id && !selectedSector.unlockReq.includes(s.id));
                                                if (options.length > 0) updateSectorParam('unlockReq', [...selectedSector.unlockReq, options[0].id]);
                                            }}
                                            style={{ padding: '0.5rem', background: '#222', color: '#ccc', border: '1px dashed #444', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.5rem' }}>+ Add Requirement</button>
                                    </div>
                                </div>

                                <div>
                                    <button
                                        onClick={() => {
                                            if (!confirm('Are you sure you want to delete this sector?')) return;
                                            setCampaignData(prev => {
                                                const newSectors = prev[planet].sectors.filter(s => s.id !== selectedSector.id);
                                                const newLayout = { ...prev[planet].layout };
                                                delete newLayout[selectedSector.id];
                                                const newData = { ...prev, [planet]: { sectors: newSectors, layout: newLayout } };
                                                saveCampaign(newData);
                                                return newData;
                                            });
                                            setSelectedSector(null);
                                        }}
                                        style={{ padding: '0.8rem', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>DELETE SECTOR</button>
                                </div>

                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👆</div>
                            <p>Select a planetary sector from the map to edit its properties.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
