import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  TextInput, Modal, ActivityIndicator, Alert, SafeAreaView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const LOGO_BLUE = '#0056FF';
const DANGER_RED = '#ff4757'; // Color rojo para el botón de despedir

export default function GestionUsuariosScreen() {
  const router = useRouter(); 
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // ESTADOS FORMULARIO
  const [userId, setUserId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [numCuenta, setNumCuenta] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  // --- ESCUCHA EN TIEMPO REAL (REALTIME) ---
  useEffect(() => {
    cargarUsuarios();

    const canal = supabase
      .channel('cambios-usuarios')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'usuarios' }, 
        (payload) => {
          cargarUsuarios(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const cargarUsuarios = async () => {
    try {
      if(usuarios.length === 0) setLoading(true); 
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('ultima_conexion', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error: any) {
      console.log("Error cargando usuarios:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearConexion = (fechaISO: string) => {
    if (!fechaISO) return "Desconectado";
    
    const ultima = new Date(fechaISO);
    const ahora = new Date();
    const diferenciaMs = ahora.getTime() - ultima.getTime();
    const segundos = Math.floor(diferenciaMs / 1000);

    if (segundos < 10) return "En línea";
    
    const esHoy = ultima.toDateString() === ahora.toDateString();
    return esHoy 
      ? `Hoy ${ultima.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
      : ultima.toLocaleDateString();
  };

  const abrirModal = (user: any = null) => {
    if (user) {
      setUserId(user.id);
      setNombre(user.nombre);
      // Aseguramos que se lean como string para el TextInput
      setNumCuenta(user.num_cuenta ? user.num_cuenta.toString() : '');
      setPin(user.pin ? user.pin.toString() : '');
      setRol(user.rol);
    } else {
      setUserId(null);
      setNombre('');
      setNumCuenta('');
      setPin('');
      setRol('empleado');
    }
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!nombre || !numCuenta || !pin) {
      Alert.alert("Faltan datos", "Todos los campos son obligatorios.");
      return;
    }
    setProcesando(true);
    try {
      // Nos aseguramos de enviar los datos limpios. 
      // NOTA: Si num_cuenta y pin son INTEGER en tu BD, usa parseInt(numCuenta.trim(), 10)
      const payload = { 
        nombre: nombre.trim(), 
        num_cuenta: numCuenta.trim(), 
        pin: pin.trim(), 
        rol: rol, 
        activo: true 
      };

      if (userId) {
        const { error } = await supabase.from('usuarios').update(payload).eq('id', userId);
        if (error) throw error;
      } else {
        // En Supabase v2, a menudo es mejor enviar el objeto directo si es uno solo
        const { error } = await supabase.from('usuarios').insert(payload);
        if (error) throw error;
      }
      
      setModalVisible(false);
    } catch (error: any) {
      console.log("Error detallado al guardar:", error); // Esto nos dirá si falló por una regla de BD (ej. num_cuenta duplicado)
      Alert.alert("Error al guardar", error.message || "Verifica que el número de cuenta no esté repetido.");
    } finally {
      setProcesando(false);
    }
  };

  // --- LÓGICA PARA ELIMINAR / DESPEDIR USUARIO ---
  const confirmarEliminar = () => {
    if (Platform.OS === 'web') {
      const seguro = window.confirm(`¿Estás seguro de que quieres eliminar a ${nombre}? Se le revocará el acceso de inmediato.`);
      if (seguro) handleEliminar();
    } else {
      Alert.alert(
        "Despedir Empleado",
        `¿Estás seguro de que quieres eliminar a ${nombre}? Se le revocará el acceso de inmediato.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, Eliminar", style: "destructive", onPress: handleEliminar }
        ]
      );
    }
  };

  const handleEliminar = async () => {
    if (!userId) return;
    setProcesando(true);
    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', userId);
      if (error) throw error;
      
      setModalVisible(false);
      if (Platform.OS === 'web') window.alert('Usuario eliminado correctamente.');
    } catch (error: any) {
      Alert.alert("Error al eliminar", error.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
            <Text style={styles.backText}>Atrás</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerSub}>ADMIN</Text>
            <Text style={styles.headerTitle}>CONTROL DE PERSONAL</Text>
          </View>
          <View style={{ width: 60 }} /> 
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={usuarios}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const status = formatearConexion(item.ultima_conexion);
              const isOnline = status === "En línea";

              return (
                <TouchableOpacity style={styles.userCard} onPress={() => abrirModal(item)}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarText}>{item.nombre.charAt(0)}</Text>
                    {isOnline && <View style={styles.onlineBadge} />}
                  </View>
                  
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.nombre}</Text>
                    <Text style={[styles.userStatus, isOnline && {color: '#2ecc71', fontWeight: 'bold'}]}>
                      {status}
                    </Text>
                    <Text style={styles.userSub}>ID: {item.num_cuenta} • {item.rol.toUpperCase()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity style={styles.fab} onPress={() => abrirModal()}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{userId ? 'Editar Usuario' : 'Nuevo Usuario'}</Text>
              <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
              <TextInput style={styles.input} value={numCuenta} onChangeText={setNumCuenta} placeholder="Cuenta" keyboardType="numeric" />
              <TextInput style={styles.input} value={pin} onChangeText={setPin} placeholder="PIN" keyboardType="numeric" maxLength={4} />
              
              <View style={styles.rolRow}>
                <TouchableOpacity style={[styles.rolBtn, rol === 'empleado' && styles.rolBtnActive]} onPress={() => setRol('empleado')}>
                   <Text style={[styles.rolBtnText, rol === 'empleado' && {color: '#fff'}]}>Empleado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rolBtn, rol === 'admin' && styles.rolBtnActive]} onPress={() => setRol('admin')}>
                   <Text style={[styles.rolBtnText, rol === 'admin' && {color: '#fff'}]}>Admin</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleGuardar}>
                {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>

              {/* --- BOTÓN ELIMINAR / DESPEDIR (SOLO SI SE ESTÁ EDITANDO) --- */}
              {userId && (
                <TouchableOpacity 
                  style={styles.deleteBtn} 
                  onPress={confirmarEliminar}
                  disabled={procesando}
                >
                  <Ionicons name="trash-outline" size={18} color={DANGER_RED} style={{marginRight: 5}} />
                  <Text style={styles.deleteBtnText}>Eliminar Acceso</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><Text>Cerrar</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15, 
    paddingTop: Platform.OS === 'ios' ? 10 : 45, 
    paddingBottom: 15, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    justifyContent: 'space-between',
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingRight: 10,
  },
  backText: { fontSize: 16, color: '#333', fontWeight: '600', marginLeft: 5 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerSub: { fontSize: 10, fontWeight: 'bold', color: LOGO_BLUE, letterSpacing: 1 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },

  listContent: { padding: 20, paddingBottom: 100 },
  userCard: { 
    flexDirection: 'row', backgroundColor: '#fff', padding: 18, 
    borderRadius: 20, alignItems: 'center', marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10
  },
  avatarMini: { width: 50, height: 50, borderRadius: 25, backgroundColor: LOGO_BLUE, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  onlineBadge: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#2ecc71', borderWidth: 2, borderColor: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  userStatus: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  userSub: { fontSize: 11, color: '#cbd5e1', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: LOGO_BLUE, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 25 },
  modalContent: { backgroundColor: '#fff', borderRadius: 30, padding: 30 },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16, marginBottom: 12, ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any) },
  rolRow: { flexDirection: 'row', marginBottom: 20 },
  rolBtn: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 5 },
  rolBtnActive: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  rolBtnText: { fontWeight: 'bold', color: '#64748b' },
  saveBtn: { backgroundColor: LOGO_BLUE, padding: 20, borderRadius: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // ESTILOS DEL BOTÓN ELIMINAR
  deleteBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, marginTop: 10, borderRadius: 15, borderWidth: 1, borderColor: '#fef2f2', backgroundColor: '#fffcfc' },
  deleteBtnText: { color: DANGER_RED, fontWeight: 'bold', fontSize: 15 },

  closeBtn: { marginTop: 20, alignItems: 'center' }
});