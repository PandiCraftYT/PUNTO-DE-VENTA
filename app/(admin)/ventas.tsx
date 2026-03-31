import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TextInput, 
  FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, Modal, Image, Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import * as Location from 'expo-location'; 
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context'; 

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
  
  // ESTADOS CÁMARA
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mostrarCamara, setMostrarCamara] = useState(false);

  // ESTADO PARA EL TICKET FINAL
  const [ticketGenerado, setTicketGenerado] = useState<any>(null);

  // --- NUEVA FUNCIÓN PARA ACTUALIZAR CARRITO Y MEMORIA AL MISMO TIEMPO ---
  const actualizarCarrito = (nuevoCarrito: any[] | ((prev: any[]) => any[])) => {
    setCarritoLocal((prev) => {
      const actualizado = typeof nuevoCarrito === 'function' ? nuevoCarrito(prev) : nuevoCarrito;
      carritoGuardado = actualizado; // Lo guardamos en la memoria global para que no se pierda
      return actualizado;
    });
  };

  // ATRAPAR REPARACIÓN DEL TALLER
  useEffect(() => {
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

  const buscarProducto = async (codigo: string) => {
    const cleanCode = codigo.trim();
    if (!cleanCode) return;

    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo_barras', cleanCode)
        .single();

      if (error || !data) {
        Alert.alert("No encontrado", "El código no existe.");
        setCodigoBusqueda('');
        return;
      }

      if (data.stock <= 0) {
        Alert.alert("Sin stock", "Producto agotado.");
        setCodigoBusqueda('');
        return;
      }

      agregarAlCarrito(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCodigoBusqueda('');
    }
  };

  const agregarAlCarrito = (producto: any) => {
    actualizarCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      const precioReal = producto.precio_venta || producto.precio || 0;

      if (existe) {
        if (existe.cantidad_venta >= producto.stock && !existe.es_reparacion) {
          Alert.alert("Límite", "No hay más stock.");
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
    buscarProducto(data);
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

      setTicketGenerado({
        total: totalVenta,
        metodo: metodoPago,
        productos: carrito,
        fecha: new Date()
      });
      
      actualizarCarrito([]); // Vaciamos el carrito (y la memoria global) ahora que ya se cobró
      
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
      mensaje += `▪️ ${p.cantidad_venta}x ${p.nombre} ($${(p.precio_venta * p.cantidad_venta).toFixed(2)})\n`;
    });

    mensaje += `\n💰 *Total Pagado:* $${ticketGenerado.total.toFixed(2)}`;
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
        <View style={styles.inputContainer}>
          <View style={styles.manualInputBox}>
            <Ionicons name="pencil-outline" size={20} color={LOGO_BLUE} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Escribir código del producto..."
              placeholderTextColor="#94a3b8"
              value={codigoBusqueda}
              onChangeText={setCodigoBusqueda}
              onSubmitEditing={() => buscarProducto(codigoBusqueda)}
              underlineColorAndroid="transparent"
              {...(Platform.OS === 'web' && { outlineStyle: 'none', borderWidth: 0 } as any)}
            />
          </View>
          <TouchableOpacity 
            style={styles.cameraBtn} 
            onPress={async () => {
              const res = await requestPermission();
              if (res.granted) setMostrarCamara(true);
              else Alert.alert("Permiso", "Se requiere cámara.");
            }}
          >
            <Ionicons name="camera" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={carrito}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemCarrito}>
              {item.es_reparacion ? (
                <View style={[styles.productImage, { backgroundColor: '#f0f5ff', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="hardware-chip" size={24} color={LOGO_BLUE} />
                </View>
              ) : item.imagen_url ? (
                <Image 
                  source={{ uri: item.imagen_url }} 
                  style={styles.productImage} 
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.productImage, styles.placeholderImage]}>
                  <Ionicons name="image-outline" size={24} color="#bdc3c7" />
                </View>
              )}

              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.nombre}</Text>
                <Text style={styles.itemSub}>
                  ${parseFloat(item.precio_venta).toFixed(2)} {item.es_reparacion ? '' : `x ${item.cantidad_venta}`}
                </Text>
              </View>
              <Text style={styles.itemTotal}>${(item.cantidad_venta * item.precio_venta).toFixed(2)}</Text>
              
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
            <Text style={styles.totalAmount}>${calcularTotal().toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.btnFinalizar, (carrito.length === 0 || procesando) && {backgroundColor: '#ccc'}]} 
            onPress={finalizarVenta}
            disabled={carrito.length === 0 || procesando}
          >
            {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>COBRAR MÚLTIPLES</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={mostrarCamara} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128"] }}
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
            <Text style={styles.successAmount}>${ticketGenerado?.total.toFixed(2)}</Text>
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
  inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  manualInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
  input: { flex: 1, marginLeft: 10, fontSize: 14, color: '#1e293b', fontWeight: '500', borderWidth: 0, padding: 0, margin: 0 },
  cameraBtn: { backgroundColor: LOGO_BLUE, padding: 12, borderRadius: 12 },
  itemCarrito: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 10, elevation: 1 },
  productImage: { width: 50, height: 50, borderRadius: 10 },
  placeholderImage: { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  itemName: { fontSize: 14, fontWeight: 'bold' },
  itemSub: { fontSize: 13, color: '#64748b' },
  itemTotal: { fontSize: 17, fontWeight: '800', color: LOGO_BLUE, marginRight: 15 },
  footerVenta: { backgroundColor: '#fff', padding: 15, borderRadius: 25, elevation: 10 },
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