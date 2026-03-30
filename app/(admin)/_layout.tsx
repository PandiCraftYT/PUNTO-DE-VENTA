import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/auth_context'; 
import { ActivityIndicator, View } from 'react-native';

// IMPORTAMOS TU PANTALLA DE LOGIN DIRECTAMENTE
import LoginScreen from '../login'; 

export default function AdminLayout() {
  // AQUÍ ESTÁ EL TRUCO: Agregamos cargandoSesion para saber cuándo el teléfono ya terminó de buscar
  const { usuario, cargandoSesion } = useAuth();
  const [rootReady, setRootReady] = useState(false);

  // Esperamos un ciclo para asegurar que el componente esté montado
  useEffect(() => {
    setRootReady(true);
  }, []);

  // 1. EL CADENERO ESPERA: Mientras la app busca en AsyncStorage si hay sesión guardada
  // mostramos la ruedita de carga. Esto frena en seco el "efecto parpadeo".
  if (cargandoSesion || !rootReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' }}>
        <ActivityIndicator size="large" color="#0056FF" />
      </View>
    );
  }

  // 2. YA TERMINÓ DE CARGAR Y EL USUARIO ES NULL (No hay sesión guardada)
  // Ahora sí, con total seguridad, mostramos el Login.
  if (usuario === null) {
    return <LoginScreen />;
  }

  // 3. SI HAY USUARIO GUARDADO, RENDERIZAMOS LAS PANTALLAS DE ADMIN DIRECTAMENTE
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="productos" />
      <Stack.Screen name="ventas" />
      <Stack.Screen name="perfil" />
      <Stack.Screen name="usuarios" />
    </Stack>
  );
}