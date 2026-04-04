import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, Image, ActivityIndicator, Linking, Modal, Platform, TextInput, Alert, Clipboard, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

const LOGO_BLUE = '#0056FF';
const WHATSAPP_GREEN = '#25D366';

// El número de la tienda para recibir pedidos
const NUMERO_WHATSAPP = '526670000000'; 

export default function TiendaPublicaScreen() {
  const router = useRouter();
  const esEmpleado = router.canGoBack(); 

  const [cargando, setCargando] = useState(true);
  const [catalogoAgrupado, setCatalogoAgrupado] = useState<any>({});
  const [categoriasLista, setCategoriasLista] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // ESTADOS DEL CARRITO
  const [carrito, setCarrito] = useState<any[]>([]);
  const [modalCarrito, setModalCarrito] = useState(false);

  // ESTADOS DEL FORMULARIO DEL CLIENTE
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [fechaRecogida, setFechaRecogida] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  
  const [otraPersonaRecoge, setOtraPersonaRecoge] = useState(false);
  const [nombreOtraPersona, setNombreOtraPersona] = useState('');
  const [telefonoOtraPersona, setTelefonoOtraPersona] = useState('');

  // ESTADOS DE ERROR
  const [errores, setErrores] = useState({
    nombre: false, telefono: false, fecha: false, nombreOtra: false, telefonoOtra: false
  });

  useEffect(() => {
    cargarCatalogo();

    const canal = supabase
      .channel(`tienda-publica-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => {
        cargarCatalogo(false);
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, []);

  const cargarCatalogo = async (mostrarRueda = true) => {
    if (mostrarRueda) setCargando(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('categoria', { ascending: true })
        .order('nombre', { ascending: true });

      if (error) throw error;

      if (data) {
        const grupos: any = {};
        data.forEach(prod => {
          const cat = prod.categoria?.trim() || 'Otros';
          if (!grupos[cat]) grupos[cat] = [];
          grupos[cat].push(prod);
        });

        setCatalogoAgrupado(grupos);
        setCategoriasLista(Object.keys(grupos));
      }
    } catch (err) {
      console.log("Error al cargar catálogo:", err);
    } finally {
      setCargando(false);
    }
  };

  const getCatalogoFiltrado = () => {
    if (!busqueda.trim()) return { grupos: catalogoAgrupado, categorias: categoriasLista };

    const q = busqueda.toLowerCase();
    const gruposFiltrados: any = {};
    const categoriasActivas: string[] = [];

    categoriasLista.forEach(cat => {
      const filtrados = catalogoAgrupado[cat].filter((prod: any) =>
        prod.nombre.toLowerCase().includes(q)
      );
      if (filtrados.length > 0) {
        gruposFiltrados[cat] = filtrados;
        categoriasActivas.push(cat);
      }
    });

    return { grupos: gruposFiltrados, categorias: categoriasActivas };
  };

  const { grupos: catalogoA_Mostrar, categorias: categoriasAMostrar } = getCatalogoFiltrado();

  const agregarAlCarrito = (producto: any) => {
    if (producto.stock <= 0) return; 
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          if (Platform.OS === 'web') window.alert(`Solo quedan ${producto.stock} piezas.`);
          else Alert.alert("Stock máximo", `Solo quedan ${producto.stock} piezas.`);
          return prev;
        }
        return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const quitarDelCarrito = (id: string) => {
    setCarrito(prev => prev.filter(item => item.id !== id));
  };

  const calcularTotal = () => {
    return carrito.reduce((total, item) => total + (item.precio_venta * item.cantidad), 0);
  };

  // --- FUNCIÓN PARA FORMATEAR MONEDA CON COMAS ---
  const formatoMoneda = (valor: number) => {
    return '$' + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const compartirEnlace = async () => {
    const link = Platform.OS === 'web' ? window.location.href : 'https://puntoventa.charlystudio.org/catalogo';
    const mensaje = `🎮 *¡Hola! Checa nuestro catálogo digital de Punto de venta* 🎮\n\nMira todo nuestro inventario disponible, precios y haz tu pedido en línea súper rápido aquí:\n\n👉 ${link}`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Catálogo Punto de venta',
            text: mensaje,
            url: link
          });
        } catch (error) {
          console.log('Error al compartir', error);
        }
      } else {
        Clipboard.setString(mensaje);
        window.alert('¡Mensaje y enlace copiados! Ya puedes pegarlos en WhatsApp o Facebook.');
      }
    } else {
      try {
        await Share.share({ message: mensaje });
      } catch (error: any) {
        Alert.alert("Error", "No se pudo abrir el menú para compartir.");
      }
    }
  };

  const validarFormulario = () => {
    const nuevosErrores = {
      nombre: !nombreCliente.trim(),
      telefono: !telefonoCliente.trim(),
      fecha: !fechaRecogida.trim(),
      nombreOtra: otraPersonaRecoge && !nombreOtraPersona.trim(),
      telefonoOtra: otraPersonaRecoge && !telefonoOtraPersona.trim()
    };
    
    setErrores(nuevosErrores);
    return !Object.values(nuevosErrores).some(e => e === true);
  };

  const enviarPedidoWhatsApp = () => {
    if (carrito.length === 0) return;
    
    if (!validarFormulario()) {
      const errorMsg = "Por favor, completa los campos marcados en rojo obligatorios.";
      if (Platform.OS === 'web') window.alert(errorMsg);
      else Alert.alert("Datos incompletos", errorMsg);
      return;
    }

    let mensaje = `🛒 *NUEVO PEDIDO DE TIENDA VIRTUAL* 🛒\n\n`;
    
    mensaje += `*👤 DATOS DEL CLIENTE:*\n`;
    mensaje += `▪️ Nombre: ${nombreCliente}\n`;
    mensaje += `▪️ Teléfono: ${telefonoCliente}\n\n`;

    mensaje += `*📦 PRODUCTOS SOLICITADOS:*\n`;
    carrito.forEach(item => {
      // Aplicamos el formato con comas también en el ticket de WhatsApp
      mensaje += `• ${item.cantidad}x ${item.nombre} (${formatoMoneda(item.precio_venta * item.cantidad)})\n`;
    });
    
    mensaje += `\n💰 *Total a pagar:* ${formatoMoneda(calcularTotal())}\n`;
    mensaje += `💳 *Método de pago:* ${metodoPago}\n\n`;

    mensaje += `*🚚 DETALLES DE RECOLECCIÓN:*\n`;
    mensaje += `▪️ Cuándo pasará: ${fechaRecogida}\n`;
    
    if (otraPersonaRecoge) {
      mensaje += `▪️ *¿Quién recoge?:* Otra persona\n`;
      mensaje += `  - Nombre: ${nombreOtraPersona}\n`;
      mensaje += `  - Tel: ${telefonoOtraPersona}\n`;
    } else {
      mensaje += `▪️ *¿Quién recoge?:* El mismo cliente\n`;
    }

    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'web') window.alert("No se pudo abrir WhatsApp.");
      else Alert.alert("Error", "No se pudo abrir WhatsApp.");
    });
    
    setModalCarrito(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {esEmpleado && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
        )}
        
        <View style={styles.logoCircle}>
          <Ionicons name="game-controller" size={20} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>Punto de venta</Text>
        
        {esEmpleado ? (
          <TouchableOpacity onPress={compartirEnlace} style={styles.shareBtn}>
            <Ionicons name="share-social" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {cargando ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={LOGO_BLUE} />
          <Text style={{ marginTop: 10, color: '#94a3b8' }}>Cargando tienda...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrapper}>
            <Text style={styles.bienvenidaTxt}>Catálogo de Productos</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Buscar artículos..."
                placeholderTextColor="#94a3b8"
                value={busqueda}
                onChangeText={setBusqueda}
              />
            </View>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {categoriasAMostrar.length === 0 ? (
              <View style={styles.emptySearchContainer}>
                <Ionicons name="sad-outline" size={60} color="#cbd5e1" />
                <Text style={styles.emptySearchText}>No encontramos artículos.</Text>
              </View>
            ) : (
              categoriasAMostrar.map((categoria, index) => (
                <View key={index} style={styles.categoriaSection}>
                  <View style={styles.categoriaHeaderRow}>
                    <Text style={styles.categoriaTitulo}>{categoria}</Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 15 }}>
                    {catalogoA_Mostrar[categoria].map((prod: any) => {
                      const isAgotado = prod.stock <= 0;
                      const enCarrito = carrito.find(c => c.id === prod.id)?.cantidad || 0;

                      return (
                        <TouchableOpacity 
                          key={prod.id} 
                          style={[styles.productoCard, isAgotado && { opacity: 0.6 }]}
                          activeOpacity={0.8}
                          onPress={() => agregarAlCarrito(prod)}
                          disabled={isAgotado}
                        >
                          <View style={styles.imgWrapper}>
                            {prod.imagen_url ? (
                              <Image source={{ uri: prod.imagen_url }} style={styles.prodImg} resizeMode="cover" />
                            ) : (
                              <View style={styles.imgPlaceholder}>
                                <Ionicons name="image-outline" size={30} color="#cbd5e1" />
                              </View>
                            )}
                            {isAgotado && (
                              <View style={styles.badgeAgotado}><Text style={styles.badgeAgotadoTxt}>AGOTADO</Text></View>
                            )}
                            {enCarrito > 0 && (
                              <View style={styles.badgeCarrito}><Text style={styles.badgeCarritoTxt}>{enCarrito}</Text></View>
                            )}
                          </View>

                          <View style={styles.prodInfo}>
                            <Text style={styles.prodNombre} numberOfLines={2}>{prod.nombre}</Text>
                            <Text style={styles.prodStock}>{isAgotado ? 'Sin stock' : `Disponibles: ${prod.stock}`}</Text>
                            <View style={styles.precioRow}>
                              {/* Aplicamos el formato con comas aquí */}
                              <Text style={styles.prodPrecio}>{formatoMoneda(parseFloat(prod.precio_venta))}</Text>
                              {!isAgotado && (
                                <View style={styles.btnAgregarIcon}>
                                  <Ionicons name="add" size={18} color="#fff" />
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                </View>
              ))
            )}
            <View style={{ height: 120 }} />
          </ScrollView>
        </View>
      )}

      {carrito.length > 0 && (
        <TouchableOpacity style={styles.btnCarritoFlotante} onPress={() => setModalCarrito(true)}>
          <View style={styles.carritoFlotanteRow}>
            <View style={styles.carritoIconWrapper}>
              <Ionicons name="cart" size={24} color={LOGO_BLUE} />
              <View style={styles.carritoNotificacion}>
                <Text style={styles.carritoNotificacionTxt}>{carrito.reduce((t, i) => t + i.cantidad, 0)}</Text>
              </View>
            </View>
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={styles.carritoFlotanteTitle}>Completar Pedido</Text>
              {/* Formato de comas en el carrito flotante */}
              <Text style={styles.carritoFlotanteTotal}>{formatoMoneda(calcularTotal())}</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      <Modal visible={modalCarrito} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tu Pedido</Text>
              <TouchableOpacity onPress={() => setModalCarrito(false)}>
                <Ionicons name="close-circle" size={30} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              
              <View style={styles.seccionForm}>
                <Text style={styles.seccionTitulo}>Artículos Seleccionados</Text>
                {carrito.map(item => (
                  <View key={item.id} style={styles.carritoItem}>
                    
                    {item.imagen_url ? (
                      <Image source={{ uri: item.imagen_url }} style={styles.carritoItemImg} />
                    ) : (
                      <View style={[styles.carritoItemImg, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="image-outline" size={16} color="#cbd5e1" />
                      </View>
                    )}
                    
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.carritoItemNombre} numberOfLines={2}>{item.nombre}</Text>
                      <Text style={styles.carritoItemPrecio}>
                        {/* Formato de comas en el desglose del modal */}
                        <Text style={{fontWeight: '900'}}>{item.cantidad}x</Text> {formatoMoneda(item.precio_venta)} = {formatoMoneda(item.cantidad * item.precio_venta)}
                      </Text>
                    </View>
                    
                    <TouchableOpacity onPress={() => quitarDelCarrito(item.id)} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={22} color="#ff4757" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <View style={styles.carritoTotalRow}>
                  <Text style={styles.carritoTotalLabel}>Total:</Text>
                  {/* Formato de comas en el total a pagar */}
                  <Text style={styles.carritoTotalMonto}>{formatoMoneda(calcularTotal())}</Text>
                </View>
              </View>

              <View style={styles.seccionForm}>
                <Text style={styles.seccionTitulo}>Tus Datos Obligatorios</Text>
                
                <TextInput 
                  style={[styles.inputBox, errores.nombre && styles.inputError]} 
                  placeholder="Tu Nombre Completo *" 
                  placeholderTextColor="#a0aec0"
                  value={nombreCliente} 
                  onChangeText={setNombreCliente} 
                />
                {errores.nombre && <Text style={styles.errorText}>El nombre es obligatorio</Text>}

                <TextInput 
                  style={[styles.inputBox, errores.telefono && styles.inputError, {marginTop: 10}]} 
                  placeholder="Tu Teléfono (WhatsApp) *"
                  placeholderTextColor="#a0aec0" 
                  keyboardType="phone-pad" 
                  value={telefonoCliente} 
                  onChangeText={setTelefonoCliente} 
                />
                {errores.telefono && <Text style={styles.errorText}>El teléfono es obligatorio</Text>}
              </View>

              <View style={styles.seccionForm}>
                <Text style={styles.seccionTitulo}>Recolección en Tienda</Text>
                
                <TextInput 
                  style={[styles.inputBox, errores.fecha && styles.inputError]} 
                  placeholder="¿Cuándo pasarás? (Ej. Hoy a las 4 PM) *" 
                  placeholderTextColor="#a0aec0"
                  value={fechaRecogida} 
                  onChangeText={setFechaRecogida} 
                />
                {errores.fecha && <Text style={styles.errorText}>Dinos cuándo pasarás</Text>}
                
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setOtraPersonaRecoge(!otraPersonaRecoge)}>
                  <Ionicons name={otraPersonaRecoge ? "checkbox" : "square-outline"} size={24} color={LOGO_BLUE} />
                  <Text style={styles.checkboxText}>¿Alguien más pasará a recogerlo?</Text>
                </TouchableOpacity>

                {otraPersonaRecoge && (
                  <View style={styles.otraPersonaBox}>
                    <Text style={styles.labelSecundario}>Datos Obligatorios de quien recoge:</Text>
                    
                    <TextInput 
                      style={[styles.inputBox, errores.nombreOtra && styles.inputError, {backgroundColor: '#fff'}]} 
                      placeholder="Nombre de quien recoge *" 
                      placeholderTextColor="#a0aec0"
                      value={nombreOtraPersona} 
                      onChangeText={setNombreOtraPersona} 
                    />
                    {errores.nombreOtra && <Text style={styles.errorText}>Necesitamos el nombre de quien recoge</Text>}
                    
                    <TextInput 
                      style={[styles.inputBox, errores.telefonoOtra && styles.inputError, {backgroundColor: '#fff', marginTop: 10}]} 
                      placeholder="Teléfono de quien recoge *" 
                      placeholderTextColor="#a0aec0"
                      keyboardType="phone-pad" 
                      value={telefonoOtraPersona} 
                      onChangeText={setTelefonoOtraPersona} 
                    />
                    {errores.telefonoOtra && <Text style={styles.errorText}>Necesitamos su teléfono</Text>}
                  </View>
                )}
              </View>

              <View style={styles.seccionForm}>
                <Text style={styles.seccionTitulo}>¿Cómo vas a pagar en sucursal?</Text>
                <View style={styles.pagoRow}>
                  {['Efectivo', 'Tarjeta', 'Transferencia'].map((metodo) => (
                    <TouchableOpacity 
                      key={metodo} 
                      style={[styles.pagoBtn, metodoPago === metodo && styles.pagoBtnActivo]}
                      onPress={() => setMetodoPago(metodo)}
                    >
                      <Text style={[styles.pagoBtnText, metodoPago === metodo && {color: '#fff'}]}>{metodo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={{ paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <TouchableOpacity style={styles.btnWhatsapp} onPress={enviarPedidoWhatsApp}>
                <Ionicons name="paper-plane" size={20} color="#fff" />
                <Text style={styles.btnWhatsappText}>Enviar Pedido por WhatsApp</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 45, paddingBottom: 15, backgroundColor: LOGO_BLUE, elevation: 4 },
  backBtn: { padding: 5, marginRight: 10 },
  shareBtn: { padding: 5, marginLeft: 'auto' },
  logoCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  searchWrapper: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  bienvenidaTxt: { fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 15 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b' },
  emptySearchContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptySearchText: { fontSize: 16, color: '#94a3b8', marginTop: 15, textAlign: 'center' },

  scrollContent: { paddingLeft: 20 },
  categoriaSection: { marginBottom: 25 },
  categoriaHeaderRow: { marginBottom: 15 },
  categoriaTitulo: { fontSize: 16, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },

  productoCard: { width: 150, backgroundColor: '#fff', borderRadius: 16, marginRight: 15, padding: 10, elevation: 2 },
  imgWrapper: { width: '100%', height: 130, borderRadius: 12, backgroundColor: '#f8fafc', marginBottom: 10, overflow: 'hidden' },
  prodImg: { width: '100%', height: '100%' },
  imgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badgeAgotado: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(231, 76, 60, 0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeAgotadoTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
  badgeCarrito: { position: 'absolute', top: -5, right: -5, backgroundColor: '#2ecc71', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeCarritoTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  prodInfo: { flex: 1, justifyContent: 'space-between' },
  prodNombre: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  prodStock: { fontSize: 11, color: '#94a3b8', marginBottom: 8 },
  precioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prodPrecio: { fontSize: 16, fontWeight: '900', color: LOGO_BLUE },
  btnAgregarIcon: { backgroundColor: LOGO_BLUE, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  btnCarritoFlotante: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#1e293b', borderRadius: 20, padding: 15, elevation: 10 },
  carritoFlotanteRow: { flexDirection: 'row', alignItems: 'center' },
  carritoIconWrapper: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  carritoNotificacion: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ff4757', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  carritoNotificacionTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  carritoFlotanteTitle: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  carritoFlotanteTotal: { color: '#fff', fontSize: 20, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  
  seccionForm: { marginBottom: 25 },
  seccionTitulo: { fontSize: 13, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 12 },
  
  carritoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  carritoItemImg: { width: 45, height: 45, borderRadius: 8, backgroundColor: '#f8fafc' },
  carritoItemNombre: { fontSize: 14, fontWeight: '600', color: '#334155' },
  carritoItemPrecio: { fontSize: 13, color: LOGO_BLUE, marginTop: 4 },
  carritoTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, marginTop: 10 },
  carritoTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  carritoTotalMonto: { fontSize: 24, fontWeight: '900', color: LOGO_BLUE },

  inputBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#1e293b', ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any) },
  inputError: { borderColor: '#ff4757', backgroundColor: '#fff5f5' },
  errorText: { color: '#ff4757', fontSize: 12, fontWeight: 'bold', marginLeft: 5, marginTop: 4 },
  
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 5 },
  checkboxText: { marginLeft: 10, fontSize: 15, color: '#334155', fontWeight: '600' },
  otraPersonaBox: { backgroundColor: '#f0f5ff', padding: 15, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#dbeafe' },
  labelSecundario: { fontSize: 13, color: LOGO_BLUE, fontWeight: 'bold', marginBottom: 10 },

  pagoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pagoBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 4 },
  pagoBtnActivo: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  pagoBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },

  btnWhatsapp: { flexDirection: 'row', backgroundColor: WHATSAPP_GREEN, padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnWhatsappText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});