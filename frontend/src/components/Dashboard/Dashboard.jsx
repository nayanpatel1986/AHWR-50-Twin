import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, MenuItem, Select, InputLabel, FormControl, Divider, Slider, Switch, FormControlLabel, Checkbox } from '@mui/material';
import io from 'socket.io-client';
import AnalogGauge from '../Common/AnalogGauge';
import RigVisualizer from './RigVisualizer';
import StatsPanel from './StatsPanel';
import {
    Activity,
    Settings,
    Edit2,
    Database,
    Upload,
    Download,
    RefreshCw,
    Plus,
    Trash2,
    Check,
    X,
    ArrowDownToLine,
    Move
} from 'lucide-react';

// Available parameters for side stats
const ALL_PARAMETERS = [
    { key: 'hook_load', label: 'Start Hook Load', unit: 'tons', min: 0, max: 100 },
    { key: 'pump_pressure', label: 'Pump Pressure', unit: 'psi', min: 0, max: 5000 },
    { key: 'flow_out', label: 'Flow Out', unit: 'GPM', min: 0, max: 1000 },
    { key: 'torque', label: 'Rotary Torque', unit: 'ft-lbs', min: 0, max: 20000 },
    { key: 'engine_rpm', label: 'Engine RPM', unit: 'RPM', min: 0, max: 2000 },
    { key: 'wob', label: 'Weight on Bit', unit: 'kips', min: 0, max: 100 },
    { key: 'trip_tank', label: 'Trip Tank', unit: 'm³', min: 0, max: 100 },
    { key: 'rig_air_pressure', label: 'Rig Air', unit: 'psi', min: 0, max: 200 },
    { key: 'total_spm', label: 'Total SPM', unit: 'spm', min: 0, max: 500 },
    { key: 'oil_pressure', label: 'Oil Pressure', unit: 'psi', min: 0, max: 100 },
];

const DEFAULT_SIDE_STATS = [
    { key: 'pump_pressure', label: 'Pump Pressure', unit: 'psi', min: 0, max: 5000 },
    { key: 'torque', label: 'Rotary Torque', unit: 'ft-lbs', min: 0, max: 20000 }
];

const socket = io('/');

// Default Config with Layout Props
const DEFAULT_DASHBOARD_GAUGES = [
    // Left Stack
    { id: 'd2', label: 'PUMP PRESSURE', dataKey: 'pump_pressure', min: 0, max: 5000, unit: 'psi', color: '#fb7185', gridWidth: 3, size: 160 },
    { id: 'd4', label: 'TORQUE', dataKey: 'torque', min: 0, max: 10000, unit: 'ft-lbs', color: '#fbbf24', gridWidth: 3, size: 160 },
    // Center Big
    { id: 'd1', label: 'HOOK LOAD', dataKey: 'hook_load', min: 0, max: 100, unit: 'ton', color: '#38bdf8', gridWidth: 6, size: 300, majorTicks: 10, minorTicks: 4 },
    // Right Stack
    { id: 'd3', label: 'ENGINE RPM', dataKey: 'engine_rpm', min: 0, max: 2000, unit: 'RPM', color: '#34d399', gridWidth: 3, size: 160 },
    { id: 'd5', label: 'TRIP TANK', dataKey: 'trip_tank', min: 0, max: 100, unit: 'm³', color: '#a78bfa', gridWidth: 3, size: 160 },
    { id: 'd6', label: 'RIG AIR PRESSURE', dataKey: 'rig_air_pressure', min: 0, max: 200, unit: 'psi', color: '#22d3ee', gridWidth: 3, size: 160 },
];

export default function Dashboard() {
    // --- State ---
    const [rigData, setRigData] = useState({
        hook_load: 0, pump_pressure: 0, engine_rpm: 0, torque: 0,
        block_position: 0, oil_pressure: 0, flow_in: 0, flow_out: 0,
        spm1: 0, spm2: 0, wob: 0, bit_depth: 0, hole_depth: 0,
        trip_tank: 0, rig_air_pressure: 0,
        crownomatic: false, flooromatic: false,
        travelling_up: false, travelling_down: false
    });

    const [gauges, setGauges] = useState(DEFAULT_DASHBOARD_GAUGES);
    const [editMode, setEditMode] = useState(false);
    const [editingGauge, setEditingGauge] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Drag State for Visual Feedback
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Drilling Controls State
    const [isDrillingControlsOpen, setIsDrillingControlsOpen] = useState(false);
    const [calibrationValues, setCalibrationValues] = useState({ bitDepth: '', holeDepth: '', mode: 'wob' });

    // Unit State
    // Unit State
    const [units, setUnits] = useState({ wob: 'tonnes', depth: 'ft' });

    // Side Stats State
    const [sideStats, setSideStats] = useState(DEFAULT_SIDE_STATS);
    const [editStatOpen, setEditStatOpen] = useState(false);
    const [editingStatIndex, setEditingStatIndex] = useState(null);
    const [tempStatKey, setTempStatKey] = useState('');

    // --- Effects ---
    useEffect(() => {
        console.log("Fetching dashboard layout from /api/dashboard/layout...");
        // Load Global Layout from Backend
        fetch(`/api/dashboard/layout?t=${Date.now()}`)
            .then(res => {
                console.log("Dashboard layout response:", res.status);
                return res.json();
            })
            .then(config => {
                console.log("Loaded dashboard config:", config);
                if (config.gauges) setGauges(config.gauges);
                if (config.sideStats) setSideStats(config.sideStats);
                if (config.units) setUnits(config.units);
            })
            .catch(err => console.error("Failed to load dashboard layout:", err));
    }, []);

    const saveSideStats = (newStats) => {
        setSideStats(newStats);
        fetch('/api/dashboard/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gauges, sideStats: newStats, units })
        }).catch(e => console.error("Failed to save layout", e));
    };

    const handleEditSideStat = (index) => {
        setEditingStatIndex(index);
        setTempStatKey(sideStats[index].key);
        setEditStatOpen(true);
    };

    const handleSaveSideStat = () => {
        const param = ALL_PARAMETERS.find(p => p.key === tempStatKey);
        if (!param) return;
        const newStats = [...sideStats];
        newStats[editingStatIndex] = { ...param };
        saveSideStats(newStats);
        setEditStatOpen(false);
    };

    // --- Effects ---
    // (Consolidated above)

    useEffect(() => {
        // Real-time Layout Updates
        socket.on('dashboard_layout_update', (config) => {
            console.log("Received real-time layout update:", config);
            if (config.gauges) setGauges(config.gauges);
            if (config.sideStats) setSideStats(config.sideStats);
            if (config.units) setUnits(config.units);
        });

        socket.on('rig_data', (newData) => {
            // If we receive an empty object or null, force release to zero
            if (!newData || Object.keys(newData).length === 0) {
                setRigData(prev => ({
                    ...prev,
                    hook_load: 0, pump_pressure: 0, engine_rpm: 0, torque: 0,
                    block_position: 0, oil_pressure: 0, flow_in: 0, flow_out: 0,
                    spm1: 0, spm2: 0, wob: 0, trip_tank: 0, rig_air_pressure: 0,
                    // Preserve stateful depths if needed, or zero them if requested? 
                    // User said "data should be zero", imply sensors. Depth is state.
                    // Let's keep depth from backend (which physics engine maintains) or 0 if backend killed.
                    // Physics engine usually sends depths even if inputs are 0.
                    // But if backend sends {}, we zero sensors.
                }));
                return;
            }

            const flattened = {
                hook_load: newData.drawworks?.hook_load || 0,
                block_position: newData.drawworks?.block_position || 0,
                engine_rpm: newData.engine?.rpm || 0,
                oil_pressure: newData.engine?.oil_pressure || 0,
                pump_pressure: newData.mudpump?.pressure || 0,
                torque: newData.engine?.torque || (newData.engine?.rpm ? newData.engine.rpm * 2.5 : 0),

                flow_in: newData.mudpump?.flow_in || 0,
                flow_out: newData.mudpump?.flow_out || 0,

                // Physics Calculations (Override Mock)
                wob: newData.drilling?.wob !== undefined ? newData.drilling.wob : 0,
                bit_depth: newData.drilling?.bit_depth || 0,
                hole_depth: newData.drilling?.hole_depth || 0,

                // Well Control
                annular_pressure: newData.well_control?.annular_pressure || 0,
                manifold_pressure: newData.well_control?.manifold_pressure || 0,
                accumulator_pressure: newData.well_control?.accumulator_pressure || 0,

                // Additional Analog Inputs
                trip_tank: newData.drawworks?.TRIP_TANK || newData.drawworks?.trip_tank || 0,
                rig_air_pressure: newData.drawworks?.RIG_AIR_PRESSURE || newData.drawworks?.rig_air_pressure || 0,

                // Real Digital Inputs
                crownomatic: newData.drawworks?.crownomatic === 0, // Strict literal 0
                flooromatic: newData.drawworks?.flooromatic === 0,
                travelling_up: newData.drawworks?.travelling_up === 0,
                travelling_down: newData.drawworks?.travelling_down === 0
            };

            setRigData(prev => ({ ...prev, ...flattened }));
        });
        return () => socket.off('rig_data');
    }, []);

    // --- Helpers ---
    const saveGauges = (newGauges) => {
        setGauges(newGauges);
        fetch('/api/dashboard/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gauges: newGauges, sideStats, units })
        }).catch(e => console.error("Failed to save layout", e));
    };

    const saveUnits = (newUnits) => {
        setUnits(newUnits);
        fetch('/api/dashboard/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gauges, sideStats, units: newUnits })
        }).catch(e => console.error("Failed to save layout", e));
    };

    const formatWOB = (val) => {
        if (units.wob === 'lbs') return (val * 1000).toFixed(0);
        if (units.wob === 'tonnes') return (val * 0.453592).toFixed(1);
        return val; // kips
    };

    const formatDepth = (val) => {
        if (units.depth === 'm') return (val * 0.3048).toFixed(1);
        return val; // ft
    };

    // --- Handlers ---
    const handleAddGauge = () => {
        const newId = `d-${Date.now()}`;
        const newGauge = {
            id: newId,
            label: 'NEW GAUGE',
            dataKey: 'hook_load',
            min: 0, max: 100,
            unit: 'unit',
            color: '#ffffff',
            gridWidth: 3,
            size: 160
        };
        saveGauges([...gauges, newGauge]);
    };

    const handleRemoveGauge = (id) => {
        if (window.confirm("Delete this gauge?")) {
            saveGauges(gauges.filter(g => g.id !== id));
        }
    };

    const handleEditSave = () => {
        const newGauges = gauges.map(g => g.id === editingGauge.id ? editingGauge : g);
        saveGauges(newGauges);
        setIsDialogOpen(false);
    };

    const handleReset = () => {
        if (window.confirm("Reset dashboard to default CENTERED layout?")) {
            saveGauges(DEFAULT_DASHBOARD_GAUGES);
        }
    };

    // --- Drilling API Calls ---
    const handleZeroWOB = async () => {
        try {
            await fetch('/api/drilling/zero-wob', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentHookLoad: rigData.hook_load })
            });
            // Optional alert or toast
        } catch (e) {
            console.error(e);
            alert("Failed to Zero WOB");
        }
    };

    const handleSetDepth = async () => {
        try {
            // Convert to FT for backend if needed
            let bitDepth = calibrationValues.bitDepth ? Number(calibrationValues.bitDepth) : undefined;
            let holeDepth = calibrationValues.holeDepth ? Number(calibrationValues.holeDepth) : undefined;

            // If user input meters, convert back to feet for backend storage
            if (units.depth === 'm') {
                if (bitDepth !== undefined) bitDepth = bitDepth / 0.3048;
                if (holeDepth !== undefined) holeDepth = holeDepth / 0.3048;
            }

            await fetch('/api/drilling/set-depth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bitDepth, holeDepth })
            });
            setIsDrillingControlsOpen(false);
        } catch (e) {
            console.error(e);
            alert("Failed to Set Depth");
        }
    };

    // --- DnD Helpers ---
    const handleDragStart = (e, id) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        setDragOverIndex(null);
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId) return;

        const draggedIndex = gauges.findIndex(g => g.id === draggedId);
        if (draggedIndex === -1 || draggedIndex === targetIndex) return;

        const newGauges = [...gauges];
        const [movedItem] = newGauges.splice(draggedIndex, 1);
        newGauges.splice(targetIndex, 0, movedItem);

        saveGauges(newGauges);
    };

    // --- Digital Inputs are now directly parsed from Rig Data ---

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Rig Overview</Typography>

                {/* Controls */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {editMode && (
                        <Button
                            variant="contained"
                            startIcon={<Plus size={18} />}
                            onClick={handleAddGauge}
                            sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
                        >
                            Add Gauge
                        </Button>
                    )}
                    <Box sx={{ display: 'flex', bgcolor: '#1e293b', borderRadius: 1 }}>
                        <IconButton
                            size="small"
                            onClick={() => setEditMode(!editMode)}
                            sx={{ color: editMode ? '#fbbf24' : '#94a3b8' }}
                            title={editMode ? "Done Editing" : "Edit Layout"}
                        >
                            {editMode ? <Check size={18} /> : <Edit2 size={18} />}
                        </IconButton>
                        {editMode && (
                            <IconButton size="small" onClick={handleReset} sx={{ color: '#ef4444' }} title="Reset Defaults">
                                <X size={18} />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* Left Side: Rig Visualizer */}
                <Grid item xs={12} md={4}>
                    <RigVisualizer
                        crownomatic={rigData.crownomatic}
                        flooromatic={rigData.flooromatic}
                        travellingUp={rigData.travelling_up}
                        travellingDown={rigData.travelling_down}
                    />

                    {/* Side Stats Panels */}
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'row', gap: 2 }}>
                        {sideStats.map((stat, index) => {
                            const value = rigData[stat.key] || 0;
                            const ratio = stat.max > 0 ? value / stat.max : 0;
                            const isCritical = ratio > 0.85;

                            return (
                                <Paper key={index} sx={{
                                    flex: 1,
                                    p: 2,
                                    bgcolor: '#1e293b',
                                    color: 'white',
                                    textAlign: 'center',
                                    border: `1px solid ${isCritical ? '#ef4444' : '#334155'}`,
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    borderRadius: 2,
                                    height: '116px',
                                    minHeight: '116px'
                                }}>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: 1, fontWeight: 'bold' }}>
                                        {stat.label.toUpperCase()}
                                    </Typography>
                                    <Box sx={{ mt: 'auto' }}>
                                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: isCritical ? '#ef4444' : '#38bdf8', mt: 1 }}>
                                            {/* Special handling for torque which is sometimes rpm*2.5 in mock */}
                                            {value.toFixed(1)}
                                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: '#64748b' }}>
                                                {stat.unit}
                                            </Typography>
                                        </Typography>
                                    </Box>

                                    {/* Edit Button */}
                                    <IconButton
                                        size="small"
                                        onClick={() => handleEditSideStat(index)}
                                        sx={{
                                            position: 'absolute', top: 2, right: 2,
                                            color: '#475569', p: 0.5,
                                            opacity: 0.5,
                                            '&:hover': { color: '#38bdf8', opacity: 1 }
                                        }}
                                    >
                                        <Edit2 size={12} />
                                    </IconButton>
                                </Paper>
                            );
                        })}
                    </Box>
                </Grid>

                {/* Right Side: Drilling Status, Gauges, Stats */}
                <Grid item xs={12} md={8}>
                    {/* --- Drilling Status Panel (Dedicated Stat Panel) --- */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', border: '1px solid #334155' }}>
                        {/* Rig Activity Indicator */}
                        <Box sx={{ textAlign: 'center', minWidth: 150 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5, color: '#94a3b8' }}>
                                <Activity size={16} />
                                <Typography variant="caption">RIG ACTIVITY</Typography>
                            </Box>
                            <Box sx={{
                                bgcolor: rigData.wob > 1 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                                px: 2, py: 1, borderRadius: 2, border: '1px solid',
                                borderColor: rigData.wob > 1 ? '#4ade80' : '#38bdf8'
                            }}>
                                <Typography variant="h5" sx={{ fontWeight: 'bold', color: rigData.wob > 1 ? '#4ade80' : '#38bdf8', letterSpacing: 1 }}>
                                    {rigData.wob > 1 ? 'DRILLING' : (rigData.block_position > 1 && rigData.block_position < 99) ? 'TRIPPING' : 'IDLE'}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#334155' }} />

                        {/* Hole Depth Stat */}
                        <Box sx={{ textAlign: 'center', minWidth: 150 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5, color: '#94a3b8' }}>
                                <Activity size={16} />
                                <Typography variant="caption">HOLE DEPTH</Typography>
                                <IconButton
                                    size="small" sx={{ color: '#64748b', p: 0.5, '&:hover': { color: '#4ade80' } }}
                                    onClick={() => {
                                        setCalibrationValues({ ...calibrationValues, holeDepth: formatDepth(rigData.hole_depth), mode: 'depth' });
                                        setIsDrillingControlsOpen(true);
                                    }}
                                >
                                    <Edit2 size={12} />
                                </IconButton>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4ade80' }}>
                                {formatDepth(rigData.hole_depth)}
                                <Button
                                    variant="text" size="small"
                                    sx={{ minWidth: 'auto', p: 0, ml: 0.5, color: '#cbd5e1', fontSize: '0.4em' }}
                                    onClick={() => {
                                        const next = units.depth === 'ft' ? 'm' : 'ft';
                                        saveUnits({ ...units, depth: next });
                                    }}
                                >
                                    {units.depth}
                                </Button>
                            </Typography>
                        </Box>

                        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#334155' }} />

                        {/* Bit Position Stat */}
                        <Box sx={{ textAlign: 'center', minWidth: 150 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5, color: '#94a3b8' }}>
                                <ArrowDownToLine size={16} />
                                <Typography variant="caption">BIT POSITION</Typography>
                                <IconButton
                                    size="small" sx={{ color: '#64748b', p: 0.5, '&:hover': { color: '#38bdf8' } }}
                                    onClick={() => {
                                        setCalibrationValues({ ...calibrationValues, bitDepth: formatDepth(rigData.bit_depth), mode: 'depth' });
                                        setIsDrillingControlsOpen(true);
                                    }}
                                >
                                    <Edit2 size={12} />
                                </IconButton>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#38bdf8' }}>
                                {formatDepth(rigData.bit_depth)}
                                <span style={{ fontSize: '0.5em', color: '#cbd5e1', marginLeft: 4 }}>{units.depth}</span>
                            </Typography>
                        </Box>
                    </Paper>

                    {/* Gauges Grid */}
                    <Grid container spacing={2} sx={{ mb: 4, alignItems: 'center' }}>
                        {gauges.map((g, index) => (
                            <Grid
                                item
                                xs={12} sm={6} md={g.gridWidth || 3}
                                key={g.id}
                            >
                                {/* Wrapper DIV for Drag Events */}
                                <div
                                    draggable={editMode}
                                    onDragStart={(e) => editMode && handleDragStart(e, g.id)}
                                    onDragOver={(e) => editMode && handleDragOver(e, index)}
                                    onDrop={(e) => editMode && handleDrop(e, index)}
                                    style={{
                                        cursor: editMode ? 'grab' : 'default',
                                        opacity: editMode && dragOverIndex === index ? 0.5 : 1,
                                        transform: editMode && dragOverIndex === index ? 'scale(0.98)' : 'scale(1)',
                                        transition: 'all 0.2s',
                                        border: editMode && dragOverIndex === index ? '2px dashed #fbbf24' : '2px solid transparent',
                                        borderRadius: 8,
                                        height: '100%'
                                    }}
                                >
                                    <Paper
                                        sx={{
                                            p: 1,
                                            bgcolor: editMode ? 'rgba(30, 41, 59, 0.5)' : 'transparent',
                                            backgroundImage: 'none',
                                            boxShadow: 'none',
                                            color: 'white',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                            border: editMode ? '1px dashed #475569' : 'none',
                                            height: '100%',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                bgcolor: editMode ? '#1e293b' : 'transparent',
                                                boxShadow: editMode ? '0 0 0 2px #334155' : 'none'
                                            }
                                        }}
                                    >
                                        <AnalogGauge
                                            value={Number(rigData[g.dataKey]) || 0}
                                            max={Number(g.max)}
                                            min={Number(g.min)}
                                            label={g.label}
                                            unit={g.unit}
                                            size={g.size || 160}
                                            color={g.color}
                                            majorTicks={g.majorTicks || 5}
                                            minorTicks={g.minorTicks || 4}
                                            // Conditional Props for Hook Load
                                            subValue={g.dataKey === 'hook_load' ? formatWOB(rigData.wob) : undefined}
                                            subLabel={g.dataKey === 'hook_load' ? `BIT WEIGHT (${units.wob === 'tonnes' ? 'ton' : units.wob})` : undefined}
                                        />

                                        {editMode && (
                                            <Box sx={{
                                                position: 'absolute', top: 0, right: 0, p: 1,
                                                display: 'flex', gap: 1, zIndex: 10
                                            }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); setEditingGauge({ ...g }); setIsDialogOpen(true); }}
                                                    sx={{ bgcolor: '#fbbf24', color: 'black', '&:hover': { bgcolor: '#f59e0b' } }}
                                                    title="Edit Settings"
                                                >
                                                    <Settings size={14} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveGauge(g.id); }}
                                                    sx={{ color: 'white', bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' } }}
                                                    title="Remove"
                                                >
                                                    <Trash2 size={14} />
                                                </IconButton>
                                            </Box>
                                        )}

                                        {editMode && (
                                            <Box sx={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', color: '#64748b', pointerEvents: 'none' }}>
                                                <Typography variant="caption" sx={{ fontSize: 10 }}>DRAG TO MOVE</Typography>
                                            </Box>
                                        )}
                                    </Paper>
                                </div>
                            </Grid>
                        ))}
                    </Grid>

                    {/* --- Configurable Stats Panel (Bottom) --- */}
                    <StatsPanel rigData={rigData} />
                </Grid>
            </Grid>

            {/* Edit Dialog - Gauge Configuration */}
            <Dialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                PaperProps={{ sx: { bgcolor: '#1e293b', color: 'white', minWidth: 400 } }}
            >
                <DialogTitle>Edit Gauge</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Data Source" select
                            value={editingGauge?.dataKey || ''}
                            onChange={(e) => setEditingGauge({ ...editingGauge, dataKey: e.target.value })}
                            fullWidth size="small"
                            sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiSelect-select': { color: 'white' } }}
                        >
                            <MenuItem value="hook_load">Hook Load</MenuItem>
                            <MenuItem value="pump_pressure">Pump Pressure</MenuItem>
                            <MenuItem value="engine_rpm">Engine RPM</MenuItem>
                            <MenuItem value="torque">Torque</MenuItem>
                            <MenuItem value="oil_pressure">Oil Pressure</MenuItem>
                            <MenuItem value="block_position">Block Position</MenuItem>
                            <MenuItem value="wob">Weight on Bit</MenuItem>
                            <MenuItem value="bit_depth">Bit Depth</MenuItem>
                            <MenuItem value="hole_depth">Hole Depth</MenuItem>
                            <MenuItem value="flow_in">Flow In</MenuItem>
                            <MenuItem value="flow_out">Flow Out</MenuItem>
                            <MenuItem value="spm1">SPM 1</MenuItem>
                            <MenuItem value="spm2">SPM 2</MenuItem>
                            <MenuItem value="total_spm">Total SPM</MenuItem>
                            <MenuItem value="trip_tank">Trip Tank</MenuItem>
                            <MenuItem value="rig_air_pressure">Rig Air Pressure</MenuItem>
                            <MenuItem value="annular_pressure">Annular Pressure</MenuItem>
                            <MenuItem value="manifold_pressure">Manifold Pressure</MenuItem>
                            <MenuItem value="accumulator_pressure">Accumulator Pressure</MenuItem>
                        </TextField>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Label"
                                value={editingGauge?.label || ''}
                                onChange={(e) => setEditingGauge({ ...editingGauge, label: e.target.value })}
                                fullWidth size="small"
                                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                            />
                            <TextField
                                label="Unit"
                                value={editingGauge?.unit || ''}
                                onChange={(e) => setEditingGauge({ ...editingGauge, unit: e.target.value })}
                                fullWidth size="small"
                                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Min" type="number"
                                value={editingGauge?.min}
                                onChange={(e) => setEditingGauge({ ...editingGauge, min: e.target.value })}
                                fullWidth size="small"
                                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                            />
                            <TextField
                                label="Max" type="number"
                                value={editingGauge?.max}
                                onChange={(e) => setEditingGauge({ ...editingGauge, max: e.target.value })}
                                fullWidth size="small"
                                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ color: '#94a3b8' }}>Grid Width</InputLabel>
                                <Select
                                    value={editingGauge?.gridWidth || 3}
                                    label="Grid Width"
                                    onChange={(e) => setEditingGauge({ ...editingGauge, gridWidth: Number(e.target.value) })}
                                    sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' } }}
                                >
                                    <MenuItem value={3}>Small (1/4)</MenuItem>
                                    <MenuItem value={4}>Medium (1/3)</MenuItem>
                                    <MenuItem value={6}>Half (1/2)</MenuItem>
                                    <MenuItem value={8}>Large (2/3)</MenuItem>
                                    <MenuItem value={12}>Full Width</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ color: '#94a3b8' }}>Gauge Size</InputLabel>
                                <Select
                                    value={editingGauge?.size || 160}
                                    label="Gauge Size"
                                    onChange={(e) => setEditingGauge({ ...editingGauge, size: Number(e.target.value) })}
                                    sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' } }}
                                >
                                    <MenuItem value={140}>Tiny (140px)</MenuItem>
                                    <MenuItem value={160}>Small (160px)</MenuItem>
                                    <MenuItem value={220}>Medium (220px)</MenuItem>
                                    <MenuItem value={300}>Large (300px)</MenuItem>
                                    <MenuItem value={380}>Huge (380px)</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDialogOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                    <Button onClick={handleEditSave} variant="contained" sx={{ bgcolor: '#fbbf24', color: 'black' }}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Drilling Controls Dialog (Values & Units) */}
            <Dialog
                open={isDrillingControlsOpen}
                onClose={() => setIsDrillingControlsOpen(false)}
                PaperProps={{ sx: { bgcolor: '#1e293b', color: 'white', minWidth: 350 } }}
            >
                <DialogTitle>
                    {calibrationValues.mode === 'wob' ? 'Calibrate Weight on Bit' : 'Set Depths'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                        {(!calibrationValues.mode || calibrationValues.mode === 'wob') && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ color: '#94a3b8', mb: 1 }}>Settings</Typography>
                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                    <InputLabel sx={{ color: '#94a3b8' }}>Display Unit</InputLabel>
                                    <Select
                                        value={units.wob}
                                        label="Display Unit"
                                        onChange={(e) => saveUnits({ ...units, wob: e.target.value })}
                                        sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' } }}
                                    >
                                        <MenuItem value="kips">Kips (1000 lbs)</MenuItem>
                                        <MenuItem value="lbs">Pounds (lbs)</MenuItem>
                                        <MenuItem value="tonnes">Tonnes (Metric)</MenuItem>
                                    </Select>
                                </FormControl>
                                <Button
                                    fullWidth variant="contained"
                                    color="warning"
                                    onClick={handleZeroWOB}
                                >
                                    Zero WOB (Tare Hook Load)
                                </Button>
                            </Box>
                        )}

                        {(!calibrationValues.mode || calibrationValues.mode === 'depth') && (
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>Depth Tracking</Typography>
                                    <Button
                                        size="small" variant="text"
                                        onClick={() => saveUnits({ ...units, depth: units.depth === 'ft' ? 'm' : 'ft' })}
                                    >
                                        Unit: {units.depth.toUpperCase()}
                                    </Button>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                    <TextField
                                        label={`Bit Depth (${units.depth})`} size="small" type="number"
                                        value={calibrationValues.bitDepth}
                                        onChange={(e) => setCalibrationValues({ ...calibrationValues, bitDepth: e.target.value })}
                                        sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                                    />
                                    <TextField
                                        label={`Hole Depth (${units.depth})`} size="small" type="number"
                                        value={calibrationValues.holeDepth}
                                        onChange={(e) => setCalibrationValues({ ...calibrationValues, holeDepth: e.target.value })}
                                        sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
                                    />
                                </Box>
                                <Button fullWidth variant="contained" onClick={handleSetDepth}>Update Depths</Button>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDrillingControlsOpen(false)} sx={{ color: '#94a3b8' }}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Edit Side Stat Dialog */}
            <Dialog
                open={editStatOpen}
                onClose={() => setEditStatOpen(false)}
                PaperProps={{ sx: { bgcolor: '#1e293b', color: 'white', minWidth: 350 } }}
            >
                <DialogTitle>Edit Panel Parameter</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel sx={{ color: '#94a3b8' }}>Parameter</InputLabel>
                        <Select
                            value={tempStatKey}
                            label="Parameter"
                            onChange={(e) => setTempStatKey(e.target.value)}
                            sx={{
                                color: 'white',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '& .MuiSvgIcon-root': { color: '#94a3b8' }
                            }}
                        >
                            {ALL_PARAMETERS.map(p => (
                                <MenuItem key={p.key} value={p.key}>
                                    {p.label} ({p.unit})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditStatOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                    <Button onClick={handleSaveSideStat} variant="contained" sx={{ bgcolor: '#38bdf8', color: '#0f172a' }}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
