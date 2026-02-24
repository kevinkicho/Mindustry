import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

function App() {
    const [assets, setAssets] = useState([]);
    const [summary, setSummary] = useState({ total: 0, withSprites: 0 });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [progressMsg, setProgressMsg] = useState('Connecting...');
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [editingStats, setEditingStats] = useState({});
    const [showAudit, setShowAudit] = useState(false);
    const [orphans, setOrphans] = useState([]);
    const [blockSubFilter, setBlockSubFilter] = useState('');
    const [locales, setLocales] = useState(['en']);
    const [selectedLocale, setSelectedLocale] = useState('en');

    useEffect(() => {
        fetchLocales();
        fetchAssets();
    }, [selectedLocale]);

    const fetchLocales = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/locales`);
            const data = await res.json();
            if (Array.isArray(data)) setLocales(data);
        } catch (e) { console.error('Failed to fetch locales', e); }
    };

    const fetchAssets = () => {
        setLoading(true);
        setProgressMsg('Connecting...');
        const es = new EventSource(`${API_BASE}/api/assets-stream?locale=${selectedLocale}`);
        es.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                setProgressMsg(data.message);
            } else if (data.type === 'done') {
                setAssets(data.assets || []);
                setSummary(data.summary || { total: 0, withSprites: 0 });
                setOrphans(data.orphans || []);
                setLoading(false);
                es.close();
            } else if (data.type === 'error') {
                setMessage('Error: ' + data.message);
                setLoading(false);
                es.close();
            }
        };
        es.onerror = () => {
            setMessage('Connection lost. Is the server running?');
            setLoading(false);
            es.close();
        };
    };

    const openFolder = (spritePath) => {
        fetch(`${API_BASE}/api/open-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spritePath })
        });
    };

    const handleStatChange = (id, key, value) => {
        setEditingStats(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                [key]: value
            }
        }));
    };

    const saveStats = async (asset) => {
        const stats = editingStats[asset.id];
        if (!stats) return;

        setMessage(`Saving stats for ${asset.id}...`);
        try {
            const res = await fetch(`${API_BASE}/api/update-stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: asset.id,
                    sourceFile: asset.sourceFile,
                    stats
                }),
            });
            if (res.ok) {
                setMessage(`Success! Stats updated for ${asset.id}.`);
                setTimeout(() => setMessage(''), 3000);
                fetchAssets(); // Refresh
            }
        } catch (err) {
            setMessage('Save failed: ' + err.message);
        }
    };

    const handleFileChange = async (asset, file) => {
        const formData = new FormData();
        formData.append('sprite', file);
        formData.append('targetPath', asset.spritePath || `${asset.id}.png`);

        setMessage(`Replacing ${asset.id}...`);
        try {
            const res = await fetch(`${API_BASE}/api/replace-sprite`, {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                setMessage(`Success! Replaced ${asset.id}.`);
                setTimeout(() => setMessage(''), 3000);
                fetchAssets();
            }
        } catch (err) {
            setMessage('Upload failed: ' + err.message);
        }
    };

    const runRepack = async () => {
        setMessage('Repacking sprites... this may take a minute.');
        try {
            const res = await fetch(`${API_BASE}/api/repack`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setMessage('Repack complete! Changes applied to game.');
            } else {
                setMessage('Repack failed: ' + data.error);
            }
        } catch (err) {
            setMessage('Repack failed: ' + err.message);
        }
    };

    const typeIcons = { block: '🧱', item: '💎', unit: '⚔️', liquid: '💧', effect: '✨', weather: '🌦️', planet: '🪐', sector: '📍' };
    const types = ['All', ...new Set(assets.map(a => a.type || 'block'))].sort();
    const typeCounts = {};
    assets.forEach(a => { const t = a.type || 'block'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
    typeCounts['All'] = assets.length;
    // Block sub-categories
    const blockSubCats = [...new Set(assets.filter(a => (a.type || 'block') === 'block' && a.subCategory).map(a => a.subCategory))].sort();
    const filteredAssets = assets.filter(a => {
        const matchesType = filter === 'All' || (a.type || 'block') === filter;
        const matchesSubCat = !blockSubFilter || (a.subCategory === blockSubFilter);
        const matchesSearch = (a.id && a.id.toLowerCase().includes(search.toLowerCase())) ||
            (a.variableName && a.variableName.toLowerCase().includes(search.toLowerCase()));
        return matchesType && matchesSubCat && matchesSearch;
    });

    return (
        <div style={{ padding: '0', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#121212', color: 'white', minHeight: '100vh', display: 'flex' }}>
            {/* Sidebar */}
            <nav style={{ width: '240px', backgroundColor: '#1a1a1a', borderRight: '1px solid #333', padding: '2rem 1rem', position: 'sticky', top: 0, height: '100vh', flexShrink: 0, overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#ff9800' }}>Asset Types</h2>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {types.map(t => (
                        <li
                            key={t}
                            onClick={() => { setFilter(t); setBlockSubFilter(''); }}
                            style={{
                                padding: '0.7rem 0.8rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginBottom: '0.3rem',
                                backgroundColor: filter === t ? '#333' : 'transparent',
                                fontWeight: filter === t ? 'bold' : 'normal',
                                color: filter === t ? '#ff9800' : '#888',
                                fontSize: '0.9rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span>{typeIcons[t] || '📦'} {t.charAt(0).toUpperCase() + t.slice(1)}</span>
                            <span style={{ fontSize: '0.7rem', color: '#555', background: '#222', padding: '2px 6px', borderRadius: '10px' }}>{typeCounts[t] || 0}</span>
                        </li>
                    ))}
                    {filter === 'block' && blockSubCats.length > 0 && (
                        <>
                            <li style={{ fontSize: '0.7rem', color: '#555', padding: '0.6rem 0.8rem 0.2rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub-categories</li>
                            <li
                                onClick={() => setBlockSubFilter('')}
                                style={{ padding: '0.4rem 0.8rem 0.4rem 1.4rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: !blockSubFilter ? '#ff9800' : '#666', background: !blockSubFilter ? '#2a2a2a' : 'transparent' }}
                            >All Blocks</li>
                            {blockSubCats.map(sc => (
                                <li key={sc}
                                    onClick={() => setBlockSubFilter(sc)}
                                    style={{ padding: '0.4rem 0.8rem 0.4rem 1.4rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: blockSubFilter === sc ? '#ff9800' : '#666', background: blockSubFilter === sc ? '#2a2a2a' : 'transparent' }}
                                >{sc}</li>
                            ))}
                        </>
                    )}
                </ul>
            </nav>

            {/* Main Content */}
            <main style={{ flexGrow: 1, padding: '2rem', overflowX: 'hidden' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Mindustry Asset Dashboard</h1>
                        <p style={{ color: '#666', marginTop: '0.4rem' }}>
                            Managing {assets.length} assets
                            <span style={{ marginLeft: '1rem', color: summary.withSprites === summary.total ? '#4caf50' : '#ff9800', fontWeight: 'bold' }}>
                                Sprites matched: {summary.withSprites} / {summary.total}
                            </span>
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        <button
                            onClick={() => setShowAudit(!showAudit)}
                            style={{ padding: '0.8rem 1.2rem', backgroundColor: showAudit ? '#ff9800' : '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            {showAudit ? 'View Dash' : 'Audit Mode'}
                        </button>
                        <input
                            type="text"
                            placeholder="Search name or ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', width: '220px' }}
                        />
                        <button
                            onClick={runRepack}
                            style={{ padding: '0.8rem 1.5rem', backgroundColor: '#ff9800', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Repack
                        </button>
                        <select
                            value={selectedLocale}
                            onChange={(e) => setSelectedLocale(e.target.value)}
                            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer' }}
                        >
                            {locales.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                        </select>
                    </div>
                </header>

                {message && <div style={{ padding: '1rem', background: '#333', borderRadius: '4px', marginBottom: '1rem', borderLeft: '4px solid #ff9800' }}>{message}</div>}

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1.5rem' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid #333', borderTop: '3px solid #ff9800', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: '#ff9800', fontSize: '0.95rem', fontWeight: 'bold', margin: 0 }}>{progressMsg}</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : showAudit ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Audit Table: Bindings */}
                        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333' }}>
                            <h2 style={{ marginBottom: '1rem', color: '#ff9800' }}>Java Variable Bindings</h2>
                            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Comparing Java variable declarations to their matched filesystem sprites.</p>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #333', color: '#888' }}>
                                        <th style={{ padding: '0.8rem' }}>Java Variable</th>
                                        <th style={{ padding: '0.8rem' }}>String ID</th>
                                        <th style={{ padding: '0.8rem' }}>Status</th>
                                        <th style={{ padding: '0.8rem' }}>Matched Sprite</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssets.map(a => (
                                        <tr key={a.variableName + a.sourceFile} style={{ borderBottom: '1px solid #222' }}>
                                            <td style={{ padding: '0.8rem' }}>
                                                <div style={{ fontWeight: 'bold' }}>{a.name || a.variableName}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#555' }}>{a.variableName}</div>
                                            </td>
                                            <td style={{ padding: '0.8rem', color: '#888' }}><code>{a.id || '(null)'}</code></td>
                                            <td style={{ padding: '0.8rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    background: a.spritePath ? '#1b5e20' : '#b71c1c',
                                                    color: 'white'
                                                }}>
                                                    {a.spritePath ? 'BOUND' : 'UNMATCHED'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.8rem', color: '#666' }}>
                                                {a.spritePath ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <img src={`${API_BASE}/sprites/${a.spritePath}`} style={{ width: '16px', height: '16px', imageRendering: 'pixelated' }} />
                                                        {a.matchedName}.png
                                                    </div>
                                                ) : '---'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Audit Table: Orphans */}
                        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333' }}>
                            <h2 style={{ marginBottom: '1rem', color: '#f44336' }}>Orphaned Sprites</h2>
                            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Sprites in the filesystem that are NOT matched to any Java variable.</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                {orphans.map(o => (
                                    <div key={o.path}
                                        onClick={() => openFolder(o.path)}
                                        style={{ background: '#111', padding: '0.8rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #222', cursor: 'pointer', transition: 'border-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#f44336'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
                                    >
                                        <img src={`${API_BASE}/sprites/${o.path}`} style={{ width: '32px', height: '32px', imageRendering: 'pixelated', marginBottom: '0.5rem' }} />
                                        <div style={{ fontSize: '0.7rem', color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }}>{o.name}</div>
                                        <div style={{ fontSize: '0.6rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.2rem' }} title={o.path}>{o.path}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                        {filteredAssets.map((asset) => (
                            <div key={asset.variableName + asset.sourceFile} style={{ background: '#1e1e1e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: '8px', marginBottom: '1.5rem', position: 'relative' }}>
                                    {asset.spritePath ? (
                                        <img
                                            src={`${API_BASE}/sprites/${asset.spritePath}`}
                                            alt={asset.id}
                                            style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', imageRendering: 'pixelated' }}
                                        />
                                    ) : <div style={{ textAlign: 'center' }}>
                                        <p style={{ color: '#666', margin: 0 }}>No Sprite Found</p>
                                        <small style={{ color: '#444', fontSize: '0.65rem' }}>Attempts: {asset.variableName}, {asset.id}</small>
                                    </div>}
                                    <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#333', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', color: '#888' }}>{asset.category}</span>
                                </div>

                                <div style={{ flexGrow: 1 }}>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <h3 style={{ margin: 0, color: asset.isVariableOnly ? '#f44336' : '#ff9800' }} title={asset.variableName}>
                                            {asset.name || asset.variableName}
                                        </h3>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                                            <code style={{ fontSize: '0.75rem', color: '#555' }}>ID: {asset.id || '(null)'}</code>
                                            <span style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic' }}>{asset.variableName}</span>
                                        </div>
                                        {asset.description && (
                                            <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.8rem', fontStyle: 'italic', lineHeight: '1.4', background: '#151515', padding: '0.5rem', borderRadius: '4px' }}>
                                                {asset.description}
                                            </p>
                                        )}
                                    </div>

                                    <div style={{ fontSize: '0.75rem', color: '#888', background: '#151515', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #222' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                            <span>Resolution:</span>
                                            <input
                                                type="text"
                                                defaultValue={asset.dimensions?.width ? `${asset.dimensions.width}x${asset.dimensions.height}` : ''}
                                                placeholder="WxH"
                                                onChange={(e) => handleStatChange(asset.id || asset.variableName, '_resolution', e.target.value)}
                                                style={{ width: '80px', background: '#111', border: '1px solid #222', color: '#bbb', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.75rem', textAlign: 'right' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                            <span>Matched Name:</span>
                                            <span style={{ color: '#bbb' }}>{asset.matchedName || 'N/A'}</span>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <span style={{ color: '#555' }}>Path: </span>
                                            <span title={asset.spritePath || 'N/A'} style={{ fontSize: '0.65rem' }}>{asset.spritePath || '---'}</span>
                                        </div>
                                    </div>

                                    {/* Properties */}
                                    {asset.properties && Object.keys(asset.properties).length > 0 && (
                                        <div style={{ marginTop: '0.8rem' }}>
                                            {/* Editable Requirements */}
                                            {Array.isArray(asset.properties._requirements) && asset.properties._requirements.length > 0 && (
                                                <div style={{ marginBottom: '0.6rem', padding: '0.5rem', background: '#1a1a2e', borderRadius: '6px', border: '1px solid #2a2a4e' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#7eb8da', fontWeight: 'bold', marginBottom: '0.4rem' }}>⚙️ Requirements</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.4rem' }}>
                                                        {asset.properties._requirements.map((req, ri) => (
                                                            <div key={ri} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                                                <input type="text" defaultValue={req.item}
                                                                    onChange={(e) => handleStatChange(asset.id || asset.variableName, `_req_${ri}_item`, e.target.value)}
                                                                    style={{ width: '60%', background: '#111', border: '1px solid #333', color: '#7eb8da', padding: '0.25rem', borderRadius: '3px', fontSize: '0.7rem' }}
                                                                    title="Mineral" />
                                                                <input type="number" defaultValue={req.count}
                                                                    onChange={(e) => handleStatChange(asset.id || asset.variableName, `_req_${ri}_count`, e.target.value)}
                                                                    style={{ width: '40%', background: '#111', border: '1px solid #333', color: '#aaddff', padding: '0.25rem', borderRadius: '3px', fontSize: '0.7rem', textAlign: 'right' }}
                                                                    title="Cost" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Ammo Cases */}
                                            {Array.isArray(asset.properties._ammo) && asset.properties._ammo.length > 0 && (
                                                <div style={{ marginBottom: '0.6rem' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#da7e7e', fontWeight: 'bold', marginBottom: '0.4rem' }}>🔥 Ammo Types ({asset.properties._ammo.length})</div>
                                                    {asset.properties._ammo.map((ammo, ai) => (
                                                        <details key={ai} style={{ marginBottom: '0.3rem', background: '#1e1515', borderRadius: '5px', border: '1px solid #3a2222' }}>
                                                            <summary style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', color: '#e8a0a0', fontWeight: 'bold' }}>
                                                                {ammo.source}
                                                                <span style={{ fontWeight: 'normal', color: '#666', marginLeft: '0.5rem', fontSize: '0.65rem' }}>{ammo.bulletType}</span>
                                                                {ammo.props.damage && <span style={{ float: 'right', color: '#ff6666', fontSize: '0.65rem' }}>DMG: {ammo.props.damage}</span>}
                                                            </summary>
                                                            <div style={{ padding: '0.4rem 0.6rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                                                {Object.entries(ammo.props).map(([pk, pv]) => (
                                                                    <div key={pk}>
                                                                        <label style={{ display: 'block', fontSize: '0.6rem', color: '#666' }}>{pk.replace(/([A-Z])/g, ' $1')}</label>
                                                                        <input type="text" defaultValue={pv}
                                                                            onChange={(e) => handleStatChange(asset.id || asset.variableName, `_ammo_${ai}_${pk}`, e.target.value)}
                                                                            style={{ width: '100%', background: '#111', border: '1px solid #2a2222', color: '#ddd', padding: '0.2rem', borderRadius: '3px', fontSize: '0.7rem' }} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    ))}
                                                </div>
                                            )}
                                            {/* General Properties */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                {Object.entries(asset.properties)
                                                    .filter(([k]) => !k.startsWith('_'))
                                                    .slice(0, 14)
                                                    .map(([key, val]) => (
                                                        <div key={key}>
                                                            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</label>
                                                            <input type="text" defaultValue={val}
                                                                onChange={(e) => handleStatChange(asset.id || asset.variableName, key, e.target.value)}
                                                                style={{ width: '100%', background: '#111', border: '1px solid #222', color: 'white', padding: '0.3rem', borderRadius: '4px', marginTop: '0.15rem', fontSize: '0.75rem' }} />
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        disabled={!editingStats[asset.id || asset.variableName] || !asset.id}
                                        onClick={() => saveStats(asset)}
                                        style={{ flexGrow: 1, padding: '0.6rem', background: editingStats[asset.id || asset.variableName] ? '#4caf50' : '#333', border: 'none', borderRadius: '4px', color: 'white', cursor: editingStats[asset.id || asset.variableName] ? 'pointer' : 'default', fontSize: '0.8rem' }}
                                    >
                                        Save
                                    </button>
                                    <label style={{ flexGrow: 1, padding: '0.6rem', border: '1px solid #333', borderRadius: '4px', color: '#888', textAlign: 'center', cursor: 'pointer', fontSize: '0.8rem' }}>
                                        Upload
                                        <input
                                            type="file"
                                            accept="image/png"
                                            onChange={(e) => handleFileChange(asset, e.target.files[0])}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    {asset.spritePath && (
                                        <button
                                            onClick={() => openFolder(asset.spritePath)}
                                            style={{ padding: '0.6rem', border: '1px solid #333', borderRadius: '4px', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}
                                            title="Reveal sprite in file explorer"
                                        >📂</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
