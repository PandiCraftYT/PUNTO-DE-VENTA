import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

// COLOR AZUL DE TU LOGO GS
const LOGO_BLUE = '#0056FF';
const INACTIVE_COLOR = '#7f8c8d';

export default function FooterNav() {
  const router = useRouter();
  const pathname = usePathname();

  // --- LÓGICA PARA DETECTAR RUTA ACTUAL ---
  const isInventory = pathname.includes('productos') || pathname.includes('nuevo-producto');
  const isServicios = pathname.includes('servicios');
  const isHome = !isInventory && !isServicios; 

  // --- FUNCIÓN ANTIBUCLE ---
  const manejarNavegacion = (destino: string) => {
    // Si intentas ir a una ruta y ya estás ahí, NO hagas nada
    if (destino === '/(admin)' && isHome) return;
    if (destino === '/(admin)/productos' && isInventory) return;
    if (destino === '/(admin)/servicios' && isServicios) return;

    // Si es una ruta nueva, usamos replace para mantener limpio el historial
    router.replace(destino as any);
  };

  return (
    <View style={styles.footerNav}>
      {/* BOTÓN INICIO */}
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => manejarNavegacion('/(admin)')}
      >
        <Ionicons 
          name={isHome ? "home" : "home-outline"} 
          size={26} 
          color={isHome ? LOGO_BLUE : INACTIVE_COLOR} 
        />
        <Text style={[styles.navText, { color: isHome ? LOGO_BLUE : INACTIVE_COLOR }]}>
          Inicio
        </Text>
      </TouchableOpacity>
      
      {/* BOTÓN INVENTARIO */}
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => manejarNavegacion('/(admin)/productos')}
      >
        <Ionicons 
          name={isInventory ? "archive" : "archive-outline"} 
          size={26} 
          color={isInventory ? LOGO_BLUE : INACTIVE_COLOR} 
        />
        <Text style={[styles.navText, { color: isInventory ? LOGO_BLUE : INACTIVE_COLOR }]}>
          Inventario
        </Text>
      </TouchableOpacity>

      {/* BOTÓN SERVICIOS (TALLER) */}
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => manejarNavegacion('/(admin)/servicios')}
      >
        <Ionicons 
          name={isServicios ? "build" : "build-outline"} 
          size={26} 
          color={isServicios ? LOGO_BLUE : INACTIVE_COLOR} 
        />
        <Text style={[styles.navText, { color: isServicios ? LOGO_BLUE : INACTIVE_COLOR }]}>
          Servicios
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footerNav: {
    position: 'absolute', // Esto lo ancla hasta abajo
    bottom: 0,
    width: '100%',
    height: 80,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingBottom: 20, // Da espacio para la barrita de los iPhone
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  navItem: { 
    alignItems: 'center',
    flex: 1 
  },
  navText: { 
    fontSize: 12, 
    marginTop: 4, 
    fontWeight: '700' 
  }
});