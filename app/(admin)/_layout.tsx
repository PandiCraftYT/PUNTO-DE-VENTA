import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/auth_context'; 
import { ActivityIndicator, View } from 'react-native';

// IMPORTAMOS TU PANTALLA DE LOGIN DIRECTAMENTE
import LoginScreen from '../login'; 

export default function AdminLayout() {
  const { usuario } = useAuth();
  const [rootReady, setRootReady] = useState(false);

  // Esperamos un ciclo para asegurar que el componente esté montado
  useEffect(() => {
    setRootReady(true);
  }, []);

  // 1. Mientras la app decide si hay usuario o el componente no ha montado
  if (usuario === undefined || !rootReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' }}>
        <ActivityIndicator size="large" color="#0056FF" />
      </View>
    );
  }

  // 2. SI EL USUARIO ES NULL (Cerró sesión o no está logueado)
  // En lugar de navegar y causar errores, mostramos el componente de Login directamente.
  // Esto "limpia" la pantalla de administración al instante.
  if (usuario === null) {
    return <LoginScreen />;
  }

  // 3. SI HAY USUARIO, RENDERIZAMOS LAS PANTALLAS DE ADMIN
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