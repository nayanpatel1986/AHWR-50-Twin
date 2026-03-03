import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Gauge, Droplets, Waves } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('/');

function MetricCard({ title, value, unit, icon: Icon, color = '#38bdf8' }) {
    return (
        <Paper sx={{ p: 2, bgcolor: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: `${color}20`, color: color }}>
                <Icon size={24} />
            </Box>
            <Box>
                <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>{title}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {value} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{unit}</span>
                </Typography>
            </Box>
        </Paper>
    );
}

export default function MudPumpDashboard() {
    const [pumpData, setPumpData] = useState({
        spm: 0,
        pressure: 0,
        total_spm: 0,
        flow_in: 0,
        flow_out: 0
    });
    const [flowTrend, setFlowTrend] = useState([]);

    useEffect(() => {
        socket.on('rig_data', (data) => {
            if (data.mudpump) {
                setPumpData(data.mudpump);

                // Update Flow Trend
                setFlowTrend(prev => {
                    const newPoint = {
                        name: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        flow_in: data.mudpump.flow_in,
                        flow_out: data.mudpump.flow_out
                    };
                    const updated = [...prev, newPoint];
                    if (updated.length > 30) updated.shift();
                    return updated;
                });
            }
        });

        return () => {
            socket.off('rig_data');
        };
    }, []);

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Mud Pump System</Typography>

            <Grid container spacing={3}>
                {/* Key Metrics */}
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="PUMP SPM"
                        value={pumpData.spm}
                        unit="SPM"
                        icon={Activity}
                        color="#ec4899"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="PRESSURE"
                        value={pumpData.pressure}
                        unit="psi"
                        icon={Gauge}
                        color="#ef4444"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="FLOW IN"
                        value={pumpData.flow_in}
                        unit="GPM"
                        icon={Droplets}
                        color="#3b82f6"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="FLOW OUT"
                        value={pumpData.flow_out}
                        unit="GPM"
                        icon={Waves}
                        color="#22c55e"
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="TOTAL STROKES"
                        value={pumpData.total_spm}
                        unit="Strokes"
                        icon={Activity}
                        color="#f59e0b"
                    />
                </Grid>

                {/* Flow Trend Chart */}
                <Grid item xs={12} md={12}>
                    <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white', minHeight: 400 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Flow In vs Flow Out Trend</Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={flowTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                                <Legend />
                                <Line type="monotone" dataKey="flow_in" stroke="#3b82f6" name="Flow In" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="flow_out" stroke="#22c55e" name="Flow Out" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
