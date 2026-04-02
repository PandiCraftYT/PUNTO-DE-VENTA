import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Linking, Platform, Image, Keyboard 
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
  
  // Estado para la barra de búsqueda y filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Modales
  const [modalVisible, setModalVisible] = useState(false);
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [modalDetallesVisible, setModalDetallesVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reparacionActiva, setReparacionActiva] = useState<any>(null);

  // Formulario de ingreso
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [equipo, setEquipo] = useState('');
  const [problema, setProblema] = useState('');
  const [costo, setCosto] = useState('');
  const [sucursal, setSucursal] = useState('Centro');

  // --- NUEVOS ESTADOS PARA EL AUTOCOMPLETADO ---
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
      if (!error && data) {
        setDirectorioClientes(data);
      }
    } catch (err) {
      console.log("Error al cargar clientes:", err);
    }
  };

  const cargarReparaciones = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('reparaciones')
        .select('*')
        .order('created_at', { ascending: false });

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
      const coincidencias = directorioClientes.filter(c => 
        c.nombre.toLowerCase().includes(texto.toLowerCase())
      );
      setSugerencias(coincidencias);
      setMostrarSugerencias(true);
    } else {
      setMostrarSugerencias(false);
    }
  };

  const seleccionarCliente = (cli: any) => {
    setCliente(cli.nombre);
    setTelefono(cli.telefono);
    setMostrarSugerencias(false);
    Keyboard.dismiss();
  };

  const guardarReparacion = async () => {
    if (!cliente || !equipo || !problema) {
      Alert.alert('Faltan datos', 'Cliente, Equipo y Problema son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const clienteExiste = directorioClientes.find(c => c.nombre.toLowerCase() === cliente.toLowerCase());
      
      if (!clienteExiste) {
        await supabase.from('clientes').insert([{
          nombre: cliente,
          telefono: telefono,
          sucursal_registro: sucursal,
          registrado_por: usuario?.nombre
        }]);
        cargarDirectorio();
      }

      const { error } = await supabase.from('reparaciones').insert([{
        cliente, telefono, equipo, problema, costo_estimado: parseFloat(costo) || 0, registrado_por: usuario?.nombre,
        sucursal: sucursal
      }]);
      if (error) throw error;

      // =========================================================================
      // LÓGICA DE NOTIFICACIONES PUSH (Avisar al Admin que llegó un equipo)
      // =========================================================================
      try {
        // 1. Buscar a los administradores que tengan un token de notificaciones
        const { data: admins } = await supabase
          .from('usuarios')
          .select('push_token')
          .eq('rol', 'admin') 
          .not('push_token', 'is', null);

        if (admins && admins.length > 0) {
          // 2. Mandarle un mensaje Push a cada administrador encontrado
          for (const admin of admins) {
            if(admin.push_token) {
              await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Accept-encoding': 'gzip, deflate',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: admin.push_token,
                  sound: 'default',
                  title: '¡Nuevo Equipo en Taller! 🛠️',
                  body: `${cliente} ha dejado un ${equipo}. Falla: ${problema}`,
                  data: { ruta: 'taller' },
                }),
              });
            }
          }
        }
      } catch (pushError) {
        console.log("No se pudo enviar la notificación Push", pushError);
      }
      // =========================================================================
      
      setModalVisible(false);
      setCliente(''); setTelefono(''); setEquipo(''); setProblema(''); setCosto(''); setSucursal('Centro');
      setMostrarSugerencias(false);
      cargarReparaciones();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la reparación.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalEstado = (item: any) => {
    setReparacionActiva(item);
    setModalEstadoVisible(true);
  };

  const abrirModalDetalles = (item: any) => {
    setReparacionActiva(item);
    setModalDetallesVisible(true);
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
    const mensaje = `Hola ${nombre}, te avisamos de *punto de venta* 🎮 que tu ${equipo} ya está listo y reparado. El total a pagar es de $${costo}. ¡Te esperamos en la sucursal!`;
    Linking.openURL(`https://wa.me/52${tel}?text=${encodeURIComponent(mensaje)}`);
  };

  const entregarYCobrar = (item: any) => {
    const irAlPuntoDeVenta = () => {
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
    if (estado === 'RECIBIDO') return '#e74c3c';
    if (estado === 'EN REVISIÓN') return '#f39c12';
    if (estado === 'LISTO') return '#2ecc71';
    if (estado === 'ENTREGADO') return '#94a3b8';
    return '#95a5a6';
  };

  const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'Fecha desconocida';
    const opciones: Intl.DateTimeFormatOptions = { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    };
    return new Date(fechaString).toLocaleDateString('es-MX', opciones);
  };

  const reparacionesFiltradas = reparaciones.filter(item => {
    if (filtroEstado !== 'TODOS' && item.estado === 'ENTREGADO') return false;
    if (filtroEstado !== 'TODOS' && item.estado !== filtroEstado) return false;
    if (busqueda) {
      const matchCliente = item.cliente?.toLowerCase().includes(busqueda.toLowerCase());
      const matchEquipo = item.equipo?.toLowerCase().includes(busqueda.toLowerCase());
      return matchCliente || matchEquipo;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.headerSimple}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CONTROL DE TALLER</Text>
        <View style={{ width: 60 }} />
      </View>

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

      <View style={styles.filtrosContainer}>
        <TouchableOpacity style={[styles.filtroBtn, filtroEstado === 'TODOS' && styles.filtroBtnActivo]} onPress={() => setFiltroEstado('TODOS')}>
          <Text style={[styles.filtroText, filtroEstado === 'TODOS' && styles.filtroTextActivo]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filtroBtn, filtroEstado === 'RECIBIDO' && styles.filtroBtnActivo]} onPress={() => setFiltroEstado('RECIBIDO')}>
          <Text style={[styles.filtroText, filtroEstado === 'RECIBIDO' && styles.filtroTextActivo]}>Recibidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filtroBtn, filtroEstado === 'EN REVISIÓN' && styles.filtroBtnActivo]} onPress={() => setFiltroEstado('EN REVISIÓN')}>
          <Text style={[styles.filtroText, filtroEstado === 'EN REVISIÓN' && styles.filtroTextActivo]}>En Revisión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filtroBtn, filtroEstado === 'LISTO' && styles.filtroBtnActivo]} onPress={() => setFiltroEstado('LISTO')}>
          <Text style={[styles.filtroText, filtroEstado === 'LISTO' && styles.filtroTextActivo]}>Listos</Text>
        </TouchableOpacity>
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
                {busqueda || filtroEstado !== 'TODOS' ? 'No se encontraron resultados.' : 'No hay equipos en taller actualmente.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const esEntregado = item.estado === 'ENTREGADO';

            return (
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => abrirModalDetalles(item)}
                style={[styles.card, { borderLeftColor: getColorEstado(item.estado) }, esEntregado && styles.cardEntregado]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.equipo, esEntregado && {color: '#94a3b8'}]}>{item.equipo}</Text>
                  <View style={[styles.badge, { backgroundColor: getColorEstado(item.estado) }]}>
                    <Text style={styles.badgeText}>{item.estado}</Text>
                  </View>
                </View>
                <Text style={styles.cliente}><Ionicons name="person" size={12}/> {item.cliente} {item.telefono && `(${item.telefono})`}</Text>
                
                <Text style={styles.problema}>Falla: {item.problema}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                    <Ionicons name="location-outline" size={12} color="#94a3b8" />
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginLeft: 3 }}>
                      Sucursal: <Text style={{fontWeight: 'bold'}}>{item.sucursal || 'Centro'}</Text>
                    </Text>
                </View>
                
                <View style={styles.cardFooter}>
                  <Text style={[styles.precio, esEntregado && {color: '#94a3b8'}]}>Costo Est: ${item.costo_estimado}</Text>
                  
                  {!esEntregado && (
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

                          <TouchableOpacity style={styles.btnEntregar} onPress={() => entregarYCobrar(item)}>
                            <Ionicons name="cart" size={16} color="#fff" />
                            <Text style={styles.btnEntregarText}>Cobrar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
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
            
            <View style={{ zIndex: 10 }}>
              <TextInput 
                style={styles.input} 
                placeholder="Nombre del Cliente" 
                placeholderTextColor="#a0aec0"
                value={cliente} 
                onChangeText={handleCambioCliente} 
              />
              
              {/* --- AUTOCOMPLETADO VISUAL --- */}
              {mostrarSugerencias && sugerencias.length > 0 && (
                <View style={styles.sugerenciasContainer}>
                  {sugerencias.map((sug) => (
                    <TouchableOpacity 
                      key={sug.id} 
                      style={styles.sugerenciaItem}
                      onPress={() => seleccionarCliente(sug)}
                    >
                      <Ionicons name="person" size={14} color="#94a3b8" style={{ marginRight: 8 }} />
                      <View>
                        <Text style={{ fontWeight: 'bold', color: '#334155' }}>{sug.nombre}</Text>
                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>{sug.telefono}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TextInput style={styles.input} placeholder="Teléfono (WhatsApp)" placeholderTextColor="#a0aec0" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
            <TextInput style={styles.input} placeholder="Equipo (Ej. PS5, Switch)" placeholderTextColor="#a0aec0" value={equipo} onChangeText={setEquipo} />
            <TextInput style={styles.input} placeholder="Falla o Problema" placeholderTextColor="#a0aec0" value={problema} onChangeText={setProblema} />
            <TextInput style={styles.input} placeholder="Costo Estimado ($)" placeholderTextColor="#a0aec0" keyboardType="numeric" value={costo} onChangeText={setCosto} />
            
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 5, marginBottom: 5, marginLeft: 5, fontWeight: 'bold' }}>UBICACIÓN DE RECEPCIÓN</Text>
            <View style={{ flexDirection: 'row', marginBottom: 15 }}>
              <TouchableOpacity style={[styles.btnSucursal, sucursal === 'Centro' && styles.btnSucursalActivo]} onPress={() => setSucursal('Centro')}>
                <Text style={[styles.textSucursal, sucursal === 'Centro' && { color: '#fff' }]}>Centro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSucursal, sucursal === 'Huizaches' && styles.btnSucursalActivo]} onPress={() => setSucursal('Huizaches')}>
                <Text style={[styles.textSucursal, sucursal === 'Huizaches' && { color: '#fff' }]}>Huizaches</Text>
              </TouchableOpacity>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
              <TouchableOpacity style={[styles.btn, {backgroundColor: '#ccc'}]} onPress={() => {setModalVisible(false); setMostrarSugerencias(false);}}>
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

            <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#94a3b8'}]} onPress={() => actualizarEstadoBD('ENTREGADO')}>
              <Text style={styles.btnEstadoText}>Marcar como Entregado</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{marginTop: 15, padding: 10, alignItems: 'center'}} onPress={() => setModalEstadoVisible(false)}>
              <Text style={{color: '#94a3b8', fontWeight: 'bold'}}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE DETALLES DEL EQUIPO */}
      <Modal visible={modalDetallesVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.modalTitle}>Detalles de Solicitud</Text>
              <TouchableOpacity onPress={() => setModalDetallesVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {reparacionActiva && (
              <View>
                <View style={styles.detalleFila}>
                  <Ionicons name="hardware-chip" size={18} color="#64748b" style={styles.detalleIcono} />
                  <View>
                    <Text style={styles.detalleLabel}>Equipo</Text>
                    <Text style={styles.detalleTexto}>{reparacionActiva.equipo}</Text>
                  </View>
                </View>

                <View style={styles.detalleFila}>
                  <Ionicons name="person" size={18} color="#64748b" style={styles.detalleIcono} />
                  <View>
                    <Text style={styles.detalleLabel}>Cliente</Text>
                    <Text style={styles.detalleTexto}>{reparacionActiva.cliente} ({reparacionActiva.telefono || 'Sin número'})</Text>
                  </View>
                </View>

                <View style={styles.detalleFila}>
                  <Ionicons name="alert-circle" size={18} color="#64748b" style={styles.detalleIcono} />
                  <View>
                    <Text style={styles.detalleLabel}>Problema Reportado</Text>
                    <Text style={styles.detalleTexto}>{reparacionActiva.problema}</Text>
                  </View>
                </View>

                <View style={styles.detalleDivider} />

                <View style={styles.detalleFila}>
                  <Ionicons name="time" size={18} color={LOGO_BLUE} style={styles.detalleIcono} />
                  <View>
                    <Text style={styles.detalleLabel}>Fecha y Hora de Ingreso</Text>
                    <Text style={styles.detalleTextoHighlight}>{formatearFecha(reparacionActiva.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.detalleFila}>
                  <Ionicons name="id-card" size={18} color={LOGO_BLUE} style={styles.detalleIcono} />
                  <View>
                    <Text style={styles.detalleLabel}>Registrado y Atendido por</Text>
                    <Text style={styles.detalleTextoHighlight}>{reparacionActiva.registrado_por || 'Administrador'}</Text>
                  </View>
                </View>

                <View style={[styles.detalleFila, { alignItems: 'flex-start' }]}>
                  <Ionicons name="location" size={18} color={LOGO_BLUE} style={[styles.detalleIcono, { marginTop: 2 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detalleLabel}>Ubicación de Solicitud</Text>
                    <Text style={styles.detalleTextoHighlight}>{reparacionActiva.sucursal || 'Centro'}</Text>
                    
                    <TouchableOpacity 
                      style={styles.mapContainer}
                      activeOpacity={0.8}
                      onPress={() => {
                        const url = reparacionActiva.sucursal === 'Huizaches' 
                          ? 'https://www.google.com/maps/search/?api=1&query=Culiacan+Sinaloa' 
                          : 'https://maps.app.goo.gl/TU_ENLACE_DE_GOOGLE_MAPS';
                        Linking.openURL(url);
                      }}
                    >
                      <Image 
                        source={{ uri: 'https://media.wired.com/photos/59269cd37034dc5f91bec0f1/master/pass/GoogleMapTA.jpg' }} 
                        style={styles.mapImage}
                      />
                      <View style={styles.mapOverlay}>
                        <View style={styles.mapButton}>
                          <Ionicons name="navigate-circle" size={20} color="#fff" />
                          <Text style={styles.mapButtonText}>Ver Ubicación</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

              </View>
            )}
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
    margin: 15, marginBottom: 10, paddingHorizontal: 15, borderRadius: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 15 },
  modalContentSmall: { backgroundColor: '#fff', padding: 25, borderRadius: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 10 },
  btn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
  btnEstado: { padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnEstadoText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // --- ESTILOS DE AUTOCOMPLETADO ---
  sugerenciasContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -10, // Para que se pegue al input de arriba
    marginBottom: 10,
    maxHeight: 120,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 100 // Para que flote sobre los otros campos
  },
  sugerenciaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },

  btnSucursal: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f1f5f9', marginHorizontal: 5, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  btnSucursalActivo: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  textSucursal: { fontWeight: 'bold', color: '#64748b' },

  detalleFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  detalleIcono: { marginRight: 15, width: 20, textAlign: 'center' },
  detalleLabel: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' },
  detalleTexto: { fontSize: 15, color: '#334155', marginTop: 2 },
  detalleTextoHighlight: { fontSize: 15, color: '#1e293b', marginTop: 2, fontWeight: '600' },
  detalleDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10, marginBottom: 20 },

  mapContainer: { marginTop: 15, height: 120, width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', position: 'relative', borderWidth: 1, borderColor: '#cbd5e1' },
  mapImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.2)', justifyContent: 'center', alignItems: 'center' },
  mapButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: LOGO_BLUE, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  mapButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 6 }
});