import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, ScrollView, Linking, Platform, 
  ActivityIndicator, StatusBar, TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

const LOGO_BLUE = '#0056FF';
const SUCCESS_GREEN = '#2ecc71';

export default function HistorialVentas() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  
  // Guardamos las ventas "crudas" (originales) para no hacer peticiones a cada rato
  const [ventasCrudas, setVentasCrudas] = useState<any[]>([]);
  const [ventasAgrupadas, setVentasAgrupadas] = useState<any[]>([]);
  const [datosGrafica, setDatosGrafica] = useState<any[]>([]);
  const [maxVentaGrafica, setMaxVentaGrafica] = useState(0);

  const [ventaSeleccionada, setVentaSeleccionada] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [diasExpandidos, setDiasExpandidos] = useState<string[]>([]);

  // NUEVOS ESTADOS: Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState('dias'); // 'dias', 'semanas', 'meses', 'anos'

  useEffect(() => {
    fetchVentas();
  }, []);

  // Cada vez que cambie la búsqueda, el filtro o los datos, recalculamos
  useEffect(() => {
    procesarVentas(ventasCrudas, busqueda, filtroTiempo);
  }, [ventasCrudas, busqueda, filtroTiempo]);

  const fetchVentas = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setVentasCrudas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // --- LÓGICA DE AGRUPACIÓN Y FILTRADO ---
  const procesarVentas = (datos: any[], textoBusqueda: string, filtro: string) => {
    // 1. Filtrar por búsqueda (vendedor o método de pago)
    let filtrados = datos;
    if (textoBusqueda) {
      const q = textoBusqueda.toLowerCase();
      filtrados = datos.filter(v => 
        v.vendedor_nombre?.toLowerCase().includes(q) || 
        v.metodo_pago?.toLowerCase().includes(q)
      );
    }

    // 2. Agrupar según el filtro de tiempo
    const grupos = filtrados.reduce((acc: any, venta: any) => {
      const fechaObj = new Date(venta.created_at);
      let claveGrupo = '';

      if (filtro === 'dias') {
        claveGrupo = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      } else if (filtro === 'semanas') {
        // Obtenemos el lunes de esa semana
        const dia = fechaObj.getDay();
        const diff = fechaObj.getDate() - dia + (dia === 0 ? -6 : 1);
        const lunes = new Date(fechaObj.setDate(diff));
        claveGrupo = `Semana ${lunes.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;
      } else if (filtro === 'meses') {
        claveGrupo = fechaObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      } else if (filtro === 'anos') {
        claveGrupo = fechaObj.getFullYear().toString();
      }
      
      if (!acc[claveGrupo]) acc[claveGrupo] = { ventas: [], totalDia: 0 };
      
      acc[claveGrupo].ventas.push(venta);
      acc[claveGrupo].totalDia += parseFloat(venta.total) || 0;
      return acc;
    }, {});

    const listaAgrupada = Object.keys(grupos).map(fecha => ({
      fecha,
      datos: grupos[fecha].ventas,
      totalDia: grupos[fecha].totalDia
    }));

    setVentasAgrupadas(listaAgrupada);

    // 3. Preparar datos para la gráfica (Tomamos los últimos 7 periodos y los invertimos para que el más nuevo salga a la derecha)
    const paraGrafica = listaAgrupada.slice(0, 7).reverse();
    setDatosGrafica(paraGrafica);

    // Encontrar el valor máximo para escalar la gráfica correctamente
    const max = Math.max(...paraGrafica.map(item => item.totalDia), 0);
    setMaxVentaGrafica(max > 0 ? max : 1); // Evitamos división por cero
  };

  const toggleDia = (fecha: string) => {
    setDiasExpandidos(prev => 
      prev.includes(fecha) ? prev.filter(f => f !== fecha) : [...prev, fecha]
    );
  };

  const abrirMapa = (lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}`
    }) || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    
    Linking.openURL(url);
  };

  const renderVentaItem = (venta: any) => (
    <TouchableOpacity 
      key={venta.id}
      style={styles.ventaRow} 
      onPress={() => {
        setVentaSeleccionada(venta);
        setModalVisible(true);
      }}
    >
      <View style={styles.ventaInfo}>
        <Text style={styles.ventaHora}>
          {new Date(venta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <View style={styles.metodoMiniBadge}>
          <Ionicons 
            name={venta.metodo_pago === 'EFECTIVO' ? 'cash' : venta.metodo_pago === 'TARJETA' ? 'card' : 'swap-horizontal'} 
            size={10} color="#64748b" 
          />
          <Text style={styles.ventaVendedor}>{venta.vendedor_nombre || 'Admin'} • {venta.metodo_pago || 'EFECTIVO'}</Text>
        </View>
      </View>
      <View style={styles.ventaMonto}>
        <Text style={styles.ventaTotal}>${parseFloat(venta.total).toFixed(2)}</Text>
        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER Y BÚSQUEDA */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>HISTORIAL DE VENTAS</Text>
          <TouchableOpacity onPress={fetchVentas} style={styles.headerBtn}>
            <Ionicons name="refresh" size={24} color={LOGO_BLUE} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Buscar por vendedor o método..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* BOTONES DE FILTRO DE TIEMPO */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll} contentContainerStyle={styles.filtrosContainer}>
          <TouchableOpacity style={[styles.filtroBtn, filtroTiempo === 'dias' && styles.filtroBtnActivo]} onPress={() => setFiltroTiempo('dias')}>
            <Text style={[styles.filtroText, filtroTiempo === 'dias' && styles.filtroTextActivo]}>Días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtroBtn, filtroTiempo === 'semanas' && styles.filtroBtnActivo]} onPress={() => setFiltroTiempo('semanas')}>
            <Text style={[styles.filtroText, filtroTiempo === 'semanas' && styles.filtroTextActivo]}>Semanas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtroBtn, filtroTiempo === 'meses' && styles.filtroBtnActivo]} onPress={() => setFiltroTiempo('meses')}>
            <Text style={[styles.filtroText, filtroTiempo === 'meses' && styles.filtroTextActivo]}>Meses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtroBtn, filtroTiempo === 'anos' && styles.filtroBtnActivo]} onPress={() => setFiltroTiempo('anos')}>
            <Text style={[styles.filtroText, filtroTiempo === 'anos' && styles.filtroTextActivo]}>Años</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={LOGO_BLUE} />
          <Text style={{marginTop: 10, color: '#94a3b8'}}>Cargando historial...</Text>
        </View>
      ) : (
        <FlatList
          data={ventasAgrupadas}
          keyExtractor={(item) => item.fecha}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            // --- GRÁFICA DE BARRAS NATIVA ---
            datosGrafica.length > 0 ? (
              <View style={styles.graficaContainer}>
                <Text style={styles.graficaTitulo}>Rendimiento ({filtroTiempo.toUpperCase()})</Text>
                <View style={styles.graficaChart}>
                  {datosGrafica.map((item, index) => {
                    const alturaPorcentaje = (item.totalDia / maxVentaGrafica) * 100;
                    return (
                      <View key={index} style={styles.graficaBarraWrapper}>
                        <Text style={styles.graficaValor}>${Math.round(item.totalDia)}</Text>
                        <View style={styles.graficaPista}>
                          <View style={[styles.graficaRelleno, { height: `${alturaPorcentaje}%` }]} />
                        </View>
                        <Text style={styles.graficaEtiqueta} numberOfLines={1}>{item.fecha.substring(0, 6)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>No se encontraron ventas.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.diaContainer}>
              <TouchableOpacity 
                style={styles.diaHeader} 
                onPress={() => toggleDia(item.fecha)}
                activeOpacity={0.7}
              >
                <View style={styles.diaInfo}>
                  <View style={styles.iconDate}>
                    <Ionicons name="calendar" size={18} color={LOGO_BLUE} />
                  </View>
                  <Text style={styles.diaTexto}>{item.fecha}</Text>
                </View>
                
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.diaTotalDinero}>${item.totalDia.toFixed(2)}</Text>
                  <Text style={styles.diaBadgeText}>{item.datos.length} {item.datos.length === 1 ? 'venta' : 'ventas'}</Text>
                </View>
              </TouchableOpacity>

              {diasExpandidos.includes(item.fecha) && (
                <View style={styles.listaVentas}>
                  {item.datos.map((v: any) => renderVentaItem(v))}
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* MODAL DE DETALLE COMPLETO (Se mantiene igual que tu versión) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>TICKET DE VENTA</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {ventaSeleccionada && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.infoCard}>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Atendido por:</Text>
                    <Text style={styles.infoVal}>{ventaSeleccionada.vendedor_nombre}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Fecha y Hora:</Text>
                    <Text style={styles.infoVal}>
                      {new Date(ventaSeleccionada.created_at).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Método de Pago:</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Ionicons 
                        name={ventaSeleccionada.metodo_pago === 'EFECTIVO' ? 'cash' : ventaSeleccionada.metodo_pago === 'TARJETA' ? 'card' : 'swap-horizontal'} 
                        size={14} color={SUCCESS_GREEN} style={{marginRight: 5}} 
                      />
                      <Text style={[styles.infoVal, { color: SUCCESS_GREEN, fontWeight: '900' }]}>
                        {ventaSeleccionada.metodo_pago || 'EFECTIVO'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.seccionTitle}>ARTÍCULOS VENDIDOS</Text>
                <View style={styles.ticketBox}>
                  
                  {ventaSeleccionada.productos_json && ventaSeleccionada.productos_json.length > 0 ? (
                    ventaSeleccionada.productos_json.map((p: any, i: number) => (
                      <View key={i} style={styles.productoFila}>
                        <Text style={styles.pNombre}>{p.cantidad_venta || 1}x {p.nombre}</Text>
                        <Text style={styles.pPrecio}>${((p.precio_venta || 0) * (p.cantidad_venta || 1)).toFixed(2)}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.productoFila}>
                      <Text style={styles.pNombre}>1x Reparación / Servicio de Taller</Text>
                      <Text style={styles.pPrecio}>${parseFloat(ventaSeleccionada.total).toFixed(2)}</Text>
                    </View>
                  )}

                  <View style={styles.divider} />
                  <View style={styles.totalFila}>
                    <Text style={styles.totalLabel}>TOTAL PAGADO</Text>
                    <Text style={styles.totalMonto}>${parseFloat(ventaSeleccionada.total).toFixed(2)}</Text>
                  </View>
                </View>

                {ventaSeleccionada.ubicacion && (
                  <TouchableOpacity 
                    style={styles.btnMapa}
                    onPress={() => abrirMapa(ventaSeleccionada.ubicacion.lat, ventaSeleccionada.ubicacion.lng)}
                  >
                    <Ionicons name="location" size={20} color="#fff" />
                    <Text style={styles.btnMapaText}>Ver ubicación GPS de la venta</Text>
                  </TouchableOpacity>
                )}
                <View style={{height: 20}} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header y Buscador combinados
  headerContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 50, 
    paddingBottom: 15
  },
  headerBtn: { padding: 5, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', letterSpacing: 0.5 },
  
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    marginHorizontal: 20, marginBottom: 15, paddingHorizontal: 15, borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1e293b' },

  filtrosScroll: { paddingHorizontal: 20 },
  filtrosContainer: { paddingRight: 40, flexDirection: 'row', alignItems: 'center' },
  filtroBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  filtroBtnActivo: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  filtroText: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  filtroTextActivo: { color: '#fff' },

  // Estilos de la Gráfica Nativa
  graficaContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  graficaTitulo: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 20 },
  graficaChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  graficaBarraWrapper: { alignItems: 'center', flex: 1 },
  graficaValor: { fontSize: 9, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  graficaPista: { width: 12, height: 80, backgroundColor: '#f1f5f9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  graficaRelleno: { width: '100%', backgroundColor: LOGO_BLUE, borderRadius: 6 },
  graficaEtiqueta: { fontSize: 9, color: '#94a3b8', marginTop: 8, textTransform: 'capitalize' },

  listContent: { padding: 15, paddingBottom: 50 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 10, fontWeight: '500' },

  diaContainer: { marginBottom: 15 },
  diaHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: '#fff', padding: 18, borderRadius: 16, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  iconDate: { backgroundColor: '#f0f5ff', padding: 8, borderRadius: 10, marginRight: 12 },
  diaInfo: { flexDirection: 'row', alignItems: 'center' },
  diaTexto: { fontSize: 15, fontWeight: '800', color: '#1e293b', textTransform: 'capitalize' },
  diaTotalDinero: { fontSize: 16, fontWeight: '900', color: LOGO_BLUE },
  diaBadgeText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  
  listaVentas: { backgroundColor: '#fdfdfd', marginTop: -15, paddingTop: 20, paddingHorizontal: 15, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', borderTopWidth: 0 },
  ventaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ventaInfo: { flex: 1 },
  ventaHora: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  metodoMiniBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ventaVendedor: { fontSize: 11, color: '#64748b', marginLeft: 4, textTransform: 'uppercase' },
  ventaMonto: { flexDirection: 'row', alignItems: 'center' },
  ventaTotal: { fontSize: 16, fontWeight: '800', marginRight: 8, color: '#1e293b' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', letterSpacing: 1 },
  infoCard: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' },
  infoVal: { fontSize: 14, color: '#1e293b', fontWeight: '700' },
  seccionTitle: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 10, letterSpacing: 1 },
  ticketBox: { backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
  productoFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pNombre: { fontSize: 14, color: '#334155', flex: 1, fontWeight: '500', marginRight: 10 },
  pPrecio: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12, borderStyle: 'dashed' },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '900', color: '#1e293b' },
  totalMonto: { fontSize: 24, fontWeight: '900', color: LOGO_BLUE },
  btnMapa: { backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 15, marginTop: 20 },
  btnMapaText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 13 }
});