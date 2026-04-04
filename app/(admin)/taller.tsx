import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Platform, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

// IMPORTAMOS NUESTROS MODALES EXTERNOS
import { ModalAgregarEquipo, ModalCambiarEstado, ModalDetalles } from '../../components/ModalesTaller';

const LOGO_BLUE = '#0056FF';

export default function TallerScreen() {
  const router = useRouter();
  const { usuario } = useAuth();
  
  const [reparaciones, setReparaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [modalDetallesVisible, setModalDetallesVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reparacionActiva, setReparacionActiva] = useState<any>(null);

  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [equipo, setEquipo] = useState('');
  const [problema, setProblema] = useState('');
  const [costo, setCosto] = useState('');
  const [sucursal, setSucursal] = useState('Centro');

  const [directorioClientes, setDirectorioClientes] = useState<any[]>([]);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  useEffect(() => {
    cargarReparaciones();
    cargarDirectorio(); 
  }, []);

  const cargarDirectorio = async () => {
    try {
      const { data, error } = await supabase.from('clientes').select('*');
      if (!error && data) setDirectorioClientes(data);
    } catch (err) { console.log(err); }
  };

  const cargarReparaciones = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase.from('reparaciones').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const datosOrdenados = (data || []).sort((a, b) => {
        if (a.estado === 'ENTREGADO' && b.estado !== 'ENTREGADO') return 1;
        if (a.estado !== 'ENTREGADO' && b.estado === 'ENTREGADO') return -1;
        return 0;
      });
      setReparaciones(datosOrdenados);
    } catch (error) {
      console.log(error);
    } finally {
      setCargando(false);
    }
  };

  const handleCambioCliente = (texto: string) => {
    setCliente(texto);
    if (texto.length > 1) {
      const coincidencias = directorioClientes.filter(c => c.nombre.toLowerCase().includes(texto.toLowerCase()));
      setSugerencias(coincidencias);
      setMostrarSugerencias(true);
    } else {
      setMostrarSugerencias(false);
    }
  };

  const seleccionarCliente = (cli: any) => {
    setCliente(cli.nombre); setTelefono(cli.telefono); setMostrarSugerencias(false); Keyboard.dismiss();
  };

  const guardarReparacion = async () => {
    if (!cliente || !equipo || !problema) { Alert.alert('Faltan datos', 'Cliente, Equipo y Problema obligatorios.'); return; }
    setGuardando(true);
    try {
      const clienteExiste = directorioClientes.find(c => c.nombre.toLowerCase() === cliente.toLowerCase());
      if (!clienteExiste) {
        await supabase.from('clientes').insert([{ nombre: cliente, telefono: telefono, sucursal_registro: sucursal, registrado_por: usuario?.nombre }]);
        cargarDirectorio();
      }

      const { error } = await supabase.from('reparaciones').insert([{ cliente, telefono, equipo, problema, costo_estimado: parseFloat(costo) || 0, registrado_por: usuario?.nombre, sucursal }]);
      if (error) throw error;

      try {
        const { data: admins } = await supabase.from('usuarios').select('push_token').ilike('rol', '%admin%');
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            if (admin.push_token && admin.push_token.includes('ExponentPushToken')) {
              
              // ==========================================
              // AQUÍ INTEGRAMOS EL PROJECT ID PARA EL APK
              // ==========================================
              fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST', 
                headers: { 
                  Accept: 'application/json', 
                  'Accept-encoding': 'gzip, deflate', 
                  'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                  to: admin.push_token, 
                  sound: 'default', 
                  title: '¡Nuevo Equipo! 🛠️', 
                  body: `Se registró un ${equipo} para ${cliente}.`, 
                  data: { ruta: 'taller' },
                  // ¡Este es el código vital para que suene en Android!
                  projectId: "ed581b99-a5b9-4cac-a75c-470f565313fe" 
                }),
              }).catch(() => {});
            }
          }
        }
      } catch (pushError) {}
      
      setModalVisible(false); setCliente(''); setTelefono(''); setEquipo(''); setProblema(''); setCosto(''); setSucursal('Centro'); setMostrarSugerencias(false);
      cargarReparaciones();

      if (Platform.OS === 'web') window.alert('¡Éxito! Equipo agregado al taller.');
      else Alert.alert('Éxito', 'Equipo agregado al taller correctamente.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la reparación.');
    } finally { setGuardando(false); }
  };

  const abrirModalEstado = (item: any) => { setReparacionActiva(item); setModalEstadoVisible(true); };
  const abrirModalDetalles = (item: any) => { setReparacionActiva(item); setModalDetallesVisible(true); };

  const actualizarEstadoBD = async (nuevoEstado: string) => {
    if (!reparacionActiva) return;
    try {
      await supabase.from('reparaciones').update({ estado: nuevoEstado }).eq('id', reparacionActiva.id);
      setModalEstadoVisible(false); cargarReparaciones();
    } catch (error) { Alert.alert('Error al actualizar'); }
  };

  const avisarWhatsApp = (tel: string, nombre: string, equipo: string, costo: number) => {
    if (!tel) { Alert.alert("Sin número", "No registraste teléfono."); return; }
    Linking.openURL(`https://wa.me/52${tel}?text=${encodeURIComponent(`Hola ${nombre}, te avisamos de *punto de venta* 🎮 que tu ${equipo} ya está listo y reparado. El total a pagar es de $${costo}. ¡Te esperamos en la sucursal!`)}`);
  };

  const entregarYCobrar = (item: any) => {
    const irAlPuntoDeVenta = () => router.push(`/(admin)/ventas?taller_id=${item.id}&taller_nombre=Reparación:%20${encodeURIComponent(item.equipo)}%20(${encodeURIComponent(item.cliente)})&taller_precio=${item.costo_estimado}`);
    if (Platform.OS === 'web') { if (window.confirm(`¿Enviar la reparación de ${item.equipo} a cobrar?`)) irAlPuntoDeVenta(); }
    else { Alert.alert("Cobrar", `¿Enviar ${item.equipo} al carrito?`, [{ text: "Cancelar", style: "cancel" }, { text: "Sí, cobrar", onPress: irAlPuntoDeVenta }]); }
  };

  const confirmarEliminacion = (id: string, equipo: string) => {
    if (Platform.OS === 'web') { if (window.confirm(`¿Eliminar ${equipo}?`)) ejecutarEliminacion(id); }
    else { Alert.alert("Eliminar", `¿Borrar ${equipo}?`, [{ text: "Cancelar", style: "cancel" }, { text: "Borrar", style: "destructive", onPress: () => ejecutarEliminacion(id) }]); }
  };

  const ejecutarEliminacion = async (id: string) => {
    try { await supabase.from('reparaciones').delete().eq('id', id); setModalDetallesVisible(false); cargarReparaciones(); } 
    catch (error) { Alert.alert("Error", "No se pudo borrar."); }
  };

  const getColorEstado = (estado: string) => {
    if (estado === 'RECIBIDO') return '#e74c3c'; if (estado === 'EN REVISIÓN') return '#f39c12';
    if (estado === 'LISTO') return '#2ecc71'; if (estado === 'ENTREGADO') return '#94a3b8';
    return '#95a5a6';
  };

  const reparacionesFiltradas = reparaciones.filter(item => {
    if (filtroEstado !== 'TODOS' && item.estado === 'ENTREGADO') return false;
    if (filtroEstado !== 'TODOS' && item.estado !== filtroEstado) return false;
    if (busqueda) return item.cliente?.toLowerCase().includes(busqueda.toLowerCase()) || item.equipo?.toLowerCase().includes(busqueda.toLowerCase());
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.headerSimple}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#333" /><Text style={styles.backText}>Atrás</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>CONTROL DE TALLER</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Buscar cliente o equipo..." value={busqueda} onChangeText={setBusqueda} />
        {busqueda.length > 0 && (<TouchableOpacity onPress={() => setBusqueda('')}><Ionicons name="close-circle" size={20} color="#94a3b8" /></TouchableOpacity>)}
      </View>

      <View style={styles.filtrosContainer}>
        {['TODOS', 'RECIBIDO', 'EN REVISIÓN', 'LISTO'].map((estado, idx) => (
          <TouchableOpacity key={idx} style={[styles.filtroBtn, filtroEstado === estado && styles.filtroBtnActivo]} onPress={() => setFiltroEstado(estado)}>
            <Text style={[styles.filtroText, filtroEstado === estado && styles.filtroTextActivo]}>{estado === 'TODOS' ? 'Todos' : estado === 'RECIBIDO' ? 'Recibidos' : estado === 'EN REVISIÓN' ? 'En Revisión' : 'Listos'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? ( <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 20 }} /> ) : (
        <FlatList
          data={reparacionesFiltradas} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="search-outline" size={40} color="#cbd5e1" /><Text style={{color: '#94a3b8', marginTop: 10}}>{busqueda || filtroEstado !== 'TODOS' ? 'No se encontraron resultados.' : 'No hay equipos en taller.'}</Text></View>}
          renderItem={({ item }) => {
            const esEntregado = item.estado === 'ENTREGADO';
            return (
              <TouchableOpacity activeOpacity={0.7} onPress={() => abrirModalDetalles(item)} style={[styles.card, { borderLeftColor: getColorEstado(item.estado) }, esEntregado && styles.cardEntregado]}>
                <View style={styles.cardHeader}><Text style={[styles.equipo, esEntregado && {color: '#94a3b8'}]}>{item.equipo}</Text><View style={[styles.badge, { backgroundColor: getColorEstado(item.estado) }]}><Text style={styles.badgeText}>{item.estado}</Text></View></View>
                <Text style={styles.cliente}><Ionicons name="person" size={12}/> {item.cliente} {item.telefono && `(${item.telefono})`}</Text>
                <Text style={styles.problema}>Falla: {item.problema}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}><Ionicons name="location-outline" size={12} color="#94a3b8" /><Text style={{ fontSize: 11, color: '#94a3b8', marginLeft: 3 }}>Sucursal: <Text style={{fontWeight: 'bold'}}>{item.sucursal || 'Centro'}</Text></Text></View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.precio, esEntregado && {color: '#94a3b8'}]}>Costo Est: ${item.costo_estimado}</Text>
                  {!esEntregado && (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity style={styles.btnUpdate} onPress={() => abrirModalEstado(item)}><Ionicons name="sync" size={16} color={LOGO_BLUE} /><Text style={styles.btnUpdateText}>Estado</Text></TouchableOpacity>
                      {item.estado === 'LISTO' && (
                        <><TouchableOpacity style={[styles.btnWa, { marginRight: 5 }]} onPress={() => avisarWhatsApp(item.telefono, item.cliente, item.equipo, item.costo_estimado)}><Ionicons name="logo-whatsapp" size={18} color="#fff" /></TouchableOpacity>
                          <TouchableOpacity style={styles.btnEntregar} onPress={() => entregarYCobrar(item)}><Ionicons name="cart" size={16} color="#fff" /><Text style={styles.btnEntregarText}>Cobrar</Text></TouchableOpacity></>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}><Ionicons name="add" size={30} color="#fff" /></TouchableOpacity>

      {/* INYECTAMOS NUESTROS MODALES EXTERNOS */}
      <ModalAgregarEquipo visible={modalVisible} setVisible={setModalVisible} cliente={cliente} handleCambioCliente={handleCambioCliente} telefono={telefono} setTelefono={setTelefono} equipo={equipo} setEquipo={setEquipo} problema={problema} setProblema={setProblema} costo={costo} setCosto={setCosto} sucursal={sucursal} setSucursal={setSucursal} guardarReparacion={guardarReparacion} guardando={guardando} mostrarSugerencias={mostrarSugerencias} sugerencias={sugerencias} seleccionarCliente={seleccionarCliente} setMostrarSugerencias={setMostrarSugerencias} />
      <ModalCambiarEstado visible={modalEstadoVisible} setVisible={setModalEstadoVisible} reparacionActiva={reparacionActiva} actualizarEstadoBD={actualizarEstadoBD} />
      <ModalDetalles visible={modalDetallesVisible} setVisible={setModalDetallesVisible} reparacionActiva={reparacionActiva} confirmarEliminacion={confirmarEliminacion} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  headerSimple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, color: '#333', fontWeight: '600', marginLeft: 5 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, marginBottom: 10, paddingHorizontal: 15, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, borderWidth: 1, borderColor: '#f1f5f9' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b' },
  filtrosContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 5 },
  filtroBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  filtroBtnActivo: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  filtroText: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  filtroTextActivo: { color: '#fff' },
  list: { padding: 15, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 50 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderLeftWidth: 5, elevation: 2 },
  cardEntregado: { backgroundColor: '#f8fafc', opacity: 0.8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  equipo: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cliente: { fontSize: 14, color: '#64748b', marginTop: 5 },
  problema: { fontSize: 13, color: '#333', marginTop: 5, fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  precio: { fontWeight: 'bold', color: '#1e293b' },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center' },
  btnUpdate: { flexDirection: 'row', backgroundColor: '#f0f5ff', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginRight: 5, borderWidth: 1, borderColor: '#dbeafe' },
  btnUpdateText: { color: LOGO_BLUE, fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  btnWa: { flexDirection: 'row', backgroundColor: '#25D366', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnEntregar: { flexDirection: 'row', backgroundColor: '#e67e22', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnEntregarText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: LOGO_BLUE, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});