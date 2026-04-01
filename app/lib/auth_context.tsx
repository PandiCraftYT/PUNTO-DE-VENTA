import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert, Platform } from 'react-native'; // Importamos Alert y Platform para el aviso de despido
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

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
        // Ya terminó de buscar en la memoria, le avisamos al layout
        setCargandoSesion(false);
      }
    };
    
    revisarSesion();
  }, []);

  // --- 2. LÓGICA DE CONEXIÓN EN TIEMPO REAL (LATIDO / PING) ---
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

  }, [usuario]); 

  // --- 3. NUEVO: EXPULSIÓN INSTANTÁNEA SI EL USUARIO ES ELIMINADO ---
  useEffect(() => {
    if (!usuario || !usuario.id) return;

    const canalDespido = supabase
      .channel(`guardian-${usuario.id}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'usuarios' },
        (payload) => {
          // Si el ID del usuario que acaban de borrar de la base de datos es el mío...
          if (payload.old && payload.old.id === usuario.id) {
            
            // 1. Le mostramos un mensaje en la cara
            if (Platform.OS === 'web') {
              window.alert("Tu acceso ha sido revocado. Tu sesión se cerrará ahora.");
            } else {
              Alert.alert(
                "Acceso Revocado", 
                "Tu cuenta ha sido eliminada por un administrador. Tu sesión se cerrará de inmediato."
              );
            }
            
            // 2. Lo corremos del sistema borrando su sesión
            cerrarSesion();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalDespido);
    };
  }, [usuario]);

  // 4. FUNCIÓN PARA ACTUALIZAR USUARIO EN EL LOGIN
  const actualizarUsuario = async (nuevoUsuario: any) => {
    try {
      if (nuevoUsuario) {
        // Guardamos en el teléfono/navegador para que no se borre al recargar
        await AsyncStorage.setItem('@sesion_usuario', JSON.stringify(nuevoUsuario));
      } else {
        // Si mandan null, limpiamos la memoria
        await AsyncStorage.removeItem('@sesion_usuario');
      }
      setUsuario(nuevoUsuario);
    } catch (error) {
      console.error("Error al guardar la sesión:", error);
    }
  };

  // 5. FUNCIÓN PARA CERRAR SESIÓN OFICIALMENTE
  const cerrarSesion = async () => {
    try {
      await AsyncStorage.removeItem('@sesion_usuario');
      setUsuario(null);
    } catch (error) {
      console.error("Error al cerrar la sesión:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      usuario, 
      setUsuario: actualizarUsuario, 
      cerrarSesion, 
      cargandoSesion 
    }}>
      {/* Ya no bloqueamos aquí, dejamos que el _layout.tsx decida qué mostrar */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);