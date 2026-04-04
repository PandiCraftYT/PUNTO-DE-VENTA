import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/auth_context'; 
import { ActivityIndicator, View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// IMPORTAMOS TU PANTALLA DE LOGIN DIRECTAMENTE
import LoginScreen from '../login'; 

export default function AdminLayout() {
  const { usuario, cargandoSesion } = useAuth();
  const [rootReady, setRootReady] = useState(false);
  
  // ESTADO PARA LA NOTIFICACIÓN FLOTANTE (Píldora simple)
  const [alertaTaller, setAlertaTaller] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0]; // Animación suave

  useEffect(() => {
    setRootReady(true);
  }, []);

  // --- ESCUCHADOR EN TIEMPO REAL PARA EL TALLER ---
  useEffect(() => {
    if (!usuario) return;

    const canalTaller = supabase
      .channel('alertas-globales-taller')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reparaciones' }, () => {
        // 1. Mostrar la píldora simple
        setAlertaTaller(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        
        // 2. Desaparecerla automáticamente después de 3.5 segundos
        setTimeout(() => {
          Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
            setAlertaTaller(false);
          });
        }, 3500);
      })
      .subscribe();

    return () => { supabase.removeChannel(canalTaller); };
  }, [usuario]);

  if (cargandoSesion || !rootReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' }}>
        <ActivityIndicator size="large" color="#0056FF" />
      </View>
    );
  }

  if (usuario === null) {
    return <LoginScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="productos" />
        <Stack.Screen name="ventas" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="usuarios" />
        <Stack.Screen name="taller" />
        <Stack.Screen name="inversion" />
      </Stack>

      {/* PÍLDORA DISCRETA DE NOTIFICACIÓN */}
      {alertaTaller && (
        <Animated.View style={[styles.pildoraSimple, { opacity: fadeAnim }]}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.pildoraTexto}>Nuevo equipo registrado en Taller</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pildoraSimple: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80, // Se pone abajo para no estorbar arriba
    alignSelf: 'center',
    backgroundColor: '#333', // Un gris oscuro elegante y discreto
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 9999,
  },
  pildoraTexto: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  }
});