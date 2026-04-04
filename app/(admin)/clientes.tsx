import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

// Importamos los modales externos
import { ModalFormularioCliente, ModalPerfilVIP, ModalCampana } from '../../components/ModalesClientes';

const LOGO_BLUE = '#0056FF';

export default function ClientesScreen() {
  const router = useRouter();
  const { usuario } = useAuth();
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Modales y Formulario
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<any>(null); // NUEVO: Saber si estamos editando
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');

  // Perfil VIP
  const [modalPerfilVisible, setModalPerfilVisible] = useState(false);
  const [clienteActivo, setClienteActivo] = useState<any>(null);
  const [historialEquipos, setHistorialEquipos] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Campañas de Marketing
  const [modalCampanaVisible, setModalCampanaVisible] = useState(false);
  const [equipoCampana, setEquipoCampana] = useState('');
  const [clientesCampana, setClientesCampana] = useState<any[]>([]);
  const [mensajeCampana, setMensajeCampana] = useState('¡Hola! 🎮 Nos acaban de llegar accesorios y promociones nuevas para tu equipo. ¡Te esperamos!');
  const [buscandoCampana, setBuscandoCampana] = useState(false);

  useEffect(() => { cargarClientes(); }, []);

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      setClientes(data || []);
    } catch (error) { console.log(error); } 
    finally { setCargando(false); }
  };

  const abrirNuevoCliente = () => {
    setClienteEditando(null);
    setNombre(''); setTelefono(''); setNotas('');
    setModalVisible(true);
  };

  const abrirEditarCliente = (cliente: any) => {
    setModalPerfilVisible(false); // Cerramos el perfil para abrir el form
    setClienteEditando(cliente);
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono);
    setNotas(cliente.notas || '');
    setModalVisible(true);
  };

  const guardarCliente = async () => {
    if (!nombre || !telefono) { Alert.alert('Faltan datos', 'Nombre y Teléfono obligatorios.'); return; }
    setGuardando(true);
    try {
      if (clienteEditando) {
        // ACTUALIZAR EXISTENTE
        const { error } = await supabase.from('clientes').update({ nombre, telefono, notas }).eq('id', clienteEditando.id);
        if (error) throw error;
      } else {
        // CREAR NUEVO
        const { error } = await supabase.from('clientes').insert([{ nombre, telefono, notas, sucursal_registro: 'Culiacán', registrado_por: usuario?.nombre }]);
        if (error) throw error;
      }
      
      setModalVisible(false); setNombre(''); setTelefono(''); setNotas(''); setClienteEditando(null);
      cargarClientes();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el cliente.');
    } finally { setGuardando(false); }
  };

  const confirmarEliminacion = (cliente: any) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Seguro que deseas eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)) {
        ejecutarEliminacion(cliente.id);
      }
    } else {
      Alert.alert("Eliminar Cliente", `¿Seguro que deseas eliminar a ${cliente.nombre}?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, Eliminar", style: "destructive", onPress: () => ejecutarEliminacion(cliente.id) }
      ]);
    }
  };

  const ejecutarEliminacion = async (id: string) => {
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      setModalPerfilVisible(false);
      cargarClientes();
    } catch (error) {
      Alert.alert("Error", "No se pudo eliminar al cliente.");
    }
  };

  const abrirWhatsApp = (tel: string, mensajeOpcional?: string) => {
    if (!tel) return;
    Linking.openURL(mensajeOpcional ? `https://wa.me/52${tel}?text=${encodeURIComponent(mensajeOpcional)}` : `https://wa.me/52${tel}`);
  };

  const abrirPerfil = async (cliente: any) => {
    setClienteActivo(cliente); setModalPerfilVisible(true); setCargandoHistorial(true);
    try {
      const { data, error } = await supabase.from('reparaciones').select('*').eq('telefono', cliente.telefono).order('created_at', { ascending: false });
      if (error) throw error;
      setHistorialEquipos(data || []);
    } catch (error) { console.log(error); } 
    finally { setCargandoHistorial(false); }
  };

  const buscarParaCampana = async () => {
    if (!equipoCampana) { Alert.alert('Aviso', 'Escribe el nombre de la consola.'); return; }
    setBuscandoCampana(true);
    try {
      const { data, error } = await supabase.from('reparaciones').select('cliente, telefono, equipo').ilike('equipo', `%${equipoCampana}%`);
      if (error) throw error;
      
      const unicos: any[] = []; const telefonosVistos = new Set();
      for (const item of (data || [])) {
        if (!telefonosVistos.has(item.telefono)) {
          telefonosVistos.add(item.telefono); unicos.push(item);
        }
      }
      setClientesCampana(unicos);
    } catch (err) { Alert.alert('Error', 'No se pudo buscar.'); } 
    finally { setBuscandoCampana(false); }
  };

  const clientesFiltrados = clientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || c.telefono?.includes(busqueda));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>DIRECTORIO CLIENTES</Text>
        </View>
        <TouchableOpacity style={styles.marketingBtn} onPress={() => setModalCampanaVisible(true)}>
          <Ionicons name="megaphone" size={16} color="#fff" />
          <Text style={styles.marketingBtnText}>Promos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Buscar por nombre o teléfono..." value={busqueda} onChangeText={setBusqueda} />
      </View>

      {cargando ? ( <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 20 }} /> ) : (
        <FlatList
          data={clientesFiltrados} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.clienteCard} activeOpacity={0.7} onPress={() => abrirPerfil(item)}>
              <View style={styles.clienteInfo}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.nombre.substring(0, 2).toUpperCase()}</Text></View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.clienteNombre}>{item.nombre}</Text>
                  <Text style={styles.clienteTel}>{item.telefono}</Text>
                  {item.notas ? <Text style={styles.clienteNotas} numberOfLines={1}>{item.notas}</Text> : null}
                </View>
              </View>
              <View style={styles.statsRow}>
                <View><Text style={styles.statLabel}>Total Gastado</Text><Text style={styles.statValue}>${item.total_gastado?.toFixed(2) || '0.00'}</Text></View>
                <TouchableOpacity style={styles.waBtn} onPress={(e) => { e.stopPropagation(); abrirWhatsApp(item.telefono); }}>
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" /><Text style={styles.waBtnText}>Mensaje</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="people-outline" size={50} color="#cbd5e1" /><Text style={styles.emptyText}>No hay clientes registrados.</Text></View>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={abrirNuevoCliente}><Ionicons name="person-add" size={24} color="#fff" /></TouchableOpacity>

      {/* --- INYECCIÓN DE MODALES --- */}
      <ModalFormularioCliente visible={modalVisible} setVisible={setModalVisible} nombre={nombre} setNombre={setNombre} telefono={telefono} setTelefono={setTelefono} notas={notas} setNotas={setNotas} guardarCliente={guardarCliente} guardando={guardando} clienteEditando={clienteEditando} />
      <ModalPerfilVIP visible={modalPerfilVisible} setVisible={setModalPerfilVisible} clienteActivo={clienteActivo} historialEquipos={historialEquipos} cargandoHistorial={cargandoHistorial} abrirEditarCliente={abrirEditarCliente} confirmarEliminacion={confirmarEliminacion} />
      <ModalCampana visible={modalCampanaVisible} setVisible={setModalCampanaVisible} equipoCampana={equipoCampana} setEquipoCampana={setEquipoCampana} mensajeCampana={mensajeCampana} setMensajeCampana={setMensajeCampana} buscarParaCampana={buscarParaCampana} buscandoCampana={buscandoCampana} clientesCampana={clientesCampana} abrirWhatsApp={abrirWhatsApp} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15, backgroundColor: '#fff' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginLeft: 10 },
  backBtn: { padding: 5 },
  marketingBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e67e22', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  marketingBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, paddingHorizontal: 15, borderRadius: 15, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  list: { padding: 15, paddingBottom: 100 },
  clienteCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  clienteInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: LOGO_BLUE + '15', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: LOGO_BLUE, fontWeight: 'bold', fontSize: 18 },
  clienteNombre: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  clienteTel: { fontSize: 14, color: '#64748b', marginTop: 2 },
  clienteNotas: { fontSize: 12, color: '#94a3b8', marginTop: 5, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  statLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { fontSize: 16, fontWeight: '900', color: '#2ecc71' },
  waBtn: { flexDirection: 'row', backgroundColor: '#25D366', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  waBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: LOGO_BLUE, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94a3b8', marginTop: 15, fontSize: 16 }
});