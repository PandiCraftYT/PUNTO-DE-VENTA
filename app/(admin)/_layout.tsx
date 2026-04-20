import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/auth_context'; 
import { ActivityIndicator, View } from 'react-native';

// IMPORTAMOS TU PANTALLA DE LOGIN DIRECTAMENTE
import LoginScreen from '../login'; 

export default function AdminLayout() {
  const { usuario, cargandoSesion } = useAuth();
  const [rootReady, setRootReady] = useState(false);

  useEffect(() => {
    setRootReady(true);
  }, []);

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
        {/* --- MÓDULO DE VENTAS --- */}
        <Stack.Screen name="index" />
        <Stack.Screen name="ventas" /> 
        <Stack.Screen name="clientes" /> 
        <Stack.Screen name="cotizacion" /> 
        
        {/* --- MÓDULO DE INVENTARIO --- */}
        <Stack.Screen name="productos" /> 
        <Stack.Screen name="nuevo-producto" /> 
        <Stack.Screen name="producto/[id]" /> 

        {/* --- MÓDULO DE ADMINISTRACIÓN --- */}
        <Stack.Screen name="historial" /> 
        <Stack.Screen name="usuarios" /> 
        <Stack.Screen name="perfil" />
      </Stack>
    </View>
  );
}