import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import io from 'socket.io-client';
import BOPStack from './BOPStack';
import AnalogGauge from '../Common/AnalogGauge';
import KillSheet from './KillSheet';

const socket = io('/');

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

    useEffect(() => {
        socket.on('rig_data', (newData) => {
            if (newData.well_control) {
                setWcData({
                    annular_pressure: Number(newData.well_control.annular_pressure) || 0,
                    manifold_pressure: Number(newData.well_control.manifold_pressure) || 0,
                    accumulator_pressure: Number(newData.well_control.accumulator_pressure) || 0,
                    // User Request: "when ram... is highlighted all are digital inputs"
                    // Convention: true = Activated/Closed (Standard PLC Logic: 1 = Alarm/Triggered)
                    annular: { open: Number(newData.well_control.annular_open) > 0, close: Number(newData.well_control.annular_close) > 0 },
                    pipe: { open: Number(newData.well_control.pipe_ram_open) > 0, close: Number(newData.well_control.pipe_ram_close) > 0 },
                    blind: { open: Number(newData.well_control.blind_ram_open) > 0, close: Number(newData.well_control.blind_ram_close) > 0 },
                    shear: Number(newData.well_control.shear_ram_open) > 0
                });
            }
        });
        return () => socket.off('rig_data');
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'white' }}>Well Control & BOP</Typography>

            <Grid container spacing={4}>
                {/* Left Side: BOP Stack Visualization (Consumer of Digital Inputs) */}
                <Grid item xs={12} md={5} lg={4}>
                    <BOPStack rams={wcData} />
                </Grid>

                {/* Right Side: Analog Gauges & Kill Sheet */}
                <Grid item xs={12} md={7} lg={8}>
                    {/* Analog Gauges for Pressures */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        {/* Annular Pressure */}
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, bgcolor: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <AnalogGauge
                                    value={wcData.annular_pressure}
                                    min={0} max={5000}
                                    label="ANNULAR"
                                    unit="psi"
                                    size={200}
                                    color="#38bdf8"
                                />
                            </Paper>
                        </Grid>

                        {/* Manifold Pressure */}
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, bgcolor: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <AnalogGauge
                                    value={wcData.manifold_pressure}
                                    min={0} max={10000}
                                    label="MANIFOLD"
                                    unit="psi"
                                    color="#818cf8"
                                    size={200}
                                />
                            </Paper>
                        </Grid>

                        {/* Accumulator Pressure */}
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, bgcolor: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <AnalogGauge
                                    value={wcData.accumulator_pressure}
                                    min={0} max={5000}
                                    label="ACCUMULATOR"
                                    unit="psi"
                                    color="#f472b6"
                                    size={200}
                                />
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Kill Sheet Calculator */}
                    <Box sx={{ mb: 4 }}>
                        <KillSheet />
                    </Box>

                    {/* Status Footer */}
                    <Box sx={{ p: 3, bgcolor: 'rgba(30, 41, 59, 0.5)', borderRadius: 2, border: '1px dashed #475569' }}>
                        <Typography variant="h6" sx={{ color: '#94a3b8', mb: 1 }}>Live Data Status</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Data Source: <strong>PLC / MODBUS (Real-Time)</strong><br />
                            Status: <span style={{ color: '#4ade80' }}>● Connected</span>
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

export default WellControlDashboard;
