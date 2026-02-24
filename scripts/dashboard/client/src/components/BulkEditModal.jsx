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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <div style={{ background: '#161616', padding: '2.5rem', borderRadius: '16px', border: '1px solid #ff9800', width: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                <header style={{ marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, color: '#ff9800', fontSize: '1.5rem' }}>⚖️ BULK BALANCER</h2>
                    <p style={{ color: '#888', marginTop: '0.5rem', fontSize: '0.9rem' }}>Applying changes to <strong>{count}</strong> selected assets.</p>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', marginBottom: '2rem', paddingRight: '0.5rem' }}>
                    {fields.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Property (e.g. health)"
                                value={f.key}
                                onChange={(e) => updateField(i, 'key', e.target.value)}
                                style={{ flexGrow: 1, background: '#0a0a0a', border: '1px solid #333', color: 'white', padding: '0.7rem', borderRadius: '8px', outline: 'none' }}
                            />
                            <input
                                type="text"
                                placeholder="Value"
                                value={f.value}
                                onChange={(e) => updateField(i, 'value', e.target.value)}
                                style={{ width: '100px', background: '#0a0a0a', border: '1px solid #333', color: '#ff9800', padding: '0.7rem', borderRadius: '8px', outline: 'none' }}
                            />
                            <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>
                    ))}
                    <button onClick={addField} style={{ background: '#222', border: '1px dashed #444', color: '#888', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', marginTop: '0.5rem' }}>
                        + Add Another Property
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={handleSave}
                        style={{ flexGrow: 1, background: '#ff9800', color: 'black', border: 'none', padding: '1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        APPLY MASS CHANGES
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: '#333', border: 'none', color: 'white', padding: '1rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.2)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#f44336', fontWeight: 'bold', marginBottom: '0.3rem' }}>⚠️ SAFETY NOTICE</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: '1.4' }}>
                        This action will patch multiple Java source files. Automatic backups (.bak) will be created for each modified file.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
