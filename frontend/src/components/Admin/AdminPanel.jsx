import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Select, MenuItem, InputLabel, FormControl, Grid, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Trash2, Save, Plus, AlertCircle, RefreshCw, Edit2 } from 'lucide-react';
import axios from 'axios';

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

export default function AdminPanel() {
    const [value, setValue] = useState(0);
    const [config, setConfig] = useState({ slaves: [] });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

    // User Dialog State
    const [openUserDialog, setOpenUserDialog] = useState(false);
    const [currentUser, setCurrentUser] = useState({ username: '', password: '', role: 'operator', status: 'active' });
    const [isEditingUser, setIsEditingUser] = useState(false);

    // Helper to fetch data
    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/modbus');
            const data = res.data.slaves ? res.data : { slaves: [] };
            setConfig(data);
        } catch (err) {
            console.error(err);
            showNotification('Failed to load configuration', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
            showNotification('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (value === 0) fetchUsers();
        if (value === 1) fetchConfig();
    }, [value]);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const showNotification = (msg, severity = 'success') => {
        setNotification({ open: true, message: msg, severity });
    };

    // --- User Actions ---
    const handleOpenUserDialog = (user = null) => {
        if (user) {
            setCurrentUser({ ...user, password: '' }); // Don't show password
            setIsEditingUser(true);
        } else {
            setCurrentUser({ username: '', password: '', role: 'operator', status: 'active' });
            setIsEditingUser(false);
        }
        setOpenUserDialog(true);
    };

    const handleSaveUser = async () => {
        try {
            if (isEditingUser) {
                const payload = { ...currentUser };
                if (!payload.password) delete payload.password; // Don't send empty password if not changing
                await axios.put(`/api/users/${currentUser.id}`, payload);
                showNotification('User updated successfully');
            } else {
                await axios.post('/api/users', currentUser);
                showNotification('User created successfully');
            }
            setOpenUserDialog(false);
            fetchUsers();
        } catch (err) {
            console.error(err);
            showNotification(err.response?.data?.error || 'Failed to save user', 'error');
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await axios.delete(`/api/users/${id}`);
            showNotification('User deleted successfully');
            fetchUsers();
        } catch (err) {
            console.error(err);
            showNotification('Failed to delete user', 'error');
        }
    };

    // --- Modbus Actions ---

    // ... (Existing Modbus functions: addSlave, removeSlave, etc. - kept same logic)
    const addSlave = () => {
        const newSlave = {
            id: Date.now(),
            name: `PLC_${config.slaves.length + 1}`,
            ip: '192.168.1.10',
            port: 502,
            slaveId: 1,
            registers: []
        };
        setConfig({ ...config, slaves: [...config.slaves, newSlave] });
    };

    const removeSlave = (index) => {
        const newSlaves = [...config.slaves];
        newSlaves.splice(index, 1);
        setConfig({ ...config, slaves: newSlaves });
    };

    const updateSlave = (index, field, val) => {
        const newSlaves = [...config.slaves];
        newSlaves[index][field] = val;
        setConfig({ ...config, slaves: newSlaves });
    };

    const addRegister = (slaveIndex) => {
        const newRegister = {
            name: 'NEW_TAG',
            address: 40001,
            type: 'holding_register',
            dataType: 'INT16',
            scale: 1.0
        };
        const newSlaves = [...config.slaves];
        newSlaves[slaveIndex].registers.push(newRegister);
        setConfig({ ...config, slaves: newSlaves });
    };

    const removeRegister = (slaveIndex, regIndex) => {
        const newSlaves = [...config.slaves];
        newSlaves[slaveIndex].registers.splice(regIndex, 1);
        setConfig({ ...config, slaves: newSlaves });
    };

    const updateRegister = (slaveIndex, regIndex, field, val) => {
        const newSlaves = [...config.slaves];
        newSlaves[slaveIndex].registers[regIndex][field] = val;

        // If user changes register type to coil or discrete_input, ensure dataType is INT16
        if (field === 'type' && (val === 'coil' || val === 'discrete_input')) {
            newSlaves[slaveIndex].registers[regIndex]['dataType'] = 'INT16';
        }

        setConfig({ ...config, slaves: newSlaves });
    };

    const saveConfiguration = async () => {
        try {
            setLoading(true);
            const res = await axios.post('/api/modbus', config);
            if (res.data.success) {
                showNotification('Configuration saved! Restarting Telegraf might be required.');
            }
        } catch (err) {
            console.error(err);
            showNotification('Failed to save configuration', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: '#334155' }}>
                <Tabs value={value} onChange={handleChange} textColor="primary" indicatorColor="primary">
                    <Tab label="User Management" sx={{ color: '#94a3b8' }} />
                    <Tab label="Modbus Configuration" sx={{ color: '#94a3b8' }} />
                </Tabs>
            </Box>

            {/* TAB 0: User Management */}
            <TabPanel value={value} index={0}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                    <Typography variant="h6">User Management</Typography>
                    <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => handleOpenUserDialog()} sx={{ bgcolor: '#38bdf8', '&:hover': { bgcolor: '#0ea5e9' } }}>
                        Add User
                    </Button>
                </Box>

                <Paper sx={{ width: '100%', mb: 2, bgcolor: '#1e293b', overflow: 'hidden', border: '1px solid #334155' }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: '#94a3b8' }}>Username</TableCell>
                                    <TableCell sx={{ color: '#94a3b8' }}>Role</TableCell>
                                    <TableCell sx={{ color: '#94a3b8' }}>Status</TableCell>
                                    <TableCell sx={{ color: '#94a3b8' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow hover key={user.id}>
                                        <TableCell sx={{ color: 'white' }}>{user.username}</TableCell>
                                        <TableCell sx={{ color: 'white' }}>{user.role}</TableCell>
                                        <TableCell>
                                            <span style={{
                                                color: user.status === 'active' ? '#4ade80' : '#ef4444',
                                                textTransform: 'capitalize'
                                            }}>
                                                {user.status}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => handleOpenUserDialog(user)} sx={{ color: '#38bdf8', mr: 1 }}>
                                                <Edit2 size={16} />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDeleteUser(user.id)} sx={{ color: '#ef4444' }}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ color: '#94a3b8', py: 3 }}>
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </TabPanel>

            {/* TAB 1: Modbus Configuration */}
            <TabPanel value={value} index={1}>
                {/* Header Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6">Modbus TCP Configuration</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant="outlined" startIcon={<RefreshCw />} onClick={fetchConfig} sx={{ color: '#38bdf8', borderColor: '#334155' }}>
                            Reload
                        </Button>
                        <Button variant="contained" startIcon={<Save />} onClick={saveConfiguration} disabled={loading} sx={{ bgcolor: '#34d399', '&:hover': { bgcolor: '#10b981' } }}>
                            {loading ? 'Saving...' : 'Save & Apply'}
                        </Button>
                    </Box>
                </Box>

                {config.slaves.map((slave, sIndex) => (
                    <Paper key={slave.id || sIndex} sx={{ p: 3, mb: 3, bgcolor: '#1e293b', border: '1px solid #334155' }}>
                        {/* Slave Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#38bdf8' }}>
                                Device #{sIndex + 1}
                            </Typography>
                            <IconButton size="small" onClick={() => removeSlave(sIndex)} sx={{ color: '#ef4444' }}>
                                <Trash2 size={18} />
                            </IconButton>
                        </Box>

                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Name" fullWidth size="small"
                                    value={slave.name} onChange={(e) => updateSlave(sIndex, 'name', e.target.value)}
                                    sx={{ bgcolor: '#0f172a', input: { color: 'white' }, label: { color: '#94a3b8' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="IP Address" fullWidth size="small"
                                    value={slave.ip} onChange={(e) => updateSlave(sIndex, 'ip', e.target.value)}
                                    sx={{ bgcolor: '#0f172a', input: { color: 'white' }, label: { color: '#94a3b8' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    label="Port" type="number" fullWidth size="small"
                                    value={slave.port} onChange={(e) => updateSlave(sIndex, 'port', parseInt(e.target.value))}
                                    sx={{ bgcolor: '#0f172a', input: { color: 'white' }, label: { color: '#94a3b8' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    label="Slave ID" type="number" fullWidth size="small"
                                    value={slave.slaveId} onChange={(e) => updateSlave(sIndex, 'slaveId', parseInt(e.target.value))}
                                    sx={{ bgcolor: '#0f172a', input: { color: 'white' }, label: { color: '#94a3b8' } }}
                                />
                            </Grid>
                        </Grid>

                        {/* Registers Table */}
                        <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>Register Map</Typography>
                        <TableContainer component={Paper} sx={{ bgcolor: '#0f172a', mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: '#94a3b8' }}>Tag Name</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>Register Type</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>Address</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>Data Type</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>Scale</TableCell>
                                        <TableCell align="right" sx={{ color: '#94a3b8' }}>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {slave.registers.map((reg, rIndex) => (
                                        <TableRow key={rIndex}>
                                            <TableCell>
                                                <TextField
                                                    variant="standard" InputProps={{ disableUnderline: true, style: { color: 'white' } }}
                                                    value={reg.name} onChange={(e) => updateRegister(sIndex, rIndex, 'name', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={reg.type}
                                                    onChange={(e) => updateRegister(sIndex, rIndex, 'type', e.target.value)}
                                                    variant="standard" disableUnderline sx={{ color: 'white', '.MuiSelect-icon': { color: 'white' } }}
                                                >
                                                    <MenuItem value="holding_register">Holding Register</MenuItem>
                                                    <MenuItem value="input_register">Input Register</MenuItem>
                                                    <MenuItem value="coil">Coil</MenuItem>
                                                    <MenuItem value="discrete_input">Discrete Input</MenuItem>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number" variant="standard" InputProps={{ disableUnderline: true, style: { color: 'white' } }}
                                                    value={reg.address} onChange={(e) => updateRegister(sIndex, rIndex, 'address', parseInt(e.target.value))}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={reg.dataType}
                                                    onChange={(e) => updateRegister(sIndex, rIndex, 'dataType', e.target.value)}
                                                    variant="standard" disableUnderline sx={{ color: 'white', '.MuiSelect-icon': { color: 'white' } }}
                                                >
                                                    <MenuItem value="INT16">INT16</MenuItem>
                                                    <MenuItem value="UINT16">UINT16</MenuItem>
                                                    <MenuItem value="FLOAT32">FLOAT32</MenuItem>
                                                    <MenuItem value="FLOAT32-IEEE">FLOAT32-IEEE</MenuItem>
                                                    <MenuItem value="BOOL">BOOL</MenuItem>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number" variant="standard" InputProps={{ disableUnderline: true, style: { color: 'white' } }}
                                                    value={reg.scale} onChange={(e) => updateRegister(sIndex, rIndex, 'scale', parseFloat(e.target.value))}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" onClick={() => removeRegister(sIndex, rIndex)} sx={{ color: '#64748b', '&:hover': { color: '#ef4444' } }}>
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Button startIcon={<Plus size={16} />} onClick={() => addRegister(sIndex)} sx={{ color: '#38bdf8' }}>
                            Add Register
                        </Button>
                    </Paper>
                ))}

                <Button variant="outlined" startIcon={<Plus />} onClick={addSlave} sx={{ color: 'white', borderColor: '#334155', borderStyle: 'dashed', width: '100%', py: 2 }}>
                    Add New PLC Device
                </Button>
            </TabPanel>

            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={() => setNotification({ ...notification, open: false })}
            >
                <Alert severity={notification.severity} variant="filled">
                    {notification.message}
                </Alert>
            </Snackbar>

            {/* Add/Edit User Dialog */}
            <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} PaperProps={{ sx: { bgcolor: '#1e293b', color: 'white', minWidth: '400px' } }}>
                <DialogTitle>{isEditingUser ? 'Edit User' : 'Add User'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Username"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={currentUser.username}
                        onChange={(e) => setCurrentUser({ ...currentUser, username: e.target.value })}
                        sx={{ mt: 2, bgcolor: '#0f172a', input: { color: 'white' }, label: { color: '#94a3b8' } }}
                    />
                    <TextField
                        margin="dense"
                        label={isEditingUser ? "Password (leave blank to keep)" : "Password"}
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={currentUser.password}
                        onChange={(e) => setCurrentUser({ ...currentUser, password: e.target.value })}
                        sx={{ mt: 2, bgcolor: '#0f172a', input: { color: 'white' }, label: { color: '#94a3b8' } }}
                    />
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel sx={{ color: '#94a3b8' }}>Role</InputLabel>
                        <Select
                            value={currentUser.role}
                            label="Role"
                            onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                            sx={{ bgcolor: '#0f172a', color: 'white', '.MuiSvgIcon-root': { color: 'white' } }}
                        >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="operator">Operator</MenuItem>
                            <MenuItem value="viewer">Viewer</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel sx={{ color: '#94a3b8' }}>Status</InputLabel>
                        <Select
                            value={currentUser.status}
                            label="Status"
                            onChange={(e) => setCurrentUser({ ...currentUser, status: e.target.value })}
                            sx={{ bgcolor: '#0f172a', color: 'white', '.MuiSvgIcon-root': { color: 'white' } }}
                        >
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenUserDialog(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                    <Button onClick={handleSaveUser} variant="contained" sx={{ bgcolor: '#38bdf8' }}>
                        {isEditingUser ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
