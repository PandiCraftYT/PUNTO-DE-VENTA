import React, { useState, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TextInput, 
  FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, Modal, Image, Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import * as Location from 'expo-location'; 
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context'; 

// --- IMPORTAMOS NUESTRA FUNCIÓN DE FORMATO ---
import { formatoMoneda } from './../lib/helpers'; 

const LOGO_BLUE = '#0056FF';
const WHATSAPP_GREEN = '#25D366';

// --- TRUCO MÁGICO: MEMORIA GLOBAL ---
// Esta variable vive fuera de la pantalla, así que no se borra si te sales.
let carritoGuardado: any[] = [];

export default function VentasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const { usuario } = useAuth();
  const inputRef = useRef<TextInput>(null);

  // ESTADOS VENTA (Iniciamos con lo que haya en la memoria global)
  const [carrito, setCarritoLocal] = useState<any[]>(carritoGuardado);
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'>('EFECTIVO');
  
  // ESTADOS INVENTARIO (Para búsqueda súper rápida)
  const [inventario, setInventario] = useState<any[]>([]);
  const [sugerencias, setSugerencias] = useState<any[]>([]);

  // ESTADOS CÁMARA
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mostrarCamara, setMostrarCamara] = useState(false);

  // ESTADO PARA EL TICKET FINAL
  const [ticketGenerado, setTicketGenerado] = useState<any>(null);

  const cargarInventarioLocal = async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .gt('stock', 0); // Solo traemos lo que sí hay en existencia
      if (!error && data) {
        setInventario(data);
      }
    } catch (err) {
      console.log("Error cargando inventario local", err);
    }
  };

  // Recargar inventario SIEMPRE que el usuario entre a esta pantalla
  useFocusEffect(
    useCallback(() => {
      cargarInventarioLocal();
    }, [])
  );

  const actualizarCarrito = (nuevoCarrito: any[] | ((prev: any[]) => any[])) => {
    setCarritoLocal((prev) => {
      const actualizado = typeof nuevoCarrito === 'function' ? nuevoCarrito(prev) : nuevoCarrito;
      carritoGuardado = actualizado; // Lo guardamos en la memoria global
      return actualizado;
    });
  };

  // ATRAPAR REPARACIÓN DEL TALLER
  React.useEffect(() => {
    if (params?.taller_id && params?.taller_nombre && params?.taller_precio) {
      const reparacion = {
        id: params.taller_id, 
        nombre: params.taller_nombre,
        precio_venta: parseFloat(params.taller_precio as string) || 0,
        cantidad_venta: 1,
        stock: 999, 
        es_reparacion: true 
      };
      
      actualizarCarrito(prev => {
        const existe = prev.find(item => item.id === reparacion.id);
        if (existe) return prev;
        return [...prev, reparacion];
      });
    }
  }, [params]);

  // --- LÓGICA DE AUTOCOMPLETADO Y BÚSQUEDA RÁPIDA ---
  const manejarEscritura = (texto: string) => {
    setCodigoBusqueda(texto);
    const txt = texto.trim().toLowerCase();

    if (txt.length > 0) {
      const filtrados = inventario.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(txt)) || 
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(txt))
      );
      setSugerencias(filtrados);
    } else {
      setSugerencias([]);
    }
  };

  const seleccionarSugerencia = (producto: any) => {
    agregarAlCarrito(producto);
    setCodigoBusqueda('');
    setSugerencias([]);
    // Eliminamos el inputRef.current?.focus() para que el teclado no te interrumpa
  };

  const buscarProductoExacto = async (codigo: string) => {
    const cleanCode = codigo.trim();
    if (!cleanCode) return;

    // 1. Buscamos primero en la memoria local (súper rápido)
    const prodLocal = inventario.find(p => p.codigo_barras === cleanCode);
    if (prodLocal) {
      agregarAlCarrito(prodLocal); // <-- Ahora lo mandamos directo al carrito
      setCodigoBusqueda('');
      setSugerencias([]);
      return;
    }

    // 2. Si no está en memoria, vamos a la base de datos como respaldo
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo_barras', cleanCode)
        .single();

      if (error || !data) {
        Alert.alert("No encontrado", "El código no existe en la base de datos.");
        setCodigoBusqueda('');
        return;
      }

      if (data.stock <= 0) {
        Alert.alert("Sin stock", "El producto está agotado.");
        setCodigoBusqueda('');
        return;
      }

      agregarAlCarrito(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCodigoBusqueda('');
      setSugerencias([]);
    }
  };

  const agregarAlCarrito = (producto: any) => {
    actualizarCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      const precioReal = producto.precio_venta || producto.precio || 0;

      if (existe) {
        if (existe.cantidad_venta >= producto.stock && !existe.es_reparacion) {
          Alert.alert("Límite", `Solo tienes ${producto.stock} en stock.`);
          return prev;
        }
        return prev.map(item => 
          item.id === producto.id ? { ...item, cantidad_venta: item.cantidad_venta + 1 } : item
        );
      }
      return [...prev, { ...producto, precio_venta: precioReal, cantidad_venta: 1, imagen_url: producto.imagen_url }];
    });
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setMostrarCamara(false);
    buscarProductoExacto(data);
    setTimeout(() => setScanned(false), 2000);
  };

  const calcularTotal = () => {
    return carrito.reduce((acc, item) => {
      const p = parseFloat(item.precio_venta) || 0;
      const c = parseInt(item.cantidad_venta) || 0;
      return acc + (p * c);
    }, 0);
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    setProcesando(true);
    
    try {
      let coordsObj = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]) as any;
          
          coordsObj = { lat: location.coords.latitude, lng: location.coords.longitude };
        }
      } catch (e) {
        console.log("GPS omitido");
      }

      const totalVenta = calcularTotal();

      // 1. REGISTRAR LA VENTA
      const { error: errorVenta } = await supabase
        .from('ventas')
        .insert([{
          total: totalVenta,
          vendedor_nombre: usuario?.nombre || 'Admin GS',
          metodo_pago: metodoPago,
          productos_json: carrito,
          ubicacion: coordsObj 
        }]);

      if (errorVenta) throw errorVenta;

      // 2. DESCONTAR STOCK Y ACTUALIZAR TALLER
      for (const item of carrito) {
        if (item.es_reparacion) {
          await supabase.from('reparaciones').update({ estado: 'ENTREGADO' }).eq('id', item.id);
        } else {
          await supabase.from('productos').update({ stock: item.stock - item.cantidad_venta }).eq('id', item.id);
        }
      }

      // Recargamos el inventario local para reflejar el nuevo stock
      cargarInventarioLocal();

      setTicketGenerado({
        total: totalVenta,
        metodo: metodoPago,
        productos: carrito,
        fecha: new Date()
      });
      
      actualizarCarrito([]); 
      
    } catch (err: any) {
      console.error("Error crítico:", err);
      const msgError = "Error al cobrar: " + (err.message || "Error de red");
      if (Platform.OS === 'web') window.alert(msgError);
      else Alert.alert("Error", msgError);
    } finally {
      setProcesando(false);
    }
  };

  const enviarTicketWhatsApp = () => {
    if (!ticketGenerado) return;

    let mensaje = `🛒 *Punto de venta* 🎮\n¡Gracias por tu compra!\n\n*Detalle de tu ticket:*\n`;
    
    ticketGenerado.productos.forEach((p: any) => {
      // Aplicamos el formato con comas en el ticket
      mensaje += `▪️ ${p.cantidad_venta}x ${p.nombre} (${formatoMoneda(p.precio_venta * p.cantidad_venta)})\n`;
    });

    mensaje += `\n💰 *Total Pagado:* ${formatoMoneda(ticketGenerado.total)}`;
    mensaje += `\n💳 *Método:* ${ticketGenerado.metodo}`;
    mensaje += `\n📅 *Fecha:* ${ticketGenerado.fecha.toLocaleDateString('es-MX')} ${ticketGenerado.fecha.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}`;
    mensaje += `\n\n📍 *¡Vuelve pronto!*`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "No se pudo abrir WhatsApp.");
    });
  };

  const cerrarYVolver = () => {
    setTicketGenerado(null);
    router.push('/(admin)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSimple}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>PUNTO DE VENTA</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        
        {/* --- BARRA DE BÚSQUEDA CON AUTOCOMPLETADO --- */}
        <View style={{ zIndex: 10 }}> 
          <View style={styles.inputContainer}>
            <View style={styles.manualInputBox}>
              <Ionicons name="search-outline" size={20} color={LOGO_BLUE} />
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Nombre o código de barras..."
                placeholderTextColor="#94a3b8"
                value={codigoBusqueda}
                onChangeText={manejarEscritura}
                onSubmitEditing={() => buscarProductoExacto(codigoBusqueda)}
                underlineColorAndroid="transparent"
                {...(Platform.OS === 'web' && { outlineStyle: 'none', borderWidth: 0 } as any)}
              />
              {codigoBusqueda.length > 0 && (
                <TouchableOpacity onPress={() => { setCodigoBusqueda(''); setSugerencias([]); }}>
                  <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={styles.cameraBtn} 
              onPress={async () => {
                const res = await requestPermission();
                if (res.granted) setMostrarCamara(true);
                else Alert.alert("Permiso", "Se requiere cámara.");
              }}
            >
              <Ionicons name="barcode-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* LISTA DESPLEGABLE DE SUGERENCIAS */}
          {sugerencias.length > 0 && (
            <View style={styles.sugerenciasWrapper}>
              <FlatList
                data={sugerencias}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.sugerenciaRow}
                    onPress={() => seleccionarSugerencia(item)}
                  >
                    {/* --- IMAGEN DEL PRODUCTO EN LA BÚSQUEDA --- */}
                    {item.imagen_url && item.imagen_url.trim() !== '' ? (
                      <Image 
                        source={{ uri: item.imagen_url }} 
                        style={styles.sugerenciaImg} 
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.sugerenciaImg, styles.placeholderSugerencia]}>
                        <Ionicons name="image-outline" size={18} color="#94a3b8" />
                      </View>
                    )}

                    {/* --- TEXTOS --- */}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.sugerenciaNombre} numberOfLines={1}>{item.nombre}</Text>
                      <Text style={styles.sugerenciaStock}>Stock: {item.stock}  |  Cód: {item.codigo_barras || 'N/A'}</Text>
                    </View>
                    
                    {/* Formato de comas en sugerencia */}
                    <Text style={styles.sugerenciaPrecio}>{formatoMoneda(item.precio_venta)}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* --- LISTA DE PRODUCTOS EN EL CARRITO --- */}
        <FlatList
          data={carrito}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 10 }}
          renderItem={({ item }) => (
            <View style={styles.itemCarrito}>
              {item.es_reparacion ? (
                <View style={[styles.productImage, { backgroundColor: '#f0f5ff', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="hardware-chip" size={24} color={LOGO_BLUE} />
                </View>
              ) : item.imagen_url && item.imagen_url.trim() !== '' ? (
                <Image 
                  source={{ uri: item.imagen_url }} 
                  style={styles.productImage} 
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.productImage, styles.placeholderImage]}>
                  <Ionicons name="game-controller-outline" size={24} color="#bdc3c7" />
                </View>
              )}

              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.nombre}</Text>
                <Text style={styles.itemSub}>
                  {/* Formato de comas en el detalle del artículo */}
                  {formatoMoneda(item.precio_venta)} {item.es_reparacion ? '' : `x ${item.cantidad_venta}`}
                </Text>
              </View>
              {/* Formato de comas en el total del artículo */}
              <Text style={styles.itemTotal}>{formatoMoneda(item.cantidad_venta * item.precio_venta)}</Text>
              
              <TouchableOpacity onPress={() => actualizarCarrito(carrito.filter(c => c.id !== item.id))} style={{padding: 5}}>
                <Ionicons name="trash-outline" size={22} color="#e74c3c" />
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.footerVenta}>
          <Text style={styles.metodoLabel}>MÉTODO DE PAGO</Text>
          <View style={styles.metodoContainer}>
            <TouchableOpacity 
              style={[styles.metodoBtn, metodoPago === 'EFECTIVO' && styles.metodoBtnActive]}
              onPress={() => setMetodoPago('EFECTIVO')}
            >
              <Ionicons name="cash-outline" size={18} color={metodoPago === 'EFECTIVO' ? '#fff' : '#64748b'} />
              <Text style={[styles.metodoBtnText, metodoPago === 'EFECTIVO' && styles.metodoTextActive]}>EFECTIVO</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.metodoBtn, metodoPago === 'TRANSFERENCIA' && styles.metodoBtnActive]}
              onPress={() => setMetodoPago('TRANSFERENCIA')}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={metodoPago === 'TRANSFERENCIA' ? '#fff' : '#64748b'} />
              <Text style={[styles.metodoBtnText, metodoPago === 'TRANSFERENCIA' && styles.metodoTextActive]}>TRANSF.</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.metodoBtn, metodoPago === 'TARJETA' && styles.metodoBtnActive]}
              onPress={() => setMetodoPago('TARJETA')}
            >
              <Ionicons name="card-outline" size={18} color={metodoPago === 'TARJETA' ? '#fff' : '#64748b'} />
              <Text style={[styles.metodoBtnText, metodoPago === 'TARJETA' && styles.metodoTextActive]}>TARJETA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            {/* Formato de comas en el Total General */}
            <Text style={styles.totalAmount}>{formatoMoneda(calcularTotal())}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.btnFinalizar, (carrito.length === 0 || procesando) && {backgroundColor: '#ccc'}]} 
            onPress={finalizarVenta}
            disabled={carrito.length === 0 || procesando}
          >
            {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>COBRAR</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={mostrarCamara} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.overlay}>
            <View style={styles.scanTarget} />
            <TouchableOpacity style={styles.closeCam} onPress={() => setMostrarCamara(false)}>
              <Text style={styles.closeCamText}>CERRAR CÁMARA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL DE ÉXITO Y TICKET WHATSAPP --- */}
      <Modal visible={ticketGenerado !== null} animationType="slide" transparent={true}>
        <View style={styles.modalSuccessOverlay}>
          <View style={styles.modalSuccessContent}>
            
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={50} color="#fff" />
            </View>
            
            <Text style={styles.successTitle}>¡Cobro Exitoso!</Text>
            {/* Formato de comas en el mensaje de Éxito */}
            <Text style={styles.successAmount}>{formatoMoneda(ticketGenerado?.total || 0)}</Text>
            <Text style={styles.successMetodo}>Pagado con {ticketGenerado?.metodo}</Text>

            <View style={styles.successDivider} />

            <TouchableOpacity style={styles.btnWhatsapp} onPress={enviarTicketWhatsApp}>
              <Ionicons name="logo-whatsapp" size={24} color="#fff" />
              <Text style={styles.btnWhatsappText}>Enviar Ticket por WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnVolver} onPress={cerrarYVolver}>
              <Text style={styles.btnVolverText}>Ir al Inicio</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  headerSimple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  content: { flex: 1, padding: 20 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  manualInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
  input: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1e293b', fontWeight: '600', borderWidth: 0, padding: 0, margin: 0 },
  cameraBtn: { backgroundColor: LOGO_BLUE, padding: 12, borderRadius: 12 },
  
  sugerenciasWrapper: {
    position: 'absolute',
    top: 55, 
    left: 0,
    right: 55, 
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    zIndex: 100,
  },
  sugerenciaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sugerenciaNombre: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  sugerenciaStock: { fontSize: 11, color: '#94a3b8' },
  sugerenciaPrecio: { fontSize: 15, fontWeight: '900', color: '#2ecc71' },
  sugerenciaImg: { width: 40, height: 40, borderRadius: 8 },
  placeholderSugerencia: { backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },

  itemCarrito: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 10, elevation: 1 },
  productImage: { width: 50, height: 50, borderRadius: 10 },
  placeholderImage: { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  itemName: { fontSize: 14, fontWeight: 'bold' },
  itemSub: { fontSize: 13, color: '#64748b' },
  itemTotal: { fontSize: 17, fontWeight: '800', color: LOGO_BLUE, marginRight: 15 },
  
  footerVenta: { backgroundColor: '#fff', padding: 15, borderRadius: 25, elevation: 10, marginTop: 10 },
  metodoLabel: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 8, textAlign: 'center', letterSpacing: 1 },
  metodoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  metodoBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginHorizontal: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  metodoBtnActive: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  metodoBtnText: { marginTop: 4, fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  metodoTextActive: { color: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontWeight: 'bold', color: '#94a3b8' },
  totalAmount: { fontSize: 26, fontWeight: '900' },
  btnFinalizar: { backgroundColor: LOGO_BLUE, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 280, height: 180, borderWidth: 2, borderColor: LOGO_BLUE, borderRadius: 20, backgroundColor: 'transparent' },
  closeCam: { position: 'absolute', bottom: 50, backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 10 },
  closeCamText: { color: '#fff', fontWeight: 'bold' },

  modalSuccessOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalSuccessContent: { backgroundColor: '#fff', width: '100%', borderRadius: 25, padding: 30, alignItems: 'center', elevation: 10 },
  successIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#2ecc71', justifyContent: 'center', alignItems: 'center', marginTop: -60, marginBottom: 20, borderWidth: 6, borderColor: '#fff' },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 5 },
  successAmount: { fontSize: 40, fontWeight: '900', color: LOGO_BLUE, marginVertical: 10 },
  successMetodo: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
  successDivider: { width: '100%', height: 1, backgroundColor: '#e2e8f0', marginVertical: 25 },
  
  btnWhatsapp: { flexDirection: 'row', backgroundColor: WHATSAPP_GREEN, width: '100%', padding: 16, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 2 },
  btnWhatsappText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  btnVolver: { width: '100%', padding: 16, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  btnVolverText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 }
});