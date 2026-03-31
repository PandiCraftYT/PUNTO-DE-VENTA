import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, ScrollView, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth_context';

const LOGO_BLUE = '#0056FF';
const EXPENSE_RED = '#e74c3c';

export default function NuevoGastoScreen() {
  const router = useRouter();
  const { usuario } = useAuth();
  
  const [gastos, setGastos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Resúmenes
  const [totalMes, setTotalMes] = useState(0);
  const [totalMercancia, setTotalMercancia] = useState(0);
  const [totalLogistica, setTotalLogistica] = useState(0);

  // Estados del Formulario (Modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Logística'); // Mercancía, Logística, Operación, Otros
  const [sucursal, setSucursal] = useState('Centro');

  useEffect(() => {
    cargarGastos();
  }, []);

  const cargarGastos = async () => {
    setCargando(true);
    try {
      const fecha = new Date();
      const primerDiaMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const datosValidos = data || [];
      setGastos(datosValidos);

      let tMes = 0;
      let tMercancia = 0;
      let tLogistica = 0;

      datosValidos.forEach(gasto => {
        if (gasto.created_at >= primerDiaMes) {
          const valor = parseFloat(gasto.monto) || 0;
          tMes += valor;
          if (gasto.categoria === 'Mercancía') tMercancia += valor;
          if (gasto.categoria === 'Logística') tLogistica += valor;
        }
      });

      setTotalMes(tMes);
      setTotalMercancia(tMercancia);
      setTotalLogistica(tLogistica);

    } catch (error) {
      console.log(error);
    } finally {
      setCargando(false);
    }
  };

  const guardarGasto = async () => {
    if (!concepto || !monto) {
      Alert.alert('Faltan datos', 'El concepto y el monto son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      const { error } = await supabase.from('gastos').insert([{
        concepto,
        monto: parseFloat(monto),
        categoria,
        sucursal,
        registrado_por: usuario?.nombre || 'Admin'
      }]);

      if (error) throw error;
      
      setModalVisible(false);
      setConcepto(''); setMonto(''); setCategoria('Logística'); setSucursal('Centro');
      cargarGastos();
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar el gasto.');
    } finally {
      setGuardando(false);
    }
  };

  const getIconoCategoria = (cat: string) => {
    if (cat === 'Mercancía') return 'cube';
    if (cat === 'Logística') return 'bicycle';
    if (cat === 'Operación') return 'flash';
    return 'cash';
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SALIDAS DE DINERO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* BOTÓN NUEVO GASTO */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.btnNuevoGasto} onPress={() => setModalVisible(true)}>
            <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnNuevoGastoText}>Registrar Nuevo Gasto</Text>
          </TouchableOpacity>
        </View>

        {/* TARJETAS DE RESUMEN */}
        <View style={styles.resumenContainer}>
          <View style={styles.tarjetaPrincipal}>
            <Text style={styles.tarjetaLabel}>Total Gastado (Este Mes)</Text>
            <Text style={styles.tarjetaMonto}>${totalMes.toFixed(2)}</Text>
          </View>
          
          <View style={styles.tarjetasSecundariasRow}>
            <View style={styles.tarjetaSecundaria}>
              <View style={styles.iconoMini}><Ionicons name="cube" size={14} color="#3b82f6" /></View>
              <Text style={styles.tarjetaSecLabel}>Mercancía</Text>
              <Text style={styles.tarjetaSecMonto}>${totalMercancia.toFixed(2)}</Text>
            </View>
            <View style={styles.tarjetaSecundaria}>
              <View style={[styles.iconoMini, {backgroundColor: '#fef3c7'}]}><Ionicons name="bicycle" size={14} color="#d97706" /></View>
              <Text style={styles.tarjetaSecLabel}>Logística</Text>
              <Text style={styles.tarjetaSecMonto}>${totalLogistica.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* LISTA DE HISTORIAL */}
        <View style={styles.historialContainer}>
          <Text style={styles.historialTitulo}>Historial de Movimientos</Text>
          
          {cargando ? (
            <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 20 }} />
          ) : gastos.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={50} color="#cbd5e1" />
              <Text style={styles.emptyText}>No hay gastos registrados aún.</Text>
            </View>
          ) : (
            gastos.map((item) => (
              <View key={item.id} style={styles.gastoRow}>
                <View style={styles.gastoIcono}>
                  <Ionicons name={getIconoCategoria(item.categoria)} size={20} color="#64748b" />
                </View>
                <View style={styles.gastoInfo}>
                  <Text style={styles.gastoConcepto}>{item.concepto}</Text>
                  <Text style={styles.gastoDetalles}>
                    {new Date(item.created_at).toLocaleDateString('es-MX', {day: 'numeric', month: 'short'})} • {item.categoria} • {item.sucursal}
                  </Text>
                </View>
                <View>
                  <Text style={styles.gastoMonto}>-${parseFloat(item.monto).toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* MODAL REGISTRO DE GASTO */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Registrar Gasto</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Ej. Pago semana Repartidor Juan" 
              value={concepto} 
              onChangeText={setConcepto} 
            />
            
            <TextInput 
              style={[styles.input, { fontSize: 20, fontWeight: 'bold' }]} 
              placeholder="Monto ($)" 
              keyboardType="numeric" 
              value={monto} 
              onChangeText={setMonto} 
            />
            
            <Text style={styles.labelSection}>Categoría del Gasto</Text>
            <View style={styles.opcionesRow}>
              {['Logística', 'Mercancía', 'Operación', 'Otros'].map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.chip, categoria === cat && styles.chipActivo]}
                  onPress={() => setCategoria(cat)}
                >
                  <Text style={[styles.chipText, categoria === cat && styles.chipTextActivo]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelSection}>Sucursal de Origen</Text>
            <View style={styles.opcionesRow}>
              {['Centro', 'Huizaches'].map(suc => (
                <TouchableOpacity 
                  key={suc} 
                  style={[styles.chipSucursal, sucursal === suc && styles.chipSucursalActivo]}
                  onPress={() => setSucursal(suc)}
                >
                  <Text style={[styles.chipText, sucursal === suc && styles.chipTextActivo]}>{suc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, {backgroundColor: '#f1f5f9'}]} onPress={() => setModalVisible(false)}>
                <Text style={{color: '#64748b', fontWeight: 'bold'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, {backgroundColor: EXPENSE_RED}]} onPress={guardarGasto} disabled={guardando}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>{guardando ? 'Guardando...' : 'Guardar Gasto'}</Text>
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
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 50, paddingBottom: 20, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  backBtn: { padding: 5 },
  actionContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  btnNuevoGasto: { backgroundColor: '#1e293b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 12, elevation: 3 },
  btnNuevoGastoText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  resumenContainer: { paddingHorizontal: 20, marginBottom: 20 },
  tarjetaPrincipal: { backgroundColor: EXPENSE_RED, padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 10, elevation: 4 },
  tarjetaLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  tarjetaMonto: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 5 },
  tarjetasSecundariasRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tarjetaSecundaria: { flex: 0.48, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  iconoMini: { backgroundColor: '#dbeafe', width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  tarjetaSecLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  tarjetaSecMonto: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  historialContainer: { paddingHorizontal: 20 },
  historialTitulo: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 15 },
  gastoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  gastoIcono: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  gastoInfo: { flex: 1 },
  gastoConcepto: { fontSize: 15, fontWeight: 'bold', color: '#334155' },
  gastoDetalles: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  gastoMonto: { fontSize: 16, fontWeight: '900', color: EXPENSE_RED },
  empty: { alignItems: 'center', marginTop: 30 },
  emptyText: { color: '#94a3b8', marginTop: 15, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  labelSection: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 10, marginTop: 5 },
  opcionesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  chip: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActivo: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  chipSucursal: { flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center', paddingVertical: 10, borderRadius: 10, marginHorizontal: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  chipSucursalActivo: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  chipText: { color: '#64748b', fontWeight: 'bold', fontSize: 13 },
  chipTextActivo: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center', marginHorizontal: 5 }
});