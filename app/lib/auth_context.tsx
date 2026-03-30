import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase'; // <-- AÑADIDO: Importamos supabase para actualizar la hora

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [usuario, setUsuario] = useState<any>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // 1. ESTO SE EJECUTA AL ABRIR LA APP: Busca si hay alguien guardado en el "disco duro"
  useEffect(() => {
    const revisarSesion = async () => {
      try {
        const datosGuardados = await AsyncStorage.getItem('@sesion_usuario');
        if (datosGuardados !== null) {
          setUsuario(JSON.parse(datosGuardados));
        }
      } catch (error) {
        console.error("Error al recuperar la sesión:", error);
      } finally {
        setCargandoSesion(false);
      }
    };
    revisarSesion();
  }, []);

  // --- 2. NUEVO: LÓGICA DE CONEXIÓN EN TIEMPO REAL (LATIDO / PING) ---
  useEffect(() => {
    // Si no hay usuario logueado o no tiene ID, no hacemos nada
    if (!usuario || !usuario.id) return;

    const avisarConexion = async () => {
      try {
        await supabase
          .from('usuarios')
          .update({ ultima_conexion: new Date().toISOString() })
          .eq('id', usuario.id);
      } catch (error) {
        // Mantenemos los errores en silencio para no llenar la consola
      }
    };

    // Mandamos el primer aviso en cuanto el usuario entra
    avisarConexion();

    // Configuramos el ciclo para que avise cada 8 segundos (8000 ms)
    const latido = setInterval(() => {
      avisarConexion();
    }, 8000);

    // Cuando el usuario cierra la app o cierra sesión, detenemos el ciclo
    return () => clearInterval(latido);

  }, [usuario]); // Esto vuelve a arrancar si el usuario cambia (ej. cierra sesión y entra otro)


  // 3. FUNCIÓN PARA ACTUALIZAR USUARIO: Guarda o borra del almacenamiento
  const actualizarUsuario = async (nuevoUsuario: any) => {
    try {
      if (nuevoUsuario) {
        // Guardamos en el teléfono para que no se borre al recargar
        await AsyncStorage.setItem('@sesion_usuario', JSON.stringify(nuevoUsuario));
      } else {
        // Si es null (Cerrar Sesión), lo borramos del teléfono
        await AsyncStorage.removeItem('@sesion_usuario');
      }
      setUsuario(nuevoUsuario);
    } catch (error) {
      console.error("Error al guardar la sesión:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, setUsuario: actualizarUsuario, cargandoSesion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);