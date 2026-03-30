import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// Conectamos a nuestro contexto real
import { useAuth } from './lib/auth_context'; 

export default function EntryPoint() {
  // Traemos el usuario real y el estado de carga real del disco duro
  const { usuario, cargandoSesion } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Solo tomamos una decisión cuando la memoria haya terminado de cargar de verdad
    if (!cargandoSesion) {
      if (usuario) {
        // Usamos replace para que te meta directo al panel sin dejar historial de navegación
        router.replace('/(admin)');
      } else {
        router.replace('/login');
      }
    }
  }, [usuario, cargandoSesion]);

  // Mientras AsyncStorage lee el disco duro (fracción de segundo), mostramos la carga
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' }}>
      <ActivityIndicator size="large" color="#0056FF" />
    </View>
  );
}