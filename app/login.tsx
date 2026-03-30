import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from './lib/auth_context';

const LOGO_BLUE = '#0056FF';

export default function LoginScreen() {
  const router = useRouter();
  const { setUsuario } = useAuth();
  
  const [numCuenta, setNumCuenta] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // FUNCIÓN UNIVERSAL PARA ALERTAS (Web y Móvil)
  const mostrarAlerta = (titulo: string, mensaje: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${titulo}: ${mensaje}`);
    } else {
      Alert.alert(titulo, mensaje);
    }
  };

  const handleIngresar = async () => {
    // 1. VALIDACIÓN DE CAMPOS VACÍOS
    if (!numCuenta || !pin) {
      mostrarAlerta("Atención", "Ingresa tu número de cuenta y PIN.");
      return;
    }

    setLoading(true);

    try {
      // 2. CONSULTA A SUPABASE
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('num_cuenta', numCuenta.trim())
        .eq('pin', pin.trim())
        .eq('activo', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        mostrarAlerta("Error", "Número de cuenta o PIN incorrectos.");
        setLoading(false);
        return;
      }
      await supabase
        .from('usuarios')
        .update({ ultima_conexion: new Date().toISOString() })
        .eq('id', data.id);

      // 3. ÉXITO: GUARDAR SESIÓN Y NAVEGAR
      setUsuario(data);
      
      // Solo mostramos alerta de bienvenida en móvil para no ser tan intrusivos en web
      if (Platform.OS !== 'web') {
        mostrarAlerta("Bienvenido", `Hola, ${data.nombre}`);
      }
      
      router.replace('/(admin)');

    } catch (error: any) {
      console.error("Error de Login:", error);
      mostrarAlerta("Error de Conexión", "No se pudo conectar. Revisa tu internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? Keyboard.dismiss : undefined}>
          <View style={styles.container}>
            <View style={styles.content}>
              
              <Text style={styles.title}>Punto de Venta</Text>
              <Text style={styles.subtitle}>Panel de Administración y Ventas</Text>

              {/* INPUT: NÚMERO DE CUENTA */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>NÚMERO DE CUENTA</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.icon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="Numero de cuenta"
                    placeholderTextColor="#a0aec0"
                    keyboardType="numeric"
                    value={numCuenta}
                    onChangeText={setNumCuenta}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* INPUT: PIN */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PIN DE ACCESO</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.icon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="****"
                    placeholderTextColor="#a0aec0"
                    secureTextEntry
                    keyboardType="numeric"
                    value={pin}
                    onChangeText={setPin}
                  />
                </View>
              </View>

              {/* BOTÓN INGRESAR */}
              <TouchableOpacity 
                style={[styles.btn, loading && { opacity: 0.7 }]} 
                onPress={handleIngresar}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.btnText}>Ingresar al Sistema</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>

              {/* RECUPERAR CONTRASEÑA */}
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>¿Necesitas ayuda con tu acceso?</Text>
              </TouchableOpacity>
              
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#f6f7fb' 
  },
  container: { 
    flex: 1, 
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  content: { 
    backgroundColor: '#fff',
    padding: 30, 
    borderRadius: 24,
    maxWidth: 450, 
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5, 
  },
  title: { 
    fontSize: 24, 
    fontWeight: '900', 
    textAlign: 'center', 
    color: '#2d3748',
    letterSpacing: 1,
    marginTop: 10
  },
  subtitle: { 
    fontSize: 14, 
    color: '#718096', 
    textAlign: 'center', 
    marginBottom: 35,
    marginTop: 5
  },

  // INPUT STYLES
  inputGroup: { 
    marginBottom: 20 
  },
  label: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#718096', 
    marginBottom: 8, 
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
  },
  icon: {
    marginRight: 10
  },
  input: { 
    flex: 1,
    fontSize: 16, 
    color: '#2d3748',
    height: '100%',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any) 
  },

  // BUTTON STYLES
  btn: { 
    flexDirection: 'row',
    backgroundColor: LOGO_BLUE, 
    height: 55,
    borderRadius: 12, 
    justifyContent: 'center',
    alignItems: 'center', 
    marginTop: 15,
    shadowColor: LOGO_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  btnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },

  // FOOTER STYLES
  forgotBtn: { 
    marginTop: 25, 
    alignSelf: 'center',
    padding: 10
  },
  forgotText: { 
    color: '#a0aec0', 
    fontSize: 14, 
    fontWeight: '600'
  }
});