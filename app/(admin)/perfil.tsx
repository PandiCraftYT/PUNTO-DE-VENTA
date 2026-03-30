import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, Platform, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth_context';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router'; // Importamos el router para volver atrás

const LOGO_BLUE = '#0056FF';

export default function PerfilScreen() {
  const { usuario, setUsuario } = useAuth();
  const router = useRouter(); // Inicializamos el router
  const esAdmin = usuario?.rol === 'admin';

  // ESTADOS
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [numCuenta, setNumCuenta] = useState(usuario?.num_cuenta || '');
  const [pin, setPin] = useState(usuario?.pin || '');
  const [rol, setRol] = useState(usuario?.rol || '');
  const [activo, setActivo] = useState(usuario?.activo ? 'true' : 'false');

  const handleGuardar = async () => {
    if (!numCuenta || !pin || (esAdmin && !nombre)) {
      Alert.alert("Atención", "Los campos obligatorios no pueden estar vacíos.");
      return;
    }

    setLoading(true);
    try {
      const datosActualizados: any = {
        num_cuenta: numCuenta.trim(),
        pin: pin.trim(),
      };

      if (esAdmin) {
        datosActualizados.nombre = nombre.trim();
        datosActualizados.rol = rol.trim().toLowerCase();
        datosActualizados.activo = activo === 'true';
      }

      const { error, data } = await supabase
        .from('usuarios')
        .update(datosActualizados)
        .eq('id', usuario.id)
        .select()
        .single();

      if (error) throw error;

      setUsuario(data);
      setIsEditing(false);
      
      if (Platform.OS === 'web') window.alert("¡Cambios guardados!");
      else Alert.alert("Éxito", "Perfil actualizado.");

    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER MINIMALISTA CON BOTÓN ATRÁS */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        {/* Dejamos solo el título principal */}
        <Text style={styles.headerTitle}>MI PERFIL</Text>
        <View style={{ width: 40 }} /> {/* Espaciador para centrar el título */}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>

            {!isEditing ? (
              <>
                <Text style={styles.userName}>{usuario?.nombre || 'Usuario'}</Text>
                <Text style={styles.userRole}>
                  {usuario?.rol === 'admin' ? 'ADMINISTRADOR' : 'EMPLEADO'}
                </Text>
              </>
            ) : (
              <Text style={styles.editingText}>Editando información de cuenta</Text>
            )}
          </View>

          <View style={styles.headerTitleRow}>
            <Text style={styles.sectionTitle}>Datos Personales</Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text style={styles.editText}>Editar Datos</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoCard}>
            <EditableRow 
              icon="id-card-outline" label="Número de Cuenta" 
              value={numCuenta} onChangeText={setNumCuenta}
              isEditing={isEditing} editable={true} 
              keyboardType="numeric"
            />
            <View style={styles.divider} />

            <EditableRow 
              icon="key-outline" label="PIN de Acceso" 
              value={pin} onChangeText={setPin}
              isEditing={isEditing} editable={true}
              secureTextEntry={!isEditing}
              keyboardType="numeric"
            />
            <View style={styles.divider} />

            <EditableRow 
              icon="person-outline" label="Nombre" 
              value={nombre} onChangeText={setNombre}
              isEditing={isEditing} editable={esAdmin} 
            />
            <View style={styles.divider} />

            <EditableRow 
              icon="shield-checkmark-outline" label="Rol del Sistema" 
              value={rol} onChangeText={setRol}
              isEditing={isEditing} editable={esAdmin}
            />
          </View>

          {isEditing && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={[styles.btnAction, styles.btnCancel]} onPress={() => setIsEditing(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnAction, styles.btnSave]} onPress={handleGuardar}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EditableRow({ icon, label, value, onChangeText, isEditing, editable, secureTextEntry, keyboardType, valueColor = '#1e293b' }: any) {
  const canEdit = isEditing && editable;
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconBox}><Ionicons name={icon} size={20} color="#64748b" /></View>
      <View style={styles.textContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        {canEdit ? (
          <TextInput 
            style={[styles.editInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            value={value} onChangeText={onChangeText}
            secureTextEntry={secureTextEntry} keyboardType={keyboardType}
          />
        ) : (
          <Text style={[styles.infoValue, { color: valueColor }]}>
            {secureTextEntry ? '••••' : (value || 'N/A')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 45, 
    paddingBottom: 15, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  scrollContent: { padding: 20 },
  profileHeader: { alignItems: 'center', marginTop: 10, marginBottom: 25 },
  avatarContainer: { 
    width: 100, height: 100, borderRadius: 50, backgroundColor: LOGO_BLUE, 
    justifyContent: 'center', alignItems: 'center', elevation: 6, marginBottom: 15 
  },
  userName: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  userRole: { fontSize: 13, color: '#64748b', fontWeight: 'bold', letterSpacing: 1 },
  editingText: { fontSize: 14, color: '#f39c12', fontWeight: 'bold' },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
  editText: { color: LOGO_BLUE, fontWeight: 'bold' },
  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContainer: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#94a3b8' },
  infoValue: { fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 5 },
  editInput: { borderBottomWidth: 1, borderBottomColor: LOGO_BLUE, fontSize: 16, color: '#1e293b', paddingVertical: 5 },
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  btnAction: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9', marginRight: 10 },
  btnCancelText: { color: '#64748b', fontWeight: 'bold' },
  btnSave: { backgroundColor: LOGO_BLUE, marginLeft: 10 },
  btnSaveText: { color: '#fff', fontWeight: 'bold' },
});