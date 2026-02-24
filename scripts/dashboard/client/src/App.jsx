import React, { useState, useEffect } from 'react';
import TechTreeExplorer from './components/TechTreeExplorer';
import MediaInspector from './components/MediaInspector';
import SpritePreview from './components/SpritePreview';
import BulkEditModal from './components/BulkEditModal';
import AssetWizard from './components/AssetWizard';
import BalanceSimulator from './components/BalanceSimulator';
import LogicWorkspace from './components/LogicWorkspace';
import CampaignEditor from './components/CampaignEditor';

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
    const [activeView, setActiveView] = useState('home'); // 'home', 'assets', 'techtree', 'media'
    const [teamColor, setTeamColor] = useState('#ffa500'); // Default Sharded orange
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulkStats, setBulkStats] = useState({});
    const [showWizard, setShowWizard] = useState(false);

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

    const openFolder = async (spritePath) => {
        try {
            await fetch(`${API_BASE}/api/open-folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spritePath })
            });
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleGenerateAsset = async (data) => {
        setLoading(true);
        setProgressMsg(`Generating ${data.id}...`);
        try {
            const res = await fetch(`${API_BASE}/api/assets/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                if (data.parentId) {
                    setProgressMsg(`Adding ${data.id} to Tech Tree...`);
                    await fetch(`${API_BASE}/api/techtree/update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            planet: data.planet, // Assumed to be passed securely from Wizard now
                            action: 'add',
                            node: data.id,
                            parentId: data.parentId
                        })
                    });
                }
                setMessage(`Success: ${result.message}`);
                fetchAssets(); // Refresh list
            } else {
                setMessage(`Error: ${result.error}`);
            }
        } catch (err) {
            setMessage(`Failed to generate asset: ${err.message}`);
        }
        setLoading(false);
    };
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === filteredAssets.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAssets.map(a => a.id || a.variableName)));
        }
    };

    const saveBulk = async () => {
        setLoading(true);
        setProgressMsg('Applying mass changes...');
        const updates = Array.from(selectedIds).map(id => {
            const asset = assets.find(a => (a.id || a.variableName) === id);
            return {
                id: asset.id,
                sourceFile: asset.sourceFile,
                stats: bulkStats
            };
        });

        try {
            const res = await fetch(`${API_BASE}/api/assets/bulk-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
            const data = await res.json();
            if (data.success) {
                setMessage(`Successfully updated ${data.modified} assets across ${data.files} files.`);
                setSelectedIds(new Set());
                setShowBulkEdit(false);
                setBulkStats({});
                fetchAssets();
            }
        } catch (err) {
            setMessage('Error applying bulk updates: ' + err.message);
        }
        setLoading(false);
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
        setLoading(true);
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
        setLoading(false);
    };

    const deployMod = async () => {
        setLoading(true);
        setMessage('Packaging mod... compiling assets and scripts.');
        try {
            const res = await fetch(`${API_BASE}/api/deploy-mod`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'engine-db-export',
                    displayName: 'Engine DB Custom Mod',
                    author: 'Creator',
                    description: 'A mod automatically packaged by the Engine DB Platform.',
                    version: '1.0',
                    minGameVersion: '146'
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessage(`Deploy complete! ${data.message}`);
            } else {
                setMessage('Deploy failed: ' + data.error);
            }
        } catch (err) {
            setMessage('Deploy failed: ' + err.message);
        }
        setLoading(false);
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
            (a.variableName && a.variableName.toLowerCase().includes(search.toLowerCase())) ||
            (a.name && a.name.toLowerCase().includes(search.toLowerCase()));
        return matchesType && matchesSubCat && matchesSearch;
    });

    const NavItem = ({ icon, label, viewId }) => (
        <li
            onClick={() => setActiveView(viewId)}
            style={{
                padding: '12px 15px',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '8px',
                backgroundColor: activeView === viewId ? 'rgba(255,152,0,0.1)' : 'transparent',
                color: activeView === viewId ? '#ff9800' : '#888',
                fontWeight: activeView === viewId ? 'bold' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s',
                border: activeView === viewId ? '1px solid rgba(255,152,0,0.3)' : '1px solid transparent'
            }}
            onMouseOver={e => { if (activeView !== viewId) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' } }}
            onMouseOut={e => { if (activeView !== viewId) { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'transparent' } }}
        >
            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
            <span style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>{label}</span>
        </li>
    );

    return (
        <div style={{ padding: '0', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0a0a0f', color: 'white', height: '100vh', display: 'flex', overflow: 'hidden' }}>
            <style>{`
                ::-webkit-scrollbar { width: 10px; height: 10px; }
                ::-webkit-scrollbar-track { background: rgba(20, 20, 28, 0.4); border-left: 1px solid rgba(255,255,255,0.02); }
                ::-webkit-scrollbar-thumb { background: rgba(255, 152, 0, 0.2); border-radius: 5px; border: 2px solid rgba(20, 20, 28, 1); transition: background 0.2s; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255, 152, 0, 0.5); }
                ::-webkit-scrollbar-corner { background: rgba(20, 20, 28, 0.4); }
                
                * { scrollbar-width: thin; scrollbar-color: rgba(255, 152, 0, 0.3) rgba(20, 20, 28, 0.4); }
            `}</style>

            {/* Master Navigation Sidebar */}
            <nav style={{ width: '220px', backgroundColor: '#14141c', borderRight: '1px solid #2a2a35', padding: '1.5rem', flexShrink: 0, display: 'flex', flexDirection: 'column', zIndex: 50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3rem' }}>
                    <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #ff9800, #d35400)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 4px 15px rgba(255,152,0,0.4)' }}>
                        ⚙️
                    </div>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '14px', letterSpacing: '0.05em', color: '#fff' }}>MINDUSTRY</div>
                        <div style={{ fontSize: '10px', color: '#ff9800', letterSpacing: '0.1em', fontWeight: 'bold' }}>ENGINE DB</div>
                    </div>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, flexGrow: 1 }}>
                    <NavItem icon="🏠" label="Dashboard" viewId="home" />
                    <NavItem icon="📦" label="Asset Database" viewId="assets" />
                    <NavItem icon="🌳" label="Tech Progression" viewId="techtree" />
                    <NavItem icon="🎙️" label="Media & FX" viewId="media" />
                    <NavItem icon="⚖️" label="Balance Simulator" viewId="balance" />
                    <NavItem icon="💻" label="Logic Workspace" viewId="logic" />
                    <NavItem icon="🗺️" label="Campaign Editor" viewId="campaign" />
                </ul>

                <button
                    onClick={runRepack}
                    style={{
                        padding: '12px', background: 'rgba(255, 152, 0, 0.1)', color: '#ff9800', border: '1px solid rgba(255, 152, 0, 0.3)',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        transition: 'all 0.2s', marginTop: 'auto'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 152, 0, 0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                    <span>⚡</span> Compile Pack
                </button>
            </nav>

            {/* Contextual Sidebar (Only for Assets view) */}
            {activeView === 'assets' && (
                <nav style={{ width: '240px', backgroundColor: '#1a1a24', borderRight: '1px solid #2a2a35', padding: '1.5rem 1rem', flexShrink: 0, overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', paddingLeft: '0.8rem' }}>Filters</div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {types.map(t => (
                            <li
                                key={t}
                                onClick={() => { setFilter(t); setBlockSubFilter(''); }}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    marginBottom: '4px',
                                    backgroundColor: filter === t ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    fontWeight: filter === t ? 'bold' : 'normal',
                                    color: filter === t ? '#fff' : '#888',
                                    fontSize: '13px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={e => { if (filter !== t) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                                onMouseOut={e => { if (filter !== t) e.currentTarget.style.background = 'transparent' }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{typeIcons[t] || '📦'}</span>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </span>
                                <span style={{ fontSize: '10px', color: filter === t ? '#aaa' : '#555', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '10px' }}>{typeCounts[t] || 0}</span>
                            </li>
                        ))}
                        {filter === 'block' && blockSubCats.length > 0 && (
                            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                <div style={{ fontSize: '0.7rem', color: '#666', padding: '0 0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Sub-categories</div>
                                <li
                                    onClick={() => setBlockSubFilter('')}
                                    style={{ padding: '6px 12px 6px 24px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: !blockSubFilter ? '#fff' : '#666', background: !blockSubFilter ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                                >All Blocks</li>
                                {blockSubCats.map(sc => (
                                    <li key={sc}
                                        onClick={() => setBlockSubFilter(sc)}
                                        style={{ padding: '6px 12px 6px 24px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: blockSubFilter === sc ? '#fff' : '#666', background: blockSubFilter === sc ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                                    >{sc}</li>
                                ))}
                            </div>
                        )}
                    </ul>
                </nav>
            )}

            {/* Main Content Area */}
            <main style={{ flexGrow: 1, overflowX: 'hidden', overflowY: 'auto' }}>
                {activeView === 'home' && (
                    <div style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', textShadow: '0 2px 10px rgba(255,152,0,0.3)' }}>Welcome to Engine DB</h1>
                        <p style={{ color: '#888', fontSize: '1.1rem', marginBottom: '3rem' }}>Centralized asset management and game logic creator.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                            {/* Stat Card 1 */}
                            <div style={{ background: 'linear-gradient(145deg, #1a1a24, #14141c)', padding: '2rem', borderRadius: '16px', border: '1px solid #2a2a35', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Total Assets</div>
                                <div style={{ fontSize: '3rem', fontWeight: '900', color: '#fff' }}>{assets.length}</div>
                            </div>

                            {/* Stat Card 2 */}
                            <div style={{ background: 'linear-gradient(145deg, #1a1a24, #14141c)', padding: '2rem', borderRadius: '16px', border: '1px solid #2a2a35', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Sprite Binding</div>
                                <div style={{ fontSize: '3rem', fontWeight: '900', color: summary.withSprites === summary.total ? '#4caf50' : '#ff9800' }}>
                                    {Math.round((summary.withSprites / Math.max(1, summary.total)) * 100)}%
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>{summary.withSprites} out of {summary.total} matched</div>
                            </div>

                            {/* Stat Card 3 */}
                            <div style={{ background: 'linear-gradient(145deg, #1a1a24, #14141c)', padding: '2rem', borderRadius: '16px', border: '1px solid #2a2a35', borderBottom: orphans.length > 0 ? '4px solid #f44336' : '1px solid #2a2a35', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Orphaned Sprites</div>
                                <div style={{ fontSize: '3rem', fontWeight: '900', color: orphans.length > 0 ? '#f44336' : '#888' }}>{orphans.length}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>Unused sprite files in repo</div>
                            </div>
                        </div>

                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#ddd' }}>Quick Actions</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            <button
                                onClick={() => setShowWizard(true)}
                                style={{
                                    padding: '2rem', background: '#1a1a24', border: '1px solid #2a2a35', borderRadius: '12px',
                                    color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s',
                                    display: 'flex', flexDirection: 'column', gap: '1rem'
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.borderColor = '#00b894' }}
                                onMouseOut={e => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = '#2a2a35' }}
                            >
                                <div style={{ fontSize: '2rem' }}>✨</div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#00b894', marginBottom: '0.5rem' }}>Create New Asset</div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>Launch the boilerplate wizard to rapidly generate new blocks and units.</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setActiveView('techtree')}
                                style={{
                                    padding: '2rem', background: '#1a1a24', border: '1px solid #2a2a35', borderRadius: '12px',
                                    color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s',
                                    display: 'flex', flexDirection: 'column', gap: '1rem'
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.borderColor = '#ff9800' }}
                                onMouseOut={e => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = '#2a2a35' }}
                            >
                                <div style={{ fontSize: '2rem' }}>🌳</div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#ff9800', marginBottom: '0.5rem' }}>Edit Tech Tree</div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>Visualize and modify the progression graph for game modes.</div>
                                </div>
                            </button>

                            <button
                                onClick={deployMod}
                                style={{
                                    padding: '2rem', background: '#1a1a24', border: '1px solid #2a2a35', borderRadius: '12px',
                                    color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s',
                                    display: 'flex', flexDirection: 'column', gap: '1rem'
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.borderColor = '#9c27b0' }}
                                onMouseOut={e => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = '#2a2a35' }}
                            >
                                <div style={{ fontSize: '2rem' }}>🚀</div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#9c27b0', marginBottom: '0.5rem' }}>Deploy Mod</div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>Package all assets and scripts into a ready-to-play Mindustry mod.</div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {activeView === 'assets' && (
                    <div style={{ padding: '2rem' }}>
                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Asset Database</h1>
                                <p style={{ color: '#666', marginTop: '0.4rem' }}>Managing {filteredAssets.length} filtered assets</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button
                                    onClick={() => setShowAudit(!showAudit)}
                                    style={{ padding: '0.8rem 1.2rem', backgroundColor: showAudit ? '#ff9800' : '#222', color: 'white', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                    {showAudit ? 'Grid View' : 'Audit Mode'}
                                </button>
                                <button
                                    onClick={() => setShowWizard(true)}
                                    style={{ padding: '0.8rem 1.2rem', backgroundColor: '#00b894', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    + New Asset
                                </button>
                                <input
                                    type="text"
                                    placeholder="Search name or ID..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a24', color: 'white', width: '250px' }}
                                />
                                <select
                                    value={selectedLocale}
                                    onChange={(e) => setSelectedLocale(e.target.value)}
                                    style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a24', color: 'white', cursor: 'pointer' }}
                                >
                                    {locales.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a1a24', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #333' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#888' }}>Team:</span>
                                    <input
                                        type="color"
                                        value={teamColor}
                                        onChange={(e) => setTeamColor(e.target.value)}
                                        style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </header>

                        {selectedIds.size > 0 && (
                            <div style={{ position: 'sticky', top: '1rem', zIndex: 100, background: '#111', border: '1px solid #ff9800', padding: '1rem 2rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ fontWeight: 'bold', color: '#ff9800', fontSize: '1.1rem' }}>{selectedIds.size} Assets Selected</span>
                                    <button onClick={selectAll} style={{ background: 'transparent', border: '1px solid #444', color: '#ff9800', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                        {selectedIds.size === filteredAssets.length ? 'Deselect All' : 'Select All Filtered'}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button onClick={() => setShowBulkEdit(true)} style={{ background: '#ff9800', color: 'black', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', letterSpacing: '0.05em' }}>
                                        ⚖️ BULK EDIT BALANCER
                                    </button>
                                    <button onClick={() => setSelectedIds(new Set())} style={{ background: '#333', color: 'white', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                </div>
                                <style>{`@keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                            </div>
                        )}

                        {message && <div style={{ padding: '1rem', background: '#333', borderRadius: '4px', marginBottom: '1rem', borderLeft: '4px solid #ff9800' }}>{message}</div>}

                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1.5rem' }}>
                                <div style={{ width: '32px', height: '32px', border: '3px solid #333', borderTop: '3px solid #ff9800', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#ff9800', fontSize: '0.95rem', fontWeight: 'bold', margin: 0 }}>{progressMsg}</p>
                            </div>
                        ) : showAudit ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {/* Audit Table: Bindings */}
                                <div style={{ background: '#1a1a24', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2a35' }}>
                                    <h2 style={{ marginBottom: '1rem', color: '#ff9800', fontSize: '1.2rem' }}>Java Variable Bindings</h2>
                                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Comparing Java variable declarations to their matched filesystem sprites.</p>
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
                                                            background: a.spritePath ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                                                            color: a.spritePath ? '#4caf50' : '#f44336',
                                                            border: a.spritePath ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(244, 67, 54, 0.3)'
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
                                <div style={{ background: '#1a1a24', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2a35' }}>
                                    <h2 style={{ marginBottom: '1rem', color: '#f44336', fontSize: '1.2rem' }}>Orphaned Sprites</h2>
                                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Sprites in the filesystem that are NOT matched to any Java variable.</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                        {orphans.map(o => (
                                            <div key={o.path}
                                                onClick={() => openFolder(o.path)}
                                                style={{ background: '#111', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #222', cursor: 'pointer', transition: 'border-color 0.2s' }}
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
                                    <div key={asset.variableName + asset.sourceFile} style={{ background: '#1a1a24', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2a35', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                                        <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f14', borderRadius: '8px', marginBottom: '1.5rem', position: 'relative', border: '1px solid #222' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(asset.id || asset.variableName)}
                                                onChange={() => toggleSelect(asset.id || asset.variableName)}
                                                style={{ position: 'absolute', top: '10px', left: '10px', width: '20px', height: '20px', cursor: 'pointer', zIndex: 10 }}
                                            />
                                            <SpritePreview
                                                asset={asset}
                                                teamColor={teamColor}
                                                size="120px"
                                            />
                                            <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#333', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', color: '#888' }}>{asset.category}</span>
                                        </div>

                                        <div style={{ flexGrow: 1 }}>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <h3 style={{ margin: 0, color: asset.isVariableOnly ? '#f44336' : '#ff9800' }} title={asset.variableName}>
                                                    {asset.name || asset.variableName}
                                                </h3>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                                                    <code style={{ fontSize: '0.75rem', color: '#666' }}>ID: {asset.id || '(null)'}</code>
                                                    <span style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic' }}>{asset.variableName}</span>
                                                </div>
                                                {asset.description && (
                                                    <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.8rem', fontStyle: 'italic', lineHeight: '1.4', background: '#111', padding: '0.5rem', borderRadius: '4px', border: '1px solid #222' }}>
                                                        {asset.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ fontSize: '0.75rem', color: '#888', background: '#111', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #222' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                    <span>Resolution:</span>
                                                    <input
                                                        type="text"
                                                        defaultValue={asset.dimensions?.width ? `${asset.dimensions.width}x${asset.dimensions.height}` : ''}
                                                        placeholder="WxH"
                                                        onChange={(e) => handleStatChange(asset.id || asset.variableName, '_resolution', e.target.value)}
                                                        style={{ width: '80px', background: '#1a1a24', border: '1px solid #333', color: '#bbb', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.75rem', textAlign: 'right' }}
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
                                                        <div style={{ marginBottom: '0.6rem', padding: '0.5rem', background: 'rgba(52, 152, 219, 0.05)', borderRadius: '6px', border: '1px solid rgba(52, 152, 219, 0.2)' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#3498db', fontWeight: 'bold', marginBottom: '0.4rem' }}>⚙️ Requirements</div>
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
                                                            <div style={{ fontSize: '0.7rem', color: '#e74c3c', fontWeight: 'bold', marginBottom: '0.4rem' }}>🔥 Ammo Types ({asset.properties._ammo.length})</div>
                                                            {asset.properties._ammo.map((ammo, ai) => (
                                                                <details key={ai} style={{ marginBottom: '0.3rem', background: 'rgba(231, 76, 60, 0.05)', borderRadius: '5px', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
                                                                    <summary style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', color: '#e74c3c', fontWeight: 'bold' }}>
                                                                        {ammo.source}
                                                                        <span style={{ fontWeight: 'normal', color: '#888', marginLeft: '0.5rem', fontSize: '0.65rem' }}>{ammo.bulletType}</span>
                                                                        {ammo.props.damage && <span style={{ float: 'right', color: '#ff6666', fontSize: '0.65rem' }}>DMG: {ammo.props.damage}</span>}
                                                                    </summary>
                                                                    <div style={{ padding: '0.4rem 0.6rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                                                        {Object.entries(ammo.props).map(([pk, pv]) => (
                                                                            <div key={pk}>
                                                                                <label style={{ display: 'block', fontSize: '0.6rem', color: '#666' }}>{pk.replace(/([A-Z])/g, ' $1')}</label>
                                                                                <input type="text" defaultValue={pv}
                                                                                    onChange={(e) => handleStatChange(asset.id || asset.variableName, `_ammo_${ai}_${pk}`, e.target.value)}
                                                                                    style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#ddd', padding: '0.2rem', borderRadius: '3px', fontSize: '0.7rem' }} />
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
                                                                        style={{ width: '100%', background: '#111', border: '1px solid #333', color: 'white', padding: '0.3rem', borderRadius: '4px', marginTop: '0.15rem', fontSize: '0.75rem', transition: 'border-color 0.2s' }}
                                                                        onFocus={e => e.target.style.borderColor = '#ff9800'}
                                                                        onBlur={e => e.target.style.borderColor = '#333'}
                                                                    />
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
                                                style={{ flexGrow: 1, padding: '0.6rem', background: editingStats[asset.id || asset.variableName] ? '#4caf50' : '#2a2a35', border: 'none', borderRadius: '6px', color: 'white', cursor: editingStats[asset.id || asset.variableName] ? 'pointer' : 'default', fontSize: '0.8rem', fontWeight: 'bold', transition: 'background 0.2s' }}
                                            >
                                                Save
                                            </button>
                                            <label style={{ flexGrow: 1, padding: '0.6rem', border: '1px solid #333', borderRadius: '6px', color: '#888', textAlign: 'center', cursor: 'pointer', fontSize: '0.8rem', transition: 'background 0.2s, color 0.2s' }}
                                                onMouseOver={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff' }}
                                                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
                                            >
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
                                                    style={{ padding: '0.6rem', border: '1px solid #333', borderRadius: '6px', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.8rem', transition: 'background 0.2s' }}
                                                    title="Reveal sprite in file explorer"
                                                    onMouseOver={e => e.currentTarget.style.background = '#222'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                >📂</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeView === 'techtree' && (
                    <TechTreeExplorer assets={assets} />
                )}

                {activeView === 'media' && (
                    <MediaInspector assets={assets} />
                )}

                {activeView === 'balance' && (
                    <BalanceSimulator assets={assets} />
                )}

                {activeView === 'logic' && (
                    <LogicWorkspace assets={assets} />
                )}

                {activeView === 'campaign' && (
                    <CampaignEditor assets={assets} />
                )}
            </main>

            <BulkEditModal
                isOpen={showBulkEdit}
                onClose={() => setShowBulkEdit(false)}
                onApply={(stats) => {
                    setBulkStats(stats);
                    saveBulk();
                    setShowBulkEdit(false);
                }}
            />

            <AssetWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                onGenerate={handleGenerateAsset}
            />
        </div>
    );
}


export default App;
