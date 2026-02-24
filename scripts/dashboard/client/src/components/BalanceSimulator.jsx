import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

export default function BalanceSimulator({ assets }) {
    const [category, setCategory] = useState('turrets'); // 'turrets' or 'units'
    const [xAxisHover, setXAxisHover] = useState(null);
    const [yAxisHover, setYAxisHover] = useState(null);

    // Process data based on category
    const chartData = useMemo(() => {
        if (!assets || assets.length === 0) return [];

        let validAssets = [];

        if (category === 'turrets') {
            const turrets = assets.filter(a => (a.type || '').toLowerCase().includes('turret') || (a.name || '').toLowerCase().includes('turret') || (a.id || '').toLowerCase().includes('turret'));
            validAssets = turrets.map(t => {
                const props = t.properties || {};
                let cost = 0;
                if (props._requirements && Array.isArray(props._requirements)) {
                    cost = props._requirements.reduce((sum, req) => sum + (parseInt(req.count) || 0), 0);
                }
                if (cost === 0) cost = (parseFloat(props.size) || 1) * 30; // Dummy cost

                let rawDamage = 0;
                if (props._ammo && props._ammo.length > 0) {
                    const avg = props._ammo.reduce((sum, a) => sum + (parseFloat(a.props?.damage || 0)), 0) / props._ammo.length;
                    rawDamage = avg;
                } else {
                    rawDamage = parseFloat(props.damage) || (parseFloat(props.size) || 1) * 15;
                }
                if (!rawDamage) rawDamage = 10;

                const reload = parseFloat(props.reload) || 30;
                const dps = reload > 0 ? (rawDamage * 60) / reload : 0;

                return {
                    id: t.id || t.variableName,
                    name: t.name || t.id,
                    health: parseInt(props.health) || ((parseFloat(props.size) || 1) * 200),
                    range: parseFloat(props.range) || 100,
                    dps: parseFloat(dps.toFixed(2)),
                    cost: cost,
                    type: t.type
                };
            }).filter(t => t.cost > 0 && t.dps > 0);
        } else if (category === 'units') {
            const units = assets.filter(a => (a.type || '').toLowerCase().includes('unit') || (a.name || '').toLowerCase().includes('unit'));
            if (units.length === 0) {
                // If the parser wasn't setting type="unit", use all non-blocks
                units.push(...assets.filter(a => a.category !== 'blocks' && !a.id?.toLowerCase().includes('turret')));
            }
            validAssets = units.map(u => {
                const props = u.properties || {};
                return {
                    id: u.id || u.variableName,
                    name: u.name || u.id,
                    health: parseInt(props.health) || 150,
                    speed: parseFloat(props.speed) || 1,
                    armor: parseInt(props.armor) || 0,
                    type: 'unit'
                };
            }).filter(u => u.health > 0);
        }

        return validAssets;

    }, [assets, category]);


    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{ background: 'rgba(20, 20, 28, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#ff9800', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>{data.name || data.id}</p>
                    {category === 'turrets' ? (
                        <>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#aaddff' }}>DPS: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.dps}</span></p>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#4caf50' }}>Health: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.health}</span></p>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#ffcc00' }}>Cost: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.cost}</span></p>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#e74c3c' }}>Range: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.range}</span></p>
                        </>
                    ) : (
                        <>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#4caf50' }}>Health: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.health}</span></p>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#ffcc00' }}>Speed: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.speed}</span></p>
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#aaddff' }}>Armor: <span style={{ color: 'white', fontWeight: 'bold' }}>{data.armor}</span></p>
                        </>
                    )}
                </div>
            );
        }
        return null;
    };

    const avgX = chartData.length > 0 ? chartData.reduce((sum, item) => sum + (category === 'turrets' ? item.cost : item.speed), 0) / chartData.length : 0;
    const avgY = chartData.length > 0 ? chartData.reduce((sum, item) => sum + (category === 'turrets' ? item.dps : item.health), 0) / chartData.length : 0;

    return (
        <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>⚖️</span> Combat & Balance Simulator
                    </h1>
                    <p style={{ color: '#888', marginTop: '0.4rem' }}>
                        Identify outliers and tune the meta.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', background: '#1a1a24', padding: '5px', borderRadius: '8px', border: '1px solid #2a2a35' }}>
                    <button
                        onClick={() => setCategory('turrets')}
                        style={{ padding: '8px 16px', background: category === 'turrets' ? '#333' : 'transparent', color: category === 'turrets' ? '#fff' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                    >
                        Turret DPS/Cost
                    </button>
                    <button
                        onClick={() => setCategory('units')}
                        style={{ padding: '8px 16px', background: category === 'units' ? '#333' : 'transparent', color: category === 'units' ? '#fff' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                    >
                        Unit Health/Speed
                    </button>
                </div>
            </header>

            <div style={{ flexGrow: 1, background: '#14141c', borderRadius: '12px', border: '1px solid #2a2a35', padding: '1rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 20, left: 30, color: '#aaa', fontSize: '12px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 12, height: 12, background: '#00bcd4', borderRadius: '50%' }}></div> Target Zone</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 12, height: 12, background: '#e91e63', borderRadius: '50%' }}></div> Overpowered</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 12, height: 12, background: '#ff9800', borderRadius: '50%' }}></div> Underpowered</div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            type="number"
                            dataKey={category === 'turrets' ? 'cost' : 'speed'}
                            name={category === 'turrets' ? 'Resource Cost' : 'Movement Speed'}
                            stroke="#888"
                            label={{ value: category === 'turrets' ? 'Resource Cost' : 'Movement Speed', position: 'insideBottom', offset: -10, fill: '#888' }}
                        />
                        <YAxis
                            type="number"
                            dataKey={category === 'turrets' ? 'dps' : 'health'}
                            name={category === 'turrets' ? 'DPS' : 'Health'}
                            stroke="#888"
                            label={{ value: category === 'turrets' ? 'Damage Per Second' : 'Base Health', angle: -90, position: 'insideLeft', fill: '#888' }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }} />
                        <ReferenceLine x={avgX} stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" label={{ position: 'top', value: 'Avg', fill: '#555', fontSize: '10px' }} />
                        <ReferenceLine y={avgY} stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" label={{ position: 'right', value: 'Avg', fill: '#555', fontSize: '10px' }} />

                        <Scatter
                            name="Assets"
                            data={chartData}
                            fill="#8884d8"
                            shape={(props) => {
                                const { cx, cy, fill, payload } = props;
                                const isOP = category === 'turrets' ? (payload.dps > avgY * 1.5 && payload.cost < avgX * 0.8) : false;
                                const isUP = category === 'turrets' ? (payload.dps < avgY * 0.5 && payload.cost > avgX * 1.2) : false;
                                let color = '#00bcd4';
                                if (isOP) color = '#e91e63';
                                if (isUP) color = '#ff9800';

                                if (category === 'units') {
                                    const isTanky = payload.health > avgY * 1.5 && payload.speed < avgX * 0.8;
                                    const isGlassCannon = payload.health < avgY * 0.5 && payload.speed > avgX * 1.5;
                                    if (isTanky) color = '#e91e63';
                                    if (isGlassCannon) color = '#ff9800';
                                }

                                return (
                                    <circle cx={cx} cy={cy} r={6} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                                        onMouseEnter={(e) => { e.target.setAttribute('r', 10); e.target.setAttribute('stroke', '#fff'); e.target.setAttribute('stroke-width', 2); }}
                                        onMouseLeave={(e) => { e.target.setAttribute('r', 6); e.target.setAttribute('stroke', 'rgba(0,0,0,0.5)'); e.target.setAttribute('stroke-width', 1); }}
                                    />
                                );
                            }}
                        />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            {chartData.length === 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#666' }}>
                    No valid numerical data to simulate.
                </div>
            )}
        </div>
    );
}
