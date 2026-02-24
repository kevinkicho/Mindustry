import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

const AssetWizard = ({ isOpen, onClose, onGenerate }) => {
    const [step, setStep] = useState(0);
    const [type, setType] = useState('wall');
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [stats, setStats] = useState({ health: 400, cost: 50 });
    const [planet, setPlanet] = useState('serpulo');
    const [parentId, setParentId] = useState('');
    const [nodes, setNodes] = useState([]);

    const types = [
        { id: 'wall', label: 'Simple Wall', icon: '🛡️', color: '#4a90e2', desc: 'Basic defensive structures' },
        { id: 'itemTurret', label: 'Item Turret', icon: '🔫', color: '#e24a4a', desc: 'Shoots items as ammo' },
        { id: 'powerTurret', label: 'Power Turret', icon: '⚡', color: '#f5a623', desc: 'Uses power to attack' },
        { id: 'generator', label: 'Generator', icon: '⚙️', color: '#7ed321', desc: 'Produces base power' },
        { id: 'unit', label: 'Unit Type', icon: '🤖', color: '#bd10e0', desc: 'Mobile entity/mech' }
    ];

    useEffect(() => {
        if (isOpen) {
            fetchNodes();
        } else {
            // Reset state correctly when closed
            setStep(0);
            setId('');
            setName('');
            setStats({ health: 400, cost: 50 });
            setParentId('');
            setPlanet('serpulo');
        }
    }, [isOpen, planet]);

    const fetchNodes = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/techtree?planet=${planet}`);
            const data = await res.json();
            setNodes(data || []);
        } catch (e) {
            console.error('Failed to fetch tech tree nodes', e);
        }
    };

    if (!isOpen) return null;

    const handleGenerate = () => {
        onGenerate({ type, id, name, stats, planet, parentId: parentId || undefined });
        onClose();
    };

    const nextStep = () => {
        // Auto-generate a name based on ID if empty
        if (step === 1 && !name && id) {
            setName(id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, ''));
        }
        setStep(s => s + 1);
    };

    const prevStep = () => setStep(s => s - 1);

    const activeType = types.find(t => t.id === type) || types[0];

    const inputStyles = {
        width: '100%', padding: '12px 16px', borderRadius: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white', outline: 'none', transition: 'all 0.3s',
        fontSize: '14px', boxSizing: 'border-box'
    };

    const labelStyles = { display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5, 5, 10, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, backdropFilter: 'blur(12px)', animation: 'fadeIn 0.3s ease'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes pulseStep { 0% { box-shadow: 0 0 0 0px rgba(74, 144, 226, 0.4); } 100% { box-shadow: 0 0 0 10px rgba(74, 144, 226, 0); } }
                .wiz-input:focus { border-color: ${activeType.color} !important; background-color: rgba(255, 255, 255, 0.1) !important; box-shadow: 0 0 0 3px ${activeType.color}33 !important; }
                .wiz-card:hover { transform: translateY(-4px) scale(1.02); }
                .wiz-btn:hover { transform: translateY(-2px); filter: brightness(1.2); }
                .wiz-btn:active { transform: translateY(0); }
            `}</style>

            <div style={{
                width: '700px', backgroundColor: '#13131c', borderRadius: '16px',
                padding: '40px', border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: `0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 40px ${activeType.color}15`,
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative', overflow: 'hidden'
            }}>
                {/* Background ambient glow */}
                <div style={{
                    position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px',
                    borderRadius: '50%', background: `radial-gradient(circle, ${activeType.color}22 0%, transparent 70%)`,
                    pointerEvents: 'none', zIndex: 0
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <div>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                                Forge <span style={{ color: activeType.color, transition: 'color 0.3s' }}>New Asset</span>
                            </h2>
                            <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: '14px' }}>Generate boilerplate code instantly.</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#aaa', cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', transition: 'all 0.2s',
                        }} onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }} onMouseOut={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>&times;</button>
                    </div>

                    {/* Step Indicators */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '40px' }}>
                        {['Type', 'Identity', 'Placement'].map((label, s) => {
                            const isActive = s === step;
                            const isPast = s < step;
                            return (
                                <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{
                                        height: '6px', backgroundColor: isActive ? activeType.color : isPast ? '#444' : '#222',
                                        borderRadius: '3px', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                        animation: isActive ? 'pulseStep 2s infinite' : 'none'
                                    }} />
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? '#fff' : isPast ? '#888' : '#444', letterSpacing: '0.05em' }}>
                                        0{s + 1} &mdash; {label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* STEP 0: TYPE */}
                    {step === 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', animation: 'fadeIn 0.3s' }}>
                            {types.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => { setType(t.id); }}
                                    className="wiz-card"
                                    style={{
                                        padding: '24px 20px', borderRadius: '16px',
                                        backgroundColor: type === t.id ? `${t.color}15` : 'rgba(255,255,255,0.03)',
                                        border: `2px solid ${type === t.id ? t.color : 'rgba(255,255,255,0.05)'}`,
                                        textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s',
                                        position: 'relative', overflow: 'hidden'
                                    }}
                                >
                                    {type === t.id && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: t.color }} />}
                                    <div style={{ fontSize: '42px', marginBottom: '15px', filter: type === t.id ? 'drop-shadow(0 0 10px rgba(255,255,255,0.3))' : 'none', transition: 'all 0.3s' }}>{t.icon}</div>
                                    <div style={{ fontWeight: '800', fontSize: '15px', color: type === t.id ? '#fff' : '#ccc' }}>{t.label}</div>
                                    <div style={{ fontSize: '12px', color: '#777', marginTop: '8px' }}>{t.desc}</div>
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button className="wiz-btn" onClick={nextStep} style={{
                                    padding: '14px 40px', borderRadius: '8px', backgroundColor: activeType.color,
                                    color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
                                    boxShadow: `0 4px 15px ${activeType.color}66`, transition: 'all 0.2s'
                                }}>Continue</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: IDENTITY & STATS */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s' }}>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyles}>Variable ID (camelCase)</label>
                                    <input
                                        className="wiz-input"
                                        value={id} onChange={e => setId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                        placeholder="e.g. titaniumWall"
                                        style={inputStyles}
                                        autoFocus
                                    />
                                    <div style={{ fontSize: '12px', color: '#777', marginTop: '6px' }}>Used internally in Java code.</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyles}>Display Name (Optional)</label>
                                    <input
                                        className="wiz-input"
                                        value={name} onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                                        placeholder="e.g. titanium-wall"
                                        style={inputStyles}
                                    />
                                    <div style={{ fontSize: '12px', color: '#777', marginTop: '6px' }}>Hyphenated identifier for localization.</div>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

                            <div>
                                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#eee', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '20px' }}>📊</span> Base Properties
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={labelStyles}>Health</label>
                                        <input className="wiz-input" type="number" value={stats.health || ''} onChange={e => setStats({ ...stats, health: parseInt(e.target.value) || 0 })} style={inputStyles} />
                                    </div>
                                    {type !== 'unit' && (
                                        <div>
                                            <label style={labelStyles}>Copper Cost</label>
                                            <input className="wiz-input" type="number" value={stats.cost || ''} onChange={e => setStats({ ...stats, cost: parseInt(e.target.value) || 0 })} style={inputStyles} />
                                        </div>
                                    )}
                                    {type.includes('Turret') && (
                                        <>
                                            <div>
                                                <label style={labelStyles}>Range (tiles &times; 8)</label>
                                                <input className="wiz-input" type="number" value={stats.range || 150} onChange={e => setStats({ ...stats, range: parseInt(e.target.value) || 0 })} style={inputStyles} />
                                            </div>
                                            <div>
                                                <label style={labelStyles}>Reload (ticks)</label>
                                                <input className="wiz-input" type="number" value={stats.reload || 30} onChange={e => setStats({ ...stats, reload: parseInt(e.target.value) || 0 })} style={inputStyles} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                                <button className="wiz-btn" onClick={prevStep} style={{
                                    padding: '14px 30px', borderRadius: '8px', backgroundColor: 'transparent',
                                    color: '#bbb', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', transition: 'all 0.2s'
                                }}>Back</button>
                                <button className="wiz-btn" onClick={nextStep} disabled={!id} style={{
                                    padding: '14px 40px', borderRadius: '8px', backgroundColor: id ? activeType.color : '#333',
                                    color: id ? 'white' : '#666', border: 'none', cursor: id ? 'pointer' : 'default', fontSize: '16px', fontWeight: 'bold',
                                    boxShadow: id ? `0 4px 15px ${activeType.color}66` : 'none', transition: 'all 0.2s'
                                }}>Next Step</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: TECH TREE / REVIEW */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
                                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '24px' }}>🌳</span> Tech Tree Integration
                                </h3>

                                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyles}>Planet</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {['serpulo', 'erekir'].map(p => (
                                                <div
                                                    key={p}
                                                    onClick={() => setPlanet(p)}
                                                    style={{
                                                        flex: 1, padding: '12px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                                                        backgroundColor: planet === p ? (p === 'serpulo' ? '#f5a62322' : '#e24a4a22') : 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${planet === p ? (p === 'serpulo' ? '#f5a623' : '#e24a4a') : 'rgba(255,255,255,0.1)'}`,
                                                        color: planet === p ? '#fff' : '#aaa', fontWeight: 'bold', textTransform: 'capitalize', transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyles}>Parent Node (Optional)</label>
                                        <select
                                            className="wiz-input"
                                            value={parentId}
                                            onChange={e => setParentId(e.target.value)}
                                            style={{ ...inputStyles, cursor: 'pointer', appearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #888 50%), linear-gradient(135deg, #888 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                                        >
                                            <option value="">- No Parent (Root) -</option>
                                            {nodes.map(n => (
                                                <option key={n.id} value={n.id}>{n.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ fontSize: '13px', color: '#999', lineHeight: '1.5', backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                                    By selecting a parent node, <code>{id}</code> will be added to the `{planet}` campaign tech tree automatically upon generation.
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                                <button className="wiz-btn" onClick={prevStep} style={{
                                    padding: '14px 30px', borderRadius: '8px', backgroundColor: 'transparent',
                                    color: '#bbb', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', transition: 'all 0.2s'
                                }}>Back</button>
                                <button className="wiz-btn" onClick={() => {
                                    onGenerate({ type, id, name, stats, planet, parentId: parentId || undefined });
                                    setStep(3); // Go to Sprite Upload
                                }} style={{
                                    padding: '14px 40px', borderRadius: '8px', backgroundImage: 'linear-gradient(135deg, #00b894, #00cec9)',
                                    color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
                                    boxShadow: '0 4px 20px rgba(0, 184, 148, 0.4)', transition: 'all 0.2s'
                                }}>Generate Asset ✨</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: SPRITE UPLOAD */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#00cec9' }}>
                                    ✅ Asset Generated!
                                </h3>
                                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
                                    Boilerplate java code added for <strong>{id}</strong>. Now, assign a visual sprite.
                                </p>

                                <label style={{
                                    display: 'block', padding: '40px', border: '2px dashed rgba(255,255,255,0.2)',
                                    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: 'rgba(0,0,0,0.2)'
                                }} onMouseOver={e => e.currentTarget.style.borderColor = '#00cec9'} onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}>
                                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🖼️</div>
                                    <div style={{ color: '#fff', fontWeight: 'bold' }}>Click or Drag .png here</div>
                                    <input type="file" accept=".png" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const targetFolder = type === 'unit' ? 'units' : 'blocks';
                                        const targetName = id.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()).replace(/^-/, '');
                                        const targetPath = targetFolder + '/' + targetName + '.png';

                                        const formData = new FormData();
                                        formData.append('sprite', file);
                                        formData.append('targetPath', targetPath);

                                        try {
                                            await fetch(`${API_BASE}/api/replace-sprite`, { method: 'POST', body: formData });
                                            // The backend watcher or next reload will pick it up
                                            onClose();
                                        } catch (err) {
                                            console.error("Upload failed", err);
                                        }
                                    }} />
                                </label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                                <button className="wiz-btn" onClick={onClose} style={{
                                    padding: '12px 30px', borderRadius: '8px', backgroundColor: 'transparent',
                                    color: '#bbb', border: 'none', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s', textDecoration: 'underline'
                                }}>Skip for now</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssetWizard;
