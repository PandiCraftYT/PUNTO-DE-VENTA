import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, ScrollView, Linking, Platform, 
  ActivityIndicator, StatusBar, TextInput, Image, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

// --- IMPORTAMOS NUESTRAS HERRAMIENTAS ---
import { formatoMoneda } from '../lib/helpers';
import { generarReportePDF } from '../lib/pdfGenerator'; 

const LOGO_BLUE = '#0056FF';
const SUCCESS_GREEN = '#2ecc71';
const NEUTRAL_SLATE = '#64748b';

export default function HistorialVentas() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  
  const [movimientosCrudos, setMovimientosCrudos] = useState<any[]>([]);
  const [movimientosAgrupados, setMovimientosAgrupadas] = useState<any[]>([]);
  const [datosGrafica, setDatosGrafica] = useState<any[]>([]);
  const [maxVentaGrafica, setMaxVentaGrafica] = useState(0);

  const [totalesPeriodo, setTotalesPeriodo] = useState({ ingresos: 0, neto: 0 });
  const [movSeleccionado, setMovSeleccionado] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [diasExpandidos, setDiasExpandidos] = useState<string[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState('hoy');

  useEffect(() => {
    fetchMovimientos();
  }, []);

  useEffect(() => {
    procesarMovimientos(movimientosCrudos, busqueda, filtroTiempo);
  }, [movimientosCrudos, busqueda, filtroTiempo]);

  const fetchMovimientos = async () => {
    setCargando(true);
    try {
      // Consultamos solo la tabla de ventas (la tabla gastos fue eliminada del core)
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false });

      if (ventasError) throw ventasError;

      const ventas = (ventasData || []).map(v => ({ ...v, tipo_registro: 'venta' }));
      setMovimientosCrudos(ventas);
    } catch (err) {
      console.error("Error al cargar movimientos:", err);
    } finally {
      setCargando(false);
    }
  };

  const procesarMovimientos = (datos: any[], textoBusqueda: string, filtro: string) => {
    let filtrados = datos;

    if (filtro === 'hoy') {
      const fechaHoy = new Date().toLocaleDateString('es-MX');
      filtrados = filtrados.filter(item => 
        new Date(item.created_at).toLocaleDateString('es-MX') === fechaHoy
      );
    }

    if (textoBusqueda) {
      const q = textoBusqueda.toLowerCase();
      filtrados = filtrados.filter(v => 
        v.vendedor_nombre?.toLowerCase().includes(q) || 
        v.metodo_pago?.toLowerCase().includes(q)
      );
    }

    let globalIngresos = 0;

    const grupos = filtrados.reduce((acc: any, item: any) => {
      const fechaObj = new Date(item.created_at);
      let claveGrupo = '';

      if (filtro === 'hoy' || filtro === 'dias') {
        claveGrupo = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      } else if (filtro === 'semanas') {
        const dia = fechaObj.getDay();
        const diff = fechaObj.getDate() - dia + (dia === 0 ? -6 : 1);
        const lunes = new Date(fechaObj.setDate(diff));
        claveGrupo = `Semana del ${lunes.getDate()} de ${lunes.toLocaleDateString('es-MX', { month: 'short' })}`;
      } else if (filtro === 'meses') {
        claveGrupo = fechaObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      } else {
        claveGrupo = fechaObj.getFullYear().toString();
      }
      
      if (!acc[claveGrupo]) {
        acc[claveGrupo] = { datos: [], totalIngresos: 0 };
      }
      
      acc[claveGrupo].datos.push(item);
      const valor = parseFloat(item.total) || 0;
      acc[claveGrupo].totalIngresos += valor;
      globalIngresos += valor;

      return acc;
    }, {});

    setTotalesPeriodo({ ingresos: globalIngresos, neto: globalIngresos });

    const listaAgrupada = Object.keys(grupos).map(fecha => ({
      fecha,
      datos: grupos[fecha].datos,
      totalDia: grupos[fecha].totalIngresos,
      totalIngresos: grupos[fecha].totalIngresos,
    }));

    setMovimientosAgrupadas(listaAgrupada);

    const paraGrafica = listaAgrupada.slice(0, 7).reverse();
    setDatosGrafica(paraGrafica);

    const max = Math.max(...paraGrafica.map(item => item.totalDia), 0);
    setMaxVentaGrafica(max > 0 ? max : 1);
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
    }) || `http://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url);
  };

  const compartirWhatsApp = () => {
    if (!movSeleccionado) return;
    
    let productosTexto = '';
    if (movSeleccionado.productos_json && movSeleccionado.productos_json.length > 0) {
      productosTexto = movSeleccionado.productos_json.map((p: any) => 
        `• ${p.cantidad_venta || 1}x ${p.nombre} - ${formatoMoneda((p.precio_venta || 0) * (p.cantidad_venta || 1))}`
      ).join('\n');
    } else {
      productosTexto = `• 1x Producto / Servicio - ${formatoMoneda(movSeleccionado.total)}`;
    }

    const mensaje = `*COMPROBANTE DE VENTA*\n\n` +
      `📅 Fecha: ${new Date(movSeleccionado.created_at).toLocaleString('es-MX')}\n` +
      `👤 Atendido por: ${movSeleccionado.vendedor_nombre}\n` +
      `💳 Pago: ${movSeleccionado.metodo_pago || 'EFECTIVO'}\n\n` +
      `*DETALLES:*\n${productosTexto}\n\n` +
      `*TOTAL PAGADO: ${formatoMoneda(movSeleccionado.total)}*\n\n` +
      `¡Gracias por su preferencia!`;

    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensaje)}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>HISTORIAL DE VENTAS</Text>
          <TouchableOpacity onPress={fetchMovimientos} style={styles.headerBtn}>
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
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
          {['hoy', 'dias', 'semanas', 'meses'].map((f) => (
            <TouchableOpacity 
              key={f}
              style={[styles.filtroBtn, filtroTiempo === f && styles.filtroBtnActivo]} 
              onPress={() => setFiltroTiempo(f)}
            >
              <Text style={[styles.filtroText, filtroTiempo === f && styles.filtroTextActivo]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {cargando ? (
        <View style={styles.center}><ActivityIndicator size="large" color={LOGO_BLUE} /></View>
      ) : (
        <FlatList
          data={movimientosAgrupados}
          keyExtractor={(item) => item.fecha}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.resumenCardFull}>
                <Text style={styles.resumenLabel}>INGRESOS TOTALES ({filtroTiempo.toUpperCase()})</Text>
                <Text style={styles.resumenMonto}>{formatoMoneda(totalesPeriodo.ingresos)}</Text>
              </View>

              {datosGrafica.length > 0 && filtroTiempo !== 'hoy' && (
                <View style={styles.graficaContainer}>
                  <Text style={styles.graficaTitulo}>Ventas por Periodo</Text>
                  <View style={styles.graficaChart}>
                    {datosGrafica.map((item, index) => (
                      <View key={index} style={styles.graficaBarraWrapper}>
                        <View style={[styles.graficaRelleno, { height: `${(item.totalDia / maxVentaGrafica) * 100}%`, backgroundColor: LOGO_BLUE }]} />
                        <Text style={styles.graficaEtiqueta}>{item.fecha.substring(0, 3)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.diaContainer}>
              <TouchableOpacity style={styles.diaHeader} onPress={() => toggleDia(item.fecha)}>
                <Text style={styles.diaTexto}>{item.fecha}</Text>
                <Text style={styles.diaTotalDinero}>{formatoMoneda(item.totalDia)}</Text>
              </TouchableOpacity>

              {diasExpandidos.includes(item.fecha) && (
                <View style={styles.listaVentas}>
                  {item.datos.map((mov: any) => (
                    <TouchableOpacity 
                      key={mov.id} 
                      style={styles.ventaRow}
                      onPress={() => { setMovSeleccionado(mov); setModalVisible(true); }}
                    >
                      <View>
                        <Text style={styles.ventaHora}>{new Date(mov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        <Text style={styles.ventaVendedor}>{mov.vendedor_nombre} • {mov.metodo_pago}</Text>
                      </View>
                      <Text style={styles.ventaTotal}>{formatoMoneda(mov.total)}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.btnPdf} onPress={() => generarReportePDF(item)}>
                    <Text style={{color: '#fff', fontWeight: 'bold'}}>Descargar Reporte del Día</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Modal de Detalle (Simplificado y Comercial) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>DETALLE DE VENTA</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close-circle" size={30} color={NEUTRAL_SLATE} /></TouchableOpacity>
            </View>
            {movSeleccionado && (
              <ScrollView>
                <View style={styles.infoCard}>
                  <Text style={styles.infoVal}>Vendedor: {movSeleccionado.vendedor_nombre}</Text>
                  <Text style={styles.infoVal}>Fecha: {new Date(movSeleccionado.created_at).toLocaleString()}</Text>
                  <Text style={styles.infoVal}>Pago: {movSeleccionado.metodo_pago}</Text>
                </View>
                <View style={styles.ticketBox}>
                  <Text style={styles.totalMonto}>{formatoMoneda(movSeleccionado.total)}</Text>
                </View>
                <TouchableOpacity style={styles.actionBtnWa} onPress={compartirWhatsApp}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>Enviar por WhatsApp</Text>
                </TouchableOpacity>
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
  headerContainer: { backgroundColor: '#fff', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15 },
  headerBtn: { padding: 5 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', marginHorizontal: 20, marginBottom: 15, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  filtrosScroll: { paddingHorizontal: 20 },
  filtroBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  filtroBtnActivo: { backgroundColor: LOGO_BLUE },
  filtroText: { fontSize: 12, color: NEUTRAL_SLATE, fontWeight: 'bold' },
  filtroTextActivo: { color: '#fff' },
  resumenCardFull: { margin: 20, backgroundColor: LOGO_BLUE, padding: 25, borderRadius: 20, alignItems: 'center', elevation: 5 },
  resumenLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  resumenMonto: { color: '#fff', fontSize: 32, fontWeight: '900' },
  graficaContainer: { marginHorizontal: 20, backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20 },
  graficaTitulo: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  graficaChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  graficaBarraWrapper: { alignItems: 'center', flex: 1 },
  graficaRelleno: { width: 15, borderRadius: 5 },
  graficaEtiqueta: { fontSize: 10, color: NEUTRAL_SLATE, marginTop: 5 },
  listContent: { paddingBottom: 50 },
  diaContainer: { marginHorizontal: 20, marginBottom: 10 },
  diaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 1 },
  diaTexto: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  diaTotalDinero: { fontSize: 16, fontWeight: 'bold', color: LOGO_BLUE },
  listaVentas: { backgroundColor: '#fff', marginTop: 5, padding: 15, borderRadius: 15 },
  ventaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ventaHora: { fontSize: 14, fontWeight: 'bold' },
  ventaVendedor: { fontSize: 11, color: NEUTRAL_SLATE },
  ventaTotal: { fontSize: 15, fontWeight: 'bold' },
  btnPdf: { backgroundColor: '#334155', padding: 12, borderRadius: 10, marginTop: 15, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  infoCard: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, marginBottom: 20 },
  infoVal: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  ticketBox: { padding: 20, backgroundColor: '#fff', borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed', alignItems: 'center', borderRadius: 15 },
  totalMonto: { fontSize: 32, fontWeight: '900', color: LOGO_BLUE },
  actionBtnWa: { backgroundColor: SUCCESS_GREEN, padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 }
});