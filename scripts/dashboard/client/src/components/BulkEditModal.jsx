import React, { useState } from 'react';

const BulkEditModal = ({ isOpen, onClose, onSave, count }) => {
    const [fields, setFields] = useState([{ key: '', value: '' }]);

    if (!isOpen) return null;

    const addField = () => setFields([...fields, { key: '', value: '' }]);
    const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i));
    const updateField = (i, k, v) => {
        const next = [...fields];
        next[i] = { ...next[i], [k]: v };
        setFields(next);
    };

    const handleSave = () => {
        const stats = {};
        fields.forEach(f => {
            if (f.key && f.value) stats[f.key] = f.value;
        });
        onSave(stats);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 5, 10, 0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease', fontFamily: '"Inter", system-ui, sans-serif'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>

            <div style={{
                background: 'rgba(20, 20, 28, 0.8)', padding: '40px', borderRadius: '24px',
                border: '1px solid rgba(255,152,0,0.3)', width: '540px', boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(255,152,0,0.1)',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative', overflow: 'hidden'
            }}>
                {/* Decorative background glow */}
                <div style={{
                    position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px',
                    background: 'radial-gradient(circle, rgba(255,152,0,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none'
                }} />

                <header style={{ marginBottom: '30px', display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #ff9800, #f39c12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 4px 15px rgba(255,152,0,0.4)', flexShrink: 0 }}>
                        ⚖️
                    </div>
                    <div>
                        <h2 style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: 800, letterSpacing: '0.05em' }}>BULK BALANCER</h2>
                        <p style={{ color: '#aaa', marginTop: '6px', fontSize: '14px', lineHeight: '1.4' }}>
                            You are applying mass modifications to <strong style={{ color: '#ff9800', background: 'rgba(255,152,0,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{count}</strong> selected assets.
                        </p>
                    </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '350px', overflowY: 'auto', marginBottom: '30px', paddingRight: '10px' }}>
                    {fields.map((f, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
                            padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'border-color 0.2s'
                        }} onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,152,0,0.3)'} onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                            <input
                                type="text"
                                placeholder="Property (e.g. health, range)"
                                value={f.key}
                                onChange={(e) => updateField(i, 'key', e.target.value)}
                                style={{
                                    flexGrow: 1, background: 'transparent', border: 'none', color: 'white',
                                    fontSize: '14px', outline: 'none'
                                }}
                            />
                            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                            <input
                                type="text"
                                placeholder="Value"
                                value={f.value}
                                onChange={(e) => updateField(i, 'value', e.target.value)}
                                style={{
                                    width: '120px', background: 'transparent', border: 'none', color: '#ff9800',
                                    fontSize: '14px', fontWeight: 'bold', outline: 'none', textAlign: 'right'
                                }}
                            />
                            {fields.length > 1 && (
                                <button onClick={() => removeField(i)} style={{
                                    background: 'rgba(244, 67, 54, 0.1)', border: 'none', color: '#f44336',
                                    width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s', marginLeft: '8px'
                                }} onMouseOver={e => { e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)' }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)' }}>
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    <button onClick={addField} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', color: '#888',
                        padding: '12px', borderRadius: '12px', cursor: 'pointer', marginTop: '5px', fontWeight: 'bold', fontSize: '13px',
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }} onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa' }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#888' }}>
                        <span style={{ fontSize: '16px' }}>+</span> Add Another Property
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={handleSave}
                        style={{
                            flexGrow: 1, background: 'linear-gradient(135deg, #ff9800, #f39c12)', color: 'black',
                            border: 'none', padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            boxShadow: '0 4px 15px rgba(255,152,0,0.3)', transition: 'transform 0.2s', letterSpacing: '0.05em'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        APPLY MASS CHANGES
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa',
                            padding: '15px 30px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa' }}
                    >
                        Cancel
                    </button>
                </div>

                <div style={{ marginTop: '25px', padding: '15px 20px', background: 'rgba(244, 67, 54, 0.08)', border: '1px solid rgba(244, 67, 54, 0.2)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '16px', color: '#f44336' }}>⚠️</div>
                    <div>
                        <div style={{ fontSize: '11px', color: '#f44336', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Safety Notice</div>
                        <div style={{ fontSize: '12px', color: '#999', lineHeight: '1.5' }}>
                            This action modifies multiple core Java files simultaneously. Automatic <strong>.bak</strong> backups are created before writing.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
