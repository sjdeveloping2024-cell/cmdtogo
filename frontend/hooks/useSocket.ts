import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/constants/config';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * useSocket(studentId?)
 *
 * Opens a single Socket.IO connection to the Flask-SocketIO server.
 * If studentId is provided the socket joins the student's private room
 * so it receives `student_borrows_update` events.
 *
 * Returns { socket, status }
 */
export function useSocket(studentId?: number) {
  const socketRef              = useRef<Socket | null>(null);
  const [status, setStatus]    = useState<SocketStatus>('connecting');

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 2000,
    });

    socketRef.current = s;

    s.on('connect', () => {
      setStatus('connected');
      if (studentId) {
        s.emit('join_student_room', { student_id: studentId });
      }
    });

    s.on('disconnect', () => setStatus('disconnected'));
    s.on('connect_error', () => setStatus('disconnected'));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { socket: socketRef.current, status };
}
