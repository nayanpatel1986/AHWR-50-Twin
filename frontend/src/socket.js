import { io } from 'socket.io-client';

// ONE shared socket instance for the whole app.
// - autoConnect:false so the connection is owned by Layout (after auth), not by import side-effects.
// - auth is a callback so the LATEST token is read on every (re)connect.
export const socket = io('/', {
    autoConnect: false,
    auth: (cb) => cb({ token: localStorage.getItem('romii_token') }),
});

export function connectSocket() {
    if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
    if (socket.connected) socket.disconnect();
}
