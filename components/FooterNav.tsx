import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native'; // <--- Platform añadido aquí
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

const LOGO_BLUE = '#0056FF';
const INACTIVE_COLOR = '#94a3b8';

export default function FooterNav() {
  const router = useRouter();
  const pathname = usePathname();

  // --- LÓGICA PARA DETECTAR RUTA ACTUAL ---
  const isHome = pathname === '/(admin)';
  const isInventory = pathname.includes('productos') || pathname.includes('nuevo-producto') || pathname.includes('producto/');
  const isVentas = pathname.includes('ventas');

  const manejarNavegacion = (destino: string) => {
    // Evitar recargas si ya estamos en la ruta
    if (destino === '/(admin)' && isHome) return;
    if (destino === '/(admin)/productos' && isInventory) return;
    if (destino === '/(admin)/ventas' && isVentas) return;

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
          name={isHome ? "grid" : "grid-outline"} 
          size={24} 
          color={isHome ? LOGO_BLUE : INACTIVE_COLOR} 
        />
        <Text style={[styles.navText, { color: isHome ? LOGO_BLUE : INACTIVE_COLOR }]}>
          Panel
        </Text>
      </TouchableOpacity>
      
      {/* BOTÓN INVENTARIO */}
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => manejarNavegacion('/(admin)/productos')}
      >
        <Ionicons 
          name={isInventory ? "cube" : "cube-outline"} 
          size={24} 
          color={isInventory ? LOGO_BLUE : INACTIVE_COLOR} 
        />
        <Text style={[styles.navText, { color: isInventory ? LOGO_BLUE : INACTIVE_COLOR }]}>
          Stock
        </Text>
      </TouchableOpacity>

      {/* BOTÓN VENTAS (EL MOTOR DEL NEGOCIO) */}
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => manejarNavegacion('/(admin)/ventas')}
      >
        <View style={[styles.salesIconContainer, isVentas && styles.salesIconActive]}>
          <Ionicons 
            name={isVentas ? "cart" : "cart-outline"} 
            size={24} 
            color={isVentas ? '#fff' : INACTIVE_COLOR} 
          />
        </View>
        <Text style={[styles.navText, { color: isVentas ? LOGO_BLUE : INACTIVE_COLOR }]}>
          Vender
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footerNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: Platform.OS === 'ios' ? 90 : 75,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  navItem: { 
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  navText: { 
    fontSize: 11, 
    marginTop: 4, 
    fontWeight: '800',
    letterSpacing: 0.3
  },
  salesIconContainer: {
    padding: 2,
    borderRadius: 8,
  },
  salesIconActive: {
    backgroundColor: LOGO_BLUE,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  }
});