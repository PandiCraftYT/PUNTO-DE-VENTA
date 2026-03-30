import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

// AGREGAMOS LOS COMPONENTES GLOBALES
import CustomHeader from '../../components/CustomHeader';
import FooterNav from '../../components/FooterNav';

const LOGO_BLUE = '#0056FF';

export default function CatalogoServiciosScreen() {
  const router = useRouter();
  const { usuario } = useAuth();

  const [servicios, setServicios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // NUEVO: Estado para la barra de búsqueda
  const [busqueda, setBusqueda] = useState('');

  // Estados del formulario
  const [idEdicion, setIdEdicion] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');

  useEffect(() => {
    cargarServicios();
  }, []);

  const cargarServicios = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('categoria', 'SERVICIO') // Solo traemos la categoría servicio
        .order('nombre', { ascending: true });

      if (error) throw error;
      setServicios(data || []);
    } catch (error) {
      console.log("Error al cargar servicios:", error);
    } finally {
      setCargando(false);
    }
  };

  const abrirModal = (servicio: any = null) => {
    if (servicio) {
      setIdEdicion(servicio.id);
      setNombre(servicio.nombre);
      setPrecio(servicio.precio_venta?.toString() || '');
    } else {
      setIdEdicion(null);
      setNombre('');
      setPrecio('');
    }
    setModalVisible(true);
  };

  const guardarServicio = async () => {
    if (!nombre.trim() || !precio.trim()) {
      Alert.alert("Faltan datos", "Ingresa el nombre del servicio y su precio.");
      return;
    }

    setProcesando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        precio_venta: parseFloat(precio) || 0,
        categoria: 'SERVICIO',
        stock: 9999, // Los servicios no se agotan
        localizacion: 'TALLER',
        registrado_por_nombre: usuario?.nombre || 'Admin GS'
      };

      if (idEdicion) {
        // Actualizar
        const { error } = await supabase.from('productos').update(payload).eq('id', idEdicion);
        if (error) throw error;
      } else {
        // Crear nuevo con un código falso para que pase los filtros de inventario
        const codigoFalso = 'SERV-' + Math.floor(100000 + Math.random() * 900000);
        const { error } = await supabase.from('productos').insert([{ ...payload, codigo_barras: codigoFalso }]);
        if (error) throw error;
      }

      setModalVisible(false);
      cargarServicios();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setProcesando(false);
    }
  };

  const confirmarEliminar = (id: string, nombreServicio: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar el servicio "${nombreServicio}" del catálogo?`)) {
        eliminarServicio(id);
      }
    } else {
      Alert.alert(
        "Eliminar Servicio",
        `¿Seguro que deseas borrar "${nombreServicio}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, borrar", style: "destructive", onPress: () => eliminarServicio(id) }
        ]
      );
    }
  };

  const eliminarServicio = async (id: string) => {
    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      cargarServicios();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // Filtrar los servicios en tiempo real
  const serviciosFiltrados = servicios.filter(item => 
    item.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER GLOBAL INTEGRADO AQUÍ */}
      <CustomHeader title="CATÁLOGO DE SERVICIOS" />

      {/* BARRA DE BÚSQUEDA */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder="Buscar servicio..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {cargando ? (
        <View style={styles.center}><ActivityIndicator size="large" color={LOGO_BLUE} /></View>
      ) : (
        <FlatList
          data={serviciosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name={busqueda ? "search-outline" : "construct-outline"} size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {busqueda ? 'No se encontraron servicios.' : 'No hay servicios registrados.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.servicioCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="build" size={20} color={LOGO_BLUE} />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.servicioNombre}>{item.nombre}</Text>
                <Text style={styles.servicioPrecio}>Precio fijo: ${parseFloat(item.precio_venta).toFixed(2)}</Text>
              </View>
              
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => abrirModal(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#f39c12" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmarEliminar(item.id, item.nombre)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => abrirModal()}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* MODAL CREAR / EDITAR SERVICIO */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{idEdicion ? 'Editar Servicio' : 'Nuevo Servicio'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>TIPO DE MANTENIMIENTO / REPARACIÓN</Text>
            <TextInput 
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} 
              placeholder="Ej. Cambio Disco Duro PS4" 
              value={nombre} 
              onChangeText={setNombre} 
            />
            
            <Text style={styles.label}>PRECIO OFICIAL</Text>
            <TextInput 
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} 
              placeholder="$0.00" 
              keyboardType="numeric" 
              value={precio} 
              onChangeText={setPrecio} 
            />
            
            <TouchableOpacity style={styles.saveBtn} onPress={guardarServicio} disabled={procesando}>
              {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar en el Catálogo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FOOTER GLOBAL INTEGRADO AQUÍ */}
      <FooterNav />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // ESTILOS DE LA BARRA DE BÚSQUEDA
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    margin: 15, marginBottom: 0, paddingHorizontal: 15, borderRadius: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b' },

  // Se aumentó el paddingBottom para que el FooterNav no tape el último elemento de la lista
  listContent: { padding: 15, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94a3b8', marginTop: 15, fontSize: 16, fontWeight: '500' },
  
  servicioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  iconContainer: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#f0f5ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  servicioNombre: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  servicioPrecio: { fontSize: 14, color: '#27ae60', fontWeight: 'bold', marginTop: 4 },
  actionBtn: { padding: 8, marginLeft: 5 },

  // Se subió el botón flotante (bottom: 100) para que quede por encima del FooterNav
  fab: { position: 'absolute', bottom: 100, right: 20, backgroundColor: LOGO_BLUE, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  label: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, marginBottom: 20 },
  saveBtn: { backgroundColor: LOGO_BLUE, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});