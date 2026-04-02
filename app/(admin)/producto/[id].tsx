import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, SafeAreaView, Platform, Image, Modal 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase'; 
import { useAuth } from '../../lib/auth_context'; 
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print'; 

const LOGO_BLUE = '#0056FF';
const RED_DELETE = '#FF3B30';
const GREEN_CREATE = '#2ecc71';

export default function EditarProductoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const { usuario } = useAuth(); 

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [datosOriginales, setDatosOriginales] = useState<any>(null);

  // --- ESTADOS DEL FORMULARIO ---
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState(''); 
  const [localizacion, setLocalizacion] = useState('HUIZACHES'); 
  const [precioVenta, setPrecioVenta] = useState('');
  const [precioCosto, setPrecioCosto] = useState('');
  const [stock, setStock] = useState('');
  const [categoria, setCategoria] = useState(''); 
  const [imagenUri, setImagenUri] = useState<string | null>(null);

  // --- ESTADO PARA EL MODAL DEL HISTORIAL ---
  const [modalHistorial, setModalHistorial] = useState(false);

  // 1. CARGAR DATOS
  useEffect(() => {
    if (id) cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*').eq('id', id).single();
      if (error) throw error;
      
      if (data) {
        setDatosOriginales(data);
        setCodigoBarras(data.codigo_barras || '');
        setNombre(data.nombre || '');
        setDescripcion(data.descripcion || ''); 
        setLocalizacion(data.localizacion || 'HUIZACHES');
        setPrecioVenta(data.precio_venta?.toString() || '0');
        setPrecioCosto(data.precio_costo?.toString() || '0');
        setStock(data.stock?.toString() || '0');
        setCategoria(data.categoria || '');
        setImagenUri(data.imagen_url || null);
      }
    } catch (error: any) {
      console.error("Error cargando:", error.message);
      if (Platform.OS === 'web') window.alert("No se pudo conectar con la base de datos.");
      else Alert.alert("Error", "No se pudo conectar con la base de datos.");
    } finally { 
      setCargando(false); 
    }
  };

  // 2. CAMBIAR FOTO
  const handleCambiarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permiso", "Necesitamos acceso a tus fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setImagenUri(result.assets[0].uri);
  };

  // 3. GENERAR E IMPRIMIR CÓDIGO
  const generarCodigo = () => {
    const randomCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    setCodigoBarras(randomCode);
  };

  const imprimirEtiqueta = async () => {
    if (!codigoBarras) {
      Alert.alert("Error", "No hay código para imprimir.");
      return;
    }
    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${codigoBarras.trim()}&scale=3&rotate=N&includetext`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 0; font-family: sans-serif; }
            .container { text-align: center; border: 1px dashed #ccc; padding: 20px; width: 300px; }
            .nombre { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
            .barcode { width: 250px; height: auto; }
            .precio { font-size: 24px; font-weight: bold; margin-top: 10px; color: ${LOGO_BLUE}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="nombre">${nombre}</div>
            <img class="barcode" src="${barcodeUrl}" onload="window.print();" />
            <div class="precio">$${precioVenta}</div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { if (window.location.search.includes('print')) window.print(); }, 500); };
          </script>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        const win = window.open('', '_blank');
        if (win) { win.document.write(htmlContent); win.document.close(); }
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo generar la etiqueta.");
    }
  };

  // 4. GUARDAR CAMBIOS (REGISTRAMOS EL HISTORIAL)
  const handleGuardar = async () => {
    setProcesando(true);
    try {
      let finalImageUrl = imagenUri;

      // Si la imagen empieza con file:// o data:image (si es web), hay que subirla
      if (imagenUri && (imagenUri.startsWith('file://') || imagenUri.startsWith('data:image'))) {
        const fileExt = imagenUri.split('.').pop() || 'jpg';
        // Generamos un nombre único y limpio
        const fileName = `${id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `productos/${fileName}`;
        
        const response = await fetch(imagenUri);
        const blob = await response.blob();
        
        // Subimos la imagen
        const { error: uploadError } = await supabase.storage.from('inventario').upload(filePath, blob, { upsert: true });
        if (uploadError) throw uploadError;

        // --- LA MAGIA CORREGIDA PARA OBTENER LA URL ---
        const { data } = supabase.storage.from('inventario').getPublicUrl(filePath);
        finalImageUrl = data.publicUrl;
      }

      const historialAnterior = datosOriginales?.historial_cambios || [];
      const nuevoRegistro = {
        fecha: new Date().toISOString(),
        usuario: usuario?.nombre || 'Desconocido',
        rol: usuario?.rol || 'Empleado',
        accion: 'Editó el producto'
      };
      const nuevoHistorial = [nuevoRegistro, ...historialAnterior];

      const { error } = await supabase
        .from('productos')
        .update({
          codigo_barras: codigoBarras.trim() || null,
          nombre: nombre,
          descripcion: descripcion, 
          localizacion: localizacion,
          precio_venta: parseFloat(precioVenta) || 0,
          precio_costo: parseFloat(precioCosto) || 0,
          stock: parseInt(stock) || 0,
          categoria: categoria,
          imagen_url: finalImageUrl, // Ahora sí guardará el enlace de internet
          historial_cambios: nuevoHistorial 
        })
        .eq('id', id);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert("¡Producto actualizado con éxito!");
        router.replace('/(admin)/productos');
      } else {
        Alert.alert("Éxito", "Producto actualizado", [{ text: "OK", onPress: () => router.replace('/(admin)/productos') }]);
      }
    } catch (error: any) {
      if (Platform.OS === 'web') window.alert("Error guardando foto: " + error.message);
      else Alert.alert("Error", error.message);
    } finally { 
      setProcesando(false); 
    }
  };

  // 5. ELIMINAR
  const handleEliminar = () => {
    if (Platform.OS === 'web') {
      const confirmar = window.confirm(`¿Seguro que quieres eliminar "${nombre}" para siempre?`);
      if (confirmar) ejecutarBorrado();
    } else {
      Alert.alert("¿Borrar?", `¿Eliminar "${nombre}"?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, borrar", style: "destructive", onPress: ejecutarBorrado }
      ]);
    }
  };

  const ejecutarBorrado = async () => {
    setProcesando(true);
    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      
      if (Platform.OS === 'web') window.alert("Producto eliminado.");
      router.replace('/(admin)/productos');
    } catch (error: any) {
      if (Platform.OS === 'web') window.alert("Error: " + error.message);
      else Alert.alert("Error al borrar", error.message);
    } finally { 
      setProcesando(false); 
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator size="large" color={LOGO_BLUE} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backText}> Atrás</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.label}>IMAGEN DEL PRODUCTO</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handleCambiarFoto}>
          {imagenUri ? (
            <Image source={{ uri: imagenUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="camera" size={40} color="#bdc3c7" />
              <Text style={styles.placeholderText}>Añadir foto</Text>
            </View>
          )}
          {imagenUri && (
             <View style={styles.changeBadge}>
                <Ionicons name="pencil" size={14} color="#FFF" />
                <Text style={styles.changeBadgeText}>Cambiar</Text>
             </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>CÓDIGO DE BARRAS / SKU</Text>
        <View style={styles.barcodeRow}>
          <TextInput 
            style={[styles.input, { flex: 1, marginRight: 10 }]} 
            placeholder="CÓDIGO DE BARRAS / SKU..."  
            placeholderTextColor="#a0aec0"
            value={codigoBarras} 
            onChangeText={setCodigoBarras} 
          />
          <TouchableOpacity style={styles.generateBtn} onPress={generarCodigo}>
            <Ionicons name="barcode-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.printMiniBtn} onPress={imprimirEtiqueta}>
            <Ionicons name="print" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>NOMBRE *</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholderTextColor="#a0aec0" />

        <Text style={styles.label}>DESCRIPCIÓN</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={descripcion} onChangeText={setDescripcion} placeholderTextColor="#a0aec0" multiline />

        <Text style={styles.label}>CATEGORÍA</Text>
        <TextInput style={styles.input} value={categoria} onChangeText={setCategoria} placeholder="Ej: Gorras, Videojuegos..." />

        <Text style={styles.label}>LOCALIZACIÓN</Text>
        <View style={styles.rowSelector}>
          <TouchableOpacity 
            style={[styles.tab, localizacion === 'HUIZACHES' && styles.tabActive]}
            onPress={() => setLocalizacion('HUIZACHES')}
          >
            <Text style={[styles.tabText, localizacion === 'HUIZACHES' && styles.textWhite]}>LAS HUIZACHES</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, localizacion === 'CENTRO' && styles.tabActive]}
            onPress={() => setLocalizacion('CENTRO')}
          >
            <Text style={[styles.tabText, localizacion === 'CENTRO' && styles.textWhite]}>CENTRO</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridHalf}>
            <Text style={styles.label}>PRECIO VENTA *</Text>
            <TextInput style={styles.input} value={precioVenta} onChangeText={setPrecioVenta} keyboardType="numeric" />
          </View>
          <View style={[styles.gridHalf, { marginLeft: 10 }]}>
            <Text style={styles.label}>PRECIO COSTO</Text>
            <TextInput style={styles.input} value={precioCosto} onChangeText={setPrecioCosto} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>CANTIDAD EN STOCK *</Text>
        <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" />

        <View style={styles.auditBar}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={18} color="#7f8c8d" />
            <Text style={styles.auditText}>
              Registrado por: <Text style={{fontWeight: 'bold', color: '#333'}}>{datosOriginales?.registrado_por_nombre || 'Desconocido'}</Text>
            </Text>
          </View>
          
          {usuario?.rol === 'admin' && (
            <TouchableOpacity style={styles.btnVerHistorial} onPress={() => setModalHistorial(true)}>
              <Text style={styles.btnVerHistorialText}>Ver historial</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.saveBtn, procesando && { opacity: 0.5 }]} onPress={handleGuardar} disabled={procesando}>
          {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar Cambios</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleEliminar} disabled={procesando}>
          <Text style={{color: RED_DELETE, fontWeight: 'bold', fontSize: 15}}>Eliminar Producto</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* --- MODAL FLOTANTE DEL HISTORIAL DE CAMBIOS --- */}
      <Modal visible={modalHistorial} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Historial de Ediciones</Text>
              <TouchableOpacity onPress={() => setModalHistorial(false)}>
                <Ionicons name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              
              {/* HISTORIAL DE EDICIONES (Si las hay) */}
              {datosOriginales?.historial_cambios && datosOriginales.historial_cambios.length > 0 && (
                datosOriginales.historial_cambios.map((cambio: any, index: number) => (
                  <View key={index} style={styles.historialItem}>
                    <View style={styles.historialDotContainer}>
                      <View style={styles.historialDotBlue} />
                      <View style={styles.historialLine} />
                    </View>
                    <View style={{ flex: 1, paddingBottom: 15 }}>
                      <Text style={styles.historialUser}>{cambio.usuario} <Text style={{fontWeight: 'normal', color: '#64748b'}}>({cambio.rol})</Text></Text>
                      <Text style={styles.historialAccion}>✏️ {cambio.accion}</Text>
                      <Text style={styles.historialDate}>
                        {new Date(cambio.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              {/* EVENTO PRINCIPAL: CREACIÓN DEL PRODUCTO (Siempre hasta abajo) */}
              <View style={styles.historialItem}>
                <View style={styles.historialDotContainer}>
                  <View style={styles.historialDotGreen} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historialUser}>
                    {datosOriginales?.registrado_por_nombre || 'Desconocido'} <Text style={{fontWeight: 'normal', color: '#64748b'}}>(Creador)</Text>
                  </Text>
                  <Text style={styles.historialAccion}>✨ Creó el producto</Text>
                  <Text style={styles.historialDate}>
                    {datosOriginales?.creado_at 
                      ? new Date(datosOriginales.creado_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                      : 'Fecha desconocida'}
                  </Text>
                </View>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: Platform.OS === 'ios' ? 20 : 50, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    justifyContent: 'flex-start' 
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: '#333' },
  scrollContent: { padding: 20 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#7f8c8d', marginTop: 15, marginBottom: 5, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#e1e8ed', color: '#2c3e50', ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any) },
  imagePicker: { width: '100%', height: 180, backgroundColor: '#fff', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#bdc3c7', marginTop: 5, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  placeholderContainer: { alignItems: 'center' },
  placeholderText: { color: '#bdc3c7', marginTop: 10, fontSize: 12 },
  changeBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, alignItems: 'center' },
  changeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', marginLeft: 5 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center' },
  generateBtn: { backgroundColor: '#2ecc71', width: 55, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2, marginRight: 8 },
  printMiniBtn: { backgroundColor: LOGO_BLUE, width: 55, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  rowSelector: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  tab: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 2, borderWidth: 1, borderColor: '#e1e8ed', backgroundColor: '#fff' },
  tabActive: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  tabText: { fontWeight: 'bold', color: LOGO_BLUE, fontSize: 11 },
  textWhite: { color: '#fff' },
  gridRow: { flexDirection: 'row', marginTop: 5 },
  gridHalf: { flex: 1 },
  
  auditBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ff', padding: 15, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#d1d8dd', justifyContent: 'space-between' },
  auditText: { fontSize: 12, color: '#555', marginLeft: 8 },
  btnVerHistorial: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: LOGO_BLUE },
  btnVerHistorialText: { color: LOGO_BLUE, fontSize: 11, fontWeight: 'bold' },

  saveBtn: { backgroundColor: LOGO_BLUE, padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: RED_DELETE, backgroundColor: '#fff' },

  // ESTILOS DEL MODAL DE HISTORIAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 20, padding: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  
  historialItem: { flexDirection: 'row', alignItems: 'flex-start' },
  historialDotContainer: { alignItems: 'center', marginRight: 15, width: 10 },
  historialDotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: LOGO_BLUE, marginTop: 5 },
  historialDotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN_CREATE, marginTop: 5 },
  historialLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginTop: 5, minHeight: 40 },
  
  historialUser: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  historialAccion: { fontSize: 13, color: '#475569', marginTop: 2 },
  historialDate: { fontSize: 11, color: '#94a3b8', marginTop: 4 }
});