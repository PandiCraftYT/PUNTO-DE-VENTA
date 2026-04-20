import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  TextInput, Modal, ActivityIndicator, Alert, SafeAreaView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router'; 
import { useAuth } from '../lib/auth_context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const LOGO_BLUE = '#0056FF';
const DANGER_RED = '#ff4757';

export default function GestionUsuariosScreen() {
  const router = useRouter(); 
  const { usuario: adminLogueado } = useAuth(); // Obtenemos el usuario actual
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

  useEffect(() => {
    cargarUsuarios();

    const canal = supabase
      .channel('cambios-usuarios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => {
          cargarUsuarios(); 
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
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
    if (!fechaISO) return "Sin actividad";
    const ultima = new Date(fechaISO);
    const ahora = new Date();
    const segundos = Math.floor((ahora.getTime() - ultima.getTime()) / 1000);

    if (segundos < 15) return "En línea";
    const esHoy = ultima.toDateString() === ahora.toDateString();
    return esHoy 
      ? `Hoy ${ultima.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
      : ultima.toLocaleDateString();
  };

  const abrirModal = (user: any = null) => {
    if (user) {
      setUserId(user.id);
      setNombre(user.nombre);
      setNumCuenta(user.num_cuenta?.toString() || '');
      setPin(user.pin?.toString() || '');
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
        const { error } = await supabase.from('usuarios').insert(payload);
        if (error) throw error;
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert("Error", "Verifica que el número de cuenta no esté repetido.");
    } finally {
      setProcesando(false);
    }
  };

  const confirmarEliminar = () => {
    // Seguridad: No permitir que el admin se borre a sí mismo
    if (userId === adminLogueado?.id) {
      Alert.alert("Acción no permitida", "No puedes eliminar tu propia cuenta de administrador desde aquí.");
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Revocar acceso a ${nombre}?`)) handleEliminar();
    } else {
      Alert.alert("Despedir Empleado", `¿Revocar acceso de inmediato a ${nombre}?`, [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar Acceso", style: "destructive", onPress: handleEliminar }
      ]);
    }
  };

  const handleEliminar = async () => {
    setProcesando(true);
    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', userId);
      if (error) throw error;
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert("Error al eliminar", "Este usuario tiene registros de ventas y no puede ser borrado (puedes desactivarlo en su lugar).");
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
            <Text style={styles.headerTitle}>GESTIÓN DE PERSONAL</Text>
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
                    <Text style={styles.avatarText}>{item.nombre.charAt(0).toUpperCase()}</Text>
                    {isOnline && <View style={styles.onlineBadge} />}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.nombre}</Text>
                    <Text style={[styles.userStatus, isOnline && {color: '#2ecc71', fontWeight: 'bold'}]}>{status}</Text>
                    <Text style={styles.userSub}>ID: {item.num_cuenta} • {item.rol.toUpperCase()}</Text>
                  </View>
                  <Ionicons name="pencil-outline" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity style={styles.fab} onPress={() => abrirModal()}>
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>

        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{userId ? 'Editar Cuenta' : 'Nuevo Acceso'}</Text>
              <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del empleado" placeholderTextColor="#94a3b8"/>
              <TextInput style={styles.input} value={numCuenta} onChangeText={setNumCuenta} placeholder="ID de Usuario / Cuenta" keyboardType="default" placeholderTextColor="#94a3b8"/>
              <TextInput style={styles.input} value={pin} onChangeText={setPin} placeholder="PIN / Contraseña" secureTextEntry keyboardType="default" placeholderTextColor="#94a3b8"/>
              
              <View style={styles.rolRow}>
                {['empleado', 'admin'].map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.rolBtn, rol === r && styles.rolBtnActive]} 
                    onPress={() => setRol(r)}
                  >
                     <Text style={[styles.rolBtnText, rol === r && {color: '#fff'}]}>
                       {r.charAt(0).toUpperCase() + r.slice(1)}
                     </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleGuardar} disabled={procesando}>
                {procesando ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar Cambios</Text>}
              </TouchableOpacity>

              {userId && userId !== adminLogueado?.id && (
                <TouchableOpacity style={styles.deleteBtn} onPress={confirmarEliminar} disabled={procesando}>
                  <Text style={styles.deleteBtnText}>Eliminar Usuario</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={{color: '#94a3b8', fontWeight: 'bold'}}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 10 : 45, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 15, color: '#333', fontWeight: '600', marginLeft: 5 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  listContent: { padding: 15, paddingBottom: 100 },
  userCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 10, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  avatarMini: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: LOGO_BLUE, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#2ecc71', borderWidth: 2, borderColor: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  userStatus: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  userSub: { fontSize: 10, color: '#64748b', marginTop: 2, textTransform: 'uppercase' },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: LOGO_BLUE, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20, textAlign: 'center', color: '#1e293b' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, marginBottom: 10 },
  rolRow: { flexDirection: 'row', marginBottom: 20 },
  rolBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 5 },
  rolBtnActive: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  rolBtnText: { fontWeight: 'bold', color: '#64748b', fontSize: 13 },
  saveBtn: { backgroundColor: LOGO_BLUE, padding: 16, borderRadius: 12, alignItems: 'center', elevation: 2 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  deleteBtn: { padding: 12, marginTop: 10, borderRadius: 12, alignItems: 'center' },
  deleteBtnText: { color: DANGER_RED, fontWeight: 'bold', fontSize: 14 },
  closeBtn: { marginTop: 15, alignItems: 'center' }
});