import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/auth_context'; 
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// IMPORTAMOS TU PANTALLA DE LOGIN DIRECTAMENTE
import LoginScreen from '../login'; 

export default function AdminLayout() {
  const { usuario, cargandoSesion } = useAuth();
  const [rootReady, setRootReady] = useState(false);
  
  // ESTADO PARA LA NOTIFICACIÓN FLOTANTE DEL TALLER
  const [alertaTaller, setAlertaTaller] = useState<any>(null);

  useEffect(() => {
    setRootReady(true);
  }, []);

  // --- ESCUCHADOR EN TIEMPO REAL PARA EL TALLER ---
  useEffect(() => {
    // Si no hay usuario logueado, no escuchamos nada
    if (!usuario) return;

    const canalTaller = supabase
      .channel('alertas-globales-taller')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reparaciones' }, (payload) => {
        const nuevoEquipo = payload.new;
        
        // 1. Mostrar la alerta con los datos que acaban de registrar
        setAlertaTaller(nuevoEquipo);
        
        // 2. Desaparecerla automáticamente después de 7 segundos
        setTimeout(() => {
          setAlertaTaller(null);
        }, 7000);
      })
      .subscribe();

    return () => { supabase.removeChannel(canalTaller); };
  }, [usuario]);

  // 1. EL CADENERO ESPERA: Mientras la app busca en AsyncStorage
  if (cargandoSesion || !rootReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' }}>
        <ActivityIndicator size="large" color="#0056FF" />
      </View>
    );
  }

  // 2. SI EL USUARIO ES NULL (No hay sesión guardada)
  if (usuario === null) {
    return <LoginScreen />;
  }

  // 3. SI HAY USUARIO, RENDERIZAMOS LAS PANTALLAS DE ADMIN + LA NOTIFICACIÓN
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="productos" />
        <Stack.Screen name="ventas" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="usuarios" />
        {/* Asegúrate de tener estas rutas también si las usas */}
        <Stack.Screen name="taller" />
        <Stack.Screen name="inversion" />
      </Stack>

      {/* BANNER FLOTANTE DE NOTIFICACIÓN (Aparece sobre cualquier pantalla) */}
      {alertaTaller && (
        <View style={styles.notificationBanner}>
          <View style={styles.notificationIcon}>
            <Ionicons name="build" size={24} color="#fff" />
          </View>
          <View style={styles.notificationTextContainer}>
            <Text style={styles.notificationTitle}>¡Nuevo Equipo en Taller!</Text>
            <Text style={styles.notificationDesc}>
              {alertaTaller.equipo} ({alertaTaller.falla})
            </Text>
            <Text style={styles.notificationFooter}>
              📍 {alertaTaller.sucursal} • Recibió: {alertaTaller.recibido_por || 'Empleado'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setAlertaTaller(null)} style={{ padding: 5 }}>
            <Ionicons name="close" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notificationBanner: {
    position: 'absolute',
    top: 50, // Ajusta si te tapa la barra del celular
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10, // Sombra para Android
    shadowColor: '#000', // Sombra para iOS/Web
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#e74c3c', // Una tira naranja/roja para llamar la atención
    zIndex: 9999, // Asegura que esté por encima de TODO
  },
  notificationIcon: {
    backgroundColor: '#e74c3c',
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 2,
  },
  notificationDesc: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  notificationFooter: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: 'bold',
  }
});