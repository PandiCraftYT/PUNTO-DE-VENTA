import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Linking, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

const LOGO_BLUE = '#0056FF';

export default function TallerScreen() {
  const router = useRouter();
  const { usuario } = useAuth();
  
  const [reparaciones, setReparaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado para la barra de búsqueda
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalVisible, setModalVisible] = useState(false);
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reparacionActiva, setReparacionActiva] = useState<any>(null);

  // Formulario de ingreso
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [equipo, setEquipo] = useState('');
  const [problema, setProblema] = useState('');
  const [costo, setCosto] = useState('');

  useEffect(() => {
    cargarReparaciones();
  }, []);

  const cargarReparaciones = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('reparaciones')
        .select('*')
        .neq('estado', 'ENTREGADO') // Se ocultan los entregados
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReparaciones(data || []);
    } catch (error) {
      console.log(error);
    } finally {
      setCargando(false);
    }
  };

  const guardarReparacion = async () => {
    if (!cliente || !equipo || !problema) {
      Alert.alert('Faltan datos', 'Cliente, Equipo y Problema son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.from('reparaciones').insert([{
        cliente, telefono, equipo, problema, costo_estimado: parseFloat(costo) || 0, registrado_por: usuario?.nombre
      }]);
      if (error) throw error;
      
      setModalVisible(false);
      setCliente(''); setTelefono(''); setEquipo(''); setProblema(''); setCosto('');
      cargarReparaciones();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalEstado = (item: any) => {
    setReparacionActiva(item);
    setModalEstadoVisible(true);
  };

  const actualizarEstadoBD = async (nuevoEstado: string) => {
    if (!reparacionActiva) return;
    try {
      await supabase.from('reparaciones').update({ estado: nuevoEstado }).eq('id', reparacionActiva.id);
      setModalEstadoVisible(false);
      cargarReparaciones();
    } catch (error) {
      Alert.alert('Error al actualizar el estado');
    }
  };

  const avisarWhatsApp = (tel: string, nombre: string, equipo: string, costo: number) => {
    if (!tel) { Alert.alert("Sin número", "No registraste teléfono para este cliente."); return; }
    const mensaje = `Hola ${nombre}, te avisamos de *GS GAMES SALE* 🎮 que tu ${equipo} ya está listo y reparado. El total a pagar es de $${costo}. ¡Te esperamos!`;
    Linking.openURL(`https://wa.me/52${tel}?text=${encodeURIComponent(mensaje)}`);
  };

  // --- FUNCIÓN QUE ENVÍA LOS DATOS AL PUNTO DE VENTA ---
  const entregarYCobrar = (item: any) => {
    const irAlPuntoDeVenta = () => {
      // LO ENVIAMOS COMO UNA URL TRADICIONAL
      router.push(`/(admin)/ventas?taller_id=${item.id}&taller_nombre=Reparación:%20${encodeURIComponent(item.equipo)}%20(${encodeURIComponent(item.cliente)})&taller_precio=${item.costo_estimado}`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Enviar la reparación de ${item.equipo} al Punto de Venta para cobrarla?`)) {
        irAlPuntoDeVenta();
      }
    } else {
      Alert.alert(
        "Mandar a Punto de Venta",
        `¿Deseas enviar la reparación de ${item.equipo} al carrito para cobrarla?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, ir a cobrar", onPress: irAlPuntoDeVenta }
        ]
      );
    }
  };

  const getColorEstado = (estado: string) => {
    if (estado === 'RECIBIDO') return '#e74c3c'; // Rojo
    if (estado === 'EN REVISIÓN') return '#f39c12'; // Naranja
    if (estado === 'LISTO') return '#2ecc71'; // Verde
    return '#95a5a6';
  };

  // Filtrar los datos en base a lo que se escriba en el buscador
  const reparacionesFiltradas = reparaciones.filter(item => 
    item.cliente?.toLowerCase().includes(busqueda.toLowerCase()) || 
    item.equipo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER SIMPLE DE RETROCESO */}
      <View style={styles.headerSimple}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CONTROL DE TALLER</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* BARRA DE BÚSQUEDA */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder="Buscar cliente o equipo..."
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
        <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={reparacionesFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={40} color="#cbd5e1" />
              <Text style={{color: '#94a3b8', marginTop: 10}}>
                {busqueda ? 'No se encontraron resultados.' : 'No hay equipos en taller actualmente.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderLeftColor: getColorEstado(item.estado) }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.equipo}>{item.equipo}</Text>
                <View style={[styles.badge, { backgroundColor: getColorEstado(item.estado) }]}>
                  <Text style={styles.badgeText}>{item.estado}</Text>
                </View>
              </View>
              <Text style={styles.cliente}><Ionicons name="person" size={12}/> {item.cliente} {item.telefono && `(${item.telefono})`}</Text>
              <Text style={styles.problema}>Falla: {item.problema}</Text>
              
              <View style={styles.cardFooter}>
                <Text style={styles.precio}>Costo Est: ${item.costo_estimado}</Text>
                
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity style={styles.btnUpdate} onPress={() => abrirModalEstado(item)}>
                    <Ionicons name="sync" size={16} color={LOGO_BLUE} />
                    <Text style={styles.btnUpdateText}>Cambiar Estado</Text>
                  </TouchableOpacity>

                  {item.estado === 'LISTO' && (
                    <>
                      <TouchableOpacity style={[styles.btnWa, { marginRight: 5 }]} onPress={() => avisarWhatsApp(item.telefono, item.cliente, item.equipo, item.costo_estimado)}>
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.btnEntregar} 
                        onPress={() => entregarYCobrar(item)}
                      >
                        <Ionicons name="cart" size={16} color="#fff" />
                        <Text style={styles.btnEntregarText}>Cobrar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* MODAL NUEVO EQUIPO */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Recibir Equipo</Text>
            <TextInput style={styles.input} placeholder="Nombre del Cliente" value={cliente} onChangeText={setCliente} />
            <TextInput style={styles.input} placeholder="Teléfono (WhatsApp)" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
            <TextInput style={styles.input} placeholder="Equipo (Ej. PS5, Switch)" value={equipo} onChangeText={setEquipo} />
            <TextInput style={styles.input} placeholder="Falla o Problema" value={problema} onChangeText={setProblema} />
            <TextInput style={styles.input} placeholder="Costo Estimado ($)" keyboardType="numeric" value={costo} onChangeText={setCosto} />
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
              <TouchableOpacity style={[styles.btn, {backgroundColor: '#ccc'}]} onPress={() => setModalVisible(false)}>
                <Text style={{fontWeight: 'bold'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, {backgroundColor: LOGO_BLUE}]} onPress={guardarReparacion} disabled={guardando}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>{guardando ? 'Guardando...' : 'Guardar Ingreso'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA CAMBIAR ESTADO */}
      <Modal visible={modalEstadoVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Actualizar Proceso</Text>
            <Text style={{textAlign: 'center', marginBottom: 15, color: '#64748b'}}>
              ¿En qué estado se encuentra el equipo {reparacionActiva?.equipo}?
            </Text>

            <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#e74c3c'}]} onPress={() => actualizarEstadoBD('RECIBIDO')}>
              <Text style={styles.btnEstadoText}>Recién Recibido</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#f39c12'}]} onPress={() => actualizarEstadoBD('EN REVISIÓN')}>
              <Text style={styles.btnEstadoText}>En Revisión / Reparando</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#2ecc71'}]} onPress={() => actualizarEstadoBD('LISTO')}>
              <Text style={styles.btnEstadoText}>Listo para Entregar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{marginTop: 15, padding: 10, alignItems: 'center'}} onPress={() => setModalEstadoVisible(false)}>
              <Text style={{color: '#94a3b8', fontWeight: 'bold'}}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  headerSimple: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15, 
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' 
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, color: '#333', fontWeight: '600', marginLeft: 5 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    margin: 15, marginBottom: 0, paddingHorizontal: 15, borderRadius: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b' },

  list: { padding: 15, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 50 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderLeftWidth: 5, elevation: 2 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 15 },
  modalContentSmall: { backgroundColor: '#fff', padding: 25, borderRadius: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 10 },
  btn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
  btnEstado: { padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnEstadoText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});