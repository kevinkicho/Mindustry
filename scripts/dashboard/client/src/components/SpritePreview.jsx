import React from 'react';

const API_BASE = 'http://localhost:3001';

const SpritePreview = ({ asset, teamColor = '#ffa500', size = '128px' }) => {
    if (!asset || !asset.spriteInfo || !asset.spriteInfo.path) {
        return (
            <div style={{ width: size, height: size, background: '#1a1a1a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '0.8rem', border: '1px dashed #333' }}>
                NO SPRITE
            </div>
        );
    }

    const { path, layers = [] } = asset.spriteInfo;
    const baseUrl = `${API_BASE}/sprites/${path}`;

    const containerStyle = {
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle, #222 0%, #0a0a0a 100%)',
        borderRadius: '12px',
        border: '1px solid #333',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
    };

    const imageStyle = {
        maxWidth: '90%',
        maxHeight: '90%',
        objectFit: 'contain',
        imageRendering: 'pixelated', // Keeps Mindustry art crisp
        position: 'absolute'
    };

    return (
        <div style={containerStyle}>
            {/* Base Layer */}
            <img src={baseUrl} alt={asset.name} style={imageStyle} />

            {/* Sub Layers */}
            {layers.map((layer, idx) => {
                const layerUrl = `${API_BASE}/sprites/${layer.path}`;

                // If it's a team color layer, apply the mask
                if (layer.type === 'team' || layer.type === 'teamtop') {
                    return (
                        <div
                            key={idx}
                            style={{
                                ...imageStyle,
                                width: '100%',
                                height: '100%',
                                backgroundColor: teamColor,
                                WebkitMaskImage: `url(${layerUrl})`,
                                maskImage: `url(${layerUrl})`,
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskPosition: 'center',
                                mixBlendMode: 'screen', // Mimic game's additive/screen tinting
                                opacity: 0.9,
                                transition: 'background-color 0.3s ease'
                            }}
                        />
                    );
                }

                // Other layers (top, mid, etc.) just overlay normally
                return (
                    <img
                        key={idx}
                        src={layerUrl}
                        alt={`${asset.name}-${layer.type}`}
                        style={imageStyle}
                    />
                );
            })}
        </div>
    );
};

export default SpritePreview;
