import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function EntryPoint() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false); // Cambia a true manualmente para probar el panel directo

  useEffect(() => {
    // Simulamos carga de 1 segundo
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#3f51b5" />
      </View>
    );
  }

  // Si no está logueado, manda al archivo login.tsx
  if (!isLogged) {
    return <Redirect href="/login" />;
  }

  // Si ya está logueado, manda a la carpeta (admin)
  return <Redirect href="/(admin)" />;
}