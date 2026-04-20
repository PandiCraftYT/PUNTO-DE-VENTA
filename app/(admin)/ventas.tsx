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
import { formatoMoneda } from './../lib/helpers'; 

// --- AGREGA ESTAS LÍNEAS AQUÍ ---
const LOGO_BLUE = '#0056FF';
const WHATSAPP_GREEN = '#25D366';
// -------------------------------

let carritoGuardado: any[] = [];

export default function VentasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const { usuario } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [carrito, setCarritoLocal] = useState<any[]>(carritoGuardado);
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'>('EFECTIVO');
  
  const [inventario, setInventario] = useState<any[]>([]);
  const [sugerencias, setSugerencias] = useState<any[]>([]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  const [ticketGenerado, setTicketGenerado] = useState<any>(null);

  const cargarInventarioLocal = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*').gt('stock', 0);
      if (!error && data) setInventario(data);
    } catch (err) { console.log(err); }
  };

  useFocusEffect(useCallback(() => { cargarInventarioLocal(); }, []));

  const actualizarCarrito = (nuevoCarrito: any[] | ((prev: any[]) => any[])) => {
    setCarritoLocal((prev) => {
      const actualizado = typeof nuevoCarrito === 'function' ? nuevoCarrito(prev) : nuevoCarrito;
      carritoGuardado = actualizado;
      return actualizado;
    });
  };

  const manejarEscritura = (texto: string) => {
    setCodigoBusqueda(texto);
    const txt = texto.trim().toLowerCase();
    if (txt.length > 0) {
      const filtrados = inventario.filter(p => 
        (p.nombre?.toLowerCase().includes(txt)) || (p.codigo_barras?.toLowerCase().includes(txt))
      );
      setSugerencias(filtrados);
    } else { setSugerencias([]); }
  };

  const agregarAlCarrito = (producto: any) => {
    actualizarCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        if (existe.cantidad_venta >= producto.stock) {
          Alert.alert("Sin existencias", `Solo quedan ${producto.stock} unidades.`);
          return prev;
        }
        return prev.map(item => item.id === producto.id ? { ...item, cantidad_venta: item.cantidad_venta + 1 } : item);
      }
      return [...prev, { ...producto, cantidad_venta: 1 }];
    });
    setCodigoBusqueda('');
    setSugerencias([]);
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    setProcesando(true);
    
    try {
      const totalVenta = carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad_venta), 0);
      
      // 1. REGISTRAR ENCABEZADO DE VENTA
      const { data: ventaData, error: errorVenta } = await supabase
        .from('ventas')
        .insert([{
          total: totalVenta,
          vendedor_nombre: usuario?.nombre || 'Cajero',
          metodo_pago: metodoPago,
          // Mantenemos el JSON por compatibilidad, pero la tabla detalles_venta es la prioritaria
          productos_json: carrito 
        }])
        .select()
        .single();

      if (errorVenta) throw errorVenta;

      // 2. REGISTRAR DETALLES Y ACTUALIZAR STOCK (Transacción lógica)
      for (const item of carrito) {
        // Guardar partida individual
        await supabase.from('detalles_venta').insert({
          venta_id: ventaData.id,
          producto_id: item.id,
          cantidad: item.cantidad_venta,
          precio_unitario: item.precio_venta
        });

        // Descontar del inventario
        await supabase.from('productos').update({ stock: item.stock - item.cantidad_venta }).eq('id', item.id);
      }

      setTicketGenerado({ total: totalVenta, metodo: metodoPago, productos: carrito, fecha: new Date() });
      actualizarCarrito([]); 
      cargarInventarioLocal();
      
    } catch (err: any) {
      Alert.alert("Error en cobro", err.message);
    } finally { setProcesando(false); }
  };

  const enviarTicketWhatsApp = () => {
    if (!ticketGenerado) return;
    let msj = `🛒 *TICKET DE COMPRA* 🧾\n\n`;
    ticketGenerado.productos.forEach((p: any) => {
      msj += `• ${p.cantidad_venta}x ${p.nombre} (${formatoMoneda(p.precio_venta * p.cantidad_venta)})\n`;
    });
    msj += `\n💰 *Total:* ${formatoMoneda(ticketGenerado.total)}\n💳 *Método:* ${ticketGenerado.metodo}\n\n¡Gracias!`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msj)}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSimple}>
<TouchableOpacity onPress={() => router.push('/(admin)')}> 
  <Ionicons name="arrow-back" size={28} color="#333" />
</TouchableOpacity>        <Text style={styles.headerTitle}>CAJA DE COBRO</Text>
        <TouchableOpacity onPress={() => actualizarCarrito([])}><Ionicons name="trash-outline" size={24} color="#e74c3c" /></TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={{ zIndex: 10 }}> 
          <View style={styles.inputContainer}>
            <View style={styles.manualInputBox}>
              <Ionicons name="search" size={20} color={LOGO_BLUE} />
              <TextInput
                style={styles.input}
                placeholder="Buscar producto..."
                value={codigoBusqueda}
                onChangeText={manejarEscritura}
              />
            </View>
            <TouchableOpacity style={styles.cameraBtn} onPress={async () => {
                const res = await requestPermission();
                if (res.granted) setMostrarCamara(true);
            }}>
              <Ionicons name="barcode-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {sugerencias.length > 0 && (
            <View style={styles.sugerenciasWrapper}>
              {sugerencias.map((item) => (
                <TouchableOpacity key={item.id} style={styles.sugerenciaRow} onPress={() => agregarAlCarrito(item)}>
                  <Text style={styles.sugerenciaNombre}>{item.nombre}</Text>
                  <Text style={styles.sugerenciaPrecio}>{formatoMoneda(item.precio_venta)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <FlatList
          data={carrito}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.itemCarrito}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.nombre}</Text>
                <Text style={styles.itemSub}>{item.cantidad_venta} x {formatoMoneda(item.precio_venta)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatoMoneda(item.cantidad_venta * item.precio_venta)}</Text>
            </View>
          )}
        />

        <View style={styles.footerVenta}>
          <View style={styles.metodoContainer}>
            {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((m: any) => (
              <TouchableOpacity 
                key={m} 
                style={[styles.metodoBtn, metodoPago === m && styles.metodoBtnActive]}
                onPress={() => setMetodoPago(m)}
              >
                <Text style={[styles.metodoBtnText, metodoPago === m && {color: '#fff'}]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalAmount}>{formatoMoneda(carrito.reduce((a, b) => a + (b.precio_venta * b.cantidad_venta), 0))}</Text>
          </View>
          <TouchableOpacity style={styles.btnFinalizar} onPress={finalizarVenta} disabled={procesando || carrito.length === 0}>
            {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>CONFIRMAR COBRO</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de éxito profesional */}
      <Modal visible={ticketGenerado !== null} animationType="slide" transparent={true}>
        <View style={styles.modalSuccessOverlay}>
          <View style={styles.modalSuccessContent}>
            <Ionicons name="checkmark-circle" size={80} color="#2ecc71" />
            <Text style={styles.successTitle}>¡VENTA REALIZADA!</Text>
            <Text style={styles.successAmount}>{formatoMoneda(ticketGenerado?.total || 0)}</Text>
            <TouchableOpacity style={styles.btnWhatsapp} onPress={enviarTicketWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.btnWhatsappText}>Enviar Comprobante</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnVolver} onPress={() => {setTicketGenerado(null); router.replace('/(admin)');}}>
              <Text>Finalizar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  headerSimple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  content: { flex: 1, padding: 20 },
  inputContainer: { flexDirection: 'row', marginBottom: 15 },
  manualInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginRight: 10 },
  input: { flex: 1, marginLeft: 10, fontSize: 15 },
  cameraBtn: { backgroundColor: LOGO_BLUE, padding: 12, borderRadius: 12, justifyContent: 'center' },
  sugerenciasWrapper: { position: 'absolute', top: 60, left: 0, right: 60, backgroundColor: '#fff', borderRadius: 12, elevation: 5, zIndex: 100 },
  sugerenciaRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sugerenciaNombre: { fontWeight: 'bold' }, 
  sugerenciaPrecio: { fontSize: 15, fontWeight: '900', color: '#2ecc71' },
  itemCarrito: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  itemName: { fontWeight: 'bold', fontSize: 14 },
  itemSub: { color: '#666', fontSize: 12 },
  itemTotal: { fontWeight: '900', color: LOGO_BLUE },
  footerVenta: { backgroundColor: '#fff', padding: 20, borderRadius: 20, elevation: 10 },
  metodoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metodoBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 10, backgroundColor: '#f8fafc', marginHorizontal: 2, borderWidth: 1, borderColor: '#eee' },
  metodoBtnActive: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  metodoBtnText: { fontSize: 10, fontWeight: 'bold', color: '#666' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  totalLabel: { fontSize: 12, fontWeight: 'bold', color: '#999' },
  totalAmount: { fontSize: 28, fontWeight: '900' },
  btnFinalizar: { backgroundColor: LOGO_BLUE, padding: 18, borderRadius: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  modalSuccessOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalSuccessContent: { backgroundColor: '#fff', width: '85%', borderRadius: 25, padding: 30, alignItems: 'center' },
  successTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 10 },
  successAmount: { fontSize: 36, fontWeight: '900', color: LOGO_BLUE, marginVertical: 15 },
  btnWhatsapp: { flexDirection: 'row', backgroundColor: '#25D366', padding: 15, borderRadius: 12, width: '100%', justifyContent: 'center', alignItems: 'center' },
  btnWhatsappText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
  btnVolver: { marginTop: 20 }
});