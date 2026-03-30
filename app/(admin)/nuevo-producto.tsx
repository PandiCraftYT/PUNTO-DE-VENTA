import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

import FooterNav from '../../components/FooterNav';

const LOGO_BLUE = '#0056FF';

export default function NuevoProductoScreen() {
  const router = useRouter();
  const { usuario } = useAuth();

  // ESTADOS DEL FORMULARIO
  const [codigoBarras, setCodigoBarras] = useState(''); 
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [localizacion, setLocalizacion] = useState('HUIZACHES'); 
  const [precioVenta, setPrecioVenta] = useState('');
  const [precioCosto, setPrecioCosto] = useState('');
  const [stock, setStock] = useState('1');
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(false);
  
  // ESTADOS PARA EL DESPLEGABLE DE CATEGORÍAS
  const [categoriasGuardadas, setCategoriasGuardadas] = useState<string[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [modoEscribirCategoria, setModoEscribirCategoria] = useState(false);

  useEffect(() => {
    cargarCategoriasExistentes();
  }, []);

  const cargarCategoriasExistentes = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('categoria');
      if (error) throw error;
      if (data) {
        const categoriasUnicas = [...new Set(data.map(item => item.categoria?.trim()).filter(Boolean))];
        setCategoriasGuardadas(categoriasUnicas as string[]);
      }
    } catch (error) {
      console.log("Error al cargar categorías:", error);
    }
  };

  const generarCodigo = () => {
    if (!nombre || !precioVenta || !stock) {
      const msj = "Por favor, llena primero el Nombre, Precio Venta y Stock para generar el código.";
      if (Platform.OS === 'web') window.alert(msj);
      else Alert.alert("Faltan datos", msj);
      return;
    }

    const randomCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    setCodigoBarras(randomCode);
  };

  const imprimirEtiqueta = () => {
    if (!codigoBarras || !nombre || !precioVenta) {
      Alert.alert("Atención", "Llena primero el nombre, precio y código para imprimir la etiqueta.");
      return;
    }

    if (Platform.OS === 'web') {
      const ventana = window.open('', '_blank');
      if(ventana) {
        ventana.document.write(`
          <html>
            <head>
              <title>Etiqueta - ${nombre}</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .ticket { border: 2px dashed #000; padding: 20px; display: inline-block; border-radius: 10px; }
                .price { font-size: 24px; font-weight: bold; margin: 10px 0; }
                .title { font-size: 16px; margin-bottom: 10px; text-transform: uppercase; }
              </style>
            </head>
            <body>
              <div class="ticket">
                <div class="title">GS GAMES SALE</div>
                <div><strong>${nombre}</strong></div>
                <div class="price">$${precioVenta}</div>
                <svg id="barcode"></svg>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
                <script>
                  JsBarcode("#barcode", "${codigoBarras}", {
                    format: "CODE128",
                    width: 2,
                    height: 50,
                    displayValue: true
                  });
                  setTimeout(() => { window.print(); }, 500);
                </script>
              </div>
            </body>
          </html>
        `);
        ventana.document.close();
      }
    } else {
      Alert.alert("Aviso", "Para imprimir directamente necesitas estar en la computadora.");
    }
  };

  const ejecutarGuardado = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('productos')
        .insert([
          {
            codigo_barras: codigoBarras.trim() || null, 
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            localizacion: localizacion,
            precio_venta: parseFloat(precioVenta),
            precio_costo: parseFloat(precioCosto) || 0,
            stock: parseInt(stock),
            categoria: categoria.trim() || 'General', 
            registrado_por_nombre: usuario?.nombre || 'Admin GS',
            registrado_por_cuenta: usuario?.num_cuenta || '9999',
            creado_at: new Date()
          }
        ]);

      if (error) throw error;
      
      if (Platform.OS === 'web') window.alert("Producto registrado correctamente.");
      else Alert.alert("Éxito", "Producto registrado correctamente.");
      
      router.back();
    } catch (error: any) {
      if (Platform.OS === 'web') window.alert("Error: " + error.message);
      else Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = () => {
    if (!nombre || !precioVenta || !stock) {
      const msj = "Nombre, Precio Venta y Stock son obligatorios.";
      if (Platform.OS === 'web') window.alert(msj);
      else Alert.alert("Atención", msj);
      return;
    }

    if (!codigoBarras || codigoBarras.trim() === '') {
      if (Platform.OS === 'web') {
        const confirmar = window.confirm("¿Estás seguro de que NO quieres generar o ingresar un código de barras para este producto?");
        if (confirmar) {
          ejecutarGuardado(); 
        }
      } else {
        Alert.alert(
          "Falta Código de Barras",
          "¿Estás seguro de que NO quieres generar un código de barras para este producto?",
          [
            { text: "No, regresar", style: "cancel" }, 
            { text: "Sí, guardar", onPress: ejecutarGuardado } 
          ]
        );
      }
    } else {
      ejecutarGuardado();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* CABECERA LIMPIA (SIN CUADRO GRIS EN EL BOTÓN) */}
      <View style={styles.headerSimplificado}>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backTextSimple}>Atrás</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          
          <Text style={styles.label}>IMAGEN DEL PRODUCTO</Text>
          <TouchableOpacity style={styles.imagePlaceholder}>
            <Ionicons name="camera-outline" size={40} color="#ccc" />
            <Text style={styles.imageText}>Toca para añadir foto</Text>
          </TouchableOpacity>

          <Text style={styles.label}>CÓDIGO DE BARRAS / SKU</Text>
          <View style={styles.rowWrapper}>
            <TextInput 
              style={[styles.input, { flex: 1, marginRight: 10 }]} 
              placeholder="Pistola escáner o automático..." 
              value={codigoBarras} 
              onChangeText={setCodigoBarras} 
            />
            {/* BOTÓN GENERAR CÓDIGO (VERDE) */}
            <TouchableOpacity style={styles.generateBtn} onPress={generarCodigo}>
              <Ionicons name="barcode-outline" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* BOTÓN IMPRIMIR ETIQUETA (AZUL) */}
            <TouchableOpacity style={styles.printBtnBlue} onPress={imprimirEtiqueta}>
              <Ionicons name="print" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>NOMBRE DEL ARTÍCULO *</Text>
          <TextInput style={styles.input} placeholder="Ej: Nintendo Switch" value={nombre} onChangeText={setNombre} />

          <Text style={styles.label}>DESCRIPCIÓN (OPCIONAL)</Text>
          <TextInput style={[styles.input, { height: 80 }]} placeholder="Detalles..." multiline value={descripcion} onChangeText={setDescripcion} />

          <Text style={styles.label}>LOCALIZACIÓN / TIENDA</Text>
          <View style={styles.rowSelector}>
            <TouchableOpacity 
              style={[styles.tabSelector, localizacion === 'HUIZACHES' && styles.tabSelectorActive]}
              onPress={() => setLocalizacion('HUIZACHES')}
            >
              <Text style={[styles.tabSelectorText, localizacion === 'HUIZACHES' && styles.textWhite]}>LAS HUIZACHES</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabSelector, localizacion === 'CENTRO' && styles.tabSelectorActive]}
              onPress={() => setLocalizacion('CENTRO')}
            >
              <Text style={[styles.tabSelectorText, localizacion === 'CENTRO' && styles.textWhite]}>CENTRO</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridHalf}>
              <Text style={styles.label}>PRECIO VENTA *</Text>
              <TextInput style={styles.input} placeholder="$0.00" keyboardType="numeric" value={precioVenta} onChangeText={setPrecioVenta} />
            </View>
            <View style={[styles.gridHalf, { marginLeft: 10 }]}>
              <Text style={styles.label}>PRECIO COSTO</Text>
              <TextInput style={styles.input} placeholder="$0.00" keyboardType="numeric" value={precioCosto} onChangeText={setPrecioCosto} />
            </View>
          </View>

          <Text style={styles.label}>CANTIDAD EN STOCK *</Text>
          <TextInput style={styles.input} placeholder="1" keyboardType="numeric" value={stock} onChangeText={setStock} />

          <Text style={styles.label}>CATEGORÍA</Text>
          
          {!modoEscribirCategoria ? (
            <View style={{ zIndex: 10 }}>
              <TouchableOpacity 
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                onPress={() => setMostrarDropdown(!mostrarDropdown)}
                activeOpacity={0.8}
              >
                <Text style={{ color: categoria ? '#2c3e50' : '#a0aec0', fontSize: 16 }}>
                  {categoria || "Selecciona una categoría..."}
                </Text>
                <Ionicons name={mostrarDropdown ? "chevron-up" : "chevron-down"} size={20} color="#999" />
              </TouchableOpacity>

              {mostrarDropdown && (
                <View style={styles.dropdownContainer}>
                  {categoriasGuardadas.length > 0 ? (
                    categoriasGuardadas.map((cat, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.dropdownItem}
                        onPress={() => {
                          setCategoria(cat);
                          setMostrarDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{cat}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.dropdownItem}>
                      <Text style={{color: '#999', fontStyle: 'italic'}}>No hay categorías registradas</Text>
                    </View>
                  )}

                  <TouchableOpacity 
                    style={styles.dropdownAddBtn}
                    onPress={() => {
                      setModoEscribirCategoria(true);
                      setMostrarDropdown(false);
                      setCategoria(''); 
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={LOGO_BLUE} />
                    <Text style={styles.dropdownAddText}>Agregar nueva categoría</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.rowWrapper}>
              <TextInput 
                style={[styles.input, { flex: 1, marginRight: 10 }]} 
                placeholder="Escribe la nueva categoría..." 
                value={categoria} 
                onChangeText={setCategoria} 
                autoFocus={true} 
              />
              <TouchableOpacity 
                style={styles.cancelarBtn}
                onPress={() => {
                  setModoEscribirCategoria(false);
                  setCategoria(''); 
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* BOTÓN GUARDAR */}
          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleGuardar} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" style={{marginRight: 10}} />
                <Text style={styles.saveBtnText}>Guardar Producto</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 120 }} /> 
        </ScrollView>
      </KeyboardAvoidingView>

      <FooterNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  headerSimplificado: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15, 
    paddingTop: Platform.OS === 'ios' ? 10 : 40, 
    paddingBottom: 10, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    justifyContent: 'flex-start',
  },
  backButtonSimple: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 0, 
    paddingRight: 10,
  },
  backTextSimple: { fontSize: 16, color: '#333', fontWeight: '600', marginLeft: 8 },
  scrollContent: { padding: 20 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#7f8c8d', marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#e1e8ed', color: '#2c3e50', ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any) },
  imagePlaceholder: { width: '100%', height: 180, backgroundColor: '#fff', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#bdc3c7' },
  imageText: { color: '#bdc3c7', marginTop: 10, fontSize: 12 },
  
  rowWrapper: { flexDirection: 'row', alignItems: 'center' },
  generateBtn: { backgroundColor: '#2ecc71', width: 55, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  // NUEVO ESTILO DEL BOTÓN DE IMPRIMIR AZUL
  printBtnBlue: { backgroundColor: LOGO_BLUE, width: 55, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2, marginLeft: 10 },
  cancelarBtn: { backgroundColor: '#ff4757', width: 55, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },

  dropdownContainer: { backgroundColor: '#fff', borderRadius: 12, marginTop: 5, borderWidth: 1, borderColor: '#e1e8ed', overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { fontSize: 16, color: '#334155', fontWeight: '500' },
  dropdownAddBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc' },
  dropdownAddText: { color: LOGO_BLUE, fontSize: 15, fontWeight: 'bold', marginLeft: 8 },

  rowSelector: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  tabSelector: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 2, borderWidth: 1, borderColor: '#e1e8ed' },
  tabSelectorActive: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  tabSelectorText: { fontWeight: 'bold', color: LOGO_BLUE, fontSize: 12 },
  textWhite: { color: '#fff' },
  gridRow: { flexDirection: 'row', marginTop: 5 },
  gridHalf: { flex: 1 },
  saveBtn: { backgroundColor: LOGO_BLUE, flexDirection: 'row', padding: 18, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});