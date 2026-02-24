import React, { useState } from 'react';

export default function LogicWorkspace({ assets }) {
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [code, setCode] = useState('// Select an asset to start scripting\n\n');
    const [syntaxError, setSyntaxError] = useState(null);

    const logicCapableAssets = assets.filter(a => a.type === 'logicBlock' || a.type === 'messageBlock' || a.type === 'microProcessor' || a.type === 'logicProcessor' || a.type === 'hyperProcessor' || a.type === 'itemTurret' || a.type === 'powerTurret' || a.type === 'unit');

    const handleCodeChange = (e) => {
        const val = e.target.value;
        setCode(val);
        // Simple mock validation
        if (val.includes('error')) {
            setSyntaxError('Syntax Error: Invalid instruction at line 4.');
        } else {
            setSyntaxError(null);
        }
    };

    return (
        <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>💻</span> Logic Workspace
                </h1>
                <p style={{ color: '#888', marginTop: '0.4rem' }}>
                    Write custom overarching game logic or unit behaviors (Mock IDE).
                </p>
            </header>

            <div style={{ flexGrow: 1, display: 'flex', gap: '2rem', height: 'calc(100% - 100px)' }}>
                {/* Asset Sidebar */}
                <div style={{ width: '250px', background: '#1a1a24', border: '1px solid #2a2a35', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#ffcc00', fontSize: '1rem' }}>Scriptable Assets</h3>
                    <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {logicCapableAssets.length > 0 ? logicCapableAssets.map(a => (
                            <button
                                key={a.id || a.variableName}
                                onClick={() => {
                                    setSelectedAsset(a);
                                    setCode(`// Logic script for ${a.name || a.id}\n// Run with processor attached.\n\nprint("Hello World")\njump 0 always`);
                                }}
                                style={{
                                    padding: '10px', background: selectedAsset?.id === (a.id || a.variableName) ? 'rgba(255,204,0,0.2)' : 'rgba(255,255,255,0.05)',
                                    color: selectedAsset?.id === (a.id || a.variableName) ? '#ffcc00' : '#ccc', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    textAlign: 'left', fontSize: '0.85rem', transition: 'all 0.2s', borderLeft: selectedAsset?.id === (a.id || a.variableName) ? '3px solid #ffcc00' : '3px solid transparent'
                                }}
                                onMouseOver={e => { if (selectedAsset?.id !== (a.id || a.variableName)) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                                onMouseOut={e => { if (selectedAsset?.id !== (a.id || a.variableName)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                            >
                                {a.name || a.id}
                            </button>
                        )) : (
                            <div style={{ color: '#666', fontSize: '0.85rem' }}>No processors or scriptable units found.</div>
                        )}
                    </div>
                </div>

                {/* Editor Area */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: '#14141c', border: '1px solid #2a2a35', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ background: '#1a1a24', padding: '10px 15px', borderBottom: '1px solid #2a2a35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontFamily: 'monospace', color: '#aaddff', fontSize: '0.9rem' }}>
                            {selectedAsset ? `${selectedAsset.id}.mlog` : 'untitled.mlog'}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button disabled={!selectedAsset} style={{ padding: '6px 15px', background: '#4caf50', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 'bold', cursor: selectedAsset ? 'pointer' : 'not-allowed', opacity: selectedAsset ? 1 : 0.5 }}>Compile</button>
                            <button disabled={!selectedAsset} style={{ padding: '6px 15px', background: '#2a2a35', border: '1px solid #444', borderRadius: '4px', color: '#ddd', cursor: selectedAsset ? 'pointer' : 'not-allowed', opacity: selectedAsset ? 1 : 0.5 }}>Save</button>
                        </div>
                    </div>
                    <div style={{ flexGrow: 1, position: 'relative' }}>
                        <textarea
                            value={code}
                            onChange={handleCodeChange}
                            disabled={!selectedAsset}
                            spellCheck={false}
                            style={{
                                width: '100%', height: '100%', background: 'transparent', color: '#eee', border: 'none', padding: '15px',
                                fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: '0.9rem', resize: 'none', outline: 'none',
                                lineHeight: '1.5'
                            }}
                            placeholder="Select an asset to begin writing Logic instructions..."
                        />
                        {syntaxError && (
                            <div style={{ position: 'absolute', bottom: 15, left: 15, right: 15, background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244,67,54,0.5)', padding: '10px', borderRadius: '6px', color: '#ff6666', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span>❌</span> {syntaxError}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
