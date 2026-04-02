import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert, Platform } from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

const AuthContext = createContext<any>(null);


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowList: true,   
  }),
});

export const AuthProvider = ({ children }: any) => {
  const [usuario, setUsuario] = useState<any>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // ESTO SE EJECUTA AL ABRIR LA APP
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

  // --- REGISTRO DE NOTIFICACIONES PUSH ---
  useEffect(() => {
    if (usuario && usuario.id) {
      registrarPushNotifications().then(token => {
        if (token) {
          // Si conseguimos el token del celular, se lo guardamos al usuario en la BD
          supabase.from('usuarios').update({ push_token: token }).eq('id', usuario.id).then();
        }
      });
    }
  }, [usuario]);

  // LÓGICA DE CONEXIÓN EN TIEMPO REAL (LATIDO)
  useEffect(() => {
    if (!usuario || !usuario.id) return;

    const avisarConexion = async () => {
      try {
        await supabase
          .from('usuarios')
          .update({ ultima_conexion: new Date().toISOString() })
          .eq('id', usuario.id);
      } catch (error) {}
    };

    avisarConexion();
    const latido = setInterval(() => { avisarConexion(); }, 8000);
    return () => clearInterval(latido);
  }, [usuario]); 

  // EXPULSIÓN INSTANTÁNEA SI EL USUARIO ES ELIMINADO
  useEffect(() => {
    if (!usuario || !usuario.id) return;

    const canalDespido = supabase
      .channel(`guardian-${usuario.id}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'usuarios' },
        (payload) => {
          if (payload.old && payload.old.id === usuario.id) {
            if (Platform.OS === 'web') {
              window.alert("Tu acceso ha sido revocado. Tu sesión se cerrará ahora.");
            } else {
              Alert.alert("Acceso Revocado", "Tu cuenta ha sido eliminada por un administrador.");
            }
            cerrarSesion();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalDespido);
    };
  }, [usuario]);

  const actualizarUsuario = async (nuevoUsuario: any) => {
    try {
      if (nuevoUsuario) {
        await AsyncStorage.setItem('@sesion_usuario', JSON.stringify(nuevoUsuario));
      } else {
        await AsyncStorage.removeItem('@sesion_usuario');
      }
      setUsuario(nuevoUsuario);
    } catch (error) {
      console.error("Error al guardar la sesión:", error);
    }
  };

  const cerrarSesion = async () => {
    try {
      await AsyncStorage.removeItem('@sesion_usuario');
      setUsuario(null);
    } catch (error) {
      console.error("Error al cerrar la sesión:", error);
    }
  };

  // Función interna para pedir permisos a Android/iOS y generar el Token
  async function registrarPushNotifications() {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return; 
      }
      // Usamos el ID de tu proyecto de Expo (el que estaba en el app.json)
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'ed581b99-a5b9-4cac-a75c-470f565313fe' 
      })).data;
    }
    
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0056FF',
      });
    }
    return token;
  }

  return (
    <AuthContext.Provider value={{ usuario, setUsuario: actualizarUsuario, cerrarSesion, cargandoSesion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);