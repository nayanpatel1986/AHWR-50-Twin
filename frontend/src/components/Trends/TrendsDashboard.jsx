import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Checkbox, FormControlLabel, FormGroup, Accordion, AccordionSummary, AccordionDetails, Button } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ChevronDown, RefreshCw, Download, Clock } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('/');

const AVAILABLE_METRICS = {
    drawworks: ['hook_load', 'block_position'],
    engine: ['rpm', 'oil_pressure', 'oil_temp', 'coolant_temp', 'exhaust_temp', 'battery_voltage', 'fuel_level'],
    mudpump: ['spm', 'pressure', 'flow_in', 'flow_out', 'total_spm'],
    wellcontrol: ['tubing_pressure', 'casing_pressure', 'bop_pressure', 'choke_pressure', 'choke_position']
};

const COLORS = [
    '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#fbbf24', '#e879f9', '#22c55e', '#ef4444', '#f59e0b', '#60a5fa'
];

export default function TrendsDashboard() {
    const [data, setData] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState(['engine.rpm', 'engine.oil_pressure', 'engine.coolant_temp']);
    const [showParams, setShowParams] = useState(false);
    const [showCustomDate, setShowCustomDate] = useState(false);

    const [timeRange, setTimeRange] = useState('-15m');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [isCustom, setIsCustom] = useState(false);

    // How many ms worth of data to keep for each range
    const getRangeMs = (range) => {
        if (range === '-1m') return 60 * 1000;
        if (range === '-5m') return 5 * 60 * 1000;
        if (range === '-10m') return 10 * 60 * 1000;
        if (range === '-15m') return 15 * 60 * 1000;
        if (range === '-1h') return 60 * 60 * 1000;
        if (range === '-12h') return 12 * 60 * 60 * 1000;
        if (range === '-24h') return 24 * 60 * 60 * 1000;
        return 15 * 60 * 1000;
    };

    // Fetch history from API
    const fetchHistory = async () => {
        try {
            let url = '/api/history';
            if (customRange.start && customRange.end) {
                url += `?start=${new Date(customRange.start).toISOString()}&stop=${new Date(customRange.end).toISOString()}`;
            } else {
                url += `?range=${timeRange}`;
            }

            const res = await axios.get(url);
            if (res.data && res.data.length > 0) {
                setData(res.data);
            } else {
                if (isCustom || (customRange.start && customRange.end)) {
                    // Only clear data if we explicitly asked for a custom range and got nothing
                    setData([]);
                }
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
            if (isCustom || (customRange.start && customRange.end)) {
                setData([]);
            }
        }
    };

    useEffect(() => {
        // Fetch historical data from API
        if (!isCustom) fetchHistory();

        // Always subscribe to live socket data for preset ranges
        if (!isCustom) {
            const handleSocketData = (newData) => {
                setData(prev => {
                    const now = new Date();
                    const newPoint = {
                        name: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
                        timestamp: now.getTime()
                    };

                    Object.keys(newData).forEach(measurement => {
                        if (typeof newData[measurement] === 'object' && newData[measurement] !== null) {
                            Object.keys(newData[measurement]).forEach(field => {
                                newPoint[`${measurement}.${field}`] = newData[measurement][field];
                            });
                        }
                    });

                    // Ensure all selected metrics have at least a 0 value if missing
                    selectedMetrics.forEach(metric => {
                        if (newPoint[metric] === undefined) {
                            newPoint[metric] = 0;
                        }
                    });

                    const updated = [...prev, newPoint];

                    // Ensure array is strictly sorted by timestamp for Recharts' time scale
                    const sorted = updated.sort((a, b) => a.timestamp - b.timestamp);

                    // Trim data older than the selected range
                    const cutoff = now.getTime() - getRangeMs(timeRange);
                    const trimmed = sorted.filter(pt => (pt.timestamp || 0) >= cutoff);

                    // Also cap at max 10000 points to prevent memory issues
                    if (trimmed.length > 10000) trimmed.splice(0, trimmed.length - 10000);

                    return trimmed;
                });
            };
            socket.on('rig_data', handleSocketData);
            return () => socket.off('rig_data', handleSocketData);
        }
    }, [timeRange, isCustom]);

    const applyCustomRange = () => {
        if (customRange.start && customRange.end) {
            setIsCustom(true);
            fetchHistory();
        }
    };

    const handlePresetClick = (val) => {
        setIsCustom(false);
        setTimeRange(val);
        setCustomRange({ start: '', end: '' });
    };

    const handleToggle = (measurement, field) => {
        const key = `${measurement}.${field}`;
        setSelectedMetrics(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleExport = () => {
        if (!data || data.length === 0) {
            alert("No data to export");
            return;
        }

        // 1. Format Data for Excel
        const exportData = data.map(row => {
            const formattedRow = {
                Timestamp: new Date(row.timestamp).toLocaleString(),
            };
            selectedMetrics.forEach(metric => {
                if (row[metric] !== undefined) {
                    formattedRow[metric] = row[metric];
                }
            });
            return formattedRow;
        });

        // 2. Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Trends Data");

        // 3. Keep column widths reasonable
        const wscols = [{ wch: 25 }]; // Timestamp column width
        selectedMetrics.forEach(() => wscols.push({ wch: 15 }));
        worksheet['!cols'] = wscols;

        // 4. Write and Download
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

        const fileName = `ROMII_Trends_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
        saveAs(dataBlob, fileName);
    };

    return (
        <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Live Parameter Trends</Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Parameters Dropdown Button */}
                    <Box sx={{ position: 'relative' }}>
                        <Button
                            variant="outlined"
                            onClick={() => setShowParams(!showParams)}
                            endIcon={<ChevronDown />}
                            sx={{ color: 'white', borderColor: '#334155', height: '100%', bgcolor: '#1e293b' }}
                        >
                            PARAMETERS
                        </Button>
                        {showParams && (
                            <Paper sx={{ position: 'absolute', top: '100%', left: 0, mt: 1, p: 2, bgcolor: '#0f172a', border: '1px solid #334155', zIndex: 50, width: 'max-content', maxWidth: '80vw', maxHeight: '400px', overflowY: 'auto' }}>
                                <FormGroup row sx={{ gap: 2 }}>
                                    {Object.entries(AVAILABLE_METRICS).map(([measurement, fields]) =>
                                        fields.map(field => {
                                            const key = `${measurement}.${field}`;
                                            return (
                                                <FormControlLabel
                                                    key={key}
                                                    sx={{ minWidth: '200px' }}
                                                    control={
                                                        <Checkbox
                                                            checked={selectedMetrics.includes(key)}
                                                            onChange={() => handleToggle(measurement, field)}
                                                            sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#38bdf8' } }}
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                                            <span style={{ color: '#94a3b8', fontSize: '0.8em', textTransform: 'uppercase', marginRight: '4px' }}>
                                                                {measurement}
                                                            </span>
                                                            {field.replace(/_/g, ' ')}
                                                        </Typography>
                                                    }
                                                />
                                            );
                                        })
                                    )}
                                </FormGroup>
                            </Paper>
                        )}
                    </Box>

                    {/* Watch Symbol for Custom Range Dropdown */}
                    <Box sx={{ position: 'relative' }}>
                        <Button
                            variant="outlined"
                            onClick={() => setShowCustomDate(!showCustomDate)}
                            sx={{ color: 'white', borderColor: '#334155', height: '100%', bgcolor: '#1e293b', minWidth: '40px', px: 1 }}
                        >
                            <Clock size={20} />
                        </Button>
                        {showCustomDate && (
                            <Paper sx={{ position: 'absolute', top: '100%', left: 0, mt: 1, p: 2, bgcolor: '#0f172a', border: '1px solid #334155', zIndex: 50, width: 'max-content' }}>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 'bold' }}>CUSTOM RANGE</Typography>
                                    <input
                                        type="datetime-local"
                                        style={{ background: 'transparent', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '4px', colorScheme: 'dark' }}
                                        onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                    />
                                    <span style={{ color: '#94a3b8' }}>-</span>
                                    <input
                                        type="datetime-local"
                                        style={{ background: 'transparent', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '4px', colorScheme: 'dark' }}
                                        onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                    />
                                    <Button variant="contained" size="small" onClick={() => { applyCustomRange(); setShowCustomDate(false); }} sx={{ ml: 1 }}>Go</Button>
                                </Box>
                            </Paper>
                        )}
                    </Box>

                    <Box sx={{ width: '1px', height: '24px', bgcolor: '#334155', mx: 1 }} />

                    {[
                        { label: '1m', val: '-1m' },
                        { label: '5m', val: '-5m' },
                        { label: '10m', val: '-10m' },
                        { label: '15m', val: '-15m' },
                        { label: '1h', val: '-1h' },
                        { label: '12h', val: '-12h' },
                        { label: '24h', val: '-24h' }
                    ].map((opt) => (
                        <Button
                            key={opt.val}
                            variant={!isCustom && timeRange === opt.val ? "contained" : "outlined"}
                            onClick={() => handlePresetClick(opt.val)}
                            size="small"
                            sx={{
                                bgcolor: !isCustom && timeRange === opt.val ? '#38bdf8' : 'transparent',
                                color: !isCustom && timeRange === opt.val ? '#0f172a' : '#94a3b8',
                                borderColor: '#334155',
                                minWidth: '40px'
                            }}
                        >
                            {opt.label}
                        </Button>
                    ))}

                    <Button variant="outlined" startIcon={<Download />} onClick={handleExport} sx={{ color: '#fbbf24', borderColor: '#fbbf24', ml: 2, '&:hover': { bgcolor: 'rgba(251, 191, 36, 0.1)' } }}>
                        Export Excel
                    </Button>

                    <Button variant="outlined" startIcon={<RefreshCw />} onClick={fetchHistory} sx={{ color: '#38bdf8', borderColor: '#334155', ml: 1 }}>
                        Resync
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                {/* Main Chart */}
                <Grid item xs={12} md={12} sx={{ height: '600px' }}>
                    <Paper sx={{ p: 2, bgcolor: '#1e293b', height: '100%', position: 'relative' }}>
                        {data.length === 0 && (
                            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 1 }}>
                                <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>No Data Available {isCustom ? 'For This Custom Range' : ''}</Typography>
                                <Typography variant="body2" sx={{ color: '#475569' }}>
                                    {isCustom
                                        ? "There is no historical data recorded corresponding to the selected time range. Try a different range."
                                        : "Waiting for live data... Data will appear as it streams in."}
                                </Typography>
                                {!isCustom && (
                                    <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 1 }}>
                                        If PLC is connected, data should appear within seconds.
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {data.length > 0 && (
                            <Typography variant="caption" sx={{ color: '#64748b', position: 'absolute', top: 8, right: 16, zIndex: 1 }}>
                                {data.length} data points
                            </Typography>
                        )}
                        {data.length > 0 && (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="timestamp"
                                        type="number"
                                        scale="time"
                                        domain={isCustom ? ['dataMin', 'dataMax'] : [Date.now() - getRangeMs(timeRange), Date.now()]}
                                        stroke="#94a3b8"
                                        tickFormatter={(unixTime) => {
                                            if (!unixTime || isNaN(unixTime)) return '';
                                            const date = new Date(unixTime);
                                            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                                        }}
                                        angle={-30}
                                        textAnchor="end"
                                        height={50}
                                        minTickGap={30}
                                        fontSize={11}
                                    />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip
                                        labelFormatter={(unixTime) => {
                                            if (!unixTime || isNaN(unixTime)) return '';
                                            return new Date(unixTime).toLocaleString();
                                        }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Legend />
                                    {selectedMetrics.map((key, index) => (
                                        <Line
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            name={key.split('.')[1].replace(/_/g, ' ').toUpperCase()}
                                            stroke={COLORS[index % COLORS.length]}
                                            dot={false}
                                            strokeWidth={2}
                                            isAnimationActive={false}
                                            connectNulls={true}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
