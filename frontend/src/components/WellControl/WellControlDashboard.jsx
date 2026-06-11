import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { socket } from '../../socket';
import BOPStack from './BOPStack';
import AnalogGauge from '../Common/AnalogGauge';
import GaugeCard from '../Common/GaugeCard';
import KillSheet from './KillSheet';
import axios from '../../api';

const DASH = '—'; // em dash for "no data"

const WellControlDashboard = () => {
    // State for Well Control Data
    const [wcData, setWcData] = useState({
        annular_pressure: 0,
        manifold_pressure: 0,
        accumulator_pressure: 0,
        annular_open: false,
        annular_close: false,
        pipe_ram_open: false,
        pipe_ram_close: false,
        blind_ram_open: false,
        blind_ram_close: false,
        shear_ram_open: false
    });

    // Honest telemetry state. Until proven live + fresh, treat as NOT available.
    const [feed, setFeed] = useState({
        connected: socket.connected,
        available: false, // well_control.available === true
        stale: false,     // data._meta.stale
        hasData: false
    });

    useEffect(() => {
        // Fetch latest data on mount
        axios.get('/api/rig/latest')
            .then(({ data }) => {
                applyData(data);
            })
            .catch(err => console.error("Failed to fetch latest well control data:", err));

        const handler = (newData) => applyData(newData);
        socket.on('rig_data', handler);

        const handleConnect = () => setFeed(prev => ({ ...prev, connected: true }));
        const handleDisconnect = () => setFeed(prev => ({ ...prev, connected: false }));
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        return () => {
            socket.off('rig_data', handler);
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, []);

    const applyData = (newData) => {
        if (!newData) return;
        const wc = newData.well_control;
        const meta = newData._meta;
        const available = !!(wc && wc.available !== false);
        setFeed(prev => ({
            connected: socket.connected,
            available,
            stale: meta ? !!meta.stale : prev.stale,
            hasData: true
        }));
        if (available && wc) {
            processWellControlData(wc);
        }
    };

    const processWellControlData = (wellControlData) => {
        setWcData({
            annular_pressure: Number(wellControlData.annular_pressure) || 0,
            manifold_pressure: Number(wellControlData.manifold_pressure) || 0,
            accumulator_pressure: Number(wellControlData.accumulator_pressure) || 0,
            annular: { open: Number(wellControlData.annular_open) > 0, close: Number(wellControlData.annular_close) > 0 },
            pipe: { open: Number(wellControlData.pipe_ram_open) > 0, close: Number(wellControlData.pipe_ram_close) > 0 },
            blind: { open: Number(wellControlData.blind_ram_open) > 0, close: Number(wellControlData.blind_ram_close) > 0 },
            shear: Number(wellControlData.shear_ram_open) > 0
        });
    };

    // Data is only trustworthy/live when connected, available, and not stale.
    const isLive = feed.connected && feed.available && !feed.stale;
    const banner = !feed.connected
        ? { text: 'WELL CONTROL TELEMETRY UNAVAILABLE - SOCKET DISCONNECTED', color: '#ef4444' }
        : (!feed.available
            ? { text: 'WELL CONTROL TELEMETRY UNAVAILABLE - NO BOP DATA SOURCE', color: '#ef4444' }
            : (feed.stale
                ? { text: 'NO LIVE DATA - WELL CONTROL FEED IS STALE', color: '#fbbf24' }
                : (!feed.hasData
                    ? { text: 'WAITING FOR WELL CONTROL TELEMETRY...', color: '#fbbf24' }
                    : null)));

    // When not live, surface pressures as "—" instead of a misleading 0.
    const fmtPressure = (v) => (isLive ? v : DASH);

    return (
        <Box sx={{ p: { xs: 0, md: 1 }, maxWidth: '100%', overflowX: 'hidden' }}>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold', color: 'white' }}>Well Control & BOP</Typography>

            {/* Honest telemetry banner: a dead/unavailable feed must NOT look like a safe closed BOP. */}
            {banner && (
                <Box sx={{
                    mb: 3, px: 2, py: 1.5, borderRadius: 2,
                    bgcolor: `${banner.color}1a`,
                    border: `1px solid ${banner.color}`,
                    display: 'flex', alignItems: 'center', gap: 1.5
                }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: banner.color, boxShadow: `0 0 10px ${banner.color}` }} />
                    <Typography variant="subtitle1" sx={{ color: banner.color, fontWeight: 'bold', letterSpacing: 0.5 }}>
                        {banner.text}
                    </Typography>
                </Box>
            )}

            <Grid container spacing={4}>
                {/* Left Side: BOP Stack Visualization (Consumer of Digital Inputs) */}
                <Grid item xs={12} md={5} lg={4}>
                    <BOPStack rams={wcData} live={isLive} accumulatorPressure={wcData.accumulator_pressure} />
                </Grid>

                {/* Right Side: Analog Gauges & Kill Sheet */}
                <Grid item xs={12} md={7} lg={8}>
                    {/* Analog Gauges for Pressures */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        {/* Annular Pressure */}
                        <Grid item xs={12} md={4}>
                            <GaugeCard opacity={isLive ? 1 : 0.5}>
                                <AnalogGauge
                                    value={fmtPressure(wcData.annular_pressure)}
                                    min={0} max={5000}
                                    label="ANNULAR"
                                    unit={isLive ? 'psi' : 'NO DATA'}
                                    size="fill"
                                    color="#38bdf8"
                                />
                            </GaugeCard>
                        </Grid>

                        {/* Manifold Pressure */}
                        <Grid item xs={12} md={4}>
                            <GaugeCard opacity={isLive ? 1 : 0.5}>
                                <AnalogGauge
                                    value={fmtPressure(wcData.manifold_pressure)}
                                    min={0} max={10000}
                                    label="MANIFOLD"
                                    unit={isLive ? 'psi' : 'NO DATA'}
                                    color="#818cf8"
                                    size="fill"
                                />
                            </GaugeCard>
                        </Grid>

                        {/* Accumulator Pressure */}
                        <Grid item xs={12} md={4}>
                            <GaugeCard opacity={isLive ? 1 : 0.5}>
                                <AnalogGauge
                                    value={fmtPressure(wcData.accumulator_pressure)}
                                    min={0} max={5000}
                                    label="ACCUMULATOR"
                                    unit={isLive ? 'psi' : 'NO DATA'}
                                    color="#f472b6"
                                    size="fill"
                                />
                            </GaugeCard>
                        </Grid>
                    </Grid>

                    {/* Kill Sheet Calculator */}
                    <Box sx={{ mb: 4 }}>
                        <KillSheet />
                    </Box>

                    {/* Status Footer - reflects REAL telemetry state */}
                    <Box sx={{ p: 3, bgcolor: 'rgba(30, 41, 59, 0.5)', borderRadius: 2, border: '1px dashed #475569' }}>
                        <Typography variant="h6" sx={{ color: '#94a3b8', mb: 1 }}>Live Data Status</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Data Source: <strong>{feed.available ? 'PLC / MODBUS' : 'NONE (no BOP source)'}</strong><br />
                            Socket: <span style={{ color: feed.connected ? '#4ade80' : '#ef4444' }}>
                                ● {feed.connected ? 'Connected' : 'Disconnected'}
                            </span><br />
                            Status: {isLive
                                ? <span style={{ color: '#4ade80' }}>● Live</span>
                                : <span style={{ color: feed.stale ? '#fbbf24' : '#ef4444' }}>
                                    ● {feed.stale ? 'Stale (not live)' : 'No live data'}
                                  </span>}
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

export default WellControlDashboard;
