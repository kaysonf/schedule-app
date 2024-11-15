import * as React from "react";
import {io} from 'socket.io-client';
export default function useSocketIoClient(url: string) {
    const [socket] = React.useState(() => io(url, {autoConnect: false}));

    const [isConnected, setIsConnected] = React.useState(false);

    React.useEffect(() => {
        function onConnect() {
            setIsConnected(true);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.connect();

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
        };
    }, [socket]);

    const on = React.useCallback((ev: string, listener: (msg: unknown) => void) => {
        socket.on(ev, listener);
    }, [socket]);

    const emit = React.useCallback((ev: string, args: unknown) => {
        socket.emit(ev, args);
    }, [socket])

    return {
        isConnected,
        on,
        emit
    }
}