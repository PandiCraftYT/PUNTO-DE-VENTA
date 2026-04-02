import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TextInput, 
  TouchableOpacity, ActivityIndicator, Platform, Modal, Image, FlatList, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import { supabase } from '../lib/supabase';

// --- IMPORTAMOS NUESTRA HERRAMIENTA ---
import { formatoMoneda } from '../lib/helpers';

const LOGO_BLUE = '#0056FF';

export default function ChecadorScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [productoEncontrado, setProductoEncontrado] = useState<any>(null);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  
  // Cámara
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mostrarCamara, setMostrarCamara] = useState(false);

  // Truco para búsqueda rápida por nombre
  const [inventarioCache, setInventarioCache] = useState<any[]>([]);

  useEffect(() => {
    cargarInventarioRapido();
  }, []);

  const cargarInventarioRapido = async () => {
    const { data } = await supabase.from('productos').select('id, nombre, codigo_barras, precio_venta, stock, imagen_url, localizacion');
    if (data) setInventarioCache(data);
  };

  const manejarEscritura = (texto: string) => {
    setBusqueda(texto);
    setProductoEncontrado(null); // Limpiamos la pantalla grande
    
    const txt = texto.trim().toLowerCase();
    if (txt.length > 2) {
      const filtrados = inventarioCache.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(txt)) || 
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(txt))
      );
      setSugerencias(filtrados);
    } else {
      setSugerencias([]);
    }
  };

  const buscarPorCodigoExacto = async (codigo: string) => {
    const cleanCode = codigo.trim();
    if (!cleanCode) return;
    Keyboard.dismiss();
    setCargando(true);
    setSugerencias([]);
    
    // Buscar primero en caché
    const prodLocal = inventarioCache.find(p => p.codigo_barras === cleanCode);
    
    if (prodLocal) {
      setProductoEncontrado(prodLocal);
      setCargando(false);
      return;
    }

    // Respaldo en BD
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('id, nombre, codigo_barras, precio_venta, stock, imagen_url, localizacion')
        .eq('codigo_barras', cleanCode)
        .single();

      if (data) {
        setProductoEncontrado(data);
      } else {
        setProductoEncontrado({ noEncontrado: true });
      }
    } catch (err) {
      setProductoEncontrado({ noEncontrado: true });
    } finally {
      setCargando(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setMostrarCamara(false);
    setBusqueda(data);
    buscarPorCodigoExacto(data);
    setTimeout(() => setScanned(false), 2000);
  };

  const seleccionarSugerencia = (prod: any) => {
    setBusqueda('');
    setSugerencias([]);
    setProductoEncontrado(prod);
    Keyboard.dismiss(); // <-- Obliga al teclado a esconderse
  };

  const limpiar = () => {
    setBusqueda('');
    setSugerencias([]);
    setProductoEncontrado(null);
    Keyboard.dismiss(); // <-- Escondemos el teclado en lugar de forzarlo a abrirse
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHECADOR DE PRECIOS</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <View style={styles.inputBox}>
            <Ionicons name="search" size={22} color={LOGO_BLUE} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Escanea o escribe el nombre..."
              value={busqueda}
              onChangeText={manejarEscritura}
              onSubmitEditing={() => buscarPorCodigoExacto(busqueda)}
              {...(Platform.OS === 'web' && { outlineStyle: 'none' } as any)}
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={limpiar}>
                <Ionicons name="close-circle" size={22} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={styles.cameraBtn}
            onPress={async () => {
              const res = await requestPermission();
              if (res.granted) setMostrarCamara(true);
            }}
          >
            <Ionicons name="barcode-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* LISTA DE SUGERENCIAS */}
        {sugerencias.length > 0 && !productoEncontrado && (
          <FlatList
            data={sugerencias}
            keyExtractor={item => item.id}
            style={styles.listaSugerencias}
            keyboardShouldPersistTaps="handled"
            renderItem={({item}) => (
              <TouchableOpacity style={styles.sugerenciaItem} onPress={() => seleccionarSugerencia(item)}>
                <View style={styles.sugerenciaIcon}>
                  <Ionicons name="pricetag-outline" size={20} color="#94a3b8" />
                </View>
                <Text style={styles.sugerenciaNombre} numberOfLines={1}>{item.nombre}</Text>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          />
        )}

        {/* RESULTADO DE LA BÚSQUEDA */}
        <View style={styles.resultadoContainer}>
          {cargando ? (
            <ActivityIndicator size="large" color={LOGO_BLUE} />
          ) : productoEncontrado ? (
            productoEncontrado.noEncontrado ? (
              <View style={styles.noEncontradoBox}>
                <Ionicons name="alert-circle-outline" size={80} color="#cbd5e1" />
                <Text style={styles.noEncontradoText}>Producto no encontrado</Text>
                <Text style={styles.noEncontradoSub}>Verifica el código o intenta buscar por nombre.</Text>
                <TouchableOpacity style={styles.btnVolver} onPress={limpiar}>
                  <Text style={styles.btnVolverText}>Buscar otro</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tarjetaProducto}>
                {productoEncontrado.imagen_url && productoEncontrado.imagen_url.trim() !== '' ? (
                  <Image source={{ uri: productoEncontrado.imagen_url }} style={styles.imagenGrande} resizeMode="contain" />
                ) : (
                  <View style={[styles.imagenGrande, styles.imagenPlaceholder]}>
                    <Ionicons name="image-outline" size={60} color="#cbd5e1" />
                  </View>
                )}
                
                <Text style={styles.nombreProducto} numberOfLines={2} adjustsFontSizeToFit>{productoEncontrado.nombre}</Text>
                <Text style={styles.codigoText}>Cód: {productoEncontrado.codigo_barras || 'N/A'}</Text>
                
                <View style={styles.divisor} />
                
                <Text style={styles.precioLabel}>PRECIO DE VENTA</Text>
                {/* --- APLICAMOS EL FORMATO DE MONEDA AQUÍ --- */}
                <Text style={styles.precioGrande}>{formatoMoneda(productoEncontrado.precio_venta)}</Text>

                <View style={styles.infoRow}>
                  <View style={styles.infoPill}>
                    <Ionicons name="cube" size={16} color={productoEncontrado.stock > 0 ? "#2ecc71" : "#e74c3c"} />
                    <Text style={[styles.infoPillText, { color: productoEncontrado.stock > 0 ? "#2ecc71" : "#e74c3c" }]}>
                      {productoEncontrado.stock > 0 ? `${productoEncontrado.stock} en stock` : 'AGOTADO'}
                    </Text>
                  </View>
                  <View style={[styles.infoPill, { backgroundColor: '#f1f5f9' }]}>
                    <Ionicons name="location" size={16} color="#64748b" />
                    <Text style={[styles.infoPillText, { color: '#64748b' }]}>{productoEncontrado.localizacion}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.btnLimpiar} onPress={limpiar}>
                  <Text style={styles.btnLimpiarText}>Nueva Búsqueda</Text>
                </TouchableOpacity>
              </View>
            )
          ) : sugerencias.length === 0 && busqueda === '' ? (
            <View style={styles.pantallaEspera}>
              <Ionicons name="barcode-outline" size={100} color="#e2e8f0" />
              <Text style={styles.esperaText}>Escanea un código de barras para ver el precio</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* CÁMARA */}
      <Modal visible={mostrarCamara} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.overlayCamara}>
            <View style={styles.scanTarget} />
            <TouchableOpacity style={styles.closeCamBtn} onPress={() => setMostrarCamara(false)}>
              <Text style={styles.closeCamText}>CERRAR CÁMARA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  content: { flex: 1, padding: 20 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, height: 60, borderRadius: 15, borderWidth: 2, borderColor: LOGO_BLUE, marginRight: 10, elevation: 4, shadowColor: LOGO_BLUE, shadowOpacity: 0.2, shadowRadius: 5 },
  input: { flex: 1, marginLeft: 10, fontSize: 18, color: '#1e293b', fontWeight: '600' },
  cameraBtn: { backgroundColor: LOGO_BLUE, height: 60, width: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 4 },

  listaSugerencias: { backgroundColor: '#fff', borderRadius: 15, maxHeight: 250, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  sugerenciaItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sugerenciaIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sugerenciaNombre: { flex: 1, fontSize: 16, color: '#334155', fontWeight: '500' },

  resultadoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pantallaEspera: { alignItems: 'center', opacity: 0.6 },
  esperaText: { fontSize: 18, color: '#94a3b8', fontWeight: '600', textAlign: 'center', marginTop: 20, paddingHorizontal: 40 },
  
  noEncontradoBox: { alignItems: 'center', backgroundColor: '#fff', padding: 40, borderRadius: 20, width: '100%', elevation: 2 },
  noEncontradoText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 15 },
  noEncontradoSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 5, marginBottom: 25 },
  btnVolver: { backgroundColor: '#f1f5f9', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
  btnVolverText: { color: '#475569', fontWeight: 'bold', fontSize: 16 },

  tarjetaProducto: { backgroundColor: '#fff', width: '100%', borderRadius: 25, padding: 25, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 15 },
  imagenGrande: { width: 150, height: 150, borderRadius: 20, marginBottom: 20 },
  imagenPlaceholder: { backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#f1f5f9', borderStyle: 'dashed' },
  nombreProducto: { fontSize: 24, fontWeight: '900', color: '#1e293b', textAlign: 'center', marginBottom: 5 },
  codigoText: { fontSize: 13, color: '#94a3b8', fontWeight: 'bold', marginBottom: 20 },
  divisor: { width: '100%', height: 2, backgroundColor: '#f1f5f9', borderStyle: 'dashed', marginBottom: 20 },
  precioLabel: { fontSize: 12, fontWeight: '800', color: LOGO_BLUE, letterSpacing: 1 },
  precioGrande: { fontSize: 55, fontWeight: '900', color: '#1e293b', marginVertical: 5 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginTop: 15, marginBottom: 25 },
  infoPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginHorizontal: 5 },
  infoPillText: { fontWeight: 'bold', fontSize: 13, marginLeft: 5 },

  btnLimpiar: { backgroundColor: LOGO_BLUE, width: '100%', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnLimpiarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  overlayCamara: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 280, height: 180, borderWidth: 3, borderColor: LOGO_BLUE, borderRadius: 20, backgroundColor: 'transparent' },
  closeCamBtn: { position: 'absolute', bottom: 50, backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15 },
  closeCamText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});