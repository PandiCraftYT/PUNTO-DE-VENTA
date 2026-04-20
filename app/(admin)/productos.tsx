import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Image, TextInput, Platform, Alert 
} from 'react-native';
import { supabase } from '../lib/supabase'; 
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import CustomHeader from '../../components/CustomHeader';
import FooterNav from '../../components/FooterNav';

// --- IMPORTAMOS NUESTRA HERRAMIENTA ---
import { formatoMoneda } from '../lib/helpers';

const LOGO_BLUE = '#0056FF';

export default function ListaProductosScreen() {
  const router = useRouter();
  
  const [productos, setProductos] = useState<any[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // --- ACTUALIZACIÓN EN TIEMPO REAL ---
  useEffect(() => {
    cargarProductos();

    const canalInventario = supabase
      .channel(`inventario-realtime-${Date.now()}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'productos' }, 
        () => { cargarProductos(false); }
      )
      .subscribe();

    return () => { supabase.removeChannel(canalInventario); };
  }, []);

  const cargarProductos = async (mostrarCarga: boolean = true) => {
    try {
      if (mostrarCarga) setCargando(true);
      
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      
      // ORDENAR: Agotados al final
      const dataOrdenada = (data || []).sort((a, b) => {
        if (a.stock <= 0 && b.stock > 0) return 1;
        if (b.stock <= 0 && a.stock > 0) return -1;
        return 0;
      });

      setProductos(dataOrdenada);
      filtrarLocalmente(busqueda, dataOrdenada);

    } catch (error: any) {
      console.error("Error cargando productos:", error.message);
    } finally {
      if (mostrarCarga) setCargando(false);
      setRefrescando(false);
    }
  };

  const filtrarLocalmente = (texto: string, listaCompleta: any[]) => {
    if (texto.trim() === '') {
      setProductosFiltrados(listaCompleta);
    } else {
      const q = texto.toLowerCase();
      setProductosFiltrados(listaCompleta.filter(p => 
        p.nombre?.toLowerCase().includes(q) || 
        p.categoria?.toLowerCase().includes(q) ||
        p.codigo_barras?.includes(q)
      ));
    }
  };

  useEffect(() => {
    filtrarLocalmente(busqueda, productos);
  }, [busqueda, productos]);

  useFocusEffect(
    useCallback(() => {
      cargarProductos(false);
    }, [])
  );

  const ejecutarBorrado = async (id: string) => {
    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      cargarProductos(false); 
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const confirmarEliminar = (id: string, nombre: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar "${nombre}"?`)) ejecutarBorrado(id);
    } else {
      Alert.alert("Borrar", `¿Eliminar "${nombre}"?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => ejecutarBorrado(id) }
      ]);
    }
  };

  const renderRightActions = (item: any) => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity style={styles.swipeEditBtn} onPress={() => router.push(`/(admin)/producto/${item.id}` as any)}>
        <Ionicons name="pencil" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => confirmarEliminar(item.id, item.nombre)}>
        <Ionicons name="trash" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const isAgotado = item.stock <= 0;

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
        <TouchableOpacity 
          style={[styles.card, isAgotado && styles.cardAgotado]} 
          onPress={() => router.push(`/(admin)/producto/${item.id}` as any)}
        >
          <View style={styles.imageContainer}>
            {item.imagen_url ? (
              <Image source={{ uri: item.imagen_url }} style={styles.prodImg} />
            ) : (
              <Ionicons name="cube-outline" size={24} color="#cbd5e1" />
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={[styles.prodNombre, isAgotado && { color: '#94a3b8' }]} numberOfLines={1}>{item.nombre}</Text>
            <Text style={styles.prodCat}>{item.categoria || 'Sin categoría'}</Text>
            <Text style={[styles.prodPrecio, isAgotado && styles.precioAgotado]}>
              {formatoMoneda(item.precio_venta)}
            </Text>
          </View>

          <View style={[styles.stockBadge, isAgotado && styles.stockBadgeAgotado]}>
            <Text style={[styles.stockText, isAgotado && styles.stockTextAgotado]}>
              {isAgotado ? 'SIN STOCK' : `${item.stock} pz`}
            </Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <CustomHeader title="INVENTARIO" />

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput 
              style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} 
              placeholder="Buscar por nombre, categoría o código..."
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>
        </View>

        {cargando && !refrescando ? (
          <View style={styles.center}><ActivityIndicator size="large" color={LOGO_BLUE} /></View>
        ) : (
          <FlatList
            data={productosFiltrados}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargarProductos()} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={50} color="#cbd5e1" />
                <Text style={styles.emptyText}>No hay productos en el inventario.</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity style={styles.fab} onPress={() => router.push('/(admin)/nuevo-producto' as any)}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        <FooterNav />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchSection: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBar: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingHorizontal: 15, height: 48, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1e293b' },
  listContent: { padding: 15, paddingBottom: 120 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 10, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  cardAgotado: { opacity: 0.6 },
  imageContainer: { width: 50, height: 50, backgroundColor: '#f8fafc', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
  prodImg: { width: '100%', height: '100%' },
  infoContainer: { flex: 1 },
  prodNombre: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  prodCat: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', marginTop: 2 },
  prodPrecio: { fontSize: 14, color: '#16a34a', fontWeight: '800', marginTop: 4 },
  precioAgotado: { color: '#94a3b8' },
  stockBadge: { backgroundColor: '#f0f7ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  stockText: { color: LOGO_BLUE, fontWeight: 'bold', fontSize: 12 },
  stockBadgeAgotado: { backgroundColor: '#fef2f2' },
  stockTextAgotado: { color: '#ef4444' },
  swipeActionsContainer: { flexDirection: 'row', marginLeft: 10 },
  swipeEditBtn: { backgroundColor: '#f39c12', width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginRight: 5 },
  swipeDeleteBtn: { backgroundColor: '#ef4444', width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  fab: { position: 'absolute', right: 20, bottom: 100, backgroundColor: LOGO_BLUE, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94a3b8', marginTop: 15, fontSize: 14 }
});