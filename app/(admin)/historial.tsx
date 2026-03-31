import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, ScrollView, Linking, Platform, 
  ActivityIndicator, StatusBar, TextInput, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

const LOGO_BLUE = '#0056FF';
const SUCCESS_GREEN = '#2ecc71';
const EXPENSE_RED = '#e74c3c';

export default function HistorialVentas() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  
  const [movimientosCrudos, setMovimientosCrudos] = useState<any[]>([]);
  const [movimientosAgrupados, setMovimientosAgrupadas] = useState<any[]>([]);
  const [datosGrafica, setDatosGrafica] = useState<any[]>([]);
  const [maxVentaGrafica, setMaxVentaGrafica] = useState(0);

  // Totales globales para las tarjetas superiores
  const [totalesPeriodo, setTotalesPeriodo] = useState({ ingresos: 0, gastos: 0, neto: 0 });

  const [movSeleccionado, setMovSeleccionado] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [diasExpandidos, setDiasExpandidos] = useState<string[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState('hoy'); // Empezamos en 'hoy' por defecto

  useEffect(() => {
    fetchMovimientos();
  }, []);

  useEffect(() => {
    procesarMovimientos(movimientosCrudos, busqueda, filtroTiempo);
  }, [movimientosCrudos, busqueda, filtroTiempo]);

  const fetchMovimientos = async () => {
    setCargando(true);
    try {
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false });

      if (ventasError) throw ventasError;

      const { data: gastosData, error: gastosError } = await supabase
        .from('gastos')
        .select('*')
        .order('created_at', { ascending: false });

      const ventas = (ventasData || []).map(v => ({ ...v, tipo_registro: 'venta' }));
      const gastos = gastosError ? [] : (gastosData || []).map(g => ({ ...g, tipo_registro: 'gasto' }));

      const combinado = [...ventas, ...gastos].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setMovimientosCrudos(combinado);
    } catch (err) {
      console.error("Error al cargar movimientos:", err);
    } finally {
      setCargando(false);
    }
  };

  const procesarMovimientos = (datos: any[], textoBusqueda: string, filtro: string) => {
    let filtrados = datos;

    // Filtro especial para HOY
    if (filtro === 'hoy') {
      const fechaHoy = new Date().toLocaleDateString('es-MX');
      filtrados = filtrados.filter(item => 
        new Date(item.created_at).toLocaleDateString('es-MX') === fechaHoy
      );
    }

    if (textoBusqueda) {
      const q = textoBusqueda.toLowerCase();
      filtrados = filtrados.filter(v => {
        if (v.tipo_registro === 'venta') {
          return v.vendedor_nombre?.toLowerCase().includes(q) || v.metodo_pago?.toLowerCase().includes(q);
        } else {
          return v.concepto?.toLowerCase().includes(q) || v.categoria?.toLowerCase().includes(q);
        }
      });
    }

    let globalIngresos = 0;
    let globalGastos = 0;

    const grupos = filtrados.reduce((acc: any, item: any) => {
      const fechaObj = new Date(item.created_at);
      let claveGrupo = '';

      if (filtro === 'hoy' || filtro === 'dias') {
        claveGrupo = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      } else if (filtro === 'semanas') {
        const dia = fechaObj.getDay();
        const diff = fechaObj.getDate() - dia + (dia === 0 ? -6 : 1);
        const lunes = new Date(fechaObj.setDate(diff));
        claveGrupo = `Semana ${lunes.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;
      } else if (filtro === 'meses') {
        claveGrupo = fechaObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      } else if (filtro === 'anos') {
        claveGrupo = fechaObj.getFullYear().toString();
      }
      
      if (!acc[claveGrupo]) {
        acc[claveGrupo] = { datos: [], totalDia: 0, totalIngresos: 0, totalEgresos: 0 };
      }
      
      acc[claveGrupo].datos.push(item);
      
      if (item.tipo_registro === 'venta') {
        const valor = parseFloat(item.total) || 0;
        acc[claveGrupo].totalIngresos += valor;
        acc[claveGrupo].totalDia += valor;
        globalIngresos += valor;
      } else {
        const valor = parseFloat(item.monto) || 0;
        acc[claveGrupo].totalEgresos += valor;
        acc[claveGrupo].totalDia -= valor;
        globalGastos += valor;
      }

      return acc;
    }, {});

    setTotalesPeriodo({
      ingresos: globalIngresos,
      gastos: globalGastos,
      neto: globalIngresos - globalGastos
    });

    const listaAgrupada = Object.keys(grupos).map(fecha => ({
      fecha,
      datos: grupos[fecha].datos,
      totalDia: grupos[fecha].totalDia,
      totalIngresos: grupos[fecha].totalIngresos,
      totalEgresos: grupos[fecha].totalEgresos
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
    }) || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  const compartirWhatsApp = () => {
    if (!movSeleccionado) return;
    
    let mensaje = '';
    
    if (movSeleccionado.tipo_registro === 'venta') {
      let productosTexto = '';
      if (movSeleccionado.productos_json && movSeleccionado.productos_json.length > 0) {
        productosTexto = movSeleccionado.productos_json.map((p: any) => 
          `• ${p.cantidad_venta || 1}x ${p.nombre} - $${((p.precio_venta || 0) * (p.cantidad_venta || 1)).toFixed(2)}`
        ).join('\n');
      } else {
        productosTexto = `• 1x Reparación / Servicio - $${parseFloat(movSeleccionado.total).toFixed(2)}`;
      }

      mensaje = `*GS GAMES SALE - TICKET DE VENTA*\n\n` +
        `📅 Fecha: ${new Date(movSeleccionado.created_at).toLocaleString('es-MX')}\n` +
        `👤 Atendido por: ${movSeleccionado.vendedor_nombre}\n` +
        `💳 Pago: ${movSeleccionado.metodo_pago || 'EFECTIVO'}\n\n` +
        `*DETALLES:*\n${productosTexto}\n\n` +
        `*TOTAL PAGADO: $${parseFloat(movSeleccionado.total).toFixed(2)}*\n\n` +
        `¡Gracias por tu compra! 🎮`;
    } else {
      mensaje = `*GS GAMES SALE - COMPROBANTE DE SALIDA*\n\n` +
        `📅 Fecha: ${new Date(movSeleccionado.created_at).toLocaleString('es-MX')}\n` +
        `👤 Registrado por: ${movSeleccionado.registrado_por}\n` +
        `🏷 Categoría: ${movSeleccionado.categoria}\n\n` +
        `*CONCEPTO:*\n• ${movSeleccionado.concepto}\n\n` +
        `*TOTAL SALIDA: $${parseFloat(movSeleccionado.monto).toFixed(2)}*`;
    }

    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensaje)}`);
  };

  const imprimirPDF = () => {
    if (Platform.OS === 'web') {
      window.print();
    } else {
      alert("En dispositivos móviles, por favor utiliza la opción de compartir por WhatsApp.");
    }
  };

  const renderMovimientoItem = (mov: any) => {
    const esGasto = mov.tipo_registro === 'gasto';

    return (
      <TouchableOpacity 
        key={mov.id}
        style={styles.ventaRow} 
        onPress={() => {
          setMovSeleccionado(mov);
          setModalVisible(true);
        }}
      >
        <View style={styles.ventaInfo}>
          <Text style={styles.ventaHora}>
            {new Date(mov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.metodoMiniBadge}>
            <Ionicons 
              name={esGasto ? 'wallet' : (mov.metodo_pago === 'EFECTIVO' ? 'cash' : 'card')} 
              size={10} color={esGasto ? EXPENSE_RED : "#64748b"} 
            />
            <Text style={[styles.ventaVendedor, esGasto && { color: EXPENSE_RED }]}>
              {esGasto ? `GASTO • ${mov.categoria}` : `${mov.vendedor_nombre || 'Admin'} • ${mov.metodo_pago || 'EFECTIVO'}`}
            </Text>
          </View>
          {esGasto && <Text style={{ fontSize: 10, color: '#333', marginTop: 2 }}>{mov.concepto}</Text>}
        </View>
        <View style={styles.ventaMonto}>
          <Text style={[styles.ventaTotal, esGasto && { color: EXPENSE_RED }]}>
            {esGasto ? `-$${parseFloat(mov.monto).toFixed(2)}` : `+$${parseFloat(mov.total).toFixed(2)}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CORTE DE MOVIMIENTOS</Text>
          <TouchableOpacity onPress={fetchMovimientos} style={styles.headerBtn}>
            <Ionicons name="refresh" size={24} color={LOGO_BLUE} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Buscar venta o gasto..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* BOTONES DE FILTRO (AHORA INCLUYE HOY) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll} contentContainerStyle={styles.filtrosContainer}>
          <TouchableOpacity style={[styles.filtroBtn, filtroTiempo === 'hoy' && styles.filtroBtnActivo]} onPress={() => setFiltroTiempo('hoy')}>
            <Text style={[styles.filtroText, filtroTiempo === 'hoy' && styles.filtroTextActivo]}>Hoy</Text>
          </TouchableOpacity>
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
          <Text style={{marginTop: 10, color: '#94a3b8'}}>Calculando corte...</Text>
        </View>
      ) : (
        <FlatList
          data={movimientosAgrupados}
          keyExtractor={(item) => item.fecha}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {/* --- TARJETAS DE RESUMEN GLOBALES --- */}
              <View style={styles.resumenGlobalRow}>
                <View style={[styles.resumenCard, { borderColor: '#dcfce7', backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.resumenLabel, { color: '#16a34a' }]}>INGRESOS</Text>
                  <Text style={[styles.resumenMonto, { color: '#16a34a' }]}>${totalesPeriodo.ingresos.toFixed(2)}</Text>
                </View>
                <View style={[styles.resumenCard, { borderColor: '#fee2e2', backgroundColor: '#fef2f2' }]}>
                  <Text style={[styles.resumenLabel, { color: EXPENSE_RED }]}>GASTOS</Text>
                  <Text style={[styles.resumenMonto, { color: EXPENSE_RED }]}>${totalesPeriodo.gastos.toFixed(2)}</Text>
                </View>
              </View>

              {/* --- GRÁFICA DE BARRAS NATIVA --- */}
              {datosGrafica.length > 0 && filtroTiempo !== 'hoy' && (
                <View style={styles.graficaContainer}>
                  <Text style={styles.graficaTitulo}>Ganancia Neta ({filtroTiempo.toUpperCase()})</Text>
                  <View style={styles.graficaChart}>
                    {datosGrafica.map((item, index) => {
                      const alturaPorcentaje = item.totalDia > 0 ? (item.totalDia / maxVentaGrafica) * 100 : 0;
                      return (
                        <View key={index} style={styles.graficaBarraWrapper}>
                          <Text style={styles.graficaValor}>${Math.round(item.totalDia)}</Text>
                          <View style={styles.graficaPista}>
                            <View style={[styles.graficaRelleno, { height: `${alturaPorcentaje}%`, backgroundColor: item.totalDia >= 0 ? LOGO_BLUE : EXPENSE_RED }]} />
                          </View>
                          <Text style={styles.graficaEtiqueta} numberOfLines={1}>{item.fecha.substring(0, 6)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>No se encontraron movimientos.</Text>
            </View>
          }
          renderItem={({ item }) => {
            // SEPARAMOS VENTAS Y GASTOS DEL DÍA
            const ventasDelDia = item.datos.filter((d: any) => d.tipo_registro === 'venta');
            const gastosDelDia = item.datos.filter((d: any) => d.tipo_registro === 'gasto');

            return (
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
                    <View>
                      <Text style={styles.diaTexto}>{item.fecha}</Text>
                      <View style={{ flexDirection: 'row', marginTop: 2 }}>
                        <Text style={{ fontSize: 10, color: SUCCESS_GREEN, marginRight: 8 }}>In: ${item.totalIngresos.toFixed(2)}</Text>
                        <Text style={{ fontSize: 10, color: EXPENSE_RED }}>Out: ${item.totalEgresos.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.diaTotalDinero, item.totalDia < 0 && { color: EXPENSE_RED }]}>
                      ${item.totalDia.toFixed(2)}
                    </Text>
                    <Text style={styles.diaBadgeText}>Neto ({item.datos.length} movs)</Text>
                  </View>
                </TouchableOpacity>

                {diasExpandidos.includes(item.fecha) && (
                  <View style={styles.listaVentas}>
                    
                    {/* SECCIÓN DE VENTAS */}
                    {ventasDelDia.length > 0 && (
                      <View style={{ marginBottom: 10 }}>
                        <View style={styles.divisorSeccion}>
                          <View style={[styles.puntoColor, { backgroundColor: SUCCESS_GREEN }]} />
                          <Text style={styles.tituloSeccion}>INGRESOS (VENTAS)</Text>
                        </View>
                        {ventasDelDia.map((v: any) => renderMovimientoItem(v))}
                      </View>
                    )}

                    {/* SECCIÓN DE GASTOS */}
                    {gastosDelDia.length > 0 && (
                      <View style={{ marginBottom: 5 }}>
                        <View style={styles.divisorSeccion}>
                          <View style={[styles.puntoColor, { backgroundColor: EXPENSE_RED }]} />
                          <Text style={[styles.tituloSeccion, { color: EXPENSE_RED }]}>EGRESOS (GASTOS)</Text>
                        </View>
                        {gastosDelDia.map((v: any) => renderMovimientoItem(v))}
                      </View>
                    )}

                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* MODAL DINÁMICO (TICKET O GASTO) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {movSeleccionado?.tipo_registro === 'gasto' ? 'COMPROBANTE DE SALIDA' : 'TICKET DE VENTA'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {movSeleccionado && (
              <ScrollView showsVerticalScrollIndicator={false}>
                
                {movSeleccionado.tipo_registro === 'gasto' ? (
                  <View>
                    <View style={[styles.infoCard, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Registrado por:</Text>
                        <Text style={styles.infoVal}>{movSeleccionado.registrado_por}</Text>
                      </View>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Fecha y Hora:</Text>
                        <Text style={styles.infoVal}>
                          {new Date(movSeleccionado.created_at).toLocaleString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </Text>
                      </View>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Categoría:</Text>
                        <Text style={styles.infoVal}>{movSeleccionado.categoria}</Text>
                      </View>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Sucursal:</Text>
                        <Text style={styles.infoVal}>{movSeleccionado.sucursal}</Text>
                      </View>
                    </View>

                    <Text style={styles.seccionTitle}>DETALLE DEL GASTO</Text>
                    <View style={styles.ticketBox}>
                      <View style={styles.productoFila}>
                        <Text style={styles.pNombre}>{movSeleccionado.concepto}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.totalFila}>
                        <Text style={styles.totalLabel}>TOTAL SALIDA</Text>
                        <Text style={[styles.totalMonto, { color: EXPENSE_RED }]}>${parseFloat(movSeleccionado.monto).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={styles.infoCard}>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Atendido por:</Text>
                        <Text style={styles.infoVal}>{movSeleccionado.vendedor_nombre}</Text>
                      </View>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Fecha y Hora:</Text>
                        <Text style={styles.infoVal}>
                          {new Date(movSeleccionado.created_at).toLocaleString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </Text>
                      </View>
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Método de Pago:</Text>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Ionicons 
                            name={movSeleccionado.metodo_pago === 'EFECTIVO' ? 'cash' : movSeleccionado.metodo_pago === 'TARJETA' ? 'card' : 'swap-horizontal'} 
                            size={14} color={SUCCESS_GREEN} style={{marginRight: 5}} 
                          />
                          <Text style={[styles.infoVal, { color: SUCCESS_GREEN, fontWeight: '900' }]}>
                            {movSeleccionado.metodo_pago || 'EFECTIVO'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.seccionTitle}>ARTÍCULOS VENDIDOS</Text>
                    <View style={styles.ticketBox}>
                      {movSeleccionado.productos_json && movSeleccionado.productos_json.length > 0 ? (
                        movSeleccionado.productos_json.map((p: any, i: number) => (
                          <View key={i} style={styles.productoFila}>
                            <Text style={styles.pNombre}>{p.cantidad_venta || 1}x {p.nombre}</Text>
                            <Text style={styles.pPrecio}>${((p.precio_venta || 0) * (p.cantidad_venta || 1)).toFixed(2)}</Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.productoFila}>
                          <Text style={styles.pNombre}>1x Reparación / Servicio de Taller</Text>
                          <Text style={styles.pPrecio}>${parseFloat(movSeleccionado.total).toFixed(2)}</Text>
                        </View>
                      )}

                      <View style={styles.divider} />
                      <View style={styles.totalFila}>
                        <Text style={styles.totalLabel}>TOTAL INGRESADO</Text>
                        <Text style={styles.totalMonto}>${parseFloat(movSeleccionado.total).toFixed(2)}</Text>
                      </View>
                    </View>

                    {movSeleccionado.ubicacion ? (
                      <View style={{ marginTop: 20 }}>
                        <Text style={styles.seccionTitle}>UBICACIÓN DE LA VENTA</Text>
                        <View style={styles.mapContainerPreview}>
                          <Image 
                            source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${movSeleccionado.ubicacion.lat},${movSeleccionado.ubicacion.lng}&zoom=15&size=400x150&markers=color:red%7C${movSeleccionado.ubicacion.lat},${movSeleccionado.ubicacion.lng}&key=TU_API_KEY_AQUI` }} 
                            style={styles.mapStaticImage} 
                          />
                          <TouchableOpacity 
                            style={styles.btnOpenMapOverlay}
                            onPress={() => abrirMapa(movSeleccionado.ubicacion.lat, movSeleccionado.ubicacion.lng)}
                          >
                            <Ionicons name="navigate" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Abrir Mapas</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noLocationText}>Ubicación GPS no registrada.</Text>
                    )}
                  </View>
                )}

                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity style={styles.actionBtnWa} onPress={compartirWhatsApp}>
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtnPdf} onPress={imprimirPDF}>
                    <Ionicons name="print" size={18} color="#333" style={{ marginRight: 6 }} />
                    <Text style={[styles.actionBtnText, { color: '#333' }]}>PDF / Imprimir</Text>
                  </TouchableOpacity>
                </View>

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

  // TARJETAS SUPERIORES
  resumenGlobalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  resumenCard: { flex: 0.48, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  resumenLabel: { fontSize: 11, fontWeight: '800', marginBottom: 5, letterSpacing: 0.5 },
  resumenMonto: { fontSize: 20, fontWeight: '900' },

  graficaContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  graficaTitulo: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 20 },
  graficaChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  graficaBarraWrapper: { alignItems: 'center', flex: 1 },
  graficaValor: { fontSize: 9, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  graficaPista: { width: 12, height: 80, backgroundColor: '#f1f5f9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  graficaRelleno: { width: '100%', borderRadius: 6 },
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
  
  diaTotalDinero: { fontSize: 18, fontWeight: '900', color: LOGO_BLUE },
  diaBadgeText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  
  listaVentas: { backgroundColor: '#fdfdfd', marginTop: -15, paddingTop: 25, paddingHorizontal: 15, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', borderTopWidth: 0 },
  
  // TÍTULOS DE SECCIÓN DENTRO DEL DÍA
  divisorSeccion: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  puntoColor: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  tituloSeccion: { fontSize: 12, fontWeight: '800', color: SUCCESS_GREEN, letterSpacing: 0.5 },

  ventaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
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
  
  mapContainerPreview: { height: 120, width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', position: 'relative' },
  mapStaticImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  btnOpenMapOverlay: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  noLocationText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
  
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  actionBtnWa: { flex: 1, backgroundColor: '#25D366', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 12, marginRight: 5 },
  actionBtnPdf: { flex: 1, backgroundColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 12, marginLeft: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});