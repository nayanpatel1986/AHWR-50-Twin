import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Grid, Dialog, DialogTitle, DialogContent, FormControl, InputLabel, Select, MenuItem, Button, DialogActions } from '@mui/material';
import { Settings, Edit2, Activity, Database } from 'lucide-react';

const AVAILABLE_METRICS = [
    { key: 'hook_load', label: 'Hook Load', unit: 'tons' },
    { key: 'wob', label: 'Weight on Bit', unit: 'kips' },
    { key: 'rop', label: 'Rate of Penetration', unit: 'ft/hr' },
    { key: 'bit_depth', label: 'Bit Depth', unit: 'ft' },
    { key: 'hole_depth', label: 'Hole Depth', unit: 'ft' },
    { key: 'block_position', label: 'Block Position', unit: 'ft' },
    { key: 'pump_pressure', label: 'Pump Pressure', unit: 'psi' },
    { key: 'engine_rpm', label: 'Engine RPM', unit: 'RPM' },
    { key: 'torque', label: 'Torque', unit: 'ft-lbs' },
    { key: 'flow_in', label: 'Flow In', unit: 'GPM' },
    { key: 'flow_out', label: 'Flow Out', unit: 'GPM' },
    { key: 'oil_pressure', label: 'Oil Pressure', unit: 'psi' },
    { key: 'spm1', label: 'SPM 1', unit: 'spm' },
    { key: 'spm2', label: 'SPM 2', unit: 'spm' },
    { key: 'trip_tank', label: 'Trip Tank', unit: 'm³' },
    { key: 'rig_air_pressure', label: 'Rig Air Pressure', unit: 'psi' },
    { key: 'total_spm', label: 'Total SPM', unit: 'spm' },
    { key: 'annular_pressure', label: 'Annular Pressure', unit: 'psi' },
    { key: 'manifold_pressure', label: 'Manifold Pressure', unit: 'psi' },
    { key: 'accumulator_pressure', label: 'Accumulator Pressure', unit: 'psi' },
];

const DEFAULT_CONFIG = [
    { key: 'hook_load', label: 'HOOK LOAD', unit: 'tons' },
    { key: 'bit_depth', label: 'BIT DEPTH', unit: 'ft' },
    { key: 'wob', label: 'WOB', unit: 'kips' },
    { key: 'pump_pressure', label: 'PUMP PRESS', unit: 'psi' }
];

const StatsPanel = ({ rigData }) => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [editMode, setEditMode] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null); // Index of slot being edited
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Temporary state for the dialog
    const [tempConfig, setTempConfig] = useState({ key: '', label: '', unit: '' });

    useEffect(() => {
        const saved = localStorage.getItem('romii_stats_panel_config_v3');
        if (saved) {
            setConfig(JSON.parse(saved));
        }
    }, []);

    const saveConfig = (newConfig) => {
        setConfig(newConfig);
        localStorage.setItem('romii_stats_panel_config_v3', JSON.stringify(newConfig));
    };

    const handleEditClick = (index) => {
        if (!editMode) return;
        setEditingSlot(index);
        const current = config[index];
        setTempConfig(current);
        setIsDialogOpen(true);
    };

    const handleSaveSlot = () => {
        const newConfig = [...config];
        // Auto-set label and unit based on key if not manually overriden (simplification: just take defaults)
        const metric = AVAILABLE_METRICS.find(m => m.key === tempConfig.key);

        newConfig[editingSlot] = {
            key: tempConfig.key,
            label: metric ? metric.label.toUpperCase() : 'UNKNOWN',
            unit: metric ? metric.unit : ''
        };

        saveConfig(newConfig);
        setIsDialogOpen(false);
    };

    const getValue = (key) => {
        // Handle nested or flat data if needed, but rigData passed is usually flat from Dashboard
        let val = rigData[key];
        if (val === undefined || val === null) return '0';
        if (typeof val === 'number') {
            if (key.includes('depth')) return val.toFixed(1);
            if (key === 'wob') return val.toFixed(1);
            return val.toFixed(0);
        }
        return val;
    };

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Activity size={16} /> KEY PERFORMANCE INDICATORS
                </Typography>
                <IconButton
                    size="small"
                    onClick={() => setEditMode(!editMode)}
                    sx={{ color: editMode ? '#fbbf24' : '#64748b', bgcolor: editMode ? 'rgba(251, 191, 36, 0.1)' : 'transparent' }}
                >
                    <Settings size={14} />
                </IconButton>
            </Box>

            <Grid container spacing={2}>
                {config.map((item, index) => (
                    <Grid item xs={6} md={3} key={index} sx={{ display: 'flex' }}>
                        <Paper
                            onClick={() => handleEditClick(index)}
                            sx={{
                                width: '100%',
                                p: 2,
                                bgcolor: '#1e293b',
                                color: 'white',
                                textAlign: 'center',
                                border: editMode ? '1px dashed #fbbf24' : '1px solid #334155',
                                cursor: editMode ? 'pointer' : 'default',
                                position: 'relative',
                                borderRadius: 2,
                                height: '116px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: editMode ? '#334155' : '#1e293b',
                                    transform: editMode ? 'scale(1.02)' : 'none'
                                }
                            }}
                        >
                            {editMode && (
                                <Box sx={{ position: 'absolute', top: 5, right: 5, color: '#fbbf24' }}>
                                    <Edit2 size={12} />
                                </Box>
                            )}
                            <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: 1, fontWeight: 'bold' }}>
                                {item.label}
                            </Typography>
                            <Box sx={{ mt: 'auto' }}>
                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#38bdf8', mt: 1 }}>
                                    {getValue(item.key)}
                                    <Typography component="span" variant="caption" sx={{ ml: 0.5, color: '#64748b' }}>
                                        {item.unit}
                                    </Typography>
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Config Dialog */}
            <Dialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                PaperProps={{ sx: { bgcolor: '#1e293b', color: 'white', minWidth: 300 } }}
            >
                <DialogTitle>Configure Slot {editingSlot + 1}</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel sx={{ color: '#94a3b8' }}>Parameter</InputLabel>
                        <Select
                            value={tempConfig.key}
                            label="Parameter"
                            onChange={(e) => setTempConfig({ ...tempConfig, key: e.target.value })}
                            sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }, '& .MuiSvgIcon-root': { color: '#94a3b8' } }}
                        >
                            {AVAILABLE_METRICS.map((m) => (
                                <MenuItem key={m.key} value={m.key}>
                                    {m.label} ({m.unit})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDialogOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                    <Button onClick={handleSaveSlot} variant="contained" sx={{ bgcolor: '#38bdf8' }}>Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StatsPanel;
