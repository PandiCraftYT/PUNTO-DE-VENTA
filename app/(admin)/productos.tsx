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
  
  // ESTADOS PARA DATOS
  const [productos, setProductos] = useState<any[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // --- ACTUALIZACIÓN EN TIEMPO REAL (WEBSOCKETS) ---
  useEffect(() => {
    cargarProductos();

    const canalInventario = supabase
      .channel(`inventario-realtime-${Date.now()}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'productos' }, 
        (payload) => {
          console.log("¡Cambio en inventario detectado!", payload);
          cargarProductos(false); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalInventario);
    };
  }, []);

  // 1. CARGAR PRODUCTOS DESDE SUPABASE Y ORDENAR
  const cargarProductos = async (mostrarCarga: boolean = true) => {
    try {
      if (mostrarCarga) setCargando(true);
      
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('creado_at', { ascending: false });

      if (error) throw error;
      
      // --- LÓGICA: ORDENAR AGOTADOS AL FINAL ---
      const dataOrdenada = (data || []).sort((a, b) => {
        if (a.stock <= 0 && b.stock > 0) return 1;
        if (b.stock <= 0 && a.stock > 0) return -1;
        return 0;
      });

      setProductos(dataOrdenada);
      
      // Mantiene el filtro si había una búsqueda escrita
      if (busqueda.trim() === '') {
        setProductosFiltrados(dataOrdenada);
      } else {
        const texto = busqueda.toLowerCase();
        setProductosFiltrados(dataOrdenada.filter(p => 
          p.nombre?.toLowerCase().includes(texto) || 
          p.localizacion?.toLowerCase().includes(texto) ||
          p.categoria?.toLowerCase().includes(texto)
        ));
      }
    } catch (error: any) {
      console.error("Error cargando productos:", error.message);
    } finally {
      if (mostrarCarga) setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarProductos();
    }, [])
  );

  // 2. LÓGICA DEL BUSCADOR
  useEffect(() => {
    if (busqueda.trim() === '') {
      setProductosFiltrados(productos);
    } else {
      const texto = busqueda.toLowerCase();
      const filtrados = productos.filter(p => 
        p.nombre?.toLowerCase().includes(texto) || 
        p.localizacion?.toLowerCase().includes(texto) ||
        p.categoria?.toLowerCase().includes(texto)
      );
      setProductosFiltrados(filtrados);
    }
  }, [busqueda, productos]);

  const confirmarEliminar = (id: string, nombre: string) => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm(`¿Seguro que quieres eliminar "${nombre}" para siempre?`);
      if (confirmar) ejecutarBorrado(id);
    } else {
      Alert.alert("¿Borrar Producto?", `Estás a punto de eliminar "${nombre}".`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, borrar", style: "destructive", onPress: () => ejecutarBorrado(id) }
      ]);
    }
  };

  const ejecutarBorrado = async (id: string) => {
    try {
      setCargando(true);
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      cargarProductos(); 
    } catch (error: any) {
      if (Platform.OS === 'web') window.alert("Error: " + error.message);
      else Alert.alert("Error", error.message);
      setCargando(false);
    }
  };

  const renderRightActions = (item: any) => {
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity 
          style={styles.swipeEditBtn}
          onPress={() => router.push(`/(admin)/producto/${item.id}` as any)}
        >
          <Ionicons name="pencil" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Editar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.swipeDeleteBtn}
          onPress={() => confirmarEliminar(item.id, item.nombre)}
        >
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Borrar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 3. DISEÑO DE LA TARJETA CON LÓGICA DE AGOTADO
  const renderItem = ({ item }: { item: any }) => {
    const isAgotado = item.stock <= 0;

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
        <TouchableOpacity 
          style={[styles.card, isAgotado && styles.cardAgotado]} 
          activeOpacity={0.9} 
          onPress={() => router.push(`/(admin)/producto/${item.id}` as any)}
        >
          <View style={[styles.imageContainer, isAgotado && { opacity: 0.6 }]}>
            {item.imagen_url && item.imagen_url.trim() !== '' ? (
              <Image source={{ uri: item.imagen_url }} style={styles.prodImg} />
            ) : (
              <Ionicons name="cube-outline" size={24} color="#ccc" />
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={[styles.prodNombre, isAgotado && { color: '#94a3b8' }]} numberOfLines={1}>{item.nombre}</Text>
            <Text style={styles.prodLocal}>{item.localizacion || 'Local 1'}</Text>
            {/* --- APLICAMOS EL FORMATO DE MONEDA AQUÍ --- */}
            <Text style={[styles.prodPrecio, isAgotado && styles.precioAgotado]}>
              {formatoMoneda(item.precio_venta)}
            </Text>
          </View>

          <View style={[styles.stockBadge, isAgotado && styles.stockBadgeAgotado]}>
            <Text style={[styles.stockText, isAgotado && styles.stockTextAgotado]}>
              {isAgotado ? 'AGOTADO' : `${item.stock} pz`}
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
            <Ionicons name="search" size={20} color="#999" />
            <TextInput 
              style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} 
              placeholder="Buscar un producto..."
              placeholderTextColor="#a0aec0"
              value={busqueda}
              onChangeText={setBusqueda}
            />
            {busqueda !== '' && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={20} color="#ccc" />
              </TouchableOpacity>
            )}
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
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={() => {
                setRefrescando(true);
                cargarProductos();
              }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={50} color="#ccc" />
                <Text style={styles.emptyText}>No se encontraron productos.</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => router.push('/(admin)/nuevo-producto' as any)}
        >
          <Ionicons name="add" size={35} color="#fff" />
        </TouchableOpacity>

        <FooterNav />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  searchSection: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchBar: { 
    flexDirection: 'row', 
    backgroundColor: '#f8f9fa', 
    paddingHorizontal: 15, 
    height: 50, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee'
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333', height: '100%' }, 

  listContent: { padding: 15, paddingBottom: 150 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardAgotado: { backgroundColor: '#fdfdfd', opacity: 0.7 },
  precioAgotado: { color: '#94a3b8' },
  stockBadgeAgotado: { backgroundColor: '#fef2f2' },
  stockTextAgotado: { color: '#ef4444', fontSize: 11, letterSpacing: 0.5 },

  imageContainer: { width: 55, height: 55, backgroundColor: '#f8f9fa', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
  prodImg: { width: '100%', height: '100%', borderRadius: 10 },
  infoContainer: { flex: 1 },
  prodNombre: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  prodLocal: { fontSize: 12, color: '#999', marginTop: 2 },
  prodPrecio: { fontSize: 15, color: '#27ae60', fontWeight: 'bold', marginTop: 4 },
  stockBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  stockText: { color: LOGO_BLUE, fontWeight: 'bold', fontSize: 13 },

  swipeActionsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  swipeEditBtn: {
    backgroundColor: '#f39c12',
    width: 75,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  swipeDeleteBtn: {
    backgroundColor: '#e74c3c',
    width: 75,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 5,
  },

  fab: {
    position: 'absolute',
    right: 25,
    bottom: 110, 
    backgroundColor: LOGO_BLUE,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: LOGO_BLUE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 999
  },

  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 15, fontSize: 16 }
});