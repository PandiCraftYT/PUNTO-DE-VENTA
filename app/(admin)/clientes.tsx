import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Linking, ScrollView, Platform 
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
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');

  // Estados Perfil VIP
  const [modalPerfilVisible, setModalPerfilVisible] = useState(false);
  const [clienteActivo, setClienteActivo] = useState<any>(null);
  const [historialEquipos, setHistorialEquipos] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // --- ESTADOS PARA CAMPAÑAS DE MARKETING ---
  const [modalCampanaVisible, setModalCampanaVisible] = useState(false);
  const [equipoCampana, setEquipoCampana] = useState('');
  const [clientesCampana, setClientesCampana] = useState<any[]>([]);
  const [mensajeCampana, setMensajeCampana] = useState('¡Hola! 🎮 Nos acaban de llegar accesorios y promociones nuevas para tu equipo. ¡Te esperamos!');
  const [buscandoCampana, setBuscandoCampana] = useState(false);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.log(error);
    } finally {
      setCargando(false);
    }
  };

  const guardarCliente = async () => {
    if (!nombre || !telefono) {
      Alert.alert('Faltan datos', 'Nombre y Teléfono son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.from('clientes').insert([{
        nombre, 
        telefono, 
        notas, 
        sucursal_registro: 'Culiacán',
        registrado_por: usuario?.nombre
      }]);
      if (error) throw error;
      
      setModalVisible(false);
      setNombre(''); setTelefono(''); setNotas('');
      cargarClientes();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirWhatsApp = (tel: string, mensajeOpcional?: string) => {
    if (!tel) return;
    const url = mensajeOpcional 
      ? `https://wa.me/52${tel}?text=${encodeURIComponent(mensajeOpcional)}`
      : `https://wa.me/52${tel}`;
    Linking.openURL(url);
  };

  const abrirPerfil = async (cliente: any) => {
    setClienteActivo(cliente);
    setModalPerfilVisible(true);
    setCargandoHistorial(true);

    try {
      const { data, error } = await supabase
        .from('reparaciones')
        .select('*')
        .eq('telefono', cliente.telefono)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistorialEquipos(data || []);
    } catch (error) {
      console.log("Error al cargar historial", error);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // --- NUEVA FUNCIÓN: BUSCAR CLIENTES POR EQUIPO PARA PROMOCIÓN ---
  const buscarParaCampana = async () => {
    if (!equipoCampana) {
      Alert.alert('Aviso', 'Escribe el nombre de la consola primero.');
      return;
    }
    setBuscandoCampana(true);
    try {
      const { data, error } = await supabase
        .from('reparaciones')
        .select('cliente, telefono, equipo')
        .ilike('equipo', `%${equipoCampana}%`);

      if (error) throw error;

      // Eliminar duplicados (si alguien llevó 2 veces un PS5, solo le mandamos 1 mensaje)
      const unicos: any[] = [];
      const telefonosVistos = new Set();
      for (const item of (data || [])) {
        if (!telefonosVistos.has(item.telefono)) {
          telefonosVistos.add(item.telefono);
          unicos.push(item);
        }
      }
      setClientesCampana(unicos);
    } catch (err) {
      Alert.alert('Error', 'No se pudo realizar la búsqueda.');
    } finally {
      setBuscandoCampana(false);
    }
  };

  const getColorEstado = (estado: string) => {
    if (estado === 'RECIBIDO') return '#e74c3c';
    if (estado === 'EN REVISIÓN') return '#f39c12';
    if (estado === 'LISTO') return '#2ecc71';
    if (estado === 'ENTREGADO') return '#94a3b8';
    return '#95a5a6';
  };

  const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'Fecha desconocida';
    const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(fechaString).toLocaleDateString('es-MX', opciones);
  };

  const clientesFiltrados = clientes.filter(c => 
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    c.telefono?.includes(busqueda)
  );

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DIRECTORIO CLIENTES</Text>
        </View>
        
        {/* BOTÓN DE CAMPAÑA MARKETING EN EL HEADER */}
        <TouchableOpacity 
          style={styles.marketingBtn} 
          onPress={() => setModalCampanaVisible(true)}
        >
          <Ionicons name="megaphone" size={16} color="#fff" />
          <Text style={styles.marketingBtnText}>Promos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder="Buscar por nombre o teléfono..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={clientesFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.clienteCard} 
              activeOpacity={0.7}
              onPress={() => abrirPerfil(item)}
            >
              <View style={styles.clienteInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.nombre.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.clienteNombre}>{item.nombre}</Text>
                  <Text style={styles.clienteTel}>{item.telefono}</Text>
                  {item.notas ? <Text style={styles.clienteNotas} numberOfLines={1}>{item.notas}</Text> : null}
                </View>
              </View>
              
              <View style={styles.statsRow}>
                <View>
                  <Text style={styles.statLabel}>Total Gastado</Text>
                  <Text style={styles.statValue}>${item.total_gastado?.toFixed(2) || '0.00'}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.waBtn} 
                  onPress={(e) => { e.stopPropagation(); abrirWhatsApp(item.telefono); }}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                  <Text style={styles.waBtnText}>Mensaje</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={50} color="#cbd5e1" />
              <Text style={styles.emptyText}>No hay clientes registrados aún.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* MODAL NUEVO CLIENTE */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Cliente</Text>
            <TextInput style={styles.input} placeholder="Nombre Completo" placeholderTextColor="#a0aec0" value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.input} placeholder="WhatsApp (10 dígitos)"placeholderTextColor="#a0aec0" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
            <TextInput 
              style={[styles.input, { height: 80 }]} 
              placeholder="Notas o Preferencias" 
              placeholderTextColor="#a0aec0"
              multiline value={notas} 
              onChangeText={setNotas} 
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, {backgroundColor: '#f1f5f9'}]} onPress={() => setModalVisible(false)}>
                <Text style={{color: '#64748b', fontWeight: 'bold'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, {backgroundColor: LOGO_BLUE}]} onPress={guardarCliente} disabled={guardando}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>{guardando ? 'Guardando...' : 'Registrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PERFIL VIP */}
      <Modal visible={modalPerfilVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%', padding: 0, overflow: 'hidden' }]}>
            
            <View style={styles.perfilHeader}>
              <TouchableOpacity onPress={() => setModalPerfilVisible(false)} style={styles.closePerfilBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.perfilAvatarLarge}>
                <Text style={styles.perfilAvatarLargeText}>{clienteActivo?.nombre?.substring(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={styles.perfilNombreLargo}>{clienteActivo?.nombre}</Text>
              <Text style={styles.perfilTelefonoLargo}>{clienteActivo?.telefono}</Text>

              <View style={styles.perfilCajasHeader}>
                <View style={styles.cajaDato}>
                  <Text style={styles.cajaDatoValor}>${clienteActivo?.total_gastado?.toFixed(2) || '0.00'}</Text>
                  <Text style={styles.cajaDatoEtiqueta}>Inversión Total</Text>
                </View>
                <View style={styles.lineaVertical} />
                <View style={styles.cajaDato}>
                  <Text style={styles.cajaDatoValor}>{historialEquipos.length}</Text>
                  <Text style={styles.cajaDatoEtiqueta}>Equipos en Taller</Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.perfilBody} showsVerticalScrollIndicator={false}>
              {clienteActivo?.notas ? (
                <View style={styles.notaGris}>
                  <Ionicons name="information-circle" size={20} color={LOGO_BLUE} />
                  <Text style={styles.notaTexto}>{clienteActivo.notas}</Text>
                </View>
              ) : null}

              <Text style={styles.historialTitulo}>Historial de Reparaciones</Text>

              {cargandoHistorial ? (
                <ActivityIndicator size="small" color={LOGO_BLUE} style={{ marginTop: 20 }} />
              ) : historialEquipos.length > 0 ? (
                historialEquipos.map((equipo) => (
                  <View key={equipo.id} style={styles.historialItem}>
                    <View style={styles.historialTop}>
                      <Text style={styles.historialEquipoTexto}>{equipo.equipo}</Text>
                      <View style={[styles.badge, { backgroundColor: getColorEstado(equipo.estado) }]}>
                        <Text style={styles.badgeText}>{equipo.estado}</Text>
                      </View>
                    </View>
                    <Text style={styles.historialProblemaTexto}>{equipo.problema}</Text>
                    <View style={styles.historialBottom}>
                      <Text style={styles.historialFechaTexto}><Ionicons name="calendar-outline" size={12}/> {formatearFecha(equipo.created_at)}</Text>
                      <Text style={styles.historialCostoTexto}>${equipo.costo_estimado}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistorial}>
                  <Ionicons name="construct-outline" size={40} color="#cbd5e1" />
                  <Text style={styles.emptyHistorialText}>Este cliente no ha dejado equipos en taller.</Text>
                </View>
              )}
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- NUEVO: MODAL DE CAMPAÑA DE MARKETING --- */}
      <Modal visible={modalCampanaVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%', padding: 0, overflow: 'hidden' }]}>
            
            <View style={styles.campanaHeader}>
              <Text style={styles.campanaTitulo}><Ionicons name="megaphone" size={20}/> Marketing por Equipo</Text>
              <TouchableOpacity onPress={() => setModalCampanaVisible(false)}>
                <Ionicons name="close" size={28} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <Text style={styles.campanaInstruccion}>1. ¿A quiénes quieres enviarles promoción?</Text>
              <View style={{ flexDirection: 'row', marginBottom: 15 }}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                  placeholder="Ej. PS5, Switch, Control..." 
                  placeholderTextColor="#a0aec0"
                  value={equipoCampana} 
                  onChangeText={setEquipoCampana} 
                />
                <TouchableOpacity style={styles.btnBuscarCampana} onPress={buscarParaCampana}>
                  <Ionicons name="search" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.campanaInstruccion}>2. Redacta tu mensaje</Text>
              <TextInput 
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                placeholder="Escribe tu mensaje publicitario..." 
                multiline 
                value={mensajeCampana} 
                onChangeText={setMensajeCampana} 
              />
            </View>

            <View style={styles.campanaResultadosHeader}>
              <Text style={{ fontWeight: 'bold', color: '#64748b' }}>Clientes Encontrados: {clientesCampana.length}</Text>
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
              {buscandoCampana ? (
                <ActivityIndicator color={LOGO_BLUE} style={{ marginTop: 20 }} />
              ) : clientesCampana.length > 0 ? (
                clientesCampana.map((cli, index) => (
                  <View key={index} style={styles.campanaItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.campanaNombre}>{cli.cliente}</Text>
                      <Text style={styles.campanaEquipo}>Equipo en historial: {cli.equipo}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.btnEnviarPromo}
                      onPress={() => abrirWhatsApp(cli.telefono, mensajeCampana)}
                    >
                      <Ionicons name="send" size={14} color="#fff" style={{ marginRight: 5 }} />
                      <Text style={styles.btnEnviarPromoText}>Enviar</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistorial}>
                  <Ionicons name="chatbubbles-outline" size={40} color="#cbd5e1" />
                  <Text style={styles.emptyHistorialText}>Busca un equipo para ver la lista de envío.</Text>
                </View>
              )}
            </ScrollView>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15, backgroundColor: '#fff' 
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginLeft: 10 },
  backBtn: { padding: 5 },
  marketingBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e67e22', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  marketingBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    margin: 15, paddingHorizontal: 15, borderRadius: 15, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  list: { padding: 15, paddingBottom: 100 },
  clienteCard: { 
    backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 15, 
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 
  },
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
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center', marginHorizontal: 5 },

  // Estilos Modal Perfil
  perfilHeader: { backgroundColor: LOGO_BLUE, paddingTop: 40, paddingBottom: 25, alignItems: 'center', position: 'relative' },
  closePerfilBtn: { position: 'absolute', top: 15, right: 15, padding: 5 },
  perfilAvatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
  perfilAvatarLargeText: { fontSize: 30, fontWeight: '900', color: LOGO_BLUE },
  perfilNombreLargo: { fontSize: 22, fontWeight: '900', color: '#fff' },
  perfilTelefonoLargo: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  perfilCajasHeader: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 15, marginTop: 20, width: '85%', justifyContent: 'space-evenly' },
  cajaDato: { alignItems: 'center' },
  cajaDatoValor: { fontSize: 18, fontWeight: '900', color: '#fff' },
  cajaDatoEtiqueta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginTop: 4 },
  lineaVertical: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: '100%' },
  perfilBody: { padding: 25, backgroundColor: '#f6f7fb', flex: 1 },
  notaGris: { flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 25 },
  notaTexto: { color: '#334155', marginLeft: 10, flex: 1, fontStyle: 'italic' },
  historialTitulo: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 15 },
  historialItem: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  historialTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historialEquipoTexto: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  historialProblemaTexto: { fontSize: 13, color: '#64748b', marginTop: 5, marginBottom: 10 },
  historialBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  historialFechaTexto: { fontSize: 12, color: '#94a3b8' },
  historialCostoTexto: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  emptyHistorial: { alignItems: 'center', marginTop: 30, padding: 20 },
  emptyHistorialText: { color: '#94a3b8', marginTop: 10, fontSize: 14, textAlign: 'center' },

  // --- ESTILOS CAMPAÑA MARKETING ---
  campanaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  campanaTitulo: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  campanaInstruccion: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
  btnBuscarCampana: { backgroundColor: LOGO_BLUE, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12, marginLeft: -10 },
  campanaResultadosHeader: { backgroundColor: '#f1f5f9', padding: 10, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  campanaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  campanaNombre: { fontWeight: 'bold', color: '#334155', fontSize: 15 },
  campanaEquipo: { color: '#64748b', fontSize: 12, marginTop: 2 },
  btnEnviarPromo: { flexDirection: 'row', backgroundColor: '#25D366', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  btnEnviarPromoText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});