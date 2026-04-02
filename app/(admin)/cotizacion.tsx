import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TextInput, 
  FlatList, TouchableOpacity, Alert, Platform, Linking, ActivityIndicator, ScrollView, Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import { supabase } from '../lib/supabase';

const LOGO_BLUE = '#0056FF';
const WHATSAPP_GREEN = '#25D366';

export default function CotizacionScreen() {
  const router = useRouter();

  const [cliente, setCliente] = useState('');
  const [items, setItems] = useState<any[]>([]);

  // ESTADOS PARA LA BASE DE DATOS Y EL BUSCADOR
  const [catalogoBD, setCatalogoBD] = useState<any[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [modalBusqueda, setModalBusqueda] = useState({ visible: false, tipo: 'servicio' });
  const [queryBusqueda, setQueryBusqueda] = useState('');

  useEffect(() => {
    cargarCatalogoCompleto();
  }, []);

  const cargarCatalogoCompleto = async () => {
    setCargandoCatalogo(true);
    try {
      // Traemos TODO el inventario y servicios de una vez para que la búsqueda sea instantánea
      const { data, error } = await supabase
        .from('productos')
        .select('id, nombre, precio_venta, categoria, stock')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setCatalogoBD(data || []);
    } catch (error) {
      console.log("Error al cargar catálogo:", error);
    } finally {
      setCargandoCatalogo(false);
    }
  };

  // Cuando se selecciona algo en el buscador, se AGREGA DIRECTO a la cotización
  const seleccionarDesdeBuscador = (item: any) => {
    const nuevoItem = {
      id: Date.now().toString() + Math.random().toString(), // ID único por si agregan el mismo varias veces
      descripcion: item.nombre,
      precio: parseFloat(item.precio_venta) || 0
    };

    setItems([...items, nuevoItem]);
    setModalBusqueda({ visible: false, tipo: 'servicio' });
    setQueryBusqueda('');
  };

  const eliminarItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calcularTotal = () => {
    return items.reduce((acc, item) => acc + item.precio, 0);
  };

  const enviarWhatsApp = () => {
    if (items.length === 0) {
      Alert.alert("Cotización vacía", "Agrega al menos un servicio o producto.");
      return;
    }

    let mensaje = `🎮 *Punto de venta* 🎮\n*COTIZACIÓN DE SERVICIO / PRODUCTOS*\n\n`;
    if (cliente) mensaje += `👤 *Cliente:* ${cliente}\n`;
    mensaje += `📅 *Fecha:* ${new Date().toLocaleDateString('es-MX')}\n\n`;
    mensaje += `*Detalles del presupuesto:*\n`;
    
    items.forEach(item => {
      mensaje += `▪️ ${item.descripcion} - $${item.precio.toFixed(2)}\n`;
    });

    mensaje += `\n💰 *Total Estimado: $${calcularTotal().toFixed(2)}*\n\n`;
    mensaje += `_Nota: Precios sujetos a revisión física y disponibilidad de stock._\n`;
    mensaje += `📍 *¡Estamos a la orden!*`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir WhatsApp."));
  };

  const imprimirCotizacion = async () => {
    if (items.length === 0) {
      Alert.alert("Cotización vacía", "Agrega al menos un servicio o producto.");
      return;
    }

    let filasHtml = '';
    items.forEach(item => {
      filasHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.descripcion}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.precio.toFixed(2)}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; }
            .title { font-size: 28px; font-weight: 900; color: ${LOGO_BLUE}; margin: 0; }
            .subtitle { font-size: 16px; color: #666; letter-spacing: 2px; }
            .info { margin-bottom: 30px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; padding: 10px; background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; }
            .total-row { font-size: 20px; font-weight: bold; color: ${LOGO_BLUE}; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">punto de venta</h1>
            <div class="subtitle">COTIZACIÓN DE SERVICIO</div>
          </div>
          
          <div class="info">
            <strong>Cliente:</strong> ${cliente || 'Mostrador'}<br>
            <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}
          </div>

          <table>
            <thead>
              <tr>
                <th>DESCRIPCIÓN</th>
                <th style="text-align: right;">PRECIO ESTIMADO</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div style="text-align: right;" class="total-row">
            TOTAL ESTIMADO: $${calcularTotal().toFixed(2)}
          </div>

          <div class="footer">
            * Los precios cotizados pueden variar dependiendo de la revisión física profunda del equipo.<br>
            ¡Gracias por tu preferencia!
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 500); };
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
      Alert.alert("Error", "No se pudo generar el documento.");
    }
  };

  // Lógica para filtrar el modal en tiempo real
  const datosFiltradosModal = catalogoBD.filter(item => {
    const coincideTipo = modalBusqueda.tipo === 'servicio' ? item.categoria === 'SERVICIO' : item.categoria !== 'SERVICIO';
    const coincideTexto = item.nombre.toLowerCase().includes(queryBusqueda.toLowerCase());
    return coincideTipo && coincideTexto;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSimple}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NUEVA COTIZACIÓN</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* DATOS DEL CLIENTE */}
        <View style={styles.card}>
          <Text style={styles.label}>NOMBRE DEL CLIENTE (Opcional)</Text>
          <TextInput
            style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Ej. Juan Pérez"
            placeholderTextColor="#a0aec0"
            value={cliente}
            onChangeText={setCliente}
          />
        </View>

        {/* BARRAS DE BÚSQUEDA INTELIGENTES */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>AGREGAR A LA COTIZACIÓN</Text>

          <TouchableOpacity 
            style={styles.fakeSearchBar} 
            onPress={() => setModalBusqueda({ visible: true, tipo: 'servicio' })}
          >
            <Ionicons name="search" size={20} color={LOGO_BLUE} style={{ marginRight: 10 }} />
            <Text style={styles.fakeSearchText}>Buscar Servicios (Ej. Limpieza, HDMI)...</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.fakeSearchBar, { marginTop: 10 }]} 
            onPress={() => setModalBusqueda({ visible: true, tipo: 'inventario' })}
          >
            <Ionicons name="search" size={20} color="#2ecc71" style={{ marginRight: 10 }} />
            <Text style={styles.fakeSearchText}>Buscar Productos o Consolas...</Text>
          </TouchableOpacity>
        </View>

        {/* LISTA DE COTIZACIÓN */}
        <Text style={styles.sectionTitle}>DETALLE DE LA COTIZACIÓN</Text>
        <View style={{ paddingBottom: 100 }}>
          {items.length === 0 ? (
             <Text style={styles.emptyText}>Agrega servicios para armar la cotización.</Text>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDesc}>{item.descripcion}</Text>
                  <Text style={styles.itemPrecio}>${item.precio.toFixed(2)}</Text>
                </View>
                <TouchableOpacity onPress={() => eliminarItem(item.id)}>
                  <Ionicons name="trash-outline" size={22} color="#ff4757" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* FOOTER TOTAL Y BOTONES */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL ESTIMADO</Text>
          <Text style={styles.totalAmount}>${calcularTotal().toFixed(2)}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.btnAction, { backgroundColor: WHATSAPP_GREEN }]} onPress={enviarWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnActionText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btnAction, { backgroundColor: LOGO_BLUE, marginLeft: 10 }]} onPress={imprimirCotizacion}>
            <Ionicons name="print" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnActionText}>Imprimir / PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL DE BÚSQUEDA DE PANTALLA COMPLETA */}
      <Modal visible={modalBusqueda.visible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
          
          <View style={styles.modalSearchHeader}>
            <TouchableOpacity onPress={() => setModalBusqueda({ ...modalBusqueda, visible: false })} style={{ padding: 5 }}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {modalBusqueda.tipo === 'servicio' ? 'BUSCAR SERVICIOS' : 'BUSCAR INVENTARIO'}
            </Text>
            <View style={{ width: 30 }} />
          </View>

          <View style={styles.searchBarReal}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              style={[styles.searchInputReal, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder={`Buscar ${modalBusqueda.tipo === 'servicio' ? 'servicio' : 'producto'}...`}
              value={queryBusqueda}
              onChangeText={setQueryBusqueda}
              autoFocus={true}
            />
            {queryBusqueda.length > 0 && (
              <TouchableOpacity onPress={() => setQueryBusqueda('')}>
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {cargandoCatalogo ? (
            <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={datosFiltradosModal}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 15 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No se encontraron resultados.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultItem} onPress={() => seleccionarDesdeBuscador(item)}>
                  <View style={styles.searchResultIcon}>
                    <Ionicons name={modalBusqueda.tipo === 'servicio' ? 'build' : 'cube'} size={20} color={modalBusqueda.tipo === 'servicio' ? LOGO_BLUE : '#2ecc71'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{item.nombre}</Text>
                    <Text style={styles.searchResultCat}>
                      {item.categoria} {modalBusqueda.tipo === 'inventario' && `• Stock: ${item.stock}`}
                    </Text>
                  </View>
                  <Text style={styles.searchResultPrice}>${parseFloat(item.precio_venta).toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#cbd5e1" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
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
  content: { flex: 1, padding: 15 },
  
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#7f8c8d', marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#1e293b' },
  
  // ESTILOS BARRAS DE BÚSQUEDA FALSAS
  fakeSearchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  fakeSearchText: { color: '#64748b', fontSize: 14, fontWeight: '500' },

  // ESTILOS MODAL BÚSQUEDA REAL
  modalSearchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 10 : 15, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchBarReal: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, paddingHorizontal: 15, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, borderWidth: 1, borderColor: '#f1f5f9' },
  searchInputReal: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1e293b', marginLeft: 10 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  searchResultIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  searchResultName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  searchResultCat: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  searchResultPrice: { fontSize: 15, fontWeight: '900', color: LOGO_BLUE },

  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 10, letterSpacing: 1 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 20 },
  
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  itemDesc: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  itemPrecio: { fontSize: 14, color: LOGO_BLUE, fontWeight: 'bold', marginTop: 4 },
  
  footer: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: -5 } },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  totalAmount: { fontSize: 28, fontWeight: '900', color: '#1e293b' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btnAction: { flex: 1, flexDirection: 'row', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnActionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});