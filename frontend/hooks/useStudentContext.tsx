import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Student = {
  id:         number;
  student_id: string;
  full_name:  string;
  email:      string;
  course:     string;
  year_level: string | number;
};

type Ctx = {
  student: Student | null;
  loading: boolean;
  login:   (d: Student) => void;
  logout:  () => void;
  update:  (d: Student) => void;
};

const StudentContext = createContext<Ctx | null>(null);
const KEY = '@libsys_student';

export function StudentProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => { if (raw) setStudent(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (student) AsyncStorage.setItem(KEY, JSON.stringify(student)).catch(() => {});
    else         AsyncStorage.removeItem(KEY).catch(() => {});
  }, [student, loading]);

  return (
    <StudentContext.Provider value={{
      student, loading,
      login:  d => setStudent(d),
      logout: ()  => setStudent(null),
      update: d => setStudent(d),
    }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent(): Ctx {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudent must be inside <StudentProvider>');
  return ctx;
}
