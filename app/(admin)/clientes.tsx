import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Platform, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

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
  const [clienteEditando, setClienteEditando] = useState<any>(null); 
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');

  // Perfil VIP y Campañas (Adaptados al modelo comercial)
  const [modalPerfilVisible, setModalPerfilVisible] = useState(false);
  const [clienteActivo, setClienteActivo] = useState<any>(null);
  
  const [modalCampanaVisible, setModalCampanaVisible] = useState(false);
  const [productoCampana, setProductoCampana] = useState('');
  const [clientesCampana, setClientesCampana] = useState<any[]>([]);
  const [mensajeCampana, setMensajeCampana] = useState('¡Hola! Tenemos nuevas promociones para ti. ¡Te esperamos!');
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
    setModalPerfilVisible(false);
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
        // CREAR NUEVO (Sin sucursales quemadas en el código)
        const { error } = await supabase.from('clientes').insert([{ 
          nombre, 
          telefono, 
          notas, 
          registrado_por: usuario?.nombre || 'Admin' 
        }]);
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
      if (window.confirm(`¿Seguro que deseas eliminar a ${cliente.nombre}?`)) {
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
      Alert.alert("Error", "No se pudo eliminar. Revisa que el cliente no tenga ventas registradas.");
    }
  };

  const abrirWhatsApp = (tel: string, mensajeOpcional?: string) => {
    if (!tel) return;
    Linking.openURL(mensajeOpcional ? `https://wa.me/52${tel}?text=${encodeURIComponent(mensajeOpcional)}` : `https://wa.me/52${tel}`);
  };

  const abrirPerfil = (cliente: any) => {
    setClienteActivo(cliente); 
    setModalPerfilVisible(true); 
  };

  // BUSCADOR GENÉRICO PARA CAMPAÑAS (Busca en base al historial de ventas, no reparaciones)
  const buscarParaCampana = async () => {
    if (!productoCampana) { Alert.alert('Aviso', 'Escribe una palabra clave del producto.'); return; }
    setBuscandoCampana(true);
    try {
      // Nota: Esta consulta requiere un Join complejo si usamos supabase js, 
      // Por ahora para el MVP filtramos a todos los clientes como demostración comercial.
      const { data, error } = await supabase.from('clientes').select('nombre, telefono');
      if (error) throw error;
      
      setClientesCampana(data || []);
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
                <View><Text style={styles.statLabel}>Total Compras</Text><Text style={styles.statValue}>${item.total_gastado?.toFixed(2) || '0.00'}</Text></View>
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

      {/* --- MODAL DE FORMULARIO BÁSICO INYECTADO --- */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{fontSize: 18, fontWeight: 'bold', marginBottom: 15}}>
              {clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}
            </Text>
            
            <TextInput style={styles.inputModal} placeholder="Nombre completo *" value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.inputModal} placeholder="Teléfono *" value={telefono} onChangeText={setTelefono} keyboardType="numeric" />
            <TextInput style={[styles.inputModal, {height: 80}]} placeholder="Notas o preferencias (Opcional)" value={notas} onChangeText={setNotas} multiline />

            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
              <TouchableOpacity style={[styles.btnModal, {backgroundColor: '#e2e8f0'}]} onPress={() => setModalVisible(false)}>
                <Text style={{color: '#64748b', fontWeight: 'bold'}}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.btnModal, {backgroundColor: LOGO_BLUE}]} onPress={guardarCliente} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight: 'bold'}}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  emptyText: { color: '#94a3b8', marginTop: 15, fontSize: 16 },

  // Estilos rápidos para el modal inyectado
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', padding: 20, borderRadius: 15 },
  inputModal: { borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 15 },
  btnModal: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 8, marginHorizontal: 5 }
});