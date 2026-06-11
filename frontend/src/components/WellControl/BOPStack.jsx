import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const RamIndicator = ({ label, active }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
            sx={{
                width: 12, height: 12, borderRadius: '50%',
                bgcolor: active ? '#ef4444' : '#1e293b',
                border: active ? '2px solid #f87171' : '2px solid #475569',
                boxShadow: active ? '0 0 8px #ef4444' : 'none',
                transition: 'all 0.3s'
            }}
        />
        <Typography variant="caption" sx={{ color: active ? 'white' : '#64748b', fontWeight: active ? 'bold' : 'normal' }}>
            {label}
        </Typography>
    </Box>
);

const BOPStack = ({ rams, live = true, accumulatorPressure }) => {
    // When the feed is not live, do NOT render ram positions (false would look like a
    // confirmed-open safe state). Force everything to an "unknown" (inactive) display.
    const status = live ? {
        annular: rams?.annular || { open: false, close: false },
        pipe: rams?.pipe || { open: false, close: false },
        blind: rams?.blind || { open: false, close: false },
        shear: rams?.shear || false
    } : {
        annular: { open: false, close: false },
        pipe: { open: false, close: false },
        blind: { open: false, close: false },
        shear: false
    };

    const RamPopup = ({ text, color, top }) => (
        <Box sx={{
            position: 'absolute', top: top, left: '50%', transform: 'translateX(-50%)',
            bgcolor: color === 'red' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)',
            px: 1.5, py: 0.5, borderRadius: 1,
            border: `2px solid ${color === 'red' ? '#fca5a5' : '#86efac'}`,
            boxShadow: `0 0 15px ${color === 'red' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)'}`,
            zIndex: 10, textAlign: 'center', pointerEvents: 'none',
            animation: 'pulseGlowBOP 1s ease-in-out infinite alternate',
            '@keyframes pulseGlowBOP': {
                '0%': { opacity: 1, transform: 'translateX(-50%) scale(1)' },
                '100%': { opacity: 0.85, transform: 'translateX(-50%) scale(1.05)' }
            }
        }}>
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', fontSize: 10, letterSpacing: 1 }}>
                {text}
            </Typography>
        </Box>
    );

    return (
        <Paper
            sx={{
                p: { xs: 2, md: 3 },
                bgcolor: '#0f172a',
                color: 'white',
                minHeight: { xs: 520, md: '100%' },
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2, md: 3 },
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #1e293b',
                overflow: 'hidden'
            }}
        >

            {/* --- BOP STACK SVG --- */}
            <Box
                sx={{
                    position: 'relative',
                    flex: '0 0 auto',
                    width: { xs: 'min(58vw, 260px)', md: 220, xl: 260 },
                    maxWidth: '100%',
                    minWidth: 160,
                    aspectRatio: '2 / 5'
                }}
            >
                <svg width="100%" height="100%" viewBox="0 0 200 500">
                    <defs>
                        <linearGradient id="bop-metal" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#334155" />
                            <stop offset="50%" stopColor="#475569" />
                            <stop offset="100%" stopColor="#334155" />
                        </linearGradient>
                        <linearGradient id="ram-active" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#dc2626" />
                            <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                    </defs>

                    {/* Central Bore */}
                    <rect x="90" y="0" width="20" height="500" fill="#1e293b" />

                    {/* --- 1. ANNULAR PREVENTER (TOP) --- */}
                    <path d="M 50 20 L 150 20 L 160 80 L 150 120 L 50 120 L 40 80 Z" fill="url(#bop-metal)" stroke="#94a3b8" strokeWidth="2" />
                    <rect x="60" y="40" width="80" height="60" rx="4" fill={status.annular.close ? 'url(#ram-active)' : '#1e293b'} stroke="#334155" />
                    <text x="100" y="75" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">ANNULAR</text>

                    {/* --- 2. PIPE RAMS (UPPER) --- */}
                    <g transform="translate(0, 160)">
                        {/* Body */}
                        <rect x="40" y="0" width="120" height="80" rx="4" fill="url(#bop-metal)" stroke="#94a3b8" strokeWidth="2" />
                        {/* Rams */}
                        <rect x="45" y="20" width={status.pipe.close ? "55" : "30"} height="40" fill={status.pipe.close ? '#ef4444' : '#1e293b'} stroke="#334155" style={{ transition: 'all 0.5s' }} />
                        <rect x={status.pipe.close ? "100" : "125"} y="20" width={status.pipe.close ? "55" : "30"} height="40" fill={status.pipe.close ? '#ef4444' : '#1e293b'} stroke="#334155" style={{ transition: 'all 0.5s' }} />
                        <text x="100" y="45" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">PIPE RAM</text>
                    </g>
                    {/* Flange */}
                    <rect x="60" y="140" width="80" height="20" fill="url(#bop-metal)" stroke="#475569" />

                    {/* --- 3. BLIND RAMS (MIDDLE) --- */}
                    <g transform="translate(0, 260)">
                        <rect x="40" y="0" width="120" height="80" rx="4" fill="url(#bop-metal)" stroke="#94a3b8" strokeWidth="2" />
                        {/* Rams */}
                        <rect x="45" y="20" width={status.blind.close ? "55" : "30"} height="40" fill={status.blind.close ? '#ef4444' : '#1e293b'} stroke="#334155" style={{ transition: 'all 0.5s' }} />
                        <rect x={status.blind.close ? "100" : "125"} y="20" width={status.blind.close ? "55" : "30"} height="40" fill={status.blind.close ? '#ef4444' : '#1e293b'} stroke="#334155" style={{ transition: 'all 0.5s' }} />
                        <text x="100" y="45" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">BLIND RAM</text>
                    </g>
                    {/* Flange */}
                    <rect x="60" y="240" width="80" height="20" fill="url(#bop-metal)" stroke="#475569" />

                    {/* --- 4. SHEAR RAMS (BOTTOM) --- */}
                    <g transform="translate(0, 360)">
                        <rect x="40" y="0" width="120" height="80" rx="4" fill="url(#bop-metal)" stroke="#94a3b8" strokeWidth="2" />
                        {/* Rams */}
                        <rect x="45" y="20" width={status.shear ? "55" : "30"} height="40" fill={status.shear ? '#ef4444' : '#1e293b'} stroke="#334155" style={{ transition: 'all 0.5s' }} />
                        <rect x={status.shear ? "100" : "125"} y="20" width={status.shear ? "55" : "30"} height="40" fill={status.shear ? '#ef4444' : '#1e293b'} stroke="#334155" style={{ transition: 'all 0.5s' }} />
                        <text x="100" y="45" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">SHEAR RAM</text>
                    </g>
                    {/* Flange */}
                    <rect x="60" y="340" width="80" height="20" fill="url(#bop-metal)" stroke="#475569" />

                    {/* Wellhead Connector */}
                    <path d="M 60 460 L 140 460 L 150 500 L 50 500 Z" fill="url(#bop-metal)" stroke="#94a3b8" />
                </svg>

                {/* --- DYNAMIC POPUPS --- */}
                {status.annular.open && <RamPopup text="ANNULAR OPEN" color="green" top="10%" />}
                {status.annular.close && <RamPopup text="ANNULAR CLOSE" color="red" top="10%" />}

                {status.pipe.open && <RamPopup text="PIPE RAM OPEN" color="green" top="36%" />}
                {status.pipe.close && <RamPopup text="PIPE RAM CLOSE" color="red" top="36%" />}

                {status.blind.open && <RamPopup text="BLIND RAM OPEN" color="green" top="56%" />}
                {status.blind.close && <RamPopup text="BLIND RAM CLOSE" color="red" top="56%" />}
            </Box>

            {/* --- DIGITAL INDICATORS --- */}
            <Box sx={{ width: '100%', maxWidth: 320, minWidth: 0 }}>
                <Typography variant="h6" sx={{ color: '#94a3b8', mb: 3, borderBottom: '1px solid #334155', pb: 1 }}>
                    RAM STATUS
                </Typography>

                {!live && (
                    <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 'bold', display: 'block', mb: 1 }}>
                        ● NO LIVE DATA — RAM POSITIONS UNKNOWN
                    </Typography>
                )}

                <RamIndicator label="ANNULAR PREVENTER" active={status.annular.close} />
                <RamIndicator label="PIPE RAMS" active={status.pipe.close} />
                <RamIndicator label="BLIND RAMS" active={status.blind.close} />
                <RamIndicator label="SHEAR RAMS" active={status.shear} />

                <Box sx={{ mt: 4, p: 2, bgcolor: '#1e293b', borderRadius: 1, border: '1px solid #334155' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1 }}>SYSTEM PRESSURE (ACCUMULATOR)</Typography>
                    {live && Number.isFinite(Number(accumulatorPressure)) ? (
                        <Typography variant="h4" sx={{ color: '#38bdf8', fontWeight: 'bold' }}>
                            {Math.round(Number(accumulatorPressure))} <span style={{ fontSize: 14 }}>psi</span>
                        </Typography>
                    ) : (
                        <Typography variant="h4" sx={{ color: '#64748b', fontWeight: 'bold' }}>
                            — <span style={{ fontSize: 14 }}>NO DATA</span>
                        </Typography>
                    )}
                </Box>
            </Box>

        </Paper>
    );
};

export default BOPStack;
