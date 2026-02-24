import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Background,
    Controls,
    MiniMap,
    MarkerType
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

const API_BASE = 'http://localhost:3001';

const getLayoutedElements = (nodes, edges, direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 200 });

    nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 150, height: 40 }));
    edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = direction === 'LR' ? 'left' : 'top';
        node.sourcePosition = direction === 'LR' ? 'right' : 'bottom';
        node.position = { x: nodeWithPosition.x - 75, y: nodeWithPosition.y - 20 };
    });

    return { nodes, edges };
};

const TechTreeExplorer = ({ onClose, assets }) => {
    const [planet, setPlanet] = useState('serpulo');
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

                initialNodes.push({
                    id: nodeData.id,
                    data: { label: asset?.name || nodeData.id, nodeData },
                    style: {
                        background: asset?.isVariableOnly ? '#331111' : '#1a1a1a',
                        color: asset?.name ? '#ff9800' : '#888',
                        border: selectedNode?.id === nodeData.id ? '2px solid #ff9800' : '1px solid #444',
                        borderRadius: '4px',
                        fontSize: '11px',
                        width: 150,
                        textAlign: 'center',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                        padding: '10px',
                        cursor: 'pointer'
                    }
                });

                if (nodeData.parent) {
                    initialEdges.push({
                        id: `e-p-${nodeData.parent}-${nodeData.id}`,
                        source: nodeData.parent,
                        target: nodeData.id,
                        style: { stroke: '#ff9800', strokeWidth: 2, opacity: 0.8 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#ff9800' }
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
                                style: { stroke: '#555', strokeDasharray: '5,5', opacity: 0.5 },
                                labelStyle: { fill: '#666', fontSize: '8px', fontStyle: 'italic' }
                            });
                        }
                    });
                }
            });

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);
        } catch (e) {
            console.error('Failed to fetch tech tree', e);
        }
    }, [planet, assets, selectedNode]);

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

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0a0a0a', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'monospace' }}>
            <header style={{ padding: '1.2rem 2rem', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🌳</span>
                        <h2 style={{ margin: 0, color: '#ff9800', letterSpacing: '0.2em', fontSize: '1.2rem' }}>DEV TREE EDITOR</h2>
                    </div>
                    <select
                        value={planet}
                        onChange={(e) => setPlanet(e.target.value)}
                        style={{ padding: '0.6rem 1.2rem', borderRadius: '4px', background: '#1a1a1a', color: 'white', border: '1px solid #444', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        <option value="serpulo">SERPULO</option>
                        <option value="erekir">EREKIR</option>
                    </select>
                </div>
                {isSaving && <span style={{ color: '#ff9800', animate: 'pulse 1s infinite' }}>💾 Syncing to Java...</span>}
                <button
                    onClick={onClose}
                    style={{ background: '#333', border: 'none', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    CLOSE
                </button>
            </header>

            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                <div style={{ flexGrow: 1, position: 'relative' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={handleNodeClick}
                        fitView
                        minZoom={0.05}
                    >
                        <Background color="#151515" gap={40} size={1} />
                        <Controls />
                        <MiniMap
                            nodeStrokeColor={(n) => n.style.background}
                            nodeColor={(n) => n.style.background}
                        />
                    </ReactFlow>
                </div>

                {selectedNode && (
                    <div style={{ width: '400px', background: '#111', borderLeft: '1px solid #333', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#ff9800' }}>{selectedAsset?.name || selectedNode.id}</h3>
                                <div style={{ color: '#666', fontSize: '0.8rem' }}>Internal ID: {selectedNode.id}</div>
                            </div>
                            <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>✕</button>
                        </div>

                        {selectedAsset?.properties?._requirements && (
                            <div>
                                <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.7rem', marginBottom: '0.5rem', borderBottom: '1px solid #222' }}>Research Cost</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {selectedAsset.properties._requirements.map((req, i) => (
                                        <div key={i} style={{ background: '#1a1a1a', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{req.item}</span>
                                            <span style={{ color: '#ff9800', fontWeight: 'bold' }}>{req.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedNode.objectives && selectedNode.objectives.length > 0 && (
                            <div>
                                <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.7rem', marginBottom: '0.5rem', borderBottom: '1px solid #222' }}>Logical Objectives</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {selectedNode.objectives.map((obj, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: '#ccc' }}>
                                            <span style={{ color: '#555' }}>[{obj.type}]</span> {obj.target}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #222', paddingTop: '1.5rem' }}>
                            <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.7rem' }}>Structural Actions</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Child variable name..."
                                    value={newNodeId}
                                    onChange={(e) => setNewNodeId(e.target.value)}
                                    style={{ flexGrow: 1, padding: '0.5rem', background: '#0a0a0a', border: '1px solid #333', color: 'white', borderRadius: '4px', fontSize: '0.8rem' }}
                                />
                                <button
                                    disabled={!newNodeId || isSaving}
                                    onClick={() => handleAction('add')}
                                    style={{ padding: '0.5rem 1rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (!newNodeId || isSaving) ? 0.5 : 1 }}
                                >
                                    ADD CHILD
                                </button>
                            </div>
                            <button
                                disabled={isSaving}
                                onClick={() => handleAction('delete')}
                                style={{ padding: '0.8rem', background: '#b71c1c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: isSaving ? 0.5 : 1 }}
                            >
                                DELETE NODE FROM TREE
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TechTreeExplorer;
