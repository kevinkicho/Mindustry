import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Background,
    Controls,
    MiniMap,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE = 'http://localhost:3001';

const getLayoutedElements = (nodes, edges, planet) => {
    // 1. Build adjacency list (ignore objectives for layout)
    const outgoing = new Map();
    const incoming = new Set();
    nodes.forEach(n => outgoing.set(n.id, []));
    edges.forEach(e => {
        if (!e.id.includes('e-obj-') && outgoing.has(e.source)) {
            outgoing.get(e.source).push(e.target);
            incoming.add(e.target);
        }
    });

    const roots = nodes.map(n => n.id).filter(id => !incoming.has(id));

    // 2. Compute subtree sizes
    const subtreeSize = new Map();
    const calculateSubtreeSize = (id) => {
        let size = 0;
        const children = outgoing.get(id) || [];
        if (children.length === 0) size = 1;
        else children.forEach(child => { size += calculateSubtreeSize(child); });
        subtreeSize.set(id, Math.max(1, size));
        return subtreeSize.get(id);
    };
    roots.forEach(r => calculateSubtreeSize(r));

    const positions = new Map();

    if (planet === 'serpulo') {
        // Horizontal symmetric layout
        const xSpacing = 220;
        const ySpacing = 80;

        const layoutNode = (id, depth, yCenter) => {
            positions.set(id, { x: depth * xSpacing, y: yCenter });
            const children = outgoing.get(id) || [];
            if (children.length > 0) {
                let startY = yCenter - ((subtreeSize.get(id) - 1) * ySpacing) / 2;
                children.forEach(child => {
                    const childSize = subtreeSize.get(child);
                    const childCenter = startY + ((childSize - 1) * ySpacing) / 2;
                    layoutNode(child, depth + 1, childCenter);
                    startY += childSize * ySpacing;
                });
            }
        };

        let rootY = 0;
        roots.forEach(r => {
            layoutNode(r, 0, rootY);
            rootY += subtreeSize.get(r) * ySpacing + 100;
        });

    } else {
        // Erekir: Radial layout
        const radiusStep = 200;

        const layoutNodeRadial = (id, depth, angleStart, angleEnd) => {
            const angle = (angleStart + angleEnd) / 2;
            const radius = depth * radiusStep;

            positions.set(id, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });

            const children = outgoing.get(id) || [];
            if (children.length > 0) {
                const totalSize = subtreeSize.get(id) - 1; // excluding self
                let currentAngle = angleStart;
                const safeTotalSize = Math.max(1, totalSize);

                children.forEach(child => {
                    const childSize = subtreeSize.get(child);
                    const angleSpan = (childSize / safeTotalSize) * (angleEnd - angleStart);
                    layoutNodeRadial(child, depth + 1, currentAngle, currentAngle + angleSpan);
                    currentAngle += angleSpan;
                });
            }
        };

        let currentAngle = 0;
        const maxRootSize = roots.reduce((sum, r) => sum + subtreeSize.get(r), 0);
        roots.forEach(r => {
            const size = subtreeSize.get(r);
            const span = (size / Math.max(1, maxRootSize)) * Math.PI * 2;
            layoutNodeRadial(r, 1, currentAngle, currentAngle + span); // Roots at depth 1
            currentAngle += span;
        });
    }

    nodes.forEach(node => {
        const pos = positions.get(node.id) || { x: 0, y: 0 };
        node.position = pos;

        if (planet === 'serpulo') {
            node.targetPosition = 'left';
            node.sourcePosition = 'right';
        } else {
            // For radial, ports usually look better auto-oriented, but react-flow doesn't support that easily
            // We'll set generic top/bottom
            node.targetPosition = 'bottom';
            node.sourcePosition = 'top';
        }
    });

    return { nodes, edges };
};

const TechTreeExplorer = ({ onClose, assets }) => {
    const [planet, setPlanet] = useState('serpulo');
    const [searchQuery, setSearchQuery] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [newNodeId, setNewNodeId] = useState('');
    const [rawTreeData, setRawTreeData] = useState([]);

    const fetchTree = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/techtree?planet=${planet}`);
            const data = await res.json();
            if (!data) return;
            setRawTreeData(data);

            const initialNodes = [];
            const initialEdges = [];

            data.forEach(nodeData => {
                const asset = assets.find(a => a.variableName === nodeData.id);
                const isSelected = selectedNode?.id === nodeData.id;
                const matchesSearch = searchQuery && (
                    (asset?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    nodeData.id.toLowerCase().includes(searchQuery.toLowerCase())
                );
                const isFaded = searchQuery && !matchesSearch && !isSelected;

                initialNodes.push({
                    id: nodeData.id,
                    data: {
                        label: (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <img
                                    src={`http://localhost:3001/api/sprites/${asset?.name || nodeData.id}`}
                                    alt={asset?.name}
                                    style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                                    onError={(e) => e.target.style.display = 'none'}
                                />
                                <span>{asset?.name || nodeData.id}</span>
                            </div>
                        ),
                        nodeData
                    },
                    style: {
                        background: asset?.isVariableOnly ? 'rgba(40, 20, 20, 0.95)' : 'rgba(30, 30, 36, 0.95)',
                        color: asset?.name ? (planet === 'serpulo' ? '#f39c12' : '#e74c3c') : '#aaa',
                        border: isSelected || matchesSearch ? `3px solid ${planet === 'serpulo' ? '#f39c12' : '#e74c3c'}` : '3px solid rgba(255,255,255,0.15)',
                        borderRadius: planet === 'erekir' ? '24px' : '8px', // Distinct core shapes
                        clipPath: planet === 'erekir' && !asset?.isVariableOnly ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' : 'none', // Hexagon for Erekir
                        fontSize: '12px',
                        fontWeight: 'bold',
                        width: planet === 'erekir' ? 90 : 140,
                        height: planet === 'erekir' ? 90 : 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        boxShadow: isSelected || matchesSearch ? `0 0 20px ${planet === 'serpulo' ? '#f39c12aa' : '#e74c3caa'}` : '0 6px 15px rgba(0,0,0,0.4)',
                        padding: '10px',
                        cursor: 'pointer',
                        backdropFilter: 'blur(5px)',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        opacity: isFaded ? 0.3 : 1,
                        filter: isFaded ? 'grayscale(100%)' : 'none'
                    }
                });

                if (nodeData.parent) {
                    initialEdges.push({
                        id: `e-p-${nodeData.parent}-${nodeData.id}`,
                        source: nodeData.parent,
                        target: nodeData.id,
                        style: { stroke: planet === 'serpulo' ? '#f39c12' : '#e74c3c', strokeWidth: 4, strokeLinejoin: 'round', opacity: 0.8 },
                        animated: isSelected, // Animate edges leading TO the selected node
                        markerEnd: { type: MarkerType.ArrowClosed, color: planet === 'serpulo' ? '#f39c12' : '#e74c3c', width: 25, height: 25 }
                    });
                }

                if (nodeData.objectives) {
                    nodeData.objectives.forEach((obj, idx) => {
                        if (data.some(d => d.id === obj.target)) {
                            initialEdges.push({
                                id: `e-obj-${obj.target}-${nodeData.id}-${idx}`,
                                source: obj.target,
                                target: nodeData.id,
                                label: obj.type,
                                animated: true,
                                style: { stroke: '#666', strokeWidth: 2, strokeDasharray: '5,5', opacity: 0.5 },
                                labelStyle: { fill: '#aaa', fontSize: '9px', fontStyle: 'italic', background: 'transparent' },
                                labelBgStyle: { fill: 'rgba(0,0,0,0.7)', fillOpacity: 0.8 }
                            });
                        }
                    });
                }
            });

            // Add unplaced assets
            assets.forEach(asset => {
                if (!asset.variableName && !asset.id) return;
                const assetId = asset.variableName || asset.id;
                if (!data.some(d => d.id === assetId) && !asset.isVariableOnly && ['block', 'unit'].includes(asset.type)) {
                    initialNodes.push({
                        id: assetId,
                        data: {
                            label: (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <img
                                        src={`http://localhost:3001/api/sprites/${assetId}`}
                                        alt={asset.name}
                                        style={{ width: 24, height: 24, objectFit: 'contain', opacity: 0.8 }}
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                    <span>{asset.name || assetId}</span>
                                </div>
                            ),
                            nodeData: { id: assetId }
                        },
                        style: {
                            background: 'rgba(20, 20, 20, 0.5)',
                            color: '#666',
                            border: '2px dashed rgba(255,255,255,0.2)',
                            borderRadius: '16px',
                            fontSize: '11px',
                            width: 140,
                            height: 50,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px',
                            cursor: 'pointer',
                            opacity: 0.7,
                            transition: 'all 0.3s ease'
                        }
                    });
                }
            });

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges, planet);
            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);
        } catch (e) {
            console.error('Failed to fetch tech tree', e);
        }
    }, [planet, assets, selectedNode, searchQuery]);

    useEffect(() => {
        fetchTree();
    }, [fetchTree]);

    const handleNodeClick = (event, node) => {
        setSelectedNode(node.data.nodeData);
    };

    const handleAction = async (action, targetId = null) => {
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/techtree/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planet,
                    action,
                    node: action === 'add' ? newNodeId : (targetId || selectedNode.id),
                    parentId: action === 'add' ? selectedNode.id : null
                })
            });
            if (res.ok) {
                setNewNodeId('');
                if (action === 'delete') setSelectedNode(null);
                await fetchTree();
            }
        } catch (e) {
            console.error('Update failed', e);
        }
        setIsSaving(false);
    };

    const selectedAsset = selectedNode ? assets.find(a => a.variableName === selectedNode.id) : null;
    const accentColor = planet === 'serpulo' ? '#f39c12' : '#e74c3c';
    const accentGradient = planet === 'serpulo' ? 'linear-gradient(135deg, #f39c12, #d35400)' : 'linear-gradient(135deg, #e74c3c, #c0392b)';

    return (
        <div style={{
            flexGrow: 1, height: '100%', display: 'flex', flexDirection: 'column',
            fontFamily: '"Inter", system-ui, sans-serif', color: '#e0e0e0',
            animation: 'fadeIn 0.3s ease'
        }}>
            {/* Ambient Background Glow based on Planet */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '80vw', height: '80vh', borderRadius: '50%',
                background: `radial-gradient(circle, ${accentColor}08 0%, transparent 70%)`,
                pointerEvents: 'none', zIndex: 0, transition: 'background 0.5s'
            }} />

            <header style={{
                padding: '20px 30px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', position: 'relative', zIndex: 10
            }}>
                <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: `0 4px 15px ${accentColor}44` }}>
                            🌳
                        </div>
                        <div>
                            <h2 style={{ margin: 0, color: '#fff', letterSpacing: '0.1em', fontSize: '18px', fontWeight: 800 }}>TECH PROGRESSION</h2>
                            <div style={{ fontSize: '11px', color: accentColor, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 'bold' }}>Visual Editor</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', background: '#1a1a24', padding: '5px', borderRadius: '10px', border: '1px solid #2a2a35' }}>
                        <button
                            onClick={() => setPlanet('serpulo')}
                            style={{
                                padding: '8px 25px', background: planet === 'serpulo' ? '#222' : 'transparent',
                                border: 'none', borderRadius: '8px', color: planet === 'serpulo' ? '#fff' : '#888',
                                fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.1em'
                            }}
                        >
                            SERPULO
                        </button>
                        <button
                            onClick={() => setPlanet('erekir')}
                            style={{
                                padding: '8px 25px', background: planet === 'erekir' ? '#222' : 'transparent',
                                border: 'none', borderRadius: '8px', color: planet === 'erekir' ? '#fff' : '#888',
                                fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.1em'
                            }}
                        >
                            EREKIR
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Find node..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '8px 15px 8px 35px', borderRadius: '8px', background: '#1a1a24',
                                border: '1px solid #333', color: 'white', width: '200px', outline: 'none',
                                fontSize: '12px', transition: 'border-color 0.3s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = accentColor}
                            onBlur={(e) => e.target.style.borderColor = '#333'}
                        />
                    </div>
                    {isSaving && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: accentColor, fontSize: '13px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor }} />
                            Syncing to Java...
                            <style>{`@keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }`}</style>
                        </div>
                    )}
                </div>
            </header>

            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative', zIndex: 1, border: '1px solid #2a2a35', borderRadius: '12px', margin: '0 30px 30px 30px', background: '#0a0a0f' }}>
                <div style={{ flexGrow: 1, position: 'relative' }}>
                    {nodes.length > 0 ? (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onNodeClick={handleNodeClick}
                            fitView
                            minZoom={0.05}
                            className="dark-theme-flow"
                        >
                            <Background
                                color={planet === 'serpulo' ? "#f39c1222" : "#e74c3c22"}
                                gap={planet === 'serpulo' ? 40 : 60}
                                size={1}
                                variant={planet === 'serpulo' ? 'lines' : 'dots'}
                            />

                            {/* Planet Glow */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: -1,
                                background: planet === 'serpulo'
                                    ? 'radial-gradient(circle at center, rgba(243,156,18,0.1) 0%, transparent 60%)'
                                    : 'radial-gradient(circle at center, rgba(231,76,60,0.1) 0%, transparent 70%)'
                            }} />

                            <Controls style={{ background: 'rgba(20, 20, 28, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', backdropFilter: 'blur(10px)' }} />
                            <MiniMap
                                nodeStrokeColor={(n) => n.style.border.split(' ')[2] || 'transparent'}
                                nodeColor={(n) => n.style.background}
                                maskColor="rgba(0,0,0,0.6)"
                                style={{ background: 'rgba(20, 20, 28, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                            />
                        </ReactFlow>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
                            Loading Tech Tree...
                        </div>
                    )}
                </div>

                <div style={{
                    width: '450px', background: 'rgba(20, 20, 28, 0.8)', borderLeft: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                    animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(20px)'
                }}>
                    <div style={{ padding: '30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#fff', fontSize: '24px', fontWeight: 800 }}>
                                {selectedNode ? (selectedAsset?.name || selectedNode.id) : "Global Tech Tree"}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                {selectedNode ? (
                                    <>
                                        <div style={{ padding: '4px 8px', background: `${accentColor}22`, color: accentColor, borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', border: `1px solid ${accentColor}44` }}>
                                            {selectedNode.id}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '12px' }}>Internal Identifier</div>
                                    </>
                                ) : (
                                    <div style={{ color: '#888', fontSize: '12px' }}>Select a node or add a new root node.</div>
                                )}
                            </div>
                        </div>
                        {selectedNode && (
                            <button onClick={() => setSelectedNode(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}>✕</button>
                        )}
                    </div>

                    <div style={{ padding: '30px', flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {selectedNode && selectedAsset?.properties?._requirements && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor }} />
                                    <div style={{ color: '#fff', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.1em', fontWeight: 'bold' }}>Research Cost</div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {selectedAsset.properties._requirements.map((req, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(0,0,0,0.3)', padding: '10px 15px', borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px'
                                        }}>
                                            <span style={{ color: '#aaa', fontSize: '13px', fontWeight: '500' }}>{req.item}</span>
                                            <span style={{ color: accentColor, fontWeight: 'bold', fontSize: '14px', background: `${accentColor}15`, padding: '2px 8px', borderRadius: '4px' }}>{req.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedNode && selectedNode.objectives && selectedNode.objectives.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3498db' }} />
                                    <div style={{ color: '#fff', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.1em', fontWeight: 'bold' }}>Logical Objectives</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {selectedNode.objectives.map((obj, i) => (
                                        <div key={i} style={{
                                            fontSize: '13px', color: '#ccc', background: 'rgba(0,0,0,0.3)',
                                            padding: '12px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex', alignItems: 'center', gap: '10px'
                                        }}>
                                            <span style={{ color: '#3498db', fontSize: '11px', fontWeight: 'bold', background: 'rgba(52, 152, 219, 0.15)', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>{obj.type}</span>
                                            <span style={{ fontFamily: 'monospace' }}>{obj.target}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '30px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
                            {selectedNode ? "Modifications" : "Add Root Node"}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    placeholder={selectedNode ? "Child node ID..." : "Root node ID..."}
                                    value={newNodeId}
                                    onChange={(e) => setNewNodeId(e.target.value)}
                                    style={{
                                        flexGrow: 1, padding: '12px 15px', background: 'rgba(0,0,0,0.4)',
                                        border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px',
                                        fontSize: '13px', outline: 'none', transition: 'border-color 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = accentColor}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                                <button
                                    disabled={!newNodeId || isSaving}
                                    onClick={() => handleAction('add')}
                                    style={{
                                        padding: '12px 20px', background: accentGradient, color: 'white', border: 'none',
                                        borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                                        opacity: (!newNodeId || isSaving) ? 0.5 : 1, transition: 'transform 0.2s, box-shadow 0.2s',
                                        boxShadow: `0 4px 15px ${accentColor}44`
                                    }}
                                    onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-2px)' }}
                                    onMouseOut={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                    {selectedNode ? "ADD CHILD" : "ADD ROOT"}
                                </button>
                            </div>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                                {selectedNode ? "Adds a new node below the currently selected node." : "Creates a new independent progression branch."}
                            </div>
                        </div>

                        {selectedNode && (
                            <button
                                disabled={isSaving}
                                onClick={() => handleAction('delete')}
                                style={{
                                    padding: '14px', background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c',
                                    border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: '8px', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '13px', opacity: isSaving ? 0.5 : 1, transition: 'all 0.2s'
                                }}
                                onMouseOver={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)'; e.currentTarget.style.borderColor = '#e74c3c'; } }}
                                onMouseOut={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)'; e.currentTarget.style.borderColor = 'rgba(231, 76, 60, 0.3)'; } }}
                            >
                                DELETE NODE FROM TREE
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TechTreeExplorer;
